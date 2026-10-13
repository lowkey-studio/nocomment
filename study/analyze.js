'use strict';
// Summarises study/ai.jsonl vs study/baseline.jsonl and writes study/results.json.
const fs = require('fs');
const path = require('path');
const { chatRef } = require('../lib/scan');

function load(f) {
  return fs.readFileSync(path.join(__dirname, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
}

function summarise(rows) {
  let code = 0, comment = 0, doc = 0, chat = 0;
  const shares = [], examples = [];
  for (const r of rows) {
    const texts = r.texts || [];
    const c = r.comment;
    const d = r.doc;
    const ch = texts.length ? texts.filter((t) => chatRef(t[2])).length : r.chat;
    code += r.code; comment += c; doc += d; chat += ch;
    const tot = r.code + c + d;
    shares.push(tot ? (c + d) / tot : 0);
    for (const t of texts) if (chatRef(t[2]) && examples.length < 2000) examples.push({ repo: r.repo, sha: r.sha, text: t[2] });
  }
  const total = code + comment + doc;
  return {
    commits: rows.length,
    linesAdded: total,
    codeLines: code,
    commentLines: comment,
    docLines: doc,
    pooledCommentShare: +(100 * (comment + doc) / total).toFixed(1),
    pooledNonDocCommentShare: +(100 * comment / total).toFixed(1),
    medianCommitCommentShare: +(100 * median(shares)).toFixed(1),
    commitsOver25pct: +(100 * shares.filter((s) => s > 0.25).length / rows.length).toFixed(1),
    narratingCommentsPer1kLines: +(1000 * chat / total).toFixed(2),
    narratingComments: chat,
    commitsWithNarration: rows.filter((r) => (r.texts || []).some((t) => chatRef(t[2]))).length,
    examples,
  };
}

const ai = summarise(load('ai.jsonl'));
const base = summarise(load('baseline.jsonl'));
const out = { generated: new Date().toISOString(), method: 'One commit per repo, sampled via GitHub commit search across each day of the window. AI: commits whose message contains "Co-Authored-By: Claude", Sep 2026. Baseline: commits from Mar 2021 with no AI co-author. Only added lines in recognised source files; vendored, generated, lock and minified files and files with >1500 additions excluded. Comment detection and narration rules: lib/scan.js.', ai: { ...ai, examples: ai.examples.slice(0, 60) }, baseline: { ...base, examples: base.examples.slice(0, 30) } };
fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(out, null, 2));
const pick = ['commits', 'linesAdded', 'pooledCommentShare', 'pooledNonDocCommentShare', 'medianCommitCommentShare', 'commitsOver25pct', 'narratingCommentsPer1kLines', 'commitsWithNarration'];
console.log('metric'.padEnd(30), 'claude'.padStart(10), 'baseline2021'.padStart(14));
for (const k of pick) console.log(k.padEnd(30), String(ai[k]).padStart(10), String(base[k]).padStart(14));
