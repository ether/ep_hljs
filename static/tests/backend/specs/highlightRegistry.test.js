'use strict';

const assert = require('assert').strict;
const {JSDOM} = require('jsdom');
const {buildRange, buildSegments} = require('../../../../static/js/highlightRegistry');

const makeLine = (innerHTML) => {
  const dom = new JSDOM('<!DOCTYPE html><div id="x"></div>');
  const div = dom.window.document.getElementById('x');
  div.innerHTML = innerHTML;
  return {div, win: dom.window};
};

describe(__filename, function () {
  it('builds segments across nested elements', async function () {
    const {div, win} = makeLine('hello <span class="a">world</span>!');
    const segs = buildSegments(div, win);
    const total = segs.reduce((s, x) => s + x.len, 0);
    assert.equal(total, 'hello world!'.length);
    assert.equal(segs.length, 3);
    assert.equal(segs[0].node.nodeValue, 'hello ');
    assert.equal(segs[1].node.nodeValue, 'world');
    assert.equal(segs[2].node.nodeValue, '!');
  });

  it('buildRange spans a single text node', async function () {
    const {div, win} = makeLine('while (true) {}');
    const segs = buildSegments(div, win);
    const range = buildRange(div.ownerDocument, segs, 0, 5);
    assert.ok(range);
    assert.equal(range.toString(), 'while');
  });

  it('buildRange spans across nested elements', async function () {
    const {div, win} = makeLine('<span class="a">while</span> (true) {}');
    const segs = buildSegments(div, win);
    const range = buildRange(div.ownerDocument, segs, 0, 5);
    assert.ok(range);
    assert.equal(range.toString(), 'while');
    const range2 = buildRange(div.ownerDocument, segs, 7, 11);
    assert.ok(range2);
    assert.equal(range2.toString(), 'true');
  });

  it('buildRange returns null for out-of-bounds ranges', async function () {
    const {div, win} = makeLine('hi');
    const segs = buildSegments(div, win);
    const range = buildRange(div.ownerDocument, segs, 5, 10);
    assert.equal(range, null);
  });

  it('buildRange handles wide range covering multiple text nodes', async function () {
    const {div, win} = makeLine('abc<span class="x">DEF</span>ghi');
    const segs = buildSegments(div, win);
    const range = buildRange(div.ownerDocument, segs, 1, 8);
    assert.ok(range);
    assert.equal(range.toString(), 'bcDEFgh');
  });
});
