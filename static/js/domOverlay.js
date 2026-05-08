'use strict';

exports.showPausedBadge = (visible) => {
  const sel = document.getElementById('ep_hljs_select');
  if (!sel) return;
  let badge = document.getElementById('ep_hljs_paused_badge');
  if (visible && !badge) {
    badge = document.createElement('span');
    badge.id = 'ep_hljs_paused_badge';
    badge.setAttribute('data-l10n-id', 'ep_hljs.paused');
    badge.textContent = 'Highlighting paused';
    sel.insertAdjacentElement('afterend', badge);
  } else if (!visible && badge) {
    badge.remove();
  }
};
