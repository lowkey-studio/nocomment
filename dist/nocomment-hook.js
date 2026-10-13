#!/usr/bin/env node
// No Comment 0.4.0 (single-file hook build). https://github.com/lowkey-studio/nocomment  MIT
// Usage in .claude/settings.json: node .claude/hooks/nocomment.js pre|post
'use strict';
const __m = {};
__m['scan'] = (() => { const module = { exports: {} };
const path = require('path');

const C = { line: ['//'], block: [['/*', '*/']], doc: ['/**', '///', '//!'] };
const HASH = { line: ['#'], block: [], doc: [] };
const LANGS = {
  c: C, h: C, cc: C, cpp: C, hpp: C, cxx: C, cs: C, java: C, kt: C, kts: C, scala: C,
  js: C, jsx: C, mjs: C, cjs: C, ts: C, tsx: C, mts: C, cts: C, go: C, rs: { ...C, rs: true }, swift: C,
  dart: C, sol: C, groovy: C, gradle: C, zig: { line: ['//'], block: [], doc: ['///'] },
  proto: C, m: C, mm: C, vue: C, svelte: C, astro: C,
  php: { line: ['//', '#'], block: [['/*', '*/']], doc: ['/**'] },
  css: { line: [], block: [['/*', '*/']], doc: [] },
  scss: C, less: C,
  py: { line: ['#'], block: [], doc: [], py: true }, pyi: { line: ['#'], block: [], doc: [], py: true },
  rb: HASH, sh: HASH, bash: HASH, zsh: HASH, fish: HASH, yaml: HASH, yml: HASH, toml: HASH,
  r: HASH, pl: HASH, ex: HASH, exs: HASH, nim: HASH, cmake: HASH, jl: HASH, tf: { line: ['#', '//'], block: [['/*', '*/']], doc: [] },
  hcl: { line: ['#', '//'], block: [['/*', '*/']], doc: [] }, ps1: { line: ['#'], block: [['<#', '#>']], doc: [] },
  sql: { line: ['--'], block: [['/*', '*/']], doc: [] }, lua: { line: ['--'], block: [['--[[', ']]']], doc: ['---'] },
  hs: { line: ['--'], block: [['{-', '-}']], doc: ['-- |'] }, elm: { line: ['--'], block: [['{-', '-}']], doc: [] },
  html: { line: [], block: [['<!--', '-->']], doc: [] }, xml: { line: [], block: [['<!--', '-->']], doc: [] },
  clj: { line: [';'], block: [], doc: [] }, el: { line: [';'], block: [], doc: [] }, lisp: { line: [';'], block: [], doc: [] },
  erl: { line: ['%'], block: [], doc: [] }, tex: { line: ['%'], block: [], doc: [] },
};
const NAMES = { dockerfile: HASH, makefile: HASH, gemfile: HASH, rakefile: HASH };

function langFor(file) {
  if (!file) return null;
  const base = path.basename(file).toLowerCase();
  if (NAMES[base]) return NAMES[base];
  const ext = base.includes('.') ? base.split('.').pop() : '';
  return LANGS[ext] || null;
}

const DIRECTIVE = /^(eslint|prettier-ignore|@ts-|istanbul|c8 |noqa|type:\s*ignore|pylint:|pyright:|mypy:|pragma|nolint|go:|\+build|#?region|#?endregion|spdx-|@license|@flow|@jsx|biome-ignore|deno-lint|rubocop:|frozen_string_literal|-\*-|coding[:=]|fmt:|isort:|tslint:|jshint|global |exported |swiftlint:|NOSONAR|webpackChunkName|@vite-ignore|<reference |@refresh|stylelint-|shellcheck |\$FlowFixMe|@generated|language=|@ngInject|codegen-|nosemgrep|checkov:|tfsec:|@noinspection|noinspection|clang-format|NOLINT)/i;

// Narration of the conversation or of the edit itself, not of the code.
const CHATREF = [
  /\b(as|per) (you|the user|requested|discussed|asked|instructed|mentioned)\b/i,
  /\byou (asked|wanted|requested|mentioned|said)\b/i,
  /\bthe user (asked|wants|wanted|requested|said)\b/i,
  /\bper (your|the user'?s?|our) (request|instructions?|feedback|comment)\b/i,
  /\b(now|now we) (uses?|returns?|handles?|calls?|supports?|correctly|properly|also|checks?|includes?|accepts?)\b/i,
  /\b(changed|updated|switched|migrated|moved|renamed) (from|to)\b/i,
  /^\W*previously\b/i,
  /\b(was|were|is) previously\b/i,
  /\bpreviously (used|did|was|were|had|hard-?coded|copy-pasted|written|called|returned|lived|duplicated|inlined|computed|handled|fetched|stored)\b/i,
  /\b(was|were) (changed|updated|renamed|refactored)\b/i,
  /\binstead of the (old|previous|original)\b/i,
  /\b(the )?(old|previous|original) (code|implementation|approach|logic|behaviou?r)\b/i,
  /^\s*(new|added|changed|updated|modified|removed|fixed|fix|refactored)\s*[:!\-–(]/i,
  /\b(keep|keeping|kept) (the )?(existing|original|same|old)\b/i,
  /\b(rest of|remaining) (the )?(code|file|function|logic|implementation)( stays| remains| is)? (unchanged|the same|as is)\b/i,
  /\.\.\.\s*(existing|rest of|other|previous) (code|logic|methods?)/i,
  /\b(left|kept|leave|keep) (it |this |them |the rest )?unchanged\b/i,
  /\bunchanged (from|since) (before|the original|the previous|the old|last)\b/i,
  /\bis unchanged apart from\b/i,
  /\b(this|the) (fix|change) (ensures|makes|prevents|addresses)\b/i,
  /\b(bug ?fix|fix(es|ed)?) for (the )?(issue|bug|problem) (where|with|you)\b/i,
  /\b(now )?no longer (uses?|calls?|needs?|requires?|returns?|throws?|depends on|supports?|handles?|imports?|reads?|writes?|sets?|checks?|relies on)\b/i,
  /\b(it|this|that) (was|used to be) (previously )?(written|copy-pasted|duplicated|hardcoded|inlined|done|computed|handled)\b/i,
  /\b(task|todo item|plan (item|step)|phase|milestone|ticket) #?\d+(\.\d+)?\b/i,
  /\b(per|see|from|in) (the )?(plan|spec|todo list|task list|conversation|discussion|chat)\b/i,
];

function chatRef(text) {
  for (const re of CHATREF) if (re.test(text)) return true;
  return false;
}

// Split source into per-line records: code text and comment text, string-aware.
function scan(src, lang) {
  const lines = src.split('\n');
  const out = lines.map(() => ({ code: '', comment: '', doc: false, directive: false }));
  let i = 0, ln = 0, col0 = 0;
  let mode = null, closer = null, quote = null, isDoc = false;
  const startsWithAt = (s) => src.startsWith(s, i);
  const pushComment = (ch) => { out[ln].comment += ch; if (isDoc) out[ln].doc = true; };
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\n') {
      if (mode === 'line') mode = null;
      if (mode === 'str' && quote.length === 1 && quote !== '`') mode = null;
      ln++; i++; col0 = i;
      continue;
    }
    if (mode === 'line') { pushComment(ch); i++; continue; }
    if (mode === 'block') {
      if (startsWithAt(closer)) { mode = null; i += closer.length; continue; }
      pushComment(ch); i++; continue;
    }
    if (mode === 'str') {
      out[ln].code += ch;
      if (ch === '\\') { if (src[i + 1] && src[i + 1] !== '\n') out[ln].code += src[i + 1]; i += 2; continue; }
      if (startsWithAt(quote)) {
        if (quote.length > 1) out[ln].code += quote.slice(1);
        i += quote.length; mode = null; continue;
      }
      i++; continue;
    }
    if (mode === 'docstr') {
      if (startsWithAt(quote)) { mode = null; i += 3; continue; }
      out[ln].comment += ch; out[ln].doc = true; i++; continue;
    }
    // Code.
    if (lang.py && (startsWithAt('"""') || startsWithAt("'''"))) {
      const q = src.substr(i, 3);
      const before = src.slice(col0, i).trim();
      if (before === '' || /^[rRuUbB]{0,2}$/.test(before)) { mode = 'docstr'; quote = q; i += 3; continue; }
      mode = 'str'; quote = q; out[ln].code += q; i += 3; continue;
    }
    let matched = false;
    for (const [open, close] of lang.block) {
      if (startsWithAt(open)) {
        mode = 'block'; closer = close; isDoc = lang.doc.some((d) => d.length >= open.length && startsWithAt(d)) && !startsWithAt(open + close.slice(-1));
        if (open === '/*' && startsWithAt('/**/')) isDoc = false;
        i += open.length; out[ln].comment += ' '; matched = true; break;
      }
    }
    if (matched) continue;
    for (const m of lang.line) {
      if (startsWithAt(m)) {
        if (m === '#' && i === 0 && src[1] === '!') break; // shebang
        if (m === '#' && src[i + 1] === '[' && !lang.py) break; // rust/c# attributes, not reached for C langs
        if (m === '//' && i > 0 && src[i - 1] === ':') break; // url in code like http://
        mode = 'line'; isDoc = lang.doc.some((d) => startsWithAt(d) && d.length > m.length);
        i += m.length; out[ln].comment += ' '; matched = true; break;
      }
    }
    if (matched) continue;
    if (ch === "'" && lang.rs && !(src[i + 2] === "'" || (src[i + 1] === '\\' && src.indexOf("'", i + 2) - i < 12))) { out[ln].code += ch; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') {
      // Apostrophes in Rust lifetimes/char literals and similar are rare enough to accept.
      mode = 'str'; quote = ch; out[ln].code += ch; i++; continue;
    }
    out[ln].code += ch; i++;
  }
  for (const r of out) {
    r.code = r.code.trim();
    r.comment = r.comment.trim();
    if (r.comment && DIRECTIVE.test(r.comment.replace(/^[*!/\s-]+/, ''))) r.directive = true;
  }
  return out;
}

function summarize(records) {
  let code = 0, comment = 0, doc = 0, trailing = 0;
  for (const r of records) {
    if (r.comment && !r.directive) {
      if (r.doc) doc++;
      else comment++;
      if (r.code) trailing++;
    }
    if (r.code) code++;
  }
  return { code, comment, doc, trailing };
}

// Comment lines present in `after` but not in `before` (multiset on trimmed comment text).
function addedComments(before, after, file) {
  const lang = langFor(file);
  if (!lang) return null;
  const a = scan(before || '', lang);
  const b = scan(after || '', lang);
  const bag = new Map();
  for (const r of a) if (r.comment) bag.set(r.comment, (bag.get(r.comment) || 0) + 1);
  const codeBag = new Map();
  for (const r of a) if (r.code) codeBag.set(r.code, (codeBag.get(r.code) || 0) + 1);
  const added = [];
  let addedCode = 0;
  b.forEach((r, idx) => {
    if (r.code) {
      const n = codeBag.get(r.code) || 0;
      if (n > 0) codeBag.set(r.code, n - 1); else addedCode++;
    }
    if (!r.comment || r.directive) return;
    const n = bag.get(r.comment) || 0;
    if (n > 0) { bag.set(r.comment, n - 1); return; }
    added.push({ idx, text: r.comment, doc: r.doc, trailing: !!r.code, chatref: chatRef(r.comment) });
  });
  return { added, addedCode, lines: b };
}

module.exports = { langFor, scan, summarize, addedComments, chatRef };

return module.exports; })();
__m['rules'] = (() => { const module = { exports: {} };
const fs = require('fs');
const path = require('path');
const os = require('os');

const PRESETS = {
  // Zero new non-doc comments.
  strict: { maxNew: 0, ratio: 0, maxBlock: 0, allowDoc: true, chatRefs: true, maxDocLines: 12 },
  // Default: comments only where they earn their place.
  balanced: { maxNew: 2, ratio: 0.1, maxBlock: 3, allowDoc: true, chatRefs: true, maxDocLines: 12 },
  // Only stop comments that narrate the chat or the edit.
  chat: { maxNew: Infinity, ratio: Infinity, maxBlock: Infinity, allowDoc: true, chatRefs: true, maxDocLines: Infinity },
};

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function loadConfig(cwd) {
  let user = readJson(path.join(os.homedir(), '.nocomment.json')) || {};
  let proj = {};
  let dir = cwd || process.cwd();
  for (let k = 0; k < 40; k++) {
    const c = readJson(path.join(dir, '.nocomment.json'));
    if (c) { proj = c; break; }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  const merged = { mode: 'balanced', ignore: [], ...user, ...proj };
  if (process.env.NOCOMMENT_MODE) merged.mode = process.env.NOCOMMENT_MODE;
  const preset = PRESETS[merged.mode] || PRESETS.balanced;
  return { ...preset, ...merged, off: merged.mode === 'off' || process.env.NOCOMMENT === 'off' };
}

function globToRe(g) {
  const re = g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '(?:.*/)?').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.');
  return new RegExp('(^|/)' + re + '$');
}

function ignored(file, cfg) {
  const rel = file.replace(/\\/g, '/');
  return (cfg.ignore || []).some((g) => globToRe(g).test(rel));
}

// Returns a list of findings; empty means the edit is fine.
function evaluate(res, cfg) {
  if (!res) return [];
  const findings = [];
  const plain = res.added.filter((a) => !a.doc);
  const docs = res.added.filter((a) => a.doc);
  if (cfg.chatRefs) {
    for (const a of res.added) if (a.chatref) findings.push({ ...a, why: 'narrates the chat or the edit history' });
  }
  const budget = Math.max(cfg.maxNew, Math.floor(cfg.ratio * res.addedCode));
  const nonChat = plain.filter((a) => !a.chatref);
  if (nonChat.length > budget) {
    for (const a of nonChat) findings.push({ ...a, why: `over the comment budget (${nonChat.length} new comment lines, budget ${budget} for ${res.addedCode} new code lines)` });
  } else if (cfg.maxBlock !== Infinity) {
    // Contiguous runs of full-line comments longer than maxBlock.
    let run = [];
    const flush = () => {
      if (run.length > cfg.maxBlock && run.length > 0) for (const a of run) if (!a.chatref) findings.push({ ...a, why: `part of a ${run.length}-line comment block` });
      run = [];
    };
    let prev = -2;
    for (const a of nonChat) {
      if (a.trailing) { flush(); prev = -2; continue; }
      if (a.idx !== prev + 1) flush();
      run.push(a); prev = a.idx;
    }
    flush();
  }
  if (!cfg.allowDoc || docs.length > cfg.maxDocLines) {
    for (const a of docs) if (!a.chatref) findings.push({ ...a, why: cfg.allowDoc ? `doc comment run of ${docs.length} lines (max ${cfg.maxDocLines})` : 'doc comments disabled' });
  }
  const seen = new Set();
  return findings.filter((f) => (seen.has(f.idx) ? false : seen.add(f.idx))).sort((a, b) => a.idx - b.idx);
}

module.exports = { loadConfig, evaluate, ignored, PRESETS };

return module.exports; })();
__m['hook'] = (() => { const module = { exports: {} };
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { addedComments } = __m['scan'];
const { loadConfig, evaluate, ignored } = __m['rules'];

const STATE = path.join(os.homedir(), '.nocomment');

function snapPath(sessionId, file) {
  const h = crypto.createHash('sha1').update(String(sessionId) + '\0' + file).digest('hex').slice(0, 16);
  return path.join(os.tmpdir(), 'nocomment-' + h);
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function logEvent(ev) {
  try {
    fs.mkdirSync(STATE, { recursive: true });
    fs.appendFileSync(path.join(STATE, 'events.jsonl'), JSON.stringify({ ts: new Date().toISOString(), ...ev }) + '\n');
  } catch {}
}

function lineOffset(fileText, snippet) {
  if (!fileText || !snippet) return 0;
  const at = fileText.indexOf(snippet);
  if (at < 0) return 0;
  return fileText.slice(0, at).split('\n').length - 1;
}

function pre(input) {
  const ti = input.tool_input || {};
  if (input.tool_name !== 'Write' || !ti.file_path) return;
  try {
    const cur = fs.readFileSync(ti.file_path, 'utf8');
    fs.writeFileSync(snapPath(input.session_id, ti.file_path), cur);
  } catch {}
}

// Codex apply_patch: "*** Update File: p" / "*** Add File: p" sections with -/+/space lines.
function patchChanges(patch, cwd) {
  const out = [];
  let cur = null;
  const flush = () => { if (cur) out.push({ file: cur.file, before: cur.before.join('\n'), after: cur.after.join('\n'), whole: cur.add }); };
  for (const line of String(patch).split('\n')) {
    const m = /^\*\*\* (Update|Add) File: (.+)$/.exec(line);
    if (m) { flush(); const f = m[2].trim(); cur = { file: path.isAbsolute(f) ? f : path.join(cwd || process.cwd(), f), before: [], after: [], add: m[1] === 'Add' }; continue; }
    if (/^\*\*\* /.test(line)) { flush(); cur = null; continue; }
    if (!cur) continue;
    if (line.startsWith('@@')) { cur.before.push(''); cur.after.push(''); continue; }
    if (line.startsWith('+')) cur.after.push(line.slice(1));
    else if (line.startsWith('-')) cur.before.push(line.slice(1));
    else if (line.startsWith(' ')) { cur.before.push(line.slice(1)); cur.after.push(line.slice(1)); }
  }
  flush();
  return out;
}

function changesOf(input) {
  const ti = input.tool_input || {};
  if (input.tool_name === 'apply_patch' || input.tool_name === 'ApplyPatch') {
    const patch = typeof ti === 'string' ? ti : ti.command || ti.patch || ti.input || '';
    return patchChanges(Array.isArray(patch) ? patch.join('\n') : patch, input.cwd);
  }
  const file = ti.file_path || ti.notebook_path;
  if (!file) return [];
  if (input.tool_name === 'Edit') return [{ file, before: ti.old_string, after: ti.new_string }];
  if (input.tool_name === 'MultiEdit') return (ti.edits || []).map((e) => ({ file, before: e.old_string, after: e.new_string }));
  if (input.tool_name === 'Write') {
    const sp = snapPath(input.session_id, file);
    let before = '';
    try { before = fs.readFileSync(sp, 'utf8'); fs.unlinkSync(sp); } catch {}
    return [{ file, before, after: ti.content, whole: true }];
  }
  return [];
}

function post(input) {
  const cfg = loadConfig(input.cwd);
  if (cfg.off) return null;
  const changes = changesOf(input);
  if (!changes.length) return null;
  const relOf = (f) => (input.cwd && f.startsWith(input.cwd) ? path.relative(input.cwd, f) : f);
  const file = changes[0].file;
  const rel = relOf(file);
  const texts = {};
  const findings = [];
  let addedTotal = 0;
  for (const ch of changes) {
    const r = relOf(ch.file);
    if (ignored(r, cfg)) continue;
    const res = addedComments(ch.before, ch.after, ch.file);
    if (!res) continue;
    if (!(ch.file in texts)) { try { texts[ch.file] = fs.readFileSync(ch.file, 'utf8'); } catch { texts[ch.file] = ''; } }
    addedTotal += res.added.length;
    const off = ch.whole ? 0 : lineOffset(texts[ch.file], ch.after.replace(/^\n+/, ''));
    const lead = ch.whole ? 0 : (ch.after.match(/^\n*/) || [''])[0].length;
    for (const f of evaluate(res, cfg)) findings.push({ ...f, rel: r, line: off + f.idx - lead + 1 });
  }
  logEvent({ tool: input.tool_name, ext: path.extname(file), added: addedTotal, flagged: findings.length });
  if (!findings.length) return null;
  const chat = findings.filter((f) => f.chatref).length;
  const shown = findings.slice(0, 25).map((f) => `  ${f.rel}:${f.line}  ${f.text.slice(0, 100)}   <- ${f.why}`).join('\n');
  const more = findings.length > 25 ? `\n  ...and ${findings.length - 25} more` : '';
  const reason = [
    `No Comment: ${findings.length} comment line(s) you just added (${[...new Set(findings.map((f) => f.rel))].join(', ')}) break this project's comment policy (mode: ${cfg.mode}).`,
    shown + more,
    'Delete or shorten them now. Comments describe the code as it is, only where the why is not obvious from the code. Never mention the conversation, the user, the request, or what the code used to do; that belongs in the commit message.' + (chat ? '' : ' Keep at most one short line where a reader would otherwise be misled.'),
    'Do not reply to this message; just fix the comments and continue the task.',
  ].join('\n');
  return { decision: 'block', reason, hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: reason } };
}

function run(phase) {
  let input;
  try { input = JSON.parse(readStdin() || '{}'); } catch { return; }
  try {
    if (phase === 'pre') return pre(input);
    const out = post(input);
    if (out) process.stdout.write(JSON.stringify(out));
  } catch (e) {
    logEvent({ error: String(e && e.message) });
  }
}

module.exports = { run, post, pre, patchChanges };

return module.exports; })();
__m.hook.run(process.argv[2] || 'post');
