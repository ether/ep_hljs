'use strict';

const assert = require('assert').strict;
const {JSDOM} = require('jsdom');
const wrapTokens = require('../../../../static/js/textNodeWrapper');

const makeLine = (innerHTML) => {
  const dom = new JSDOM('<!DOCTYPE html><div id="x"></div>');
  const div = dom.window.document.getElementById('x');
  div.innerHTML = innerHTML;
  global.NodeFilter = dom.window.NodeFilter;
  global.document = dom.window.document;
  return {div, doc: dom.window.document};
};

describe(__filename, function () {
  it('wraps a single token in a plain-text line', async function () {
    const {div} = makeLine('while (true) {}');
    wrapTokens(div, [{start: 0, end: 5, cls: 'hljs-keyword'}]);
    assert.match(div.innerHTML, /<span class="hljs-keyword">while<\/span>/);
    assert.equal(div.textContent, 'while (true) {}');
  });

  it('wraps multiple tokens preserving order and text', async function () {
    const {div} = makeLine('const foo = "bar";');
    wrapTokens(div, [
      {start: 0, end: 5, cls: 'hljs-keyword'},
      {start: 12, end: 17, cls: 'hljs-string'},
    ]);
    const html = div.innerHTML;
    assert.ok(html.includes('<span class="hljs-keyword">const</span>'));
    assert.ok(html.includes('<span class="hljs-string">"bar"</span>'));
    assert.equal(div.textContent, 'const foo = "bar";');
  });

  it('wraps within an existing parent span (e.g. author span)', async function () {
    const {div} = makeLine('<span class="author-aXX">while</span>');
    wrapTokens(div, [{start: 0, end: 5, cls: 'hljs-keyword'}]);
    assert.match(div.innerHTML,
        /<span class="author-aXX"><span class="hljs-keyword">while<\/span><\/span>/);
    assert.equal(div.textContent, 'while');
  });

  it('skips ranges that fall outside the text content', async function () {
    const {div} = makeLine('hi');
    wrapTokens(div, [{start: 5, end: 10, cls: 'hljs-keyword'}]);
    assert.equal(div.textContent, 'hi');
    assert.ok(!div.innerHTML.includes('hljs-keyword'));
  });

  it('idempotent: wrapping twice with the same ranges produces the same DOM', async function () {
    const {div} = makeLine('const x');
    const ranges = [{start: 0, end: 5, cls: 'hljs-keyword'}];
    wrapTokens(div, ranges);
    const first = div.innerHTML;
    wrapTokens(div, ranges);
    assert.equal(div.innerHTML, first);
  });
});
