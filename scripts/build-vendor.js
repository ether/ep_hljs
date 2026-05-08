'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const vendorOut = path.join(repoRoot, 'static', 'js', 'vendor', 'hljs.min.js');

// 1. Themes — always copy if source available; tolerate absence if committed.
const themesDir = path.join(repoRoot, 'static', 'css', 'themes');
fs.mkdirSync(themesDir, {recursive: true});
for (const name of ['github.css', 'github-dark.css']) {
  const srcPath = path.join(repoRoot, 'node_modules', 'highlight.js', 'styles', name);
  const dstPath = path.join(themesDir, name);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, dstPath);
  } else if (!fs.existsSync(dstPath)) {
    throw new Error(`[ep_hljs] theme ${name} missing and no committed copy`);
  }
}

// 2. JS vendor bundle — needs esbuild; tolerate absence if committed.
const run = () => {
  let esbuild;
  try {
    // eslint-disable-next-line n/no-unpublished-require
    esbuild = require('esbuild');
  } catch {
    if (!fs.existsSync(vendorOut)) {
      throw new Error('[ep_hljs] vendor JS missing and esbuild unavailable');
    }
    return;
  }

  esbuild.buildSync({
    entryPoints: [path.join(repoRoot, 'node_modules', 'highlight.js', 'lib', 'common.js')],
    bundle: true,
    globalName: 'hljs',
    format: 'iife',
    minify: true,
    outfile: vendorOut,
  });
};

run();
