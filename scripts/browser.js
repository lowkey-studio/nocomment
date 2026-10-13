'use strict';
// Builds docs/nocomment-browser.js: the scanner and rules as a browser global (window.NoComment).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let out = `/* No Comment ${require('../package.json').version} browser build. https://github.com/lowkey-studio/nocomment MIT */\n(function(){\nconst __m = {};\nconst require = (n) => n === 'path' ? { basename: (p) => p.split('/').pop(), dirname: (p) => p.split('/').slice(0, -1).join('/') || '/', join: (...a) => a.join('/'), isAbsolute: (p) => p.startsWith('/'), relative: (a, b) => b } : __m[n.replace('./', '')];\n`;
for (const m of ['scan']) {
  const src = fs.readFileSync(path.join(root, 'lib', m + '.js'), 'utf8').replace(/^'use strict';\n/, '');
  out += `__m['${m}'] = (() => { const module = { exports: {} };\n${src}\nreturn module.exports; })();\n`;
}
const rules = fs.readFileSync(path.join(root, 'lib', 'rules.js'), 'utf8');
const presets = rules.slice(rules.indexOf('const PRESETS'), rules.indexOf('function readJson'));
const evaluate = rules.slice(rules.indexOf('// Returns a list of findings'), rules.indexOf('module.exports'));
out += presets + evaluate + `window.NoComment = { ...__m.scan, evaluate, PRESETS };\n})();\n`;
fs.writeFileSync(path.join(root, 'docs', 'nocomment-browser.js'), out);
console.log('docs/nocomment-browser.js', out.length);
