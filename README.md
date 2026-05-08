# ep_hljs

Whole-pad syntax highlighting for Etherpad, powered by [highlight.js](https://highlightjs.org/). Closes [ether/etherpad#6616](https://github.com/ether/etherpad/issues/6616).

![Demo](demo.gif)

## Features

- Auto-detects the pad's language (or pick from a toolbar dropdown).
- The chosen language is a **pad-wide** setting and syncs to all collaborators in real time.
- Per-user / pad-wide enable toggle in the settings panel.
- Configurable indent size (2 or 4 spaces) with auto-indent on Enter, Tab, and Shift+Tab when a language is set.
- Light and dark palettes — dark mode follows Etherpad's `super-dark-editor` skin variant.
- HTML and PDF exports include the highlighting (theme CSS inlined).

## Architecture

Tokens are computed at render time and painted by the browser via the [CSS Custom Highlights API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API) — **the DOM Etherpad's editor owns is never modified**. Range objects are registered with `CSS.highlights` and styled via `::highlight(hljs-…)` rules, so:

- Your typing never disturbs your caret.
- Your collaborators' edits never disturb yours.
- No Easysync attribute broadcast — zero overhead on the changeset rail.

Highlight.js detection runs on a 2-second idle timer; the LRU-cached `hljs.highlight()` runs at line-render time keyed by `language:lineText`.

## Install

```bash
pnpm run plugins i ep_hljs
```

## Configure

Optional admin overrides in `settings.json`:

```json
"ep_hljs": {
  "indent-size": 4
}
```

(`indent-size` defaults to `2`. Per-user and per-pad pickers are in the User Settings / Pad Settings panels — admins can enforce a value via this setting if desired.)

## Browser support

CSS Custom Highlights ships in:

- Chrome / Edge 105+ (Sep 2022)
- Safari 17.2+ (Dec 2023)
- Firefox 140+ (mid 2025)

On older browsers the editor still works — highlighting silently no-ops.

## Bugs / requests

[github.com/ether/ep_hljs/issues](https://github.com/ether/ep_hljs/issues)
