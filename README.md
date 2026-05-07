# ep_syntax_highlighting

Whole-pad syntax highlighting for Etherpad, powered by highlight.js. Closes [ether/etherpad#6616](https://github.com/ether/etherpad/issues/6616).

> **Status:** in development at v0.0.1 — features below are planned and not yet shipped.

## Planned

- Auto-detect language, or pick one from the toolbar.
- Pad-level setting that syncs across all collaborators in real time.
- Theme follows Etherpad's color scheme (light/dark).
- HTML and PDF exports include the highlighting.

## Install (once published)

```bash
pnpm run plugins i ep_syntax_highlighting
```

Performance numbers on 100 / 500 / 1000 / 5000 line pads land in this README before v1.0.0.
