'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { addedComments } = require('./scan');
const { loadConfig, evaluate, ignored } = require('./rules');

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
