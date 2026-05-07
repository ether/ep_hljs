'use strict';

const {
  DEBOUNCE_MS, DEGRADED_DEBOUNCE_MS, BUDGET_MS, BUDGET_OVERRUN_LIMIT,
  MAX_LINES, AUTO_REDETECT_MS,
} = require('./constants');
const overlay = require('./domOverlay');

let worker = null;
let nextId = 1;
let timer = null;
let degraded = false;
let overruns = 0;
let lastDetect = 0;
let state = {language: 'auto', autoDetect: true};
let aceContext = null;

const ensureWorker = () => {
  if (worker) return worker;
  worker = new Worker('/static/plugins/ep_syntax_highlighting/static/js/highlightWorker.js');
  worker.addEventListener('message', (e) => {
    const t0 = performance.now();
    if (!e.data || !e.data.ok) return;
    overlay.apply(aceContext, e.data.ranges);
    const dt = performance.now() - t0;
    if (dt > BUDGET_MS) {
      overruns += 1;
      if (overruns >= BUDGET_OVERRUN_LIMIT) degraded = true;
    } else {
      overruns = Math.max(0, overruns - 1);
    }
  });
  worker.addEventListener('error', (err) => {
    console.warn('[ep_syntax_highlighting] worker error:', err && err.message);
  });
  return worker;
};

const padText = () => {
  if (!aceContext) return '';
  let result = '';
  aceContext.ace.callWithAce((ace) => {
    result = ace.editor.exportText();
  }, 'getText', false);
  return result;
};

const tokenize = () => {
  const text = padText();
  const lineCount = text.split('\n').length;
  if (lineCount > MAX_LINES) {
    overlay.showPausedBadge(true);
    overlay.clear(aceContext);
    return;
  }
  overlay.showPausedBadge(false);
  ensureWorker().postMessage({
    id: nextId++,
    text,
    language: state.language,
    autoDetect: state.autoDetect,
    lineOffset: 0,
  });
  if (state.autoDetect) lastDetect = Date.now();
};

const schedule = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(tokenize, degraded ? DEGRADED_DEBOUNCE_MS : DEBOUNCE_MS);
};

exports.start = (ctx, initialState) => {
  aceContext = ctx;
  state = initialState;
  schedule();
};

exports.onEdit = () => { schedule(); };

exports.setState = (next) => {
  state = next;
  overruns = 0;
  degraded = false;
  schedule();
};

exports.tickAutoRedetect = () => {
  if (state.autoDetect && Date.now() - lastDetect > AUTO_REDETECT_MS) schedule();
};
