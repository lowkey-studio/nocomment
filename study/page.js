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
<html lang="en" data-brand="nocomment">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claude-co-authored commits narrate the chat in their comments: ${a.commits} commits vs a 2021 baseline | No Comment</title>
<meta name="description" content="We measured ${a.commits} public commits co-authored by Claude against ${b.commits} commits from 2021. Comments that narrate the chat or the edit show up in ${narrA}% of Claude commits vs ${narrB}%.">
<script>try{var t=localStorage.getItem('kit-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<link rel="preload" href="/kit/fonts/Geist-Variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/kit/kit.css">
<link rel="stylesheet" href="/kit/site.css">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:image" content="https://nocomment.appin60.com/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F7F6F2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121211" media="(prefers-color-scheme: dark)">
<script src="/kit/kit.js" defer></script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<header class="site-header">
  <div class="wrap">
    <a class="brand" href="./" aria-label="No Comment home">
      <svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" style="fill:var(--accent,#826104)"/><g fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="stroke:var(--on-accent,#FFFFFF)"><path d="M11.2 23l4-14M16.8 23l4-14"/></g></svg>
      <span>No <b>Comment</b></span>
    </a>
    <nav class="nav" aria-label="Main">
      <a href="./#install">Install</a>
      <a href="check.html">PR checker</a>
      <a href="study.html" aria-current="page">Study</a>
      <a href="./#teams">Teams and CI</a>
    </nav>
    <button class="icon-btn theme-toggle" type="button" data-theme-toggle aria-label="Switch theme">
      <span class="swap">
        <svg class="icon i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>
        <svg class="icon i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-17.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
      </span>
    </button>
  </div>
</header>

<main id="main">
  <section class="hero">
    <div class="wrap">
      <h1>${narrA}% of Claude-co-authored commits leave comments that narrate the chat. In 2021 code: ${narrB}%.</h1>
      <p class="lead">Study, ${r.generated.slice(0, 10)}. We sampled <b>${a.commits}</b> public GitHub commits whose message carries <code>Co-Authored-By: Claude</code> (Sept 2026) and <b>${b.commits}</b> commits from March 2021, before AI coding agents, one commit per repository. Then we ran the same comment scanner No Comment uses over every added line in source files.</p>
      <div class="stats">
        <div class="stat"><b>${narrA}%</b><span>of Claude-co-authored commits add a comment that narrates the chat or the edit ("previously…", "changed from…", "phase 3", "per the plan"). 2021 baseline: ${narrB}%.</span></div>
        <div class="stat"><b>${a.medianCommitCommentShare}%</b><span>median share of added lines that are comments in a Claude-co-authored commit. 2021 baseline: ${b.medianCommitCommentShare}%.</span></div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head"><h2>The numbers</h2></div>
      <div class="table-wrap table-stack"><table class="table">
<thead><tr><th scope="col">Metric</th><th scope="col" class="num">Claude co-authored, 2026</th><th scope="col" class="num">Baseline, 2021</th></tr></thead>
<tbody>
${rows.map((x) => `<tr><td data-label="Metric">${x[0]}</td><td data-label="Claude co-authored, 2026" class="num">${x[1]}</td><td data-label="Baseline, 2021" class="num">${x[2]}</td></tr>`).join('\n')}
</tbody>
</table></div>
    </div>
  </section>

  <section class="section">
    <div class="wrap"><div class="prose">
<h2>What we found</h2>
<ul>
<li><b>The typical AI commit is more comment-heavy.</b> The median comment share is ${ratio(a.medianCommitCommentShare, b.medianCommitCommentShare)} the 2021 baseline, and more commits cross the 25% mark.</li>
<li><b>Most of the gap is doc comments, not line comments.</b> Pooled over all lines, non-doc comments are about the same share (${a.pooledNonDocCommentShare}% vs ${b.pooledNonDocCommentShare}%). The difference sits in docstrings and JSDoc blocks. Big commits dominate pooled numbers, so we also report medians.</li>
<li><b>The clear difference is narration.</b> Comments that describe the conversation, the plan or the edit history instead of the code appear in ${narrA}% of Claude-co-authored commits and almost never in 2021 code. They mean nothing to the next reader, and they are what <a href="https://github.com/anthropics/claude-code/issues/65961">anthropics/claude-code#65961</a> (250+ 👍) complains about.</li>
</ul>
    </div></div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head"><h2>Real examples from the sample</h2><p>Comment text as committed, one line each.</p></div>
      <div class="code code-wrap">
        <div class="code-head"><span>Narrating comments found in Claude-co-authored commits</span></div>
<pre><code>${ex.map((e) => esc(e.text)).join('\n')}</code></pre>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap"><div class="prose">
<h2>Method and caveats</h2>
<p class="muted">${esc(r.method)} Commit search returns what GitHub's index surfaces, not a uniform random sample. "Co-Authored-By: Claude" marks commits where Claude Code wrote at least part of the change; many AI-written commits carry no trailer. The narration detector is a regex list tuned for precision (lib/scan.js); in a hand check of 40 flagged lines from the Claude sample, about half were clear narration (ticket and task numbers, "previously…", "moved to…", "the user asked for it gone") and most of the rest referenced project phases ("Phase 1 of the 3D port"), which you may or may not count. Excluding every comment that mentions a phase, the result still holds: 11.5% of Claude-co-authored commits vs 0.5% of 2021 commits. The raw per-commit data (repo, sha, counts and comment texts) is in <a href="https://github.com/lowkey-studio/nocomment/tree/main/study">study/</a>, so you can re-run <code>node study/analyze.js</code>.</p>
<h2>Stop it at the source</h2>
<p>No Comment is a free hook for Claude Code and Codex. It sends exactly these comments back to the agent right after it writes them. <a href="./">Install it</a>, <a href="check.html">check one of your PRs</a>, or measure your own sessions with <code>npx github:lowkey-studio/nocomment stats</code>.</p>
<div class="hero-actions">
  <a class="btn" href="./#install">Install No Comment</a>
  <a class="btn btn-secondary" href="check.html">Check one of your PRs</a>
</div>
    </div></div>
  </section>
</main>

<footer class="site-footer">
  <div class="wrap">
    <div class="footer-row">
      <span class="footer-brand"><svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" style="fill:var(--accent,#826104)"/><g fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="stroke:var(--on-accent,#FFFFFF)"><path d="M11.2 23l4-14M16.8 23l4-14"/></g></svg>No Comment</span>
      <span>An independent open-source project, not affiliated with Anthropic. MIT licensed.</span>
      <a href="https://github.com/lowkey-studio/nocomment">Source on GitHub</a>
    </div>
    <!-- umbrella:start. Swap this block only, identically on every site. See design-kit/APPLYING.md. -->
    <p class="umbrella">One of a family of tools from <a href="https://lfglabs.ai">LFG Labs</a></p>
    <!-- umbrella:end -->
  </div>
</footer>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'study.html'), html);
console.log('docs/study.html written');
