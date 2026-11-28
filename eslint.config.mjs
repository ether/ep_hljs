import etherpad from 'eslint-config-etherpad/flat/plugin.js';

export default [
  {
    // Vendored code, theme files, and the Playwright specs, which the shared
    // config has no profile for.
    ignores: [
      'static/css/themes/',
      'static/js/vendor/',
      'static/tests/frontend-new/',
    ],
  },
  ...etherpad,
];
