'use strict';

const TOKEN_MARKER_CLASS = 'ep_syntax_token';

const escapeAttr = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '');

// Track which spans were injected by wrapTokens, keyed by the line element.
// WeakMap so GC can reclaim entries when lineEl is removed from the DOM.
const injectedSpans = new WeakMap();

const stripPreviousTokens = (lineEl) => {
  const previous = injectedSpans.get(lineEl);
  if (!previous) return;
  for (const span of previous) {
    if (!span.parentNode) continue;
    while (span.firstChild) span.parentNode.insertBefore(span.firstChild, span);
    span.parentNode.removeChild(span);
  }
  injectedSpans.delete(lineEl);
};

const collectTextSegments = (lineEl) => {
  const segs = [];
  let pos = 0;
  const walker = lineEl.ownerDocument.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const len = node.nodeValue.length;
    if (len > 0) segs.push({node, start: pos, len});
    pos += len;
  }
  return segs;
};

const wrapOneRange = (doc, segs, range) => {
  const created = [];
  for (const seg of segs) {
    const segStart = seg.start;
    const segEnd = segStart + seg.len;
    if (segEnd <= range.start) continue;
    if (segStart >= range.end) break;
    const innerStart = Math.max(0, range.start - segStart);
    const innerEnd = Math.min(seg.len, range.end - segStart);
    if (innerStart >= innerEnd) continue;
    let target = seg.node;
    if (innerStart > 0) target = target.splitText(innerStart);
    if (innerEnd - innerStart < target.nodeValue.length) {
      target.splitText(innerEnd - innerStart);
    }
    const span = doc.createElement('span');
    span.className = escapeAttr(range.cls);
    target.parentNode.insertBefore(span, target);
    span.appendChild(target);
    created.push(span);
  }
  return created;
};

const wrapTokens = (lineEl, ranges) => {
  if (!lineEl) return;
  stripPreviousTokens(lineEl);
  if (!ranges || !ranges.length) return;
  const sorted = [...ranges]
      .filter((r) => r && r.start < r.end && r.cls)
      .sort((a, b) => a.start - b.start || b.end - a.end);
  if (!sorted.length) return;
  const ownerDoc = lineEl.ownerDocument;
  const allCreated = [];
  for (const r of sorted) {
    // Re-collect segments after each wrap so nested ranges descend into
    // newly-created spans (e.g. a string with an interpolation inside).
    const segs = collectTextSegments(lineEl);
    const created = wrapOneRange(ownerDoc, segs, r);
    allCreated.push(...created);
  }
  if (allCreated.length) injectedSpans.set(lineEl, allCreated);
};

module.exports = wrapTokens;
module.exports.TOKEN_MARKER_CLASS = TOKEN_MARKER_CLASS;
