'use strict';

const assert = require('assert').strict;
const io = require('socket.io-client');
const common = require('ep_etherpad-lite/tests/backend/common');
const padManager = require('ep_etherpad-lite/node/db/PadManager');
const store = require('../../../../lib/padLanguageStore');

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
      new Promise((resolve) => a.once('connect', resolve)),
      new Promise((resolve) => b.once('connect', resolve)),
    ]);
    a.emit('joinPad', {padId});
    b.emit('joinPad', {padId});

    const heard = new Promise((resolve) => b.once('languageChanged', resolve));
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
    await new Promise((resolve) => a.once('connect', resolve));
    a.emit('joinPad', {padId});
    const ack = new Promise((resolve) => a.once('languageChangeRejected', resolve));
    a.emit('setLanguage', {padId, language: 'totally-fake', autoDetect: false});
    const reason = await ack;
    assert.match(reason.error, /unsupported language/);
    assert.deepEqual(await store.get(padId), {language: 'auto', autoDetect: true});
    a.disconnect();
  });
});
