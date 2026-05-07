'use strict';

const hljs = require('highlight.js/lib/common');

const ids = new Set(hljs.listLanguages());

const isSupported = (id) => {
  if (id === 'auto' || id === 'off') return true;
  if (ids.has(id)) return true;
  return !!hljs.getLanguage(id);
};

module.exports = {
  isSupported,
  list: () => Array.from(ids).sort(),
};
