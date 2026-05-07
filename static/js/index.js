'use strict';

const syntaxRenderer = require('ep_syntax_highlighting/static/js/syntaxRenderer');
const themeBridge = require('ep_syntax_highlighting/static/js/themeBridge');
const socketio = require('ep_etherpad-lite/static/js/socketio');
// Sub-path import keeps the client bundle clean.
const {padToggle} = require('ep_plugin_helpers/pad-toggle');

let socket = null;
let currentPadId = null;

const highlightToggle = padToggle({
  pluginName: 'ep_syntax_highlighting',
  settingId: 'syntax-highlighting',
  l10nId: 'ep_syntax_highlighting.user_enable',
  defaultLabel: 'Highlight syntax in pads',
  defaultEnabled: true,
});

exports.handleClientMessage_CLIENT_MESSAGE = highlightToggle.handleClientMessage_CLIENT_MESSAGE;

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
  themeBridge.start();

  // padToggle drives per-user / pad-wide enable. Wire it so syntaxRenderer
  // sees toggle changes.
  if (highlightToggle.subscribe) {
    highlightToggle.subscribe((enabled) => syntaxRenderer.setUserEnabled(enabled));
  }
};

exports.acePostWriteDomLineHTML = syntaxRenderer.acePostWriteDomLineHTML;

exports.aceEditorCSS = () => [
  'ep_syntax_highlighting/static/css/editor.css',
];
