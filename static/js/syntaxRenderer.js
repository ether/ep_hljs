'use strict';

const LRU = require('./lruCache');
const wrapTokens = require('./textNodeWrapper');
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
  if (paused) return false;
  if (!userEnabled) return false;
  if (!state.language) return false;
  if (state.language === 'off') return false;
  if (state.language === 'auto' && !state.autoDetect) return false;
  return true;
};

const renderLine = (node) => {
  if (!node || !isHighlightingEnabled()) return;
  // 'auto' with no detected language yet → no concrete grammar; skip.
  if (state.language === 'auto') return;
  const text = node.textContent;
  if (!text) return;
  const key = `${state.language}:${text}`;
  let ranges = cache.get(key);
  if (ranges === undefined) {
    ranges = tokenize(text, state.language);
    cache.set(key, ranges);
  }
  if (!ranges.length) return;
  try {
    wrapTokens(node, ranges);
  } catch (_e) { /* render-time errors must never break the editor */ }
};

const padText = () => {
  if (!aceContext) return '';
  let result = '';
  try {
    aceContext.ace.callWithAce((ace) => {
      result = ace.ace_exportText();
    }, 'syntax-read', false);
  } catch (_e) { /* ignore */ }
  return result;
};

const lineCount = () => {
  if (!aceContext) return 0;
  let n = 0;
  try {
    aceContext.ace.callWithAce((ace) => {
      const rep = ace.ace_getRep && ace.ace_getRep();
      if (rep && rep.lines) n = rep.lines.length();
    }, 'syntax-line-count', false);
  } catch (_e) { /* ignore */ }
  return n;
};

const repaintAllLines = () => {
  // Walk the inner doc's line divs and re-run renderLine on each. We don't
  // need to re-trigger Ace's render; we just re-tokenize and re-wrap based
  // on the current state and the existing DOM contents. wrapTokens strips
  // any previous token spans first.
  if (!aceContext) return;
  const outer = document.getElementsByName('ace_outer')[0];
  if (!outer) return;
  const outerDoc = outer.contentWindow && outer.contentWindow.document;
  if (!outerDoc) return;
  const inner = outerDoc.getElementsByName('ace_inner')[0];
  if (!inner) return;
  const innerDoc = inner.contentWindow && inner.contentWindow.document;
  if (!innerDoc) return;
  innerDoc.querySelectorAll('div[id^="magicdomid"]').forEach(renderLine);
};

const tickAutoRedetect = () => {
  if (!state.autoDetect) return;
  if (Date.now() - lastDetectAt < AUTO_REDETECT_MS) return;
  lastDetectAt = Date.now();
  const text = padText();
  if (!text) return;
  const detected = detect(text);
  if (!detected) return;
  if (detected === state.language) return;
  state = {language: detected, autoDetect: true};
  cache.clear();
  repaintAllLines();
};

const checkPaused = () => {
  const n = lineCount();
  if (n > MAX_LINES && !paused) {
    paused = true;
    return true;
  }
  if (n <= MAX_LINES && paused) {
    paused = false;
    return true;
  }
  return false;
};

exports.start = (ctx, initialState) => {
  aceContext = ctx;
  state = {...state, ...(initialState || {})};
  // Kick off auto-detect after a short delay so initial render isn't blocked.
  setTimeout(tickAutoRedetect, 500);
  if (autoDetectTimer) clearInterval(autoDetectTimer);
  autoDetectTimer = setInterval(tickAutoRedetect, 1000);
};

exports.setState = (next) => {
  state = {...state, ...next};
  cache.clear();
  repaintAllLines();
};

exports.setUserEnabled = (enabled) => {
  if (enabled === userEnabled) return;
  userEnabled = !!enabled;
  repaintAllLines();
};

// Hook handler. Returns no DOM modification (we mutate node directly).
exports.acePostWriteDomLineHTML = (hookName, context) => {
  if (checkPaused()) repaintAllLines();
  if (paused) return;
  renderLine(context.node);
};

exports.__test_internal = { // eslint-disable-line camelcase
  cache,
  getState: () => ({...state}),
};
