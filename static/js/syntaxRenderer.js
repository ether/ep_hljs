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

exports.start = (ctx, initialState) => {
  aceContext = ctx;
  state = {...state, ...(initialState || {})};
  setTimeout(tickAutoRedetect, 500);
  if (autoDetectTimer) clearInterval(autoDetectTimer);
  autoDetectTimer = setInterval(tickAutoRedetect, 1000);
};

exports.setState = (next) => {
  state = {...state, ...next};
  cache.clear();
  clearAll();
  repaintAllLines();
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

exports.__test_internal = { // eslint-disable-line camelcase
  cache,
  getState: () => ({...state}),
};
