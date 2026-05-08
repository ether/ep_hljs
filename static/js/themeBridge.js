'use strict';

const LIGHT_FILE = 'github.css';
const DARK_FILE = 'github-dark.css';
const PATH_MARKER = '/static/plugins/ep_hljs/static/css/themes/';

let listenersAttached = false;

const resolveDark = () => {
  // Etherpad signals dark mode via the html element's `super-dark-editor`
  // class (or `dark-editor` for medium dark). Fall back to legacy
  // class names and prefers-color-scheme for environments outside Etherpad.
  const html = document.documentElement;
  if (html.classList.contains('super-dark-editor')) return true;
  if (html.classList.contains('dark-editor')) return true;
  if (html.classList.contains('darkMode')) return true;
  if (document.body && document.body.dataset && document.body.dataset.theme === 'dark') return true;
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
};

const collectThemeLinks = () => {
  const links = [];
  document
      .querySelectorAll(`link[href*="${PATH_MARKER}"]`)
      .forEach((l) => links.push(l));
  // ace_getDocument() returns the outer pad document (ace2_inner.ts runs in the outer bundle).
  // The ace_inner iframe's document is where the theme CSS links are injected.
  try {
    const outerIframe = document.getElementsByName('ace_outer')[0];
    const outerDoc = outerIframe && outerIframe.contentWindow && outerIframe.contentWindow.document;
    const innerIframe = outerDoc && outerDoc.getElementsByName('ace_inner')[0];
    const innerDoc = innerIframe && innerIframe.contentWindow && innerIframe.contentWindow.document;
    if (innerDoc) {
      innerDoc
          .querySelectorAll(`link[href*="${PATH_MARKER}"]`)
          .forEach((l) => links.push(l));
    }
  } catch (_e) { /* cross-origin or not loaded yet */ }
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

exports.start = () => {
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
