'use strict';

let socket = null;
let currentPadId = null;

const onLanguageChanged = (msg) => {
  const sel = document.getElementById('ep_syntax_highlighting_select');
  if (!sel) return;
  sel.value = msg.autoDetect ? 'auto' : msg.language;
  // Controller hookup arrives in Task 5.
  document.dispatchEvent(new CustomEvent('ep_syntax_highlighting:change', {detail: msg}));
};

exports.postAceInit = (hookName, context) => {
  currentPadId = context.pad.getPadId();
  const initial = (typeof clientVars !== 'undefined' && clientVars.ep_syntax_highlighting) ||
    {language: 'auto', autoDetect: true};

  // Connect to plugin socket namespace.
  // eslint-disable-next-line no-undef
  socket = io.connect('/syntax-highlighting');
  socket.on('connect', () => socket.emit('joinPad', {padId: currentPadId}));
  socket.on('languageChanged', onLanguageChanged);

  // Apply initial state to dropdown.
  onLanguageChanged({padId: currentPadId, ...initial});

  const sel = document.getElementById('ep_syntax_highlighting_select');
  if (!sel) return;
  sel.addEventListener('change', () => {
    const val = sel.value;
    const payload = val === 'auto'
      ? {padId: currentPadId, language: 'auto', autoDetect: true}
      : {padId: currentPadId, language: val, autoDetect: false};
    socket.emit('setLanguage', payload);
  });
};
