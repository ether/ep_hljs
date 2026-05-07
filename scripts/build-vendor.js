'use strict';

const fs = require('fs');
const path = require('path');

const vendorOut = path.resolve(__dirname, '..', 'static', 'js', 'vendor', 'hljs.min.js');
const hljsEntry =
  path.resolve(__dirname, '..', 'node_modules', 'highlight.js', 'lib', 'common.js');

const run = () => {
  let esbuild;
  try {
    // eslint-disable-next-line n/no-unpublished-require
    esbuild = require('esbuild');
  } catch {
    // esbuild absent (production install); leave the committed vendor file as-is.
    if (!fs.existsSync(vendorOut)) {
      throw new Error('[ep_syntax_highlighting] vendor file missing and esbuild unavailable');
    }
    return;
  }

  esbuild.buildSync({
    entryPoints: [hljsEntry],
    bundle: true,
    globalName: 'hljs',
    format: 'iife',
    minify: true,
    outfile: vendorOut,
  });
};

run();
