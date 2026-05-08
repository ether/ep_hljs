'use strict';

// Parses hljs's HTML output into character ranges. hljs emits nested
// <span class="hljs-…">…</span> markup; we walk it linearly, accumulating
// the plain-text length and producing {start, end, cls} ranges for every
// closing </span>.
const SPAN_RE = /<span class="([^"]+)">|<\/span>/g;

// Single-pass entity decoder. A naive sequence of .replace(&amp;, &) followed
// by .replace(&lt;, <) double-decodes input like "&amp;lt;" into "<", which
// is wrong (it should stay as "&lt;"). One regex with a dispatch table
// processes each entity exactly once.
const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>',
  '&quot;': '"', '&#39;': "'", '&nbsp;': ' ',
};
const ENTITY_RE = /&(?:amp|lt|gt|quot|#39|nbsp);/g;
const decodeEntities = (s) => s.replace(ENTITY_RE, (m) => ENTITIES[m]);

// hljs sometimes emits multi-class spans (e.g. `<span class="hljs-meta hljs-string">`).
// CSS Highlights names are <custom-ident>, which can't contain spaces, so we
// emit one range per class and let the cascade overlay them.
const parseHljsHtml = (html) => {
  const ranges = [];
  const stack = [];
  let pos = 0;
  let plain = 0;
  let m;
  SPAN_RE.lastIndex = 0;
  while ((m = SPAN_RE.exec(html)) != null) {
    const before = decodeEntities(html.slice(pos, m.index));
    plain += before.length;
    if (m[1] != null) {
      stack.push({classes: m[1].split(/\s+/).filter(Boolean), start: plain});
    } else {
      const top = stack.pop();
      if (top) {
        for (const cls of top.classes) {
          ranges.push({start: top.start, end: plain, cls});
        }
      }
    }
    pos = m.index + m[0].length;
  }
  return ranges;
};

// Returns:
//   Array<{start,end,cls}> — token ranges (possibly empty if no tokens)
//   null                   — hljs not yet loaded; caller should skip + retry
const tokenize = (text, language) => {
  if (!text) return [];
  if (!language || language === 'auto' || language === 'off') return [];
  const hljs = (typeof window !== 'undefined') ? window.hljs : null;
  if (!hljs) return null;
  if (!hljs.getLanguage(language)) return [];
  let result;
  try {
    result = hljs.highlight(text, {language, ignoreIllegals: true});
  } catch (_e) { return []; }
  return parseHljsHtml(result.value);
};

const detect = (text) => {
  const hljs = (typeof window !== 'undefined') ? window.hljs : null;
  if (!hljs) return null;
  let result;
  try {
    result = hljs.highlightAuto(text);
  } catch (_e) { return null; }
  if (!result || !result.language) return null;
  // hljs scores by token-match count. A single short line of real code
  // (e.g. `const foo = "bar"; // note`) typically scores 2-4. The previous
  // threshold of 5 silently rejected most short pads. 2 is sensitive
  // enough for real code without triggering on a single English word.
  if ((result.relevance || 0) < 2) return null;
  return result.language;
};

module.exports = {tokenize, detect, parseHljsHtml};
