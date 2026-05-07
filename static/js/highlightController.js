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
    // `e.data.id` is sent but not validated: tokenize() only fires from schedule()
    // which serializes posts behind a debounce, and the worker processes messages
    // FIFO. Any future fast-path that bypasses the debounce must add a guard.
    overlay.apply(aceContext, e.data.ranges);
    const dt = performance.now() - t0;
    if (dt > BUDGET_MS) {
      overruns += 1;
      if (overruns >= BUDGET_OVERRUN_LIMIT) degraded = true;
    } else {
      overruns = Math.max(0, overruns - 1);
      if (overruns === 0) degraded = false;
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
  const allLines = text.split('\n');
  if (allLines.length > MAX_LINES) {
    overlay.showPausedBadge(true);
    overlay.clear(aceContext);
    return;
  }
  overlay.showPausedBadge(false);

  let textForWorker = text;
  let lineOffset = 0;
  if (degraded) {
    const view = overlay.viewportLineRange(aceContext);
    const start = Math.max(0, view.first - 100);
    const end = Math.min(allLines.length, view.last + 100);
    textForWorker = allLines.slice(start, end).join('\n');
    lineOffset = start;
  }

  // In degraded mode we only highlight a viewport window. Scrolling without
  // editing does NOT trigger a re-tokenize, so off-screen content is not
  // repainted until the next edit. Acceptable v1 trade-off; "scroll-to-paint"
  // can land in v1.1.
  ensureWorker().postMessage({
    id: nextId++,
    text: textForWorker,
    language: state.language,
    autoDetect: state.autoDetect,
    lineOffset,
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
