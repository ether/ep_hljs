'use strict';

// Parses hljs's HTML output into character ranges. hljs emits nested
// <span class="hljs-…">…</span> markup; we walk it linearly, accumulating
// the plain-text length and producing {start, end, cls} ranges for every
// closing </span>.
const SPAN_RE = /<span class="([^"]+)">|<\/span>/g;

const decodeEntities = (s) => s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

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
      stack.push({cls: m[1], start: plain});
    } else {
      const top = stack.pop();
      if (top) ranges.push({start: top.start, end: plain, cls: top.cls});
    }
    pos = m.index + m[0].length;
  }
  return ranges;
};

const tokenize = (text, language) => {
  if (!text || !language || language === 'auto' || language === 'off') return [];
  const hljs = (typeof window !== 'undefined') ? window.hljs : null;
  if (!hljs) return [];
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
  if ((result.relevance || 0) < 5) return null;
  return result.language;
};

module.exports = {tokenize, detect, parseHljsHtml};
