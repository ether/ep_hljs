'use strict';

const syntaxRenderer = require('ep_syntax_highlighting/static/js/syntaxRenderer');
const codeIndent = require('ep_syntax_highlighting/static/js/codeIndent');
const themeBridge = require('ep_syntax_highlighting/static/js/themeBridge');
const socketio = require('ep_etherpad-lite/static/js/socketio');
// Sub-path import keeps the client bundle clean.
const {padToggle} = require('ep_plugin_helpers/pad-toggle');
const {padSelect} = require('ep_plugin_helpers/pad-select');

let socket = null;
let currentPadId = null;

const highlightToggle = padToggle({
  pluginName: 'ep_syntax_highlighting',
  settingId: 'syntax-highlighting',
  l10nId: 'ep_syntax_highlighting.user_enable',
  defaultLabel: 'Highlight syntax in pads',
  defaultEnabled: true,
});

const indentSelect = padSelect({
  pluginName: 'ep_syntax_highlighting',
  settingId: 'indent-size',
  l10nId: 'ep_syntax_highlighting.indent_size',
  defaultLabel: 'Indent size',
  options: [
    {value: 2, label: '2 spaces'},
    {value: 4, label: '4 spaces'},
  ],
  defaultValue: 2,
});

// Both helpers re-export handleClientMessage_CLIENT_MESSAGE so each can refresh
// its own UI on padoptions broadcasts; chain both invocations.
exports.handleClientMessage_CLIENT_MESSAGE = (hookName, ctx) => {
  highlightToggle.handleClientMessage_CLIENT_MESSAGE(hookName, ctx);
  indentSelect.handleClientMessage_CLIENT_MESSAGE(hookName, ctx);
};

const loadHljs = () => {
  if (typeof window !== 'undefined' && window.hljs) return Promise.resolve();
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = '/static/plugins/ep_syntax_highlighting/static/js/vendor/hljs.min.js';
    script.onload = resolve;
    script.onerror = resolve;
    document.head.appendChild(script);
  });
};

const onLanguageChanged = (msg) => {
  const sel = document.getElementById('ep_syntax_highlighting_select');
  if (sel) {
    const newVal = msg.autoDetect ? 'auto' : msg.language;
    sel.value = newVal;
    const $ = window.$;
    if ($ && $.fn && $.fn.niceSelect) $(sel).niceSelect('update');
  }
  syntaxRenderer.setState({language: msg.language, autoDetect: !!msg.autoDetect});
};

exports.postAceInit = async (hookName, context) => {
  await loadHljs();
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

  // Reflect initial language in the dropdown without dispatching a change event.
  const sel = document.getElementById('ep_syntax_highlighting_select');
  if (sel) {
    sel.value = initial.autoDetect ? 'auto' : initial.language;
    const $ = window.$;
    if ($ && $.fn && $.fn.niceSelect) $(sel).niceSelect('update');
    const handler = () => {
      const val = sel.value;
      const payload = val === 'auto'
        ? {padId: currentPadId, language: 'auto', autoDetect: true}
        : {padId: currentPadId, language: val, autoDetect: false};
      socket.emit('setLanguage', payload);
    };
    if ($ && $.fn) $(sel).on('change', handler);
    else sel.addEventListener('change', handler);
  }

  syntaxRenderer.start(context, initial);
  codeIndent.start({
    indentSize: 2, // padSelect.init() fires onChange synchronously below with the effective value
    getLanguage: () => syntaxRenderer.getState().language,
    getAutoDetect: () => syntaxRenderer.getState().autoDetect,
  });
  themeBridge.start();

  // padToggle drives per-user / pad-wide enable. init() binds the checkboxes
  // (without it, the checkboxes render unchecked even when defaultEnabled is
  // true — the helper renders empty <input type="checkbox"> server-side and
  // relies on init() to set the correct state from cookie/pad option/default).
  highlightToggle.init({
    onChange: (enabled) => syntaxRenderer.setUserEnabled(enabled),
  });

  // padSelect drives the indent-size dropdown. init() fires onChange once with
  // the effective initial value (cookie / pad option / default), and again
  // whenever the user changes the dropdown OR a remote padoptions broadcast
  // arrives via handleClientMessage_CLIENT_MESSAGE.
  indentSelect.init({
    onChange: (size) => codeIndent.setIndentSize(size),
  });
};

exports.acePostWriteDomLineHTML = syntaxRenderer.acePostWriteDomLineHTML;
exports.aceKeyEvent = codeIndent.handleKey;

exports.aceEditorCSS = () => [
  'ep_syntax_highlighting/static/css/editor.css',
];
