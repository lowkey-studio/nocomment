'use strict';
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
