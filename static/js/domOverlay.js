'use strict';

// The DOM overlay approach was abandoned (it fought Ace's render cycle and
// reset the caret). Highlighting is now applied via character attributes
// (see highlightController.js → ace_applyTokenAttributes).
//
// This file retains only the badge + viewport helpers that never wrote to
// the editor DOM.

const innerDoc = () => {
  const outerIframe = document.getElementsByName('ace_outer')[0];
  if (!outerIframe) return null;
  const outerDoc = outerIframe.contentWindow && outerIframe.contentWindow.document;
  if (!outerDoc) return null;
  const innerIframe = outerDoc.getElementsByName('ace_inner')[0];
  if (!innerIframe) return null;
  return innerIframe.contentWindow && innerIframe.contentWindow.document;
};

const allLineEls = (doc) => doc.querySelectorAll('div[id^="magicdomid"]');

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

exports.viewportLineRange = () => {
  const doc = innerDoc();
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
