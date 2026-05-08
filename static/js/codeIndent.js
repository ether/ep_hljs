'use strict';

let indentSize = 2;
let getLanguage = () => null;
let getAutoDetect = () => true;

exports.start = (opts) => {
  if (opts && typeof opts.indentSize === 'number' && opts.indentSize > 0) {
    indentSize = opts.indentSize;
  }
  if (opts && typeof opts.getLanguage === 'function') {
    getLanguage = opts.getLanguage;
  }
  if (opts && typeof opts.getAutoDetect === 'function') {
    getAutoDetect = opts.getAutoDetect;
  }
};

exports.setIndentSize = (n) => {
  if (typeof n === 'number' && n > 0) indentSize = n;
};

exports.getIndentSize = () => indentSize;

const inCodeMode = () => {
  const lang = getLanguage();
  if (!lang || lang === 'auto' || lang === 'off') return false;
  // Only intercept Tab / Enter / Shift+Tab when the user has *explicitly*
  // picked a language. Auto-detect picking a language under the hood does
  // not enable keystroke interception — otherwise core Etherpad tests that
  // paste code-shaped text into a plain pad (e.g. indentation.spec.ts)
  // would have their Tab/Enter overridden when auto-detect kicks in.
  return getAutoDetect() === false;
};

const indentStr = (n) => ' '.repeat(n);

const leadingIndent = (text) => {
  const m = /^([ \t]*)/.exec(text);
  return m ? m[1] : '';
};

const handleEnter = (rep, editorInfo, evt) => {
  const line = rep.selStart[0];
  const col = rep.selStart[1];
  const lineEntry = rep.lines.atIndex(line);
  const text = (lineEntry && lineEntry.text) || '';
  const beforeCaret = text.slice(0, col);
  let indent = leadingIndent(text);
  if (/[{[(]\s*$/.test(beforeCaret)) indent += indentStr(indentSize);
  editorInfo.ace_replaceRange(rep.selStart, rep.selEnd, `\n${indent}`);
  evt.preventDefault();
  return true;
};

const handleTab = (rep, editorInfo, evt) => {
  const a = rep.selStart;
  const b = rep.selEnd;
  if (a[0] === b[0]) {
    editorInfo.ace_replaceRange(a, b, indentStr(indentSize));
  } else {
    const startLine = Math.min(a[0], b[0]);
    const endLine = Math.max(a[0], b[0]);
    for (let i = startLine; i <= endLine; i++) {
      editorInfo.ace_replaceRange([i, 0], [i, 0], indentStr(indentSize));
    }
  }
  evt.preventDefault();
  return true;
};

const handleShiftTab = (rep, editorInfo, evt) => {
  const a = rep.selStart;
  const b = rep.selEnd;
  const startLine = Math.min(a[0], b[0]);
  const endLine = Math.max(a[0], b[0]);
  let didAnything = false;
  for (let i = startLine; i <= endLine; i++) {
    const lineEntry = rep.lines.atIndex(i);
    const text = (lineEntry && lineEntry.text) || '';
    const m = /^([ \t]*)/.exec(text);
    if (!m || !m[1].length) continue;
    const removeCount = Math.min(m[1].length, indentSize);
    editorInfo.ace_replaceRange([i, 0], [i, removeCount], '');
    didAnything = true;
  }
  if (!didAnything) return false;
  evt.preventDefault();
  return true;
};

exports.handleKey = (hookName, ctx) => {
  if (!inCodeMode()) return false;
  const evt = ctx && ctx.evt;
  if (!evt || evt.type !== 'keydown') return false;
  const rep = ctx.rep;
  if (!rep || !rep.selStart || !rep.lines) return false;
  const editorInfo = ctx.editorInfo;
  if (!editorInfo || typeof editorInfo.ace_replaceRange !== 'function') return false;
  if (evt.keyCode === 13 && !evt.ctrlKey && !evt.altKey && !evt.metaKey && !evt.shiftKey) {
    return handleEnter(rep, editorInfo, evt);
  }
  if (evt.keyCode === 9 && !evt.ctrlKey && !evt.altKey && !evt.metaKey) {
    return evt.shiftKey ? handleShiftTab(rep, editorInfo, evt) : handleTab(rep, editorInfo, evt);
  }
  return false;
};
