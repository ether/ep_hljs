'use strict';

const assert = require('assert').strict;
const {parseHljsHtml} = require('../../../../static/js/hljsAdapter');

describe(__filename, function () {
  it('parses a single span', async function () {
    const ranges = parseHljsHtml('<span class="hljs-keyword">const</span> foo');
    assert.deepEqual(ranges, [{start: 0, end: 5, cls: 'hljs-keyword'}]);
  });

  it('decodes HTML entities when computing positions', async function () {
    const ranges = parseHljsHtml('<span class="hljs-string">&quot;hi&quot;</span>');
    assert.deepEqual(ranges, [{start: 0, end: 4, cls: 'hljs-string'}]);
  });

  it('emits one range per class on multi-class spans', async function () {
    const ranges = parseHljsHtml('<span class="hljs-meta hljs-string">@foo</span>');
    assert.equal(ranges.length, 2);
    const classes = ranges.map((r) => r.cls).sort();
    assert.deepEqual(classes, ['hljs-meta', 'hljs-string']);
    assert.equal(ranges[0].start, 0);
    assert.equal(ranges[0].end, 4);
  });

  it('handles nested spans (inner opens after outer)', async function () {
    const html = '<span class="hljs-string">"hello <span class="hljs-subst">${x}</span>"</span>';
    const ranges = parseHljsHtml(html);
    // Outer covers the whole string; inner covers the interpolation.
    const subst = ranges.find((r) => r.cls === 'hljs-subst');
    const string = ranges.find((r) => r.cls === 'hljs-string');
    assert.ok(subst);
    assert.ok(string);
    assert.equal(string.start, 0);
    assert.equal(string.end, 12); // "hello ${x}"
    assert.equal(subst.start, 7);
    assert.equal(subst.end, 11);
  });

  it('returns empty array for plain text', async function () {
    assert.deepEqual(parseHljsHtml('just text'), []);
  });
});
