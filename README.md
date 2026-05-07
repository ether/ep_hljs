# ep_syntax_highlighting

Whole-pad syntax highlighting for Etherpad, powered by [highlight.js](https://highlightjs.org/). Closes [ether/etherpad#6616](https://github.com/ether/etherpad/issues/6616).

## What it does

- Auto-detects the pad's language via `hljs.highlightAuto`, or pick one from the toolbar dropdown.
- Pad-level setting; the chosen language syncs to all collaborators in real time.
- Per-user and pad-wide enable toggles via `ep_plugin_helpers/padToggle`.
- HTML and PDF exports include the highlighting (theme CSS inlined).

## Architecture

Tokens are computed at render time and painted by the browser via the [CSS Custom Highlights API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API):

1. The `acePostWriteDomLineHTML` hook fires after each line render.
2. We tokenize the line text via `hljs.highlight()` (cached in an LRU keyed by `language:text`).
3. For each token range we build a `Range` object pointing into the line's existing text nodes.
4. The Ranges are registered with `CSS.highlights.set('hljs-keyword', new Highlight(range1, …))`.
5. The browser composites the paint via `::highlight(hljs-…)` rules in `editor.css`.

**The DOM Etherpad's Ace owns is never mutated.** No `splitText`, no `<span>` injection, no `setAttributesOnRange`, no Easysync attribute broadcast. Your typing never disturbs your caret, and your collaborators' edits never disturb yours.

Auto-detect runs on a 5-second idle timer over the full pad text; when the detected language changes, the LRU cache is cleared and all line ranges are repainted.

The `MAX_LINES = 5000` kill switch suspends highlighting on very large pads (toolbar shows "highlighting paused") to keep the editor responsive.

## Install

```bash
pnpm run plugins i ep_syntax_highlighting
```

## Browser support

CSS Custom Highlights is supported in:

- Chrome / Edge 105+ (Sep 2022)
- Safari 17.2+ (Dec 2023)
- Firefox 140+ (mid-2025)

On older browsers the editor still works — highlighting silently no-ops.

## Status

- v0.3.0 — CSS Custom Highlights architecture, all caret/collab regressions resolved.
- Light theme only; dark mode is a follow-up commit.
- Performance numbers on 100 / 500 / 1000 / 5000-line pads will land before v1.0.0.

## Issue tracker

Bugs / feature requests: [github.com/ether/ep_syntax_highlighting/issues](https://github.com/ether/ep_syntax_highlighting/issues).
