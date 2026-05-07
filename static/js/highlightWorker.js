/* eslint-disable no-restricted-globals, no-undef */
'use strict';

importScripts('/static/plugins/ep_syntax_highlighting/static/js/vendor/hljs.min.js');

const decodeEntities = (s) => s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

self.addEventListener('message', (e) => {
  const {id, text, language, autoDetect, lineOffset = 0} = e.data;
  try {
    const lines = text.split('\n');
    let lang = language;
    if (autoDetect) {
      const probe = self.hljs.highlightAuto(text);
      lang = probe.language || 'plaintext';
    }
    const ranges = [];
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      if (!lineText.length) continue;
      let html;
      try {
        html = self.hljs.highlight(
            lineText, {language: lang || 'plaintext', ignoreIllegals: true}
        ).value;
      } catch (_e) {
        continue;
      }
      const re = /<span class="([^"]+)">|<\/span>/g;
      const stack = [];
      let pos = 0;
      let plainAccum = '';
      let m;
      // eslint-disable-next-line no-cond-assign
      while ((m = re.exec(html)) != null) {
        const before = html.slice(pos, m.index);
        const decoded = decodeEntities(before);
        plainAccum += decoded;
        if (stack.length) stack[stack.length - 1].text += decoded;
        if (m[1]) {
          stack.push({cls: m[1], start: plainAccum.length, text: ''});
        } else {
          const t = stack.pop();
          if (t !== undefined) {
            ranges.push({
              line: i + lineOffset,
              start: t.start,
              end: t.start + t.text.length,
              cls: t.cls,
            });
          }
        }
        pos = m.index + m[0].length;
      }
    }
    self.postMessage({id, ok: true, language: lang, ranges, lineCount: lines.length});
  } catch (err) {
    self.postMessage({id, ok: false, error: err && err.message});
  }
});
/* eslint-enable no-restricted-globals, no-undef */
