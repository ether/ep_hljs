'use strict';

const assert = require('assert').strict;
const LRU = require('../../../../static/js/lruCache');

describe(__filename, function () {
  it('stores and retrieves values', async function () {
    const c = new LRU(3);
    c.set('a', 1);
    c.set('b', 2);
    assert.equal(c.get('a'), 1);
    assert.equal(c.get('b'), 2);
    assert.equal(c.get('missing'), undefined);
  });

  it('evicts oldest when capacity exceeded', async function () {
    const c = new LRU(2);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    assert.equal(c.has('a'), false);
    assert.equal(c.get('b'), 2);
    assert.equal(c.get('c'), 3);
  });

  it('refreshes recency on get', async function () {
    const c = new LRU(2);
    c.set('a', 1);
    c.set('b', 2);
    c.get('a');
    c.set('c', 3);
    assert.equal(c.has('a'), true);
    assert.equal(c.has('b'), false);
    assert.equal(c.get('c'), 3);
  });

  it('clear empties the cache', async function () {
    const c = new LRU(3);
    c.set('a', 1);
    c.set('b', 2);
    c.clear();
    assert.equal(c.size, 0);
    assert.equal(c.get('a'), undefined);
  });
});
