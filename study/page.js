'use strict';
// Writes docs/study.html from study/results.json.
const fs = require('fs');
const path = require('path');
const r = JSON.parse(fs.readFileSync(path.join(__dirname, 'results.json'), 'utf8'));
const a = r.ai, b = r.baseline;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const ratio = (x, y) => (y ? (x / y).toFixed(1) + '×' : 'n/a');
const narrA = (100 * a.commitsWithNarration / a.commits).toFixed(1);
const narrB = (100 * b.commitsWithNarration / b.commits).toFixed(1);
const rows = [
  ['Commits sampled (one per repo)', a.commits, b.commits],
  ['Lines added in source files', a.linesAdded.toLocaleString('en'), b.linesAdded.toLocaleString('en')],
  ['Median comment share per commit', a.medianCommitCommentShare + '%', b.medianCommitCommentShare + '%'],
  ['Commits where over 25% of added lines are comments', a.commitsOver25pct + '%', b.commitsOver25pct + '%'],
  ['Pooled comment share (incl. docstrings / JSDoc)', a.pooledCommentShare + '%', b.pooledCommentShare + '%'],
  ['Pooled comment share (excl. doc comments)', a.pooledNonDocCommentShare + '%', b.pooledNonDocCommentShare + '%'],
  ['Commits with a comment narrating the chat or edit', `${a.commitsWithNarration} (${narrA}%)`, `${b.commitsWithNarration} (${narrB}%)`],
  ['Narrating comments per 1,000 added lines', a.narratingCommentsPer1kLines, b.narratingCommentsPer1kLines],
];
const ex = a.examples.filter((e) => e.text.length > 25).slice(0, 18);
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claude-co-authored commits narrate the chat in their comments: ${a.commits} commits vs a 2021 baseline | No Comment</title>
<meta name="description" content="We measured ${a.commits} public commits co-authored by Claude against ${b.commits} commits from 2021. Comments that narrate the chat or the edit show up in ${narrA}% of Claude commits vs ${narrB}%.">
<style>
:root{--bg:#0e0f11;--fg:#e8e6e1;--mute:#9a978f;--acc:#ffcc4d;--card:#17191c;--line:#2a2d31}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}
main{max-width:860px;margin:0 auto;padding:48px 22px 80px}h1{font-size:36px;line-height:1.15}h2{margin-top:44px}
a{color:var(--acc)}table{width:100%;border-collapse:collapse;margin:18px 0}td,th{padding:10px 8px;border-bottom:1px solid var(--line);text-align:left}
td:nth-child(2),td:nth-child(3),th:nth-child(2),th:nth-child(3){text-align:right;font-variant-numeric:tabular-nums}
.big{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:24px 0}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px}
.card b{font-size:40px;display:block;color:var(--acc)}.mute{color:var(--mute);font-size:15px}
pre{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;overflow-x:auto;font:13.5px/1.55 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap}
@media(max-width:700px){.big{grid-template-columns:1fr}}
</style></head><body><main>
<p class="mute"><a href="./">No Comment</a> / study, ${r.generated.slice(0, 10)}</p>
<h1>${narrA}% of Claude-co-authored commits leave comments that narrate the chat. In 2021 code: ${narrB}%.</h1>
<p>We sampled <b>${a.commits}</b> public GitHub commits whose message carries <code>Co-Authored-By: Claude</code> (Sept 2026) and <b>${b.commits}</b> commits from March 2021, before AI coding agents, one commit per repository. Then we ran the same comment scanner No Comment uses over every added line in source files.</p>
<div class="big">
<div class="card"><b>${narrA}%</b>of Claude-co-authored commits add a comment that narrates the chat or the edit ("previously…", "changed from…", "phase 3", "per the plan"). <span class="mute">2021 baseline: ${narrB}%.</span></div>
<div class="card"><b>${a.medianCommitCommentShare}%</b>median share of added lines that are comments in a Claude-co-authored commit. <span class="mute">2021 baseline: ${b.medianCommitCommentShare}%.</span></div>
</div>
<table><tr><th>Metric</th><th>Claude co-authored, 2026</th><th>Baseline, 2021</th></tr>
${rows.map((x) => `<tr><td>${x[0]}</td><td>${x[1]}</td><td>${x[2]}</td></tr>`).join('\n')}
</table>
<h2>What we found</h2>
<ul>
<li><b>The typical AI commit is more comment-heavy.</b> The median comment share is ${ratio(a.medianCommitCommentShare, b.medianCommitCommentShare)} the 2021 baseline, and more commits cross the 25% mark.</li>
<li><b>Most of the gap is doc comments, not line comments.</b> Pooled over all lines, non-doc comments are about the same share (${a.pooledNonDocCommentShare}% vs ${b.pooledNonDocCommentShare}%). The difference sits in docstrings and JSDoc blocks. Big commits dominate pooled numbers, so we also report medians.</li>
<li><b>The clear difference is narration.</b> Comments that describe the conversation, the plan or the edit history instead of the code appear in ${narrA}% of Claude-co-authored commits and almost never in 2021 code. They mean nothing to the next reader, and they are what <a href="https://github.com/anthropics/claude-code/issues/65961">anthropics/claude-code#65961</a> (250+ 👍) complains about.</li>
</ul>
<h2>Real examples from the sample</h2>
<pre>${ex.map((e) => esc(e.text)).join('\n')}</pre>
<h2>Method and caveats</h2>
<p class="mute">${esc(r.method)} Commit search returns what GitHub's index surfaces, not a uniform random sample. "Co-Authored-By: Claude" marks commits where Claude Code wrote at least part of the change; many AI-written commits carry no trailer. The narration detector is a regex list tuned for precision (lib/scan.js); in a hand check of 40 flagged lines from the Claude sample, about half were clear narration (ticket and task numbers, "previously…", "moved to…", "the user asked for it gone") and most of the rest referenced project phases ("Phase 1 of the 3D port"), which you may or may not count. Excluding every comment that mentions a phase, the result still holds: 11.5% of Claude-co-authored commits vs 0.5% of 2021 commits. The raw per-commit data (repo, sha, counts and comment texts) is in <a href="https://github.com/lowkey-studio/nocomment/tree/main/study">study/</a>, so you can re-run <code>node study/analyze.js</code>.</p>
<h2>Stop it at the source</h2>
<p>No Comment is a free hook for Claude Code and Codex. It sends exactly these comments back to the agent right after it writes them. <a href="./">Install it</a>, <a href="check.html">check one of your PRs</a>, or measure your own sessions with <code>npx github:lowkey-studio/nocomment stats</code>.</p>
</main></body></html>
`;
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'study.html'), html);
console.log('docs/study.html written');
