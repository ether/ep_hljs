'use strict';

const controller = require('ep_syntax_highlighting/static/js/highlightController');
const themeBridge = require('ep_syntax_highlighting/static/js/themeBridge');
const socketio = require('ep_etherpad-lite/static/js/socketio');

let socket = null;
let currentPadId = null;

const onLanguageChanged = (msg) => {
  const sel = document.getElementById('ep_syntax_highlighting_select');
  if (sel) {
    const newVal = msg.autoDetect ? 'auto' : msg.language;
    sel.value = newVal;
    // If the colibris skin wrapped this select with nice-select, keep the
    // custom widget in sync without re-triggering the 'change' listener.
    const $ = window.$;
    if ($ && $.fn && $.fn.niceSelect) {
      $(sel).niceSelect('update');
    }
  }
  document.dispatchEvent(new CustomEvent('ep_syntax_highlighting:change', {detail: msg}));
};

exports.postAceInit = (hookName, context) => {
  currentPadId = context.pad.getPadId();
  const initial = (typeof clientVars !== 'undefined' && clientVars.ep_syntax_highlighting) ||
    {language: 'auto', autoDetect: true};

  const pad = require('ep_etherpad-lite/static/js/pad');
  socket = socketio.connect(pad.baseURL || '/', '/syntax-highlighting');
  socket.on('connect', () => socket.emit('joinPad', {padId: currentPadId}));
  socket.on('languageChanged', onLanguageChanged);
  socket.on('languageChangeRejected', (reason) => {
    console.warn('[ep_syntax_highlighting] language change rejected:', reason && reason.error);
  });

  onLanguageChanged({padId: currentPadId, ...initial});

  const sel = document.getElementById('ep_syntax_highlighting_select');
  if (sel) {
    // Use jQuery's .on() so the handler fires whether the colibris nice-select widget
    // triggers the change via jQuery .trigger('change') or via a native DOM event.
    const $ = window.$;
    const handler = () => {
      const val = sel.value;
      const payload = val === 'auto'
        ? {padId: currentPadId, language: 'auto', autoDetect: true}
        : {padId: currentPadId, language: val, autoDetect: false};
      socket.emit('setLanguage', payload);
    };
    if ($ && $.fn) {
      $(sel).on('change', handler);
    } else {
      sel.addEventListener('change', handler);
    }
  }

  controller.start(context, initial);
  themeBridge.start();
  document.addEventListener('ep_syntax_highlighting:change', (e) => controller.setState(e.detail));
  setInterval(() => controller.tickAutoRedetect(), 1000);

  // Per-user enable/disable checkbox in the pad settings panel.
  const userToggle = document.getElementById('ep_syntax_highlighting_user_enabled');
  if (userToggle) {
    try {
      const stored = window.localStorage.getItem('ep_syntax_highlighting.user_enabled');
      userToggle.checked = stored !== 'false';
    } catch (_e) { /* localStorage unavailable */ }
    userToggle.addEventListener('change', () => {
      try {
        window.localStorage.setItem('ep_syntax_highlighting.user_enabled',
            userToggle.checked ? 'true' : 'false');
      } catch (_e) { /* ignore */ }
      // Re-trigger the controller: setState clears applied attrs, then
      // schedule fires; if user just disabled, tokenize bails early.
      controller.setState({...initial, language: clientVars.ep_syntax_highlighting.language,
        autoDetect: clientVars.ep_syntax_highlighting.autoDetect});
    });
  }
};

exports.aceEditEvent = (_hookName, call) => {
  // Only trigger re-tokenize on actual text changes. Navigation events
  // (Home, End, arrow keys) and selection-only events should NOT cause us
  // to apply attributes — applying setAttributesOnRange on a range that
  // crosses the caret moves the caret to the start of the range.
  if (call && call.callstack && call.callstack.docTextChanged) {
    controller.onEdit();
  }
};

exports.aceEditorCSS = () => [
  'ep_syntax_highlighting/static/css/editor.css',
  'ep_syntax_highlighting/static/css/themes/github.css',
];

const ATTR_KEY = 'syntax-tk';

exports.aceAttribsToClasses = (hookName, context) => {
  if (context.key !== ATTR_KEY) return [];
  const v = context.value;
  if (!v) return [];
  // The sentinel '__cleared__' is rendered as a no-op class. Returning a
  // distinct non-empty class forces Etherpad's renderer to replace the
  // previous hljs-* class with this one (rather than retaining the old
  // class because the hook returned []).
  if (v === '__cleared__') return ['ep_syntax_highlighting_cleared'];
  return [v];
};

// Applies per-line token-attribute updates. For non-active lines, does a
// full wide clear + per-token apply. For the line containing the user's
// caret, skips the wide clear (which would move the caret to the start of
// the range) and skips any narrow token range that crosses the caret —
// applying setAttributesOnRange on [a, b] when a < caret < b moves the
// caret to a. Stale tokens on the active line will be cleared on the next
// tokenize after the caret moves to a different line.
const applyTokenAttributesPerLine = function (updates) {
  const dam = this.documentAttributeManager;
  const rep = this.rep;
  if (!dam || !rep || !rep.lines) return;
  const lineCount = rep.lines.length();
  const activeLine = rep.selStart ? rep.selStart[0] : -1;
  const activeCol = rep.selStart ? rep.selStart[1] : -1;
  for (const u of updates) {
    if (u.line < 0 || u.line >= lineCount) continue;
    const lineText = rep.lines.atIndex(u.line).text || '';
    const lineLen = lineText.length;
    if (lineLen === 0) continue;
    const isActive = u.line === activeLine;
    if (!isActive) {
      // Wide clear with sentinel forces Etherpad to re-render the whole line
      // without the previously-applied hljs-* classes.
      try {
        dam.setAttributesOnRange([u.line, 0], [u.line, lineLen],
            [[ATTR_KEY, '__cleared__']]);
      } catch (_e) { continue; }
    }
    if (!u.ranges) continue;
    for (const r of u.ranges) {
      if (!r || r.start >= r.end || !r.cls) continue;
      if (r.start < 0 || r.end > lineLen) continue;
      // On the active line, skip ranges that strictly contain the caret —
      // applying them would move the caret to the start of the range.
      if (isActive && activeCol > r.start && activeCol < r.end) continue;
      try {
        dam.setAttributesOnRange([u.line, r.start], [u.line, r.end], [[ATTR_KEY, r.cls]]);
      } catch (_e) { /* skip invalid range */ }
    }
  }
};

exports.aceInitialized = (hookName, context) => {
  context.editorInfo.ace_applyTokenAttributesPerLine =
      applyTokenAttributesPerLine.bind(context);
};
