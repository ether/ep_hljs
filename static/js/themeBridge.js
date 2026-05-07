'use strict';

const LIGHT_FILE = 'github.css';
const DARK_FILE = 'github-dark.css';
const PATH_MARKER = '/static/plugins/ep_syntax_highlighting/static/css/themes/';

let aceContext = null;
let listenersAttached = false;

const resolveDark = () => {
  if (document.documentElement.classList.contains('darkMode')) return true;
  if (document.body && document.body.dataset && document.body.dataset.theme === 'dark') return true;
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
};

const collectThemeLinks = () => {
  const links = [];
  document
      .querySelectorAll(`link[href*="${PATH_MARKER}"]`)
      .forEach((l) => links.push(l));
  if (aceContext) {
    aceContext.ace.callWithAce((ace) => {
      const innerDoc = ace.editor.getDocument();
      if (innerDoc) {
        innerDoc
            .querySelectorAll(`link[href*="${PATH_MARKER}"]`)
            .forEach((l) => links.push(l));
      }
    }, 'ep_syntax_highlighting_theme_collect', false);
  }
  return links;
};

const swap = () => {
  const targetFile = resolveDark() ? DARK_FILE : LIGHT_FILE;
  const otherFile = resolveDark() ? LIGHT_FILE : DARK_FILE;
  collectThemeLinks().forEach((link) => {
    if (link.href.includes(PATH_MARKER + otherFile)) {
      link.href = link.href.replace(PATH_MARKER + otherFile, PATH_MARKER + targetFile);
    }
  });
};

exports.start = (ctx) => {
  aceContext = ctx;
  swap();
  if (!listenersAttached) {
    if (window.matchMedia) {
      try {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', swap);
      } catch (_e) {
        // older Safari fallback
        window.matchMedia('(prefers-color-scheme: dark)').addListener(swap);
      }
    }
    new MutationObserver(swap).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    listenersAttached = true;
  }
  // The inner ace iframe may finish loading the link tag AFTER start(); re-run
  // a few times shortly after start so the swap catches a late insertion.
  setTimeout(swap, 250);
  setTimeout(swap, 1000);
  setTimeout(swap, 3000);
};

exports.swap = swap; // exposed for tests / manual triggering
