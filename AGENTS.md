# Agent Guide — ep_hljs

Whole-pad syntax highlighting for Etherpad via highlight.js. Auto-detect or pick a language; tokens are painted via the CSS Custom Highlights API — no DOM mutation, no caret drift.

## Tech stack

* Etherpad plugin framework (hooks declared in `ep.json`)
* EJS templates rendered server-side via `eejsBlock_*` hooks
* html10n for i18n (`locales/<lang>.json`, `data-l10n-id` in templates)
* `ep_plugin_helpers` for shared boilerplate

## Project structure

```
ep_hljs/
├── AGENTS.md
├── CLAUDE.md
├── CONTRIBUTING.md
├── ep.json
├── index.js
├── lib/
├── locales/
│   ├── en.json
├── package.json
├── pnpm-workspace.yaml
├── scripts/
├── static/
│   ├── css/
│   ├── js/
│   ├── tests/
├── templates/
│   ├── editbarButtons.ejs
```

## Helpers used

* `pad-select` from `ep_plugin_helpers`
* `pad-select-server` from `ep_plugin_helpers`
* `pad-toggle` from `ep_plugin_helpers`
* `pad-toggle-server` from `ep_plugin_helpers`


## Helpers NOT used

_To be audited in the helpers-adoption sweep (Phase 4)._


## Running tests locally

`ep_hljs` runs inside Etherpad's test harness. From an etherpad checkout that has installed this plugin via `pnpm run plugins i --path ../ep_hljs`:

```bash
# Backend (Mocha) — harness boots its own server
pnpm --filter ep_etherpad-lite run test

# Playwright — needs `pnpm run dev` in a second terminal
pnpm --filter ep_etherpad-lite run test-ui
```

## Standing rules for agent edits

* PRs target `main`. Linear commits, no merge commits.
* Every bug fix includes a regression test in the same commit.
* All user-facing strings in `locales/`. No hardcoded English in templates.
* No hardcoded `aria-label` on icon-only controls — etherpad's html10n auto-populates `aria-label` from the localized string when (a) the element has a `data-l10n-id` and (b) no author-supplied `aria-label` is present. Adding a hardcoded English `aria-label` blocks that and leaves it untranslated. (See `etherpad-lite/src/static/js/vendors/html10n.ts:665-678`.)
* No nested interactive elements (no `<button>` inside `<a>`).
* LLM/Agent contributions are explicitly welcomed by maintainers.

## Quick reference: hooks declared in `ep.json`

* Server: `loadSettings`, `padRemove`, `padCopy`, `clientVars`, `socketio`, `eejsBlock_editbarMenuLeft`, `eejsBlock_mySettings`, `eejsBlock_padSettings`, `getLineHTMLForExport`, `stylesForExport`
* Client: `postAceInit`, `aceEditorCSS`, `acePostWriteDomLineHTML`, `aceKeyEvent`, `handleClientMessage_CLIENT_MESSAGE`

When adding a hook, register it in both `ep.json` *and* the matching `exports.<hook> = ...` in the JS file.
