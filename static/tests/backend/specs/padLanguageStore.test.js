'use strict';

const assert = require('assert').strict;
const common = require('ep_etherpad-lite/tests/backend/common');
const padManager = require('ep_etherpad-lite/node/db/PadManager');
const store = require('../../../../lib/padLanguageStore');

describe(__filename, function () {
  before(async function () { await common.init(); });

  it('returns auto-detect defaults when nothing has been stored', async function () {
    const padId = `lang-default-${common.randomString()}`;
    await padManager.getPad(padId, '\n');
    assert.deepEqual(await store.get(padId), {language: 'auto', autoDetect: true});
  });

  it('round-trips an explicit language', async function () {
    const padId = `lang-rt-${common.randomString()}`;
    await padManager.getPad(padId, '\n');
    await store.set(padId, {language: 'python', autoDetect: false});
    assert.deepEqual(await store.get(padId), {language: 'python', autoDetect: false});
  });

  it('rejects languages outside the allowlist', async function () {
    const padId = `lang-bad-${common.randomString()}`;
    await padManager.getPad(padId, '\n');
    await assert.rejects(
        () => store.set(padId, {language: 'esoteric-not-real', autoDetect: false}),
        /unsupported language/);
  });

  it('removes the entry when the pad is removed', async function () {
    const padId = `lang-rm-${common.randomString()}`;
    const pad = await padManager.getPad(padId, '\n');
    await store.set(padId, {language: 'go', autoDetect: false});
    await pad.remove();
    assert.deepEqual(await store.get(padId), {language: 'auto', autoDetect: true});
  });

  it('copies the entry when the pad is copied', async function () {
    const srcId = `lang-cp-src-${common.randomString()}`;
    const dstId = `lang-cp-dst-${common.randomString()}`;
    const src = await padManager.getPad(srcId, '\n');
    await store.set(srcId, {language: 'rust', autoDetect: false});
    await src.copy(dstId);
    assert.deepEqual(await store.get(dstId), {language: 'rust', autoDetect: false});
    const dst = await padManager.getPad(dstId);
    await src.remove();
    await dst.remove();
  });

  it('accepts highlight.js aliases (html → xml, js → javascript)', async function () {
    const padId1 = `lang-alias-html-${common.randomString()}`;
    await padManager.getPad(padId1, '\n');
    await store.set(padId1, {language: 'html', autoDetect: false});
    assert.deepEqual(await store.get(padId1), {language: 'html', autoDetect: false});

    const padId2 = `lang-alias-js-${common.randomString()}`;
    await padManager.getPad(padId2, '\n');
    await store.set(padId2, {language: 'js', autoDetect: false});
    assert.deepEqual(await store.get(padId2), {language: 'js', autoDetect: false});
  });
});
