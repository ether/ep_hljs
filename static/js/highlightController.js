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

// Map<lineIdx, serializedRangesString>. Used to skip apply for unchanged lines.
const previousByLine = new Map();

// Set<lineIdx>. Lines that currently have any syntax-tk attribute applied.
// Used on language change to issue CLEAR ops across all previously-painted lines.
const everApplied = new Set();

const serializeRanges = (rs) => rs
    .map((r) => `${r.start},${r.end},${r.cls}`)
    .sort()
    .join('|');

const groupByLine = (ranges) => {
  const map = new Map();
  for (const r of ranges) {
    if (!r || r.start >= r.end) continue;
    if (!map.has(r.line)) map.set(r.line, []);
    map.get(r.line).push(r);
  }
  return map;
};

const padText = () => {
  if (!aceContext) return '';
  let result = '';
  aceContext.ace.callWithAce((ace) => {
    result = ace.ace_exportText();
  }, 'getText', false);
  return result;
};

const activeLineIdx = () => {
  if (!aceContext) return -1;
  let idx = -1;
  try {
    aceContext.ace.callWithAce((ace) => {
      const rep = ace.ace_getRep && ace.ace_getRep();
      if (rep && rep.selStart) idx = rep.selStart[0];
    }, 'getActiveLine', false);
  } catch (_e) { /* no rep yet */ }
  return idx;
};

const handleWorkerResult = (data) => {
  if (!aceContext) return;
  const newByLine = groupByLine(data.ranges || []);
  const skip = activeLineIdx();

  // Build a list of lines to update: those whose token signature changed
  // AND that aren't the line containing the user's caret.
  const updates = []; // [{line, ranges: [...] | null}]; null = clear
  const seen = new Set();

  newByLine.forEach((rs, line) => {
    seen.add(line);
    if (line === skip) return;
    const sig = serializeRanges(rs);
    if (previousByLine.get(line) === sig) return;
    updates.push({line, ranges: rs});
    previousByLine.set(line, sig);
    everApplied.add(line);
  });

  // Lines that previously had tokens but no longer do → clear them.
  for (const [line] of previousByLine) {
    if (!seen.has(line) && line !== skip) {
      updates.push({line, ranges: null});
      previousByLine.delete(line);
      everApplied.delete(line);
    }
  }

  if (!updates.length) return;

  aceContext.ace.callWithAce((ace) => {
    if (typeof ace.ace_applyTokenAttributesPerLine === 'function') {
      ace.ace_applyTokenAttributesPerLine(updates);
    }
  }, 'syntax-apply', true);
};

const ensureWorker = () => {
  if (worker) return worker;
  worker = new Worker('/static/plugins/ep_syntax_highlighting/static/js/highlightWorker.js');
  worker.addEventListener('message', (e) => {
    if (!e.data || !e.data.ok) return;
    const t0 = performance.now();
    handleWorkerResult(e.data);
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

const tokenize = () => {
  const text = padText();
  const allLines = text.split('\n');
  if (allLines.length > MAX_LINES) {
    overlay.showPausedBadge(true);
    // Clear everything we previously painted.
    if (aceContext) {
      const updates = [];
      for (const [line] of previousByLine) updates.push({line, ranges: null});
      previousByLine.clear();
      if (updates.length) {
        aceContext.ace.callWithAce((ace) => {
          if (typeof ace.ace_applyTokenAttributesPerLine === 'function') {
            ace.ace_applyTokenAttributesPerLine(updates);
          }
        }, 'syntax-clear', true);
      }
    }
    return;
  }
  overlay.showPausedBadge(false);

  let textForWorker = text;
  let lineOffset = 0;
  if (degraded) {
    const view = overlay.viewportLineRange();
    const start = Math.max(0, view.first - 100);
    const end = Math.min(allLines.length, view.last + 100);
    textForWorker = allLines.slice(start, end).join('\n');
    lineOffset = start;
  }

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
  // Force a full clear of every previously-painted line (except the active
  // one, which we never disturb). The next tokenize will paint fresh tokens
  // from scratch.
  if (aceContext && everApplied.size) {
    const skip = activeLineIdx();
    const clears = [];
    for (const line of everApplied) {
      if (line !== skip) clears.push({line, ranges: null});
    }
    if (clears.length) {
      aceContext.ace.callWithAce((ace) => {
        if (typeof ace.ace_applyTokenAttributesPerLine === 'function') {
          ace.ace_applyTokenAttributesPerLine(clears);
        }
      }, 'syntax-clear-on-lang-change', true);
    }
    for (const u of clears) everApplied.delete(u.line);
  }
  previousByLine.clear();
  schedule();
};

exports.tickAutoRedetect = () => {
  if (state.autoDetect && Date.now() - lastDetect > AUTO_REDETECT_MS) schedule();
};
