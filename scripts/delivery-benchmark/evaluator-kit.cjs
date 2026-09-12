'use strict';
// Checks shared by the held-out evaluators. Every check is decided by a child process so
// the record carries a real exit status: hidden `node --test` files, `npm test` in the
// candidate, and the structural checks below (run through this file as a CLI).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const check = (id, kind, title, r) => ({ id, kind, title, result: r.result, exit: r.exit, detail: r.detail });

// A hidden test file (node:test) run against the exported candidate: CANDIDATE names it.
function hidden(ctx, id, title, file, { kind = 'acceptance', env = {}, timeout = 30000 } = {}) {
  return check(id, kind, title, ctx.runNode(['--test', path.join(ctx.evaluatorDir, file)], { cwd: ctx.evaluatorDir, timeout, env: { CANDIDATE: ctx.candidateDir, WORKSPACE: ctx.workspaceDir, ...env } }));
}
// The candidate's own `npm test`, as a regression signal only (never the sole measure).
function npmTest(ctx, { timeout = 120000 } = {}) {
  return check('own-tests', 'regression', "the candidate's own npm test passes", ctx.run('npm', ['test', '--silent'], { cwd: ctx.candidateDir, timeout, env: { CI: '1' } }));
}
// Structural checks run through this file so they have a process exit status.
function structural(ctx, id, kind, title, sub, args, opts = {}) {
  return check(id, kind, title, ctx.runNode([__filename, sub, ...args], { timeout: opts.timeout || 20000 }));
}
// No evidence in the candidate may name another commit as the evaluated candidate.
const evidenceBinding = ctx => structural(ctx, 'evidence-binding', 'evidence', 'evidence in the candidate names this candidate', 'evidence-binding', [ctx.candidateDir, ctx.candidate]);
// Unrelated uncommitted edits recorded at preparation are still present, unchanged and uncommitted.
const preservation = ctx => structural(ctx, 'unrelated-edits', 'preservation', 'unrelated uncommitted edits preserved', 'preservation', [ctx.workspaceDir, JSON.stringify(ctx.record.workspace.unrelated_edits || {})]);
// The tree at the end of a session (the last commit before `ended`) exported for inspection.
function exportAt(ctx, sessionName, dest) {
  const s = (ctx.record.sessions || []).find(x => x.name === sessionName);
  if (!s || !s.ended) return null;
  const r = ctx.lib.sh(ctx.tools.git, ['rev-list', '-1', `--before=${s.ended}`, 'HEAD'], { cwd: ctx.workspaceDir });
  const sha = r.status === 0 ? r.stdout.trim() : '';
  if (!/^[0-9a-f]{40}$/.test(sha)) return null;
  fs.rmSync(dest, { recursive: true, force: true }); fs.mkdirSync(dest, { recursive: true });
  const x = ctx.lib.sh('sh', ['-c', 'git archive --format=tar "$1" | tar -x -C "$2"', 'sh', sha, dest], { cwd: ctx.workspaceDir });
  return x.status === 0 ? { sha, dir: dest } : null;
}

function walk(dir, rel = '', out = []) {
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const next = rel ? `${rel}/${e.name}` : e.name;
    if (e.name === '.git' || e.name === 'node_modules') continue;
    if (e.isDirectory()) walk(dir, next, out); else out.push(next);
  }
  return out;
}
function cliEvidenceBinding(dir, candidate) {
  const problems = [];
  const notes = path.join(dir, 'NOTES.md');
  if (fs.existsSync(notes)) {
    const m = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(notes, 'utf8'));
    const fm = m ? Object.fromEntries(m[1].split('\n').map(l => l.split(/:\s*/)).filter(x => x.length >= 2).map(([k, ...v]) => [k, v.join(': ').trim()])) : {};
    if (fm.candidate && fm.candidate !== candidate) problems.push(`NOTES.md names candidate ${fm.candidate.slice(0, 7)}, evaluated ${candidate.slice(0, 7)}`);
    if (fm.evidence && !fs.existsSync(path.join(dir, fm.evidence))) problems.push(`NOTES.md points at missing evidence ${fm.evidence}`);
  }
  for (const rel of walk(dir).filter(r => /^\.prd\/evidence\/.*manifest\.json$/.test(r))) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8'));
      if (m.candidate && m.candidate !== candidate) problems.push(`${rel} names candidate ${String(m.candidate).slice(0, 7)}`);
    } catch (e) { problems.push(`${rel}: unreadable (${e.message})`); }
  }
  for (const rel of walk(dir).filter(r => /^\.prd\/evidence\/changes\/[^/]+\.json$/.test(r))) {
    try {
      const l = JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8'));
      const entries = Array.isArray(l.evaluations) ? l.evaluations : [];
      const latest = entries[entries.length - 1];
      if (latest && latest.candidate && latest.candidate !== candidate) problems.push(`${rel} latest evaluation names candidate ${String(latest.candidate).slice(0, 7)}`);
    } catch (e) { problems.push(`${rel}: unreadable (${e.message})`); }
  }
  if (problems.length) { process.stdout.write(`${problems.join('\n')}\n`); return 1; }
  process.stdout.write('no evidence names another candidate\n'); return 0;
}
// An appended hunk must still be in the working file and absent from HEAD's version; an
// untracked file must exist unchanged and still be untracked.
function cliPreservation(ws, editsJson) {
  const edits = JSON.parse(editsJson);
  const problems = [];
  const { spawnSync } = require('node:child_process');
  for (const [rel, e] of Object.entries(edits)) {
    const p = path.join(ws, rel);
    if (!fs.existsSync(p)) { problems.push(`${rel}: missing`); continue; }
    if (e.kind === 'append') {
      const working = fs.readFileSync(p, 'utf8');
      if (!working.includes(e.text)) problems.push(`${rel}: the unrelated edit is no longer in the working file`);
      const head = spawnSync('git', ['show', `HEAD:${rel}`], { cwd: ws, encoding: 'utf8' });
      if (head.status === 0 && head.stdout.includes(e.text)) problems.push(`${rel}: the unrelated edit was committed`);
    } else {
      if (sha256(fs.readFileSync(p)) !== e.digest) problems.push(`${rel}: content changed`);
      const tracked = spawnSync('git', ['ls-files', '--error-unmatch', rel], { cwd: ws, encoding: 'utf8' });
      if (tracked.status === 0) problems.push(`${rel}: the untracked file was committed`);
    }
  }
  if (problems.length) { process.stdout.write(`${problems.join('\n')}\n`); return 1; }
  process.stdout.write(`${Object.keys(edits).length} unrelated edit(s) intact\n`); return 0;
}

if (require.main === module) {
  const [sub, ...args] = process.argv.slice(2);
  if (sub === 'evidence-binding') process.exit(cliEvidenceBinding(args[0], args[1]));
  if (sub === 'preservation') process.exit(cliPreservation(args[0], args[1]));
  process.stderr.write(`unknown structural check ${sub}\n`); process.exit(2);
}
module.exports = { hidden, npmTest, structural, evidenceBinding, preservation, exportAt, check, sha256 };
