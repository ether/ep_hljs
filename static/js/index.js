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
};

exports.aceEditEvent = (_hookName, _context) => {
  controller.onEdit();
};

exports.aceEditorCSS = () => [
  'ep_syntax_highlighting/static/css/editor.css',
  'ep_syntax_highlighting/static/css/themes/github.css',
];

const ATTR_KEY = 'syntax-tk';

exports.aceAttribsToClasses = (hookName, context) => {
  if (context.key === ATTR_KEY && context.value) return [context.value];
  return [];
};

// Applies per-line token-attribute updates. Each entry is either
// `{line, ranges: [{start, end, cls}, ...]}` (apply) or `{line, ranges: null}` (clear).
// We never touch the line containing the caret — the controller filters those out.
const applyTokenAttributesPerLine = function (updates) {
  const dam = this.documentAttributeManager;
  const rep = this.rep;
  if (!dam || !rep || !rep.lines) return;
  const lineCount = rep.lines.length();
  for (const u of updates) {
    if (u.line < 0 || u.line >= lineCount) continue;
    const lineText = rep.lines.atIndex(u.line).text || '';
    const lineLen = lineText.length;
    if (lineLen === 0) continue;
    // Clear this line's syntax-tk attributes.
    try {
      dam.setAttributesOnRange([u.line, 0], [u.line, lineLen], [[ATTR_KEY, '']]);
    } catch (_e) { continue; }
    if (!u.ranges) continue;
    for (const r of u.ranges) {
      if (!r || r.start >= r.end || !r.cls) continue;
      if (r.start < 0 || r.end > lineLen) continue;
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
