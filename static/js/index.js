'use strict';

const controller = require('ep_syntax_highlighting/static/js/highlightController');

let socket = null;
let currentPadId = null;

const onLanguageChanged = (msg) => {
  const sel = document.getElementById('ep_syntax_highlighting_select');
  if (sel) sel.value = msg.autoDetect ? 'auto' : msg.language;
  document.dispatchEvent(new CustomEvent('ep_syntax_highlighting:change', {detail: msg}));
};

exports.postAceInit = (hookName, context) => {
  currentPadId = context.pad.getPadId();
  const initial = (typeof clientVars !== 'undefined' && clientVars.ep_syntax_highlighting) ||
    {language: 'auto', autoDetect: true};

  // eslint-disable-next-line no-undef
  socket = io.connect('/syntax-highlighting');
  socket.on('connect', () => socket.emit('joinPad', {padId: currentPadId}));
  socket.on('languageChanged', onLanguageChanged);
  socket.on('languageChangeRejected', (reason) => {
    console.warn('[ep_syntax_highlighting] language change rejected:', reason && reason.error);
  });

  onLanguageChanged({padId: currentPadId, ...initial});

  const sel = document.getElementById('ep_syntax_highlighting_select');
  if (sel) {
    sel.addEventListener('change', () => {
      const val = sel.value;
      const payload = val === 'auto'
        ? {padId: currentPadId, language: 'auto', autoDetect: true}
        : {padId: currentPadId, language: val, autoDetect: false};
      socket.emit('setLanguage', payload);
    });
  }

  controller.start(context, initial);
  document.addEventListener('ep_syntax_highlighting:change', (e) => controller.setState(e.detail));
  setInterval(() => controller.tickAutoRedetect(), 1000);
};

exports.aceEditEvent = (hookName, context) => {
  controller.onEdit();
};
