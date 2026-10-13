'use strict';
// Bundles lib/ into one dependency-free file that can be committed to a repo as .claude/hooks/nocomment.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const mods = ['scan', 'rules', 'hook'];
const ver = require('../package.json').version;
let out = `#!/usr/bin/env node\n// No Comment ${ver} (single-file hook build). https://github.com/lowkey-studio/nocomment  MIT\n// Usage in .claude/settings.json: node .claude/hooks/nocomment.js pre|post\n'use strict';\nconst __m = {};\n`;
for (const m of mods) {
  const src = fs.readFileSync(path.join(root, 'lib', m + '.js'), 'utf8').replace(/^'use strict';\n/, '').replace(/require\('\.\/(\w+)'\)/g, "__m['$1']");
  out += `__m['${m}'] = (() => { const module = { exports: {} };\n${src}\nreturn module.exports; })();\n`;
}
out += `__m.hook.run(process.argv[2] || 'post');\n`;
fs.writeFileSync(path.join(root, 'dist', 'nocomment-hook.js'), out);
fs.chmodSync(path.join(root, 'dist', 'nocomment-hook.js'), 0o755);
console.log('dist/nocomment-hook.js', out.length, 'bytes');
