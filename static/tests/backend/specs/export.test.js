'use strict';

const assert = require('assert').strict;
const common = require('ep_etherpad-lite/tests/backend/common');
const padManager = require('ep_etherpad-lite/node/db/PadManager');
const store = require('../../../../lib/padLanguageStore');
const renderer = require('../../../../lib/exportRenderer');

describe(__filename, function () {
  before(async function () { await common.init(); });

  it('wraps tokens in hljs spans for an explicit language', async function () {
    const padId = `export-explicit-${common.randomString()}`;
    await padManager.getPad(padId, '\n');
    await store.set(padId, {language: 'python', autoDetect: false});
    const html = await renderer.renderLine(padId, 'def add(a, b): return a + b');
    assert.match(html, /<span class="hljs-keyword">def<\/span>/);
  });

  it('uses auto-detect when autoDetect=true', async function () {
    const padId = `export-auto-${common.randomString()}`;
    await padManager.getPad(padId, '\n');
    const html = await renderer.renderLine(padId, 'function f() { return 1; }');
    // hljs wraps function in hljs-function or hljs-keyword depending on the
    // detected language; just assert that some highlighting span was emitted.
    assert.match(html, /<span class="hljs-/);
  });

  it('returns plain escaped text for plaintext or auto with no signal', async function () {
    const padId = `export-plain-${common.randomString()}`;
    await padManager.getPad(padId, '\n');
    const html = await renderer.renderLine(padId, '');
    assert.equal(html, '');
  });

  it('emits theme css through stylesForExport hook', async function () {
    const css = await renderer.stylesForExport();
    assert.match(css, /\.hljs-keyword/);
  });

  it('does not throw on a malformed line (failsoft)', async function () {
    const padId = `export-soft-${common.randomString()}`;
    await padManager.getPad(padId, '\n');
    const html = await renderer.renderLine(padId, ' weird�');
    assert.match(html, /weird/);
  });
});
