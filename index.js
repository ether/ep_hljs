'use strict';

const {template} = require('ep_plugin_helpers');

const store = require('./lib/padLanguageStore');
const eejs = require('ep_etherpad-lite/node/eejs/');
const renderer = require('./lib/exportRenderer');
const {padToggle} = require('ep_plugin_helpers/pad-toggle-server');
const {padSelect} = require('ep_plugin_helpers/pad-select-server');

// Parallel User Settings + Pad Wide Settings checkboxes for the per-user
// "Highlight syntax in pads" toggle. Helper owns checkbox rendering, cookie
// persistence, broadcast/sync, enforceSettings, and i18n wiring.
const highlightToggle = padToggle({
  pluginName: 'ep_hljs',
  settingId: 'syntax-highlighting',
  l10nId: 'ep_hljs.user_enable',
  defaultLabel: 'Highlight syntax in pads',
  defaultEnabled: true,
});

// Indent size dropdown (2 vs 4 spaces) for code-mode indenting.
const indentSelect = padSelect({
  pluginName: 'ep_hljs',
  settingId: 'indent-size',
  l10nId: 'ep_hljs.indent_size',
  defaultLabel: 'Indent size',
  options: [
    {value: 2, label: '2 spaces', l10nId: 'ep_hljs.indent_2'},
    {value: 4, label: '4 spaces', l10nId: 'ep_hljs.indent_4'},
  ],
  defaultValue: 2,
});

exports.loadSettings = async (hookName, args) => {
  await highlightToggle.loadSettings(hookName, args);
  await indentSelect.loadSettings(hookName, args);
};

exports.eejsBlock_mySettings = (hookName, args, cb) => {
  highlightToggle.eejsBlock_mySettings(hookName, args, () => {
    indentSelect.eejsBlock_mySettings(hookName, args, cb);
  });
};

exports.eejsBlock_padSettings = (hookName, args, cb) => {
  highlightToggle.eejsBlock_padSettings(hookName, args, () => {
    indentSelect.eejsBlock_padSettings(hookName, args, cb);
  });
};

const toggleClientVars = highlightToggle.clientVars;
const indentClientVars = indentSelect.clientVars;

exports.padRemove = async (hookName, {pad}) => {
  await store.remove(pad.id);
};

exports.padCopy = async (hookName, {srcPad, dstPad}) => {
  const value = await store.get(srcPad.id);
  // Only copy non-default settings to keep db clean.
  if (value.language !== 'auto' || value.autoDetect !== true) {
    await store.set(dstPad.id, value);
  }
};

exports.clientVars = async (hook, context) => {
  const value = await store.get(context.pad.id);
  const toggleVars = await toggleClientVars(hook, context);
  const indentVars = await indentClientVars(hook, context);
  // padToggle writes ep_plugin_helpers.padToggle.<pluginName>; padSelect
  // writes ep_plugin_helpers.padSelect.<pluginName>. They live under different
  // helper-name keys so a shallow merge of ep_plugin_helpers is enough.
  return {
    ep_plugin_helpers: {
      ...((toggleVars && toggleVars.ep_plugin_helpers) || {}),
      ...((indentVars && indentVars.ep_plugin_helpers) || {}),
    },
    ep_hljs: value,
  };
};

exports.socketio = (hookName, {io}) => {
  const ns = io.of('/syntax-highlighting');
  ns.on('connection', (socket) => {
    socket.on('joinPad', ({padId}) => {
      if (typeof padId !== 'string' || !padId) return;
      socket.join(padId);
    });
    socket.on('setLanguage', async ({padId, language, autoDetect}) => {
      try {
        await store.set(padId, {language, autoDetect});
        ns.to(padId).emit('languageChanged', {padId, language, autoDetect: !!autoDetect});
      } catch (err) {
        socket.emit('languageChangeRejected', {error: err.message});
      }
    });
  });
};

exports.eejsBlock_editbarMenuLeft =
    template('ep_hljs/templates/editbarButtons.ejs');

exports.getLineHTMLForExport = async (hookName, context) => {
  if (!context || typeof context.lineContent !== 'string') return;
  context.lineContent = await renderer.renderLine(context.padId, context.lineContent);
};

exports.stylesForExport = async () => await renderer.stylesForExport();
