'use strict';
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
