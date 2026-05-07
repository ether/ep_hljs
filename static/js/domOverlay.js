'use strict';

const PAINTED_CLASS = 'ep_syntax_highlighting_painted';

const innerDoc = (ctx) => {
  let doc;
  ctx.ace.callWithAce((ace) => {
    doc = ace.editor.getDocument();
  }, 'getDoc', false);
  return doc;
};

const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]));
const escapeAttr = (s) => s.replace(/[^A-Za-z0-9_-]/g, '');

const stripExisting = (lineEl) => {
  const spans = lineEl.querySelectorAll('span.ep_syntax_highlighting_token');
  spans.forEach((s) => {
    const txt = lineEl.ownerDocument.createTextNode(s.textContent);
    s.replaceWith(txt);
  });
  lineEl.normalize();
  lineEl.classList.remove(PAINTED_CLASS);
};

const paintLine = (lineEl, lineRanges) => {
  if (!lineEl) return;
  stripExisting(lineEl);
  if (!lineRanges.length) return;
  const text = lineEl.textContent;
  const sorted = [...lineRanges].sort((a, b) => a.start - b.start || b.end - a.end);
  let html = '';
  let cursor = 0;
  for (const r of sorted) {
    if (r.start < cursor) continue;
    if (r.end > text.length || r.start >= r.end) continue;
    html += escapeHtml(text.slice(cursor, r.start));
    const cls = `ep_syntax_highlighting_token ${escapeAttr(r.cls)}`;
    html += `<span class="${cls}">${escapeHtml(text.slice(r.start, r.end))}</span>`;
    cursor = r.end;
  }
  html += escapeHtml(text.slice(cursor));
  lineEl.innerHTML = html;
  lineEl.classList.add(PAINTED_CLASS);
};

const groupByLine = (ranges) => {
  const map = new Map();
  for (const r of ranges) {
    if (!map.has(r.line)) map.set(r.line, []);
    map.get(r.line).push(r);
  }
  return map;
};

const allLineEls = (doc) => doc.querySelectorAll('div[id^="magicdomid"]');

const applyChunked = (doc, byLine) => {
  // First, strip painted lines that have NO ranges in the new payload —
  // otherwise stale spans from a previous tokenization survive.
  doc.querySelectorAll(`.${PAINTED_CLASS}`).forEach((el) => {
    const m = el.id.match(/^magicdomid(\d+)$/);
    if (m && !byLine.has(parseInt(m[1], 10))) {
      stripExisting(el);
    }
  });

  // Then apply new ranges, chunked.
  const lines = allLineEls(doc);
  const work = [];
  byLine.forEach((ranges, idx) => {
    const el = lines[idx];
    if (el) work.push({el, ranges});
  });
  let i = 0;
  const step = (deadline) => {
    while (i < work.length) {
      if (deadline && deadline.timeRemaining && deadline.timeRemaining() <= 0) break;
      paintLine(work[i].el, work[i].ranges);
      i++;
      if (!deadline && i % 50 === 0) break;
    }
    if (i < work.length) {
      if (typeof window !== 'undefined' && window.requestIdleCallback) {
        window.requestIdleCallback(step);
      } else {
        setTimeout(step, 0);
      }
    }
  };
  step(null);
};

exports.apply = (ctx, ranges) => {
  if (!ctx) return;
  const doc = innerDoc(ctx);
  if (!doc) return;
  applyChunked(doc, groupByLine(ranges));
};

exports.clear = (ctx) => {
  if (!ctx) return;
  const doc = innerDoc(ctx);
  if (!doc) return;
  doc.querySelectorAll(`.${PAINTED_CLASS}`).forEach(stripExisting);
};

exports.showPausedBadge = (visible) => {
  const sel = document.getElementById('ep_syntax_highlighting_select');
  if (!sel) return;
  let badge = document.getElementById('ep_syntax_highlighting_paused_badge');
  if (visible && !badge) {
    badge = document.createElement('span');
    badge.id = 'ep_syntax_highlighting_paused_badge';
    badge.setAttribute('data-l10n-id', 'ep_syntax_highlighting.paused');
    badge.textContent = 'Highlighting paused';
    sel.insertAdjacentElement('afterend', badge);
  } else if (!visible && badge) {
    badge.remove();
  }
};

exports.viewportLineRange = (ctx) => {
  const doc = innerDoc(ctx);
  if (!doc) return {first: 0, last: 0};
  const lines = allLineEls(doc);
  if (!lines.length) return {first: 0, last: 0};
  const scroll = doc.scrollingElement || doc.documentElement;
  const top = scroll.scrollTop;
  const bottom = top + scroll.clientHeight;
  let first = lines.length;
  let last = 0;
  lines.forEach((el, i) => {
    const offTop = el.offsetTop;
    if (offTop + el.offsetHeight >= top && offTop <= bottom) {
      if (i < first) first = i;
      if (i > last) last = i;
    }
  });
  if (first > last) { first = 0; last = lines.length - 1; }
  return {first, last};
};
