'use strict';

const hljs = require('highlight.js/lib/common');

const ids = new Set(hljs.listLanguages());

module.exports = {
  isSupported: (id) => id === 'auto' || ids.has(id),
  list: () => Array.from(ids).sort(),
};
