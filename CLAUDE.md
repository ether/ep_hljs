# Claude Code Guidelines for `ep_hljs`

Whole-pad syntax highlighting for Etherpad, powered by highlight.js, painted via the **CSS Custom Highlights API**. This file is the architectural reference for anyone (Claude or human) extending the plugin.

## Architecture in one paragraph

Tokens are computed at render time and painted by the browser via `CSS.highlights` Range registration — **the DOM Etherpad's Ace owns is never mutated**. On every line render (`acePostWriteDomLineHTML`) and every text mutation (`MutationObserver`), the renderer reads `node.textContent`, runs `hljs.highlight(text, {language})` (cached in an LRU keyed by `language:text`), turns the resulting `<span>`-soup into `{start, end, cls}` token ranges, then builds DOM `Range` objects pointing into the line's existing text nodes and adds them to `CSS.highlights.get('hljs-keyword')` etc. The browser composites the paint via `::highlight(hljs-…)` rules in `editor.css`. No `splitText`, no injected `<span>`s, no Easysync attribute broadcast.

## Files

| Path | Role |
|---|---|
| `static/js/syntaxRenderer.js` | Orchestrator: state, LRU cache, auto-detect timer, `acePostWriteDomLineHTML` hook, MutationObserver, repaintAllLines |
| `static/js/highlightRegistry.js` | Wraps `CSS.highlights`. `setLineRanges(lineEl, [{start,end,cls}])` / `removeLineRanges(lineEl)` / `clearAll()` |
| `static/js/hljsAdapter.js` | `tokenize(text, lang) -> ranges \| null`, `detect(text) -> language \| null`, `parseHljsHtml(html) -> ranges` |
| `static/js/codeIndent.js` | `aceKeyEvent` handler: Enter inherits/extends indent, Tab/Shift+Tab indent/de-indent in code mode |
| `static/js/lruCache.js` | Map-backed LRU |
| `static/js/index.js` | Client postAceInit: dynamically injects `vendor/hljs.min.js`, wires socketio + padToggle.init + syntaxRenderer.start + codeIndent.start |
| `static/js/themeBridge.js` | Light/dark theme detection (no longer swaps stylesheets — `editor.css` carries both palettes) |
| `static/js/domOverlay.js` | "Highlighting paused" badge for MAX_LINES kill switch |
| `static/css/editor.css` | `::highlight(hljs-…)` rules. Light + dark palettes scoped via `.super-dark-editor` |
| `static/css/themes/{github,github-dark}.css` | Vendored hljs themes — used **only by export pipeline**, not by the live editor |
| `index.js` (server) | loadSettings, clientVars (lang + indentSize), socketio (setLanguage), eejsBlock_*, getLineHTMLForExport, stylesForExport |
| `lib/padLanguageStore.js` | `{language, autoDetect}` per pad |
| `lib/exportRenderer.js` | HTML/PDF export: hljs.highlight() emits real `<span>`s + theme CSS inlined |

## How rendering actually flows

```
keystroke / paste / remote changeset
    │
    ▼
Etherpad updates inner-iframe DOM
    │
    ├─ acePostWriteDomLineHTML hook fires (full line re-renders only)
    │       └─ syntaxRenderer.renderLine(lineDiv)
    │
    └─ MutationObserver fires (every text mutation, including incremental typing)
            └─ syntaxRenderer.renderLine(dirtyLine)
                    │
                    ▼
              tokenize(text, language)  ←  LRU cache
                    │
                    ▼
              setLineRanges(lineEl, ranges)
                    │
                    ├─ removeLineRanges(lineEl)  // strip old Highlight refs
                    ├─ buildSegments(lineEl)      // walk text nodes
                    ├─ buildRange(...) per token  // Range with setStart/setEnd
                    └─ CSS.highlights.get(cls).add(range)
                    │
                    ▼
              browser paints ::highlight(cls) rules
```

## Hard-won lessons (read before changing the render path)

### 1. Don't mutate the DOM Ace owns
v0.1 stored tokens as Easysync attributes — `setAttributesOnRange` moved the caret to the start of the range on the active line. v0.2 wrapped text nodes via `splitText`/`insertBefore` — fought Etherpad's `_magicdom_dirtiness.knownHTML` bookkeeping; lying about `knownHTML` to break the feedback loop broke remote changeset application. **CSS Custom Highlights is the answer:** observation only, no DOM modification, no fights with Ace.

### 2. `acePostWriteDomLineHTML` only fires on FULL line re-renders
Etherpad does incremental DOM updates on single-character typing (modifies `textNode.nodeValue` in place). The hook is only called when a line is fully written: paste, language change, line split, undo/redo. To catch every text mutation, install a `MutationObserver` on the inner doc body (`{childList: true, subtree: true, characterData: true}`) and walk up to the magicdomid line div. Etherpad sometimes swaps a line div wholesale on edit — `m.target` becomes `innerdocbody` and the new line is in `m.addedNodes`, so iterate both `m.target` and `m.addedNodes` when finding line ancestors.

### 3. The cache must not poison
`tokenize()` returns `null` (not `[]`) when `window.hljs` isn't loaded. `renderLine` defers — does not cache, does not strip existing highlights. If you cache `[]` from a missing-hljs render, every future render for that key is empty.

### 4. `CSS.highlights` is per-document
The editor lives in a nested iframe (`ace_outer` → `ace_inner`). Range objects must be created on the inner document and Highlights registered with the inner window's `CSS.highlights`. Using the outer window's `Highlight` constructor or `CSS.highlights` produces silent no-ops. `highlightRegistry.setLineRanges` resolves the right window via `lineEl.ownerDocument.defaultView`.

### 5. Multi-class hljs spans need splitting
hljs sometimes emits `<span class="hljs-meta hljs-string">@foo</span>`. CSS `<custom-ident>` doesn't allow spaces, so registering a Highlight named `"hljs-meta hljs-string"` is invisible. `parseHljsHtml` splits on whitespace and emits one range per class.

### 6. Etherpad applies `super-dark-editor` to the inner `<html>`, not `<body>`
Per `ace.ts:266`. Our dark-mode CSS uses `.super-dark-editor ::highlight(…)` (descendant-selector) so it matches whether the class is on `html`, `body`, or any ancestor.

### 7. `padToggle` exposes `init({onChange})`, not `subscribe`
The helper's eejs templates render `<input type="checkbox">` with NO `checked` attribute. Without calling `init()` on the client, the checkbox stays unchecked even when `defaultEnabled: true`. The flow is server-renders-empty → client-init-binds-state.

### 8. `acePostWriteDomLineHTML` fires BEFORE `postAceInit` for the initial render
For pads with persisted language, the initial line renders happen before `loadHljs()` resolves and before `syntaxRenderer.start()` sets state. The hook short-circuits on auto/missing-hljs and leaves them un-tokenized. Fix: schedule a `setTimeout(repaintAllLines, 100)` from `start()` to catch lines that rendered too early.

### 9. Auto-detect is per-client, no broadcast (yet)
Each client runs `hljs.highlightAuto(padText)` on a 2s idle interval. Convergence relies on `hljs.highlightAuto` being deterministic (same content → same language). If divergence is reported, add a jittered `setLanguage` broadcast with cancel-on-incoming so first-fire wins (sketched but not landed; see git stash `v0.2-task6-wip-archive` for the broadcast variant).

### 10. The `padShortcutEnabled.tab` Etherpad setting affects Tab interception
`codeIndent.handleKey` returns `true` and `evt.preventDefault()` to suppress Etherpad's default Tab. Test before assuming this works for a given keystroke — `aceKeyEvent` hook ordering means `outsideKeyPress` runs *before* the hook for Enter on Chrome (`isTypeForSpecialKey && keyCode === 13` branch in `ace2_inner.ts`). Backend unit tests are reliable; some Playwright tests for keystroke interaction are flaky and `test.fixme`'d.

## Settings (server-side)

```json
"ep_hljs": {
  "indentSize": 2
}
```

`indentSize` is admin-configurable in `settings.json` (clamped to `1..16`, default `2`). A pad-level UI picker (TOC-style) is a deferred follow-up.

## i18n

All user-facing strings have `data-l10n-id` and a fallback English string. Keys live in `locales/en.json`:

| Key | Where |
|---|---|
| `ep_hljs.label` | toolbar dropdown aria-label |
| `ep_hljs.auto` | dropdown "Auto-detect" option |
| `ep_hljs.off` | dropdown "Off" option |
| `ep_hljs.paused` | "Highlighting paused" badge |
| `ep_hljs.user_enable` | padToggle checkbox label |

Programming language names (`JavaScript`, `Python`, etc.) are intentionally **not** translated — they're proper nouns / fixed identifiers in the hljs grammar registry.

## Accessibility

- The toolbar `<select>` exposes `aria-label` (via `data-l10n-attr="aria-label"`).
- Toggle checkboxes get `<label for="...">` from the padToggle helper.
- `Ctrl/Alt/Meta + Tab` is **not** intercepted by `codeIndent` — keyboard navigation escape hatch.
- `Shift+Tab` defers to Etherpad's default when there's no leading whitespace to remove (so list-mode Shift+Tab still works).
- **Color contrast trade-off:** the light-mode operator color (`#3b82f6` against white) is ~3.7:1 — passes WCAG AA for large/bold text only. The string color (`#1d4ed8`) passes AA at 7:1. Users with low-vision needs should use the dark skin variant which has high-contrast brights (`#79c0ff` etc., > 7:1 on the dark BG).

## Tests

```bash
# Backend (jsdom + mocha)
cd etherpad-lite/src && npx cross-env NODE_ENV=production mocha --import=tsx --timeout 30000 \
  $(find plugin_packages -path '*ep_hljs*/static/tests/backend/specs/*.test.js' | tr '\n' ' ')

# Frontend (Playwright)
cd etherpad-lite/src && CI=true pnpm exec playwright test --project=chromium --reporter=line --workers=1 --retries=0 \
  $(find plugin_packages -path '*ep_hljs*/static/tests/frontend-new/specs/*.spec.ts' | tr '\n' ' ')
```

Backend (38 cases): `lruCache`, `highlightRegistry` (jsdom Range building), `codeIndent` (Enter/Tab/Shift+Tab logic with mocked rep+editorInfo), `hljsAdapter` (parseHljsHtml multi-class + entities), `padLanguageStore`, `socket`, `export`.

Frontend (~21 cases, ~3 fixme'd): `caret-stability`, `collaboration`, `content-sync`, `dark-mode` (CSS rule presence), `export`, `initial-paint`, `language-picker`, `large-pad`, `lifecycle`, `multi-user-caret`, `single-line-while`, `code-indent` (mostly fixme — see lesson #10).

## Known issues / follow-ups

- Pad-level indent size picker (currently admin-only via `settings.json`).
- Auto-detect divergence between collaborators is theoretically possible; broadcast-with-jitter pattern designed but not landed (see git stash).
- `code-indent.spec.ts` Enter/Tab/Shift+Tab Playwright cases are `test.fixme` — manual testing + backend unit tests cover the logic.
- `caret-stability.spec.ts` and `multi-user-caret.spec.ts` repro 2 are intermittently flaky on the niceSelect dropdown click — UI timing race, not a code bug.
