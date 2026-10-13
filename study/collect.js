'use strict';
// Samples public commits via the GitHub API and measures the comment share of added code lines.
// Usage: node study/collect.js ai|baseline N > out.jsonl   (needs `gh` logged in)
const { execFileSync } = require('child_process');
const { addedComments, langFor } = require('../lib/scan');

const kind = process.argv[2];
const want = Number(process.argv[3] || 300);
const gh = (args) => JSON.parse(execFileSync('gh', ['api', ...args], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }));
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const SKIP = /(^|\/)(node_modules|vendor|dist|build|third_party|\.next|generated|__generated__|migrations)\//i;
const SKIPF = /(\.min\.|\.lock$|lock\.json$|\.pb\.|_pb2|\.g\.dart$|\.generated\.|\.d\.ts$)/i;

function days(kind) {
  const out = [];
  const start = kind === 'ai' ? Date.UTC(2026, 8, 1) : Date.UTC(2021, 2, 1);
  for (let d = 0; d < 30; d++) out.push(new Date(start + d * 864e5).toISOString().slice(0, 10));
  return out;
}

const seenRepo = new Set();
let n = 0;
const outFile = process.argv[4];
if (outFile && require('fs').existsSync(outFile)) {
  for (const l of require('fs').readFileSync(outFile, 'utf8').split('\n').filter(Boolean)) { seenRepo.add(JSON.parse(l).repo); n++; }
}
const emit = (rec) => outFile ? require('fs').appendFileSync(outFile, JSON.stringify(rec) + '\n') : process.stdout.write(JSON.stringify(rec) + '\n');
const terms = ['add', 'fix', 'update', 'implement', 'refactor', 'feat'];
outer: for (let round = 0; round < 6; round++) {
  for (const day of days(kind)) {
    const term = terms[(round + day.charCodeAt(9)) % terms.length];
    const q = kind === 'ai'
      ? `"Co-Authored-By: Claude" ${term} committer-date:${day}`
      : `${term} committer-date:${day} merge:false`;
    let items = [];
    try { items = gh(['-X', 'GET', 'search/commits', '-f', `q=${q}`, '-f', 'per_page=30', '-f', `page=${round + 1}`]).items || []; } catch { sleep(5000); continue; }
    sleep(2200);
    for (const it of items) {
      const repo = it.repository.full_name;
      if (seenRepo.has(repo) || it.repository.fork) continue;
      if (kind === 'baseline' && /co-authored-by:.*(claude|copilot|cursor|codex|gpt|aider)/i.test(it.commit.message)) continue;
      let c;
      try { c = gh([`repos/${repo}/commits/${it.sha}`]); } catch { continue; }
      if (!c.files || (c.parents || []).length > 1) continue;
      const rec = { repo, sha: it.sha, date: day, files: 0, code: 0, comment: 0, doc: 0, chat: 0, examples: [], texts: [] };
      for (const f of c.files) {
        if (!f.patch || SKIP.test(f.filename) || SKIPF.test(f.filename) || !langFor(f.filename)) continue;
        if (f.additions > 1500) continue;
        const before = [], after = [];
        for (const l of f.patch.split('\n')) {
          if (l.startsWith('+')) after.push(l.slice(1));
          else if (l.startsWith('-')) before.push(l.slice(1));
          else if (l.startsWith('@@')) { before.push(''); after.push(''); }
        }
        const r = addedComments(before.join('\n'), after.join('\n'), f.filename);
        if (!r) continue;
        rec.files++;
        rec.code += r.addedCode;
        for (const a of r.added) {
          if (a.doc) rec.doc++; else rec.comment++;
          if (rec.texts.length < 300) rec.texts.push([a.doc ? 1 : 0, f.filename.split('.').pop(), a.text.slice(0, 160)]);
          if (a.chatref) { rec.chat++; if (rec.examples.length < 3) rec.examples.push(`${f.filename}: ${a.text.slice(0, 100)}`); }
        }
      }
      if (rec.code + rec.comment + rec.doc < 5) continue;
      seenRepo.add(repo);
      emit(rec);
      if (++n >= want) break outer;
    }
  }
}
process.stderr.write(`done ${n}\n`);
