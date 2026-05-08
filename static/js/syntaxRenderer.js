'use strict';

const LRU = require('./lruCache');
const {setLineRanges, clearAll} = require('./highlightRegistry');
const {tokenize, detect} = require('./hljsAdapter');
const {MAX_LINES, AUTO_REDETECT_MS, LRU_CAPACITY} = require('./constants');

const cache = new LRU(LRU_CAPACITY);
let state = {language: 'auto', autoDetect: true};
let userEnabled = true;
let paused = false;
let aceContext = null;
let autoDetectTimer = null;
let lastDetectAt = 0;

const isHighlightingEnabled = () => {
  if (paused || !userEnabled) return false;
  if (!state.language || state.language === 'off') return false;
  if (state.language === 'auto' && !state.autoDetect) return false;
  return true;
};

const getInnerDoc = () => {
  const outer = document.getElementsByName('ace_outer')[0];
  if (!outer) return null;
  const outerDoc = outer.contentWindow && outer.contentWindow.document;
  if (!outerDoc) return null;
  const inner = outerDoc.getElementsByName('ace_inner')[0];
  if (!inner) return null;
  return inner.contentWindow && inner.contentWindow.document;
};

const renderLine = (node) => {
  if (!node) return;
  if (!isHighlightingEnabled() || state.language === 'auto') {
    setLineRanges(node, []);
    return;
  }
  const text = node.textContent;
  if (!text) {
    setLineRanges(node, []);
    return;
  }
  const key = `${state.language}:${text}`;
  let ranges = cache.get(key);
  if (ranges === undefined) {
    ranges = tokenize(text, state.language);
    if (ranges == null) {
      // hljs not yet loaded. Don't cache, don't strip existing highlights —
      // a later render (or MutationObserver tick) will retry once hljs is in.
      return;
    }
    cache.set(key, ranges);
  }
  setLineRanges(node, ranges);
};

const repaintAllLines = () => {
  const innerDoc = getInnerDoc();
  if (!innerDoc) return;
  innerDoc.querySelectorAll('div[id^="magicdomid"]').forEach(renderLine);
};

const padText = () => {
  if (!aceContext) return '';
  let result = '';
  try {
    aceContext.ace.callWithAce((ace) => {
      result = ace.ace_exportText();
    }, 'syntax-read');
  } catch (_e) { /* ignore */ }
  return result;
};

const lineCount = () => {
  const innerDoc = getInnerDoc();
  if (!innerDoc) return 0;
  return innerDoc.querySelectorAll('div[id^="magicdomid"]').length;
};

const tickAutoRedetect = () => {
  if (!state.autoDetect) return;
  if (Date.now() - lastDetectAt < AUTO_REDETECT_MS) return;
  lastDetectAt = Date.now();
  const text = padText();
  if (!text) return;
  const detected = detect(text);
  if (!detected || detected === state.language) return;
  state = {language: detected, autoDetect: true};
  cache.clear();
  clearAll();
  repaintAllLines();
};

const checkPaused = () => {
  const n = lineCount();
  const wasPaused = paused;
  paused = n > MAX_LINES;
  return wasPaused !== paused;
};

// Toggle a marker class on the inner iframe's body when this plugin is
// actively painting. Lets editor.css scope plugin-specific CSS rules (e.g.
// the authorship-bg suppression) so they only apply to pads with
// highlighting on — keeps core Etherpad tests on plain pads unaffected.
const updateActiveClass = () => {
  const innerDoc = getInnerDoc();
  if (!innerDoc || !innerDoc.body) return;
  const active = isHighlightingEnabled() && state.language && state.language !== 'auto';
  innerDoc.body.classList.toggle('ep-syntax-highlighting-active', !!active);
};

exports.start = (ctx, initialState) => {
  aceContext = ctx;
  state = {...state, ...(initialState || {})};
  setTimeout(tickAutoRedetect, 500);
  if (autoDetectTimer) clearInterval(autoDetectTimer);
  autoDetectTimer = setInterval(tickAutoRedetect, 1000);
  startMutationObserver(); // eslint-disable-line no-use-before-define
  // The initial line renders fire BEFORE postAceInit completes (i.e. before
  // we know the language and before hljs is loaded), so the
  // acePostWriteDomLineHTML hook short-circuits and leaves them un-tokenized.
  // Repaint once now that state and hljs are ready. Small timeout so the inner
  // iframe is fully populated.
  setTimeout(() => { repaintAllLines(); updateActiveClass(); }, 100);
};

exports.setState = (next) => {
  state = {...state, ...next};
  cache.clear();
  clearAll();
  repaintAllLines();
  updateActiveClass();
};

exports.setUserEnabled = (enabled) => {
  if (enabled === userEnabled) return;
  userEnabled = !!enabled;
  clearAll();
  repaintAllLines();
};

exports.acePostWriteDomLineHTML = (hookName, context) => {
  if (checkPaused() && paused) clearAll();
  if (paused) return;
  renderLine(context.node);
};

// Etherpad does incremental DOM updates on typing — the acePostWriteDomLineHTML
// hook only fires on FULL line re-renders (paste, language change, line split).
// To catch every text mutation (typing, remote changesets, IME composition,
// undo/redo) we observe the inner doc for character-level changes and
// re-render only the affected line divs. Since CSS Custom Highlights does
// not mutate the DOM, our setLineRanges calls don't trigger this observer.
let mutationObserver = null;

const startMutationObserver = () => {
  const innerDoc = getInnerDoc();
  if (!innerDoc || !innerDoc.body) {
    setTimeout(startMutationObserver, 100);
    return;
  }
  if (mutationObserver) return;
  const win = innerDoc.defaultView;
  if (!win || !win.MutationObserver) return;
  const findLineAncestor = (node, dirtyLines) => {
    let n = node;
    while (n && n !== innerDoc.body) {
      if (n.nodeType === 1 && n.id && n.id.startsWith('magicdomid')) {
        dirtyLines.add(n);
        return;
      }
      n = n.parentNode;
    }
  };
  mutationObserver = new win.MutationObserver((mutations) => {
    if (paused) return;
    const dirtyLines = new Set();
    for (const m of mutations) {
      // characterData: m.target is the text node — walk up to its line div.
      // childList:     m.target is the parent of changed children. If
      //                Etherpad replaces a whole line div, m.target is
      //                innerdocbody and the new line is in addedNodes.
      findLineAncestor(m.target, dirtyLines);
      if (m.addedNodes) for (const n of m.addedNodes) findLineAncestor(n, dirtyLines);
    }
    for (const line of dirtyLines) renderLine(line);
  });
  mutationObserver.observe(innerDoc.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
};

exports.getState = () => ({...state});

exports.__test_internal = { // eslint-disable-line camelcase
  cache,
  getState: () => ({...state}),
};
