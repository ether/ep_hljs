'use strict';

const store = require('./lib/padLanguageStore');
const eejs = require('ep_etherpad-lite/node/eejs/');
const renderer = require('./lib/exportRenderer');
const {padToggle} = require('ep_plugin_helpers/pad-toggle-server');

// Parallel User Settings + Pad Wide Settings checkboxes for the per-user
// "Highlight syntax in pads" toggle. Helper owns checkbox rendering, cookie
// persistence, broadcast/sync, enforceSettings, and i18n wiring.
const highlightToggle = padToggle({
  pluginName: 'ep_syntax_highlighting',
  settingId: 'syntax-highlighting',
  l10nId: 'ep_syntax_highlighting.user_enable',
  defaultLabel: 'Highlight syntax in pads',
  defaultEnabled: true,
});

exports.loadSettings = highlightToggle.loadSettings;
exports.eejsBlock_mySettings = highlightToggle.eejsBlock_mySettings;
exports.eejsBlock_padSettings = highlightToggle.eejsBlock_padSettings;

// Compose padToggle.clientVars (writes ep_plugin_helpers.padToggle.<pluginName>)
// with our own language store payload (writes ep_syntax_highlighting). They
// live under different top-level keys so they don't collide.
const toggleClientVars = highlightToggle.clientVars;

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
  return {
    ...(toggleVars || {}),
    ep_syntax_highlighting: value,
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

exports.eejsBlock_editbarMenuLeft = (hookName, args, cb) => {
  args.content += eejs.require('ep_syntax_highlighting/templates/editbarButtons.ejs', {}, module);
  cb();
};

exports.getLineHTMLForExport = async (hookName, context) => {
  if (!context || typeof context.lineContent !== 'string') return;
  context.lineContent = await renderer.renderLine(context.padId, context.lineContent);
};

exports.stylesForExport = async () => await renderer.stylesForExport();
