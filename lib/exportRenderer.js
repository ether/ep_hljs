'use strict';

const fs = require('fs');
const path = require('path');
const hljs = require('highlight.js/lib/common');
const store = require('./padLanguageStore');

const themePath = (variant) => path.join(
    __dirname, '..', 'static', 'css', 'themes',
    variant === 'dark' ? 'github-dark.css' : 'github.css',
);

// Strip HTML tags to recover plain text. Acceptable simple approach for v1 —
// inline formatting (bold/italic) inside code lines is lost in highlighted
// export. Documented trade-off.
const stripHtml = (s) => String(s).replace(/<[^>]*>/g, '');

const ESCAPE_MAP = {'&': '&amp;', '<': '&lt;', '>': '&gt;'};
const escapeText = (s) => String(s).replace(/[&<>]/g, (c) => ESCAPE_MAP[c]);

const renderLine = async (padId, lineContent) => {
  const text = stripHtml(lineContent || '');
  if (!text) return '';
  try {
    const {language, autoDetect} = await store.get(padId);
    const result = autoDetect
      ? hljs.highlightAuto(text)
      : hljs.highlight(text, {language, ignoreIllegals: true});
    return result.value;
  } catch (_e) {
    // Failsoft: never break the export.
    return escapeText(text);
  }
};

// Light theme by default for exports.
const stylesForExport = async () => fs.readFileSync(themePath('light'), 'utf8');

module.exports = {renderLine, stylesForExport};
