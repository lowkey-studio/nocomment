#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { addedComments, langFor } = require('../lib/scan');
const { loadConfig, evaluate, ignored } = require('../lib/rules');

const VERSION = require('../package.json').version;
const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name, def) => {
  const i = args.indexOf('--' + name);
  if (i < 0) return def;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : true;
};

function help() {
  console.log(`nocomment ${VERSION}: stop AI coding agents from flooding your code with comments

  nocomment stats [--days 30] [--json]   How much of the code Claude Code wrote for you is comments
  nocomment check [--base <ref>]        Flag excessive / chat-narrating comments added in a git diff (CI, pre-commit)
  nocomment init [--codex]              Set up the hook for this repo (commit it so the whole team gets it)
  nocomment install [--codex]           Add the hook to ~/.claude/settings.json, or to ~/.codex/hooks.json with --codex
  nocomment uninstall                   Remove it again
  nocomment hook pre|post               (used by the Claude Code hook)

Plugin install inside Claude Code:
  /plugin marketplace add lowkey-studio/nocomment
  /plugin install nocomment@nocomment

Config: .nocomment.json  {"mode": "balanced" | "strict" | "chat" | "off", "ignore": ["**/*.test.ts"]}
Docs: https://github.com/lowkey-studio/nocomment`);
}

function* walk(dir) {
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.jsonl')) yield p;
  }
}

function stats() {
  const days = Number(flag('days', 30));
  const since = Date.now() - days * 864e5;
  const root = flag('dir', path.join(os.homedir(), '.claude', 'projects'));
  const t = { edits: 0, code: 0, comment: 0, doc: 0, chat: 0, files: new Set(), sessions: new Set() };
  const examples = [];
  const seen = new Set();
  for (const file of walk(root)) {
    let st;
    try { st = fs.statSync(file); } catch { continue; }
    if (st.mtimeMs < since) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (const line of lines) {
      if (!line.includes('"tool_use"')) continue;
      let j;
      try { j = JSON.parse(line); } catch { continue; }
      if (j.timestamp && Date.parse(j.timestamp) < since) continue;
      const content = j.message && Array.isArray(j.message.content) ? j.message.content : [];
      for (const c of content) {
        if (c.type !== 'tool_use' || !c.input || seen.has(c.id)) continue;
        seen.add(c.id);
        const fp = c.input.file_path;
        if (!fp || !langFor(fp)) continue;
        const pairs = c.name === 'Edit' ? [[c.input.old_string, c.input.new_string]]
          : c.name === 'MultiEdit' ? (c.input.edits || []).map((e) => [e.old_string, e.new_string])
          : c.name === 'Write' ? [['', c.input.content]] : [];
        for (const [b, a] of pairs) {
          if (typeof a !== 'string') continue;
          const r = addedComments(b || '', a, fp);
          if (!r) continue;
          t.edits++; t.files.add(fp); t.sessions.add(j.sessionId || file);
          t.code += r.addedCode;
          for (const x of r.added) {
            if (x.doc) t.doc++; else t.comment++;
            if (x.chatref) { t.chat++; if (examples.length < 400) examples.push({ file: path.basename(fp), text: x.text.slice(0, 90) }); }
          }
        }
      }
    }
  }
  const codexRoot = path.join(os.homedir(), '.codex', 'sessions');
  const { patchChanges } = require('../lib/hook');
  let codexEdits = 0;
  for (const file of walk(codexRoot)) {
    let st;
    try { st = fs.statSync(file); } catch { continue; }
    if (st.mtimeMs < since) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.includes('Begin Patch')) continue;
      let j;
      try { j = JSON.parse(line); } catch { continue; }
      const p = j.payload || {};
      if (p.type !== 'custom_tool_call' && p.type !== 'function_call') continue;
      let src = p.input || p.arguments || '';
      if (typeof src === 'string' && src.trim().startsWith('{')) { try { const a = JSON.parse(src); src = a.input || a.patch || a.command || a.code || src; } catch {} }
      if (Array.isArray(src)) src = src.join('\n');
      src = String(src);
      const patches = [];
      if (src.trim().startsWith('*** Begin Patch')) patches.push(src);
      else {
        // Code-mode exec: the patch is a JS string literal.
        for (const m of src.matchAll(/"(\*\*\* Begin Patch(?:[^"\\]|\\.)*)"/g)) { try { patches.push(JSON.parse('"' + m[1] + '"')); } catch {} }
        for (const m of src.matchAll(/`(\*\*\* Begin Patch[^`]*)`/g)) patches.push(m[1]);
      }
      for (const ch of patches.flatMap((x) => patchChanges(x, '/'))) {
        const r = addedComments(ch.before, ch.after, ch.file);
        if (!r) continue;
        t.edits++; codexEdits++; t.files.add(ch.file); t.sessions.add(file);
        t.code += r.addedCode;
        for (const x of r.added) {
          if (x.doc) t.doc++; else t.comment++;
          if (x.chatref) { t.chat++; if (examples.length < 400) examples.push({ file: path.basename(ch.file), text: x.text.slice(0, 90) }); }
        }
      }
    }
  }
  const total = t.code + t.comment + t.doc;
  const pct = (n) => (total ? ((100 * n) / total).toFixed(1) : '0.0');
  const out = {
    days, codexEdits, sessions: t.sessions.size, files: t.files.size, edits: t.edits,
    linesWritten: total, codeLines: t.code, commentLines: t.comment, docLines: t.doc,
    commentPct: Number(pct(t.comment + t.doc)), chatNarratingComments: t.chat,
  };
  if (flag('json', false)) return console.log(JSON.stringify(out, null, 2));
  if (!t.edits) return console.log(`No Claude Code or Codex edits found for the last ${days} days.`);
  console.log(`\nNo Comment stats: what your coding agents wrote for you in the last ${days} days\n`);
  console.log(`  ${t.sessions.size} sessions, ${t.files.size} files, ${t.edits} edits (${t.edits - codexEdits} Claude Code, ${codexEdits} Codex)`);
  console.log(`  ${total} lines written: ${t.code} code, ${t.comment} comments, ${t.doc} doc comments`);
  console.log(`  => ${pct(t.comment + t.doc)}% of the lines your agents wrote are comments (${pct(t.comment)}% excluding docstrings)`);
  console.log(`  => ${t.chat} comments narrate the chat or the edit ("now uses", "changed from", "as requested", ...)\n`);
  if (examples.length) {
    console.log('  A few of those:');
    const pick = examples.sort(() => Math.random() - 0.5).slice(0, 6);
    for (const e of pick) console.log(`    ${e.file}: ${e.text}`);
    console.log('');
  }
  console.log('  Share yours: https://github.com/lowkey-studio/nocomment/discussions');
  console.log('  Make it stop: /plugin marketplace add lowkey-studio/nocomment  then  /plugin install nocomment@nocomment\n');
}

function git(a) { return execFileSync('git', a, { encoding: 'utf8', maxBuffer: 256 << 20 }); }

function check() {
  const cfg = loadConfig(process.cwd());
  const base = flag('base', null);
  const staged = flag('staged', false);
  const diffArgs = ['diff', '-U0', '--no-color', '--no-ext-diff'];
  if (staged) diffArgs.push('--cached');
  else if (base) diffArgs.push(`${base}...HEAD`);
  const diff = git(diffArgs);
  const hunks = [];
  let file = null, cur = null, newLine = 0;
  for (const l of diff.split('\n')) {
    if (l.startsWith('+++ ')) { file = l.slice(4).replace(/^b\//, ''); if (file === '/dev/null') file = null; continue; }
    if (l.startsWith('--- ')) continue;
    const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(l);
    if (m) { cur = { file, start: Number(m[1]), before: [], after: [] }; hunks.push(cur); continue; }
    if (!cur || !cur.file) continue;
    if (l.startsWith('+')) cur.after.push(l.slice(1));
    else if (l.startsWith('-')) cur.before.push(l.slice(1));
  }
  const findings = [];
  for (const h of hunks) {
    if (!h.file || ignored(h.file, cfg)) continue;
    const r = addedComments(h.before.join('\n'), h.after.join('\n'), h.file);
    if (!r) continue;
    for (const f of evaluate(r, cfg)) findings.push({ file: h.file, line: h.start + f.idx, text: f.text, why: f.why });
  }
  const gha = !!process.env.GITHUB_ACTIONS;
  for (const f of findings) {
    if (gha) console.log(`::warning file=${f.file},line=${f.line},title=No Comment::${f.why}: ${f.text.slice(0, 120)}`);
    else console.log(`${f.file}:${f.line}  ${f.text.slice(0, 100)}   <- ${f.why}`);
  }
  if (findings.length) {
    console.log(`\nNo Comment: ${findings.length} comment line(s) to remove (mode: ${cfg.mode}).`);
    process.exit(flag('warn-only', false) ? 0 : 1);
  } else console.log('No Comment: clean.');
}

const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const APP = path.join(os.homedir(), '.nocomment', 'app');
const MARK = 'nocomment hook';

function codexHooks(file, cmdPost) {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  if (fs.existsSync(file)) fs.copyFileSync(file, file + '.nocomment-backup');
  s.hooks = s.hooks || {};
  s.hooks.PostToolUse = (s.hooks.PostToolUse || []).filter((g) => !(g.hooks || []).some((h) => /nocomment/.test(String(h.command))));
  s.hooks.PostToolUse.push({ matcher: 'apply_patch', hooks: [{ type: 'command', command: cmdPost, timeout: 10 }] });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
}

function install() {
  if (flag('codex', false)) {
    copyApp();
    const f = path.join(os.homedir(), '.codex', 'hooks.json');
    codexHooks(f, `${JSON.stringify(process.execPath)} ${JSON.stringify(path.join(APP, 'bin', 'nocomment.js'))} hook post`);
    return console.log(`No Comment hook installed for Codex in ${f}. Restart Codex and approve the hook when it asks you to trust it (/hooks).`);
  }
  copyApp();
  installClaude();
}

function copyApp() {
  fs.mkdirSync(APP, { recursive: true });
  for (const d of ['bin', 'lib']) {
    fs.mkdirSync(path.join(APP, d), { recursive: true });
    for (const f of fs.readdirSync(path.join(__dirname, '..', d))) fs.copyFileSync(path.join(__dirname, '..', d, f), path.join(APP, d, f));
  }
  fs.copyFileSync(path.join(__dirname, '..', 'package.json'), path.join(APP, 'package.json'));
}

function installClaude() {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch {}
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  if (fs.existsSync(SETTINGS)) fs.copyFileSync(SETTINGS, SETTINGS + '.nocomment-backup');
  uninstallFrom(s);
  const node = JSON.stringify(process.execPath);
  const bin = JSON.stringify(path.join(APP, 'bin', 'nocomment.js'));
  s.hooks = s.hooks || {};
  (s.hooks.PreToolUse = s.hooks.PreToolUse || []).push({ matcher: 'Write', hooks: [{ type: 'command', command: `${node} ${bin} hook pre`, timeout: 10 }] });
  (s.hooks.PostToolUse = s.hooks.PostToolUse || []).push({ matcher: 'Edit|MultiEdit|Write', hooks: [{ type: 'command', command: `${node} ${bin} hook post`, timeout: 10 }] });
  fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2) + '\n');
  console.log(`No Comment hook installed in ${SETTINGS} (backup: settings.json.nocomment-backup).\nRestart Claude Code. Tune it with a .nocomment.json in your repo: {"mode": "strict"}`);
}

function uninstallFrom(s, mark = MARK) {
  if (!s.hooks) return;
  for (const ev of ['PreToolUse', 'PostToolUse']) {
    if (!s.hooks[ev]) continue;
    s.hooks[ev] = s.hooks[ev].filter((g) => !(g.hooks || []).some((h) => String(h.command).includes(mark)));
    if (!s.hooks[ev].length) delete s.hooks[ev];
  }
}

function init() {
  const dir = process.cwd();
  const hookDst = path.join(dir, '.claude', 'hooks', 'nocomment.js');
  fs.mkdirSync(path.dirname(hookDst), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '..', 'dist', 'nocomment-hook.js'), hookDst);
  fs.chmodSync(hookDst, 0o755);
  if (flag('codex', false)) {
    codexHooks(path.join(dir, '.codex', 'hooks.json'), 'node .claude/hooks/nocomment.js post');
    console.log('Also wrote .codex/hooks.json (Codex runs hooks from the repo root; approve it in /hooks).');
  }
  const sp = path.join(dir, '.claude', 'settings.json');
  let s = {};
  try { s = JSON.parse(fs.readFileSync(sp, 'utf8')); } catch {}
  uninstallFrom(s, 'nocomment.js');
  s.hooks = s.hooks || {};
  const cmd = (ph) => `node "$CLAUDE_PROJECT_DIR/.claude/hooks/nocomment.js" ${ph}`;
  (s.hooks.PreToolUse = s.hooks.PreToolUse || []).push({ matcher: 'Write', hooks: [{ type: 'command', command: cmd('pre'), timeout: 10 }] });
  (s.hooks.PostToolUse = s.hooks.PostToolUse || []).push({ matcher: 'Edit|MultiEdit|Write', hooks: [{ type: 'command', command: cmd('post'), timeout: 10 }] });
  fs.writeFileSync(sp, JSON.stringify(s, null, 2) + '\n');
  const cfg = path.join(dir, '.nocomment.json');
  if (!fs.existsSync(cfg)) fs.writeFileSync(cfg, JSON.stringify({ mode: 'balanced', ignore: [] }, null, 2) + '\n');
  console.log('No Comment set up for this repo:\n  .claude/hooks/nocomment.js\n  .claude/settings.json (hooks)\n  .nocomment.json (policy)\nCommit these three files and everyone on the team who uses Claude Code in this repo gets the same comment policy.');
}

function uninstall() {
  let s;
  try { s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch { return console.log('Nothing to remove.'); }
  uninstallFrom(s);
  fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2) + '\n');
  console.log('No Comment hook removed.');
}

if (cmd === 'hook') require('../lib/hook').run(args[1]);
else if (cmd === 'stats') stats();
else if (cmd === 'check') check();
else if (cmd === 'install') install();
else if (cmd === 'init') init();
else if (cmd === 'uninstall') uninstall();
else if (cmd === '--version' || cmd === '-v') console.log(VERSION);
else help();
