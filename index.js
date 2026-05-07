'use strict';

const store = require('./lib/padLanguageStore');

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

exports.clientVars = async (hook, {pad}) => {
  const value = await store.get(pad.id);
  return {ep_syntax_highlighting: value};
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
