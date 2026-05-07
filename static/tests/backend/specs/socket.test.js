'use strict';

const assert = require('assert').strict;
const io = require('socket.io-client');
const common = require('ep_etherpad-lite/tests/backend/common');
const padManager = require('ep_etherpad-lite/node/db/PadManager');
const store = require('ep_syntax_highlighting/lib/padLanguageStore');

const NS = '/syntax-highlighting';

const connect = () => io(
    `http://localhost:${common.httpServer.address().port}${NS}`,
    {transports: ['websocket'], forceNew: true});

describe(__filename, function () {
  before(async function () { await common.init(); });

  it('persists and broadcasts a language change', async function () {
    const padId = `lang-sock-${common.randomString()}`;
    await padManager.getPad(padId, '\n');

    const a = connect();
    const b = connect();
    await Promise.all([
      new Promise((r) => a.once('connect', r)),
      new Promise((r) => b.once('connect', r)),
    ]);
    a.emit('joinPad', {padId});
    b.emit('joinPad', {padId});

    const heard = new Promise((r) => b.once('languageChanged', r));
    a.emit('setLanguage', {padId, language: 'python', autoDetect: false});
    const msg = await heard;
    assert.deepEqual(msg, {padId, language: 'python', autoDetect: false});
    assert.deepEqual(await store.get(padId), {language: 'python', autoDetect: false});

    a.disconnect();
    b.disconnect();
  });

  it('rejects unsupported languages without persisting', async function () {
    const padId = `lang-bad-${common.randomString()}`;
    await padManager.getPad(padId, '\n');
    const a = connect();
    await new Promise((r) => a.once('connect', r));
    a.emit('joinPad', {padId});
    const ack = new Promise((r) => a.once('languageChangeRejected', r));
    a.emit('setLanguage', {padId, language: 'totally-fake', autoDetect: false});
    const reason = await ack;
    assert.match(reason.error, /unsupported language/);
    assert.deepEqual(await store.get(padId), {language: 'auto', autoDetect: true});
    a.disconnect();
  });
});
