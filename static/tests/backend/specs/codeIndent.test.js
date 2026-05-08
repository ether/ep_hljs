'use strict';

const assert = require('assert').strict;
const codeIndent = require('../../../../static/js/codeIndent');

const makeRep = (lines, sel) => ({
  selStart: sel.start,
  selEnd: sel.end || sel.start,
  lines: {
    atIndex: (i) => ({text: lines[i] || ''}),
  },
});

const makeEditorInfo = () => {
  const calls = [];
  return {
    calls,
    ace_replaceRange: (a, b, text) => calls.push({a, b, text}),
  };
};

const makeEvt = (overrides = {}) => ({
  type: 'keydown',
  keyCode: 13,
  shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
  preventDefault: () => {},
  ...overrides,
});

describe(__filename, function () {
  beforeEach(async function () {
    codeIndent.start({
      indentSize: 2,
      getLanguage: () => 'javascript',
      getAutoDetect: () => false, // simulate user explicitly picked the language
    });
  });

  it('Enter on empty line inserts plain newline (no extra indent)', async function () {
    const rep = makeRep([''], {start: [0, 0]});
    const ei = makeEditorInfo();
    const handled = codeIndent.handleKey('aceKeyEvent',
        {evt: makeEvt({keyCode: 13}), rep, editorInfo: ei});
    assert.equal(handled, true);
    assert.equal(ei.calls.length, 1);
    assert.equal(ei.calls[0].text, '\n');
  });

  it('Enter inherits previous line\'s leading indent', async function () {
    const rep = makeRep(['    foo'], {start: [0, 7]});
    const ei = makeEditorInfo();
    codeIndent.handleKey('aceKeyEvent', {evt: makeEvt({keyCode: 13}), rep, editorInfo: ei});
    assert.equal(ei.calls[0].text, '\n    ');
  });

  it('Enter after `{` adds one extra indent level', async function () {
    const rep = makeRep(['if (x) {'], {start: [0, 8]});
    const ei = makeEditorInfo();
    codeIndent.handleKey('aceKeyEvent', {evt: makeEvt({keyCode: 13}), rep, editorInfo: ei});
    assert.equal(ei.calls[0].text, '\n  ');
  });

  it('Enter after `{` on already-indented line stacks indents', async function () {
    const rep = makeRep(['  while (cond) {'], {start: [0, 16]});
    const ei = makeEditorInfo();
    codeIndent.handleKey('aceKeyEvent', {evt: makeEvt({keyCode: 13}), rep, editorInfo: ei});
    assert.equal(ei.calls[0].text, '\n    ');
  });

  it('Enter after `[` and `(` also indent', async function () {
    const rep = makeRep(['arr = ['], {start: [0, 7]});
    const ei = makeEditorInfo();
    codeIndent.handleKey('aceKeyEvent', {evt: makeEvt({keyCode: 13}), rep, editorInfo: ei});
    assert.equal(ei.calls[0].text, '\n  ');
  });

  it('Tab inserts indentSize spaces at caret', async function () {
    const rep = makeRep(['foo'], {start: [0, 3]});
    const ei = makeEditorInfo();
    const handled = codeIndent.handleKey('aceKeyEvent',
        {evt: makeEvt({keyCode: 9}), rep, editorInfo: ei});
    assert.equal(handled, true);
    assert.equal(ei.calls[0].text, '  ');
  });

  it('Tab with multi-line selection indents each selected line', async function () {
    const rep = makeRep(['a', 'b', 'c'], {start: [0, 0], end: [2, 1]});
    const ei = makeEditorInfo();
    codeIndent.handleKey('aceKeyEvent', {evt: makeEvt({keyCode: 9}), rep, editorInfo: ei});
    assert.equal(ei.calls.length, 3);
    for (const c of ei.calls) assert.equal(c.text, '  ');
  });

  it('Shift+Tab removes leading whitespace up to indentSize', async function () {
    const rep = makeRep(['    deep'], {start: [0, 4]});
    const ei = makeEditorInfo();
    codeIndent.handleKey('aceKeyEvent',
        {evt: makeEvt({keyCode: 9, shiftKey: true}), rep, editorInfo: ei});
    assert.equal(ei.calls.length, 1);
    assert.equal(ei.calls[0].text, '');
    assert.deepEqual(ei.calls[0].b, [0, 2]);
  });

  it('Shift+Tab returns false (defers to Etherpad) when no leading whitespace', async function () {
    const rep = makeRep(['foo'], {start: [0, 1]});
    const ei = makeEditorInfo();
    const handled = codeIndent.handleKey('aceKeyEvent',
        {evt: makeEvt({keyCode: 9, shiftKey: true}), rep, editorInfo: ei});
    assert.equal(handled, false);
    assert.equal(ei.calls.length, 0);
  });

  it('skips when language is auto (not in code mode)', async function () {
    codeIndent.start({indentSize: 2, getLanguage: () => 'auto', getAutoDetect: () => true});
    const rep = makeRep(['if (x) {'], {start: [0, 8]});
    const ei = makeEditorInfo();
    const handled = codeIndent.handleKey('aceKeyEvent',
        {evt: makeEvt({keyCode: 13}), rep, editorInfo: ei});
    assert.equal(handled, false);
    assert.equal(ei.calls.length, 0);
  });

  it('skips when autoDetect picked the language (no explicit user intent)', async function () {
    codeIndent.start({
      indentSize: 2,
      getLanguage: () => 'javascript',
      getAutoDetect: () => true, // auto-detect picked it, not the user
    });
    const rep = makeRep(['if (x) {'], {start: [0, 8]});
    const ei = makeEditorInfo();
    const handled = codeIndent.handleKey('aceKeyEvent',
        {evt: makeEvt({keyCode: 13}), rep, editorInfo: ei});
    assert.equal(handled, false);
    assert.equal(ei.calls.length, 0);
  });

  it('Ctrl+Tab is NOT intercepted (escape hatch for keyboard nav)', async function () {
    const rep = makeRep(['foo'], {start: [0, 0]});
    const ei = makeEditorInfo();
    const handled = codeIndent.handleKey('aceKeyEvent',
        {evt: makeEvt({keyCode: 9, ctrlKey: true}), rep, editorInfo: ei});
    assert.equal(handled, false);
  });
});
