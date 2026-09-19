'use strict';
// PRD v7 T-94 (R-08) — the checks the held-out evaluators share.
//
// Every check is decided by a real child process, so a record carries an exit status
// something actually produced rather than a judgment the harness made about itself.
// Three kinds, and the difference between them is reported rather than averaged away:
//
//   `acceptance`   — held-out behaviour the candidate was never shown. Independent.
//   `preservation` — unrelated work is still there, unchanged and uncommitted. Independent.
//   `regression`   — the candidate's OWN test suite. Supplementary, never sufficient:
//                    a candidate that writes a test asserting its own bug passes this
//                    and fails acceptance, which is exactly the case it exists to expose.
//
// The browser seam is the other thing this owns. A UI requirement judged only by reading
// markup is not a UI requirement, so `observed` runs a real browser adapter — and when
// no adapter is configured the check is `unverified`, which makes the run `unavailable`.
// Missing tooling must never become an acceptance; that is the difference between "we
// could not check this" and "this is fine".
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const LIMITS = { detail: 4000 };
const check = (id, kind, title, r, extra = {}) => ({ id, kind, title, result: r.result, exit: r.exit, detail: String(r.detail || '').slice(-LIMITS.detail), independent: kind !== 'regression', ...extra });

// Run a child process into a normalized outcome. A tool that cannot be spawned is
// `unverified`, never `failed`: "the checker is missing" and "the candidate is wrong"
// are different findings and only one of them is about the candidate.
function run(bin, args, { cwd, timeout = 20000, env = {} } = {}) {
  if (!bin) return { result: 'unverified', exit: null, detail: 'tool unavailable: not configured' };
  const r = spawnSync(bin, args, { cwd, timeout, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 8 * 1024 * 1024 });
  if (r.error && (r.error.code === 'ENOENT' || r.error.code === 'EACCES')) return { result: 'unverified', exit: null, detail: `tool unavailable: ${bin} (${r.error.code})` };
  if (r.error && r.error.code === 'ETIMEDOUT') return { result: 'failed', exit: r.status ?? 124, detail: `timed out after ${timeout} ms` };
  if (r.status === null) return { result: 'failed', exit: 128, detail: `terminated by ${r.signal}` };
  return { result: r.status === 0 ? 'passed' : 'failed', exit: r.status, detail: (r.status === 0 ? r.stdout : `${r.stdout}${r.stderr}`).trim() };
}

// A hidden `node --test` file run against the exported candidate. CANDIDATE names the
// exported tree; the file itself never enters the workspace.
function hidden(ctx, id, title, file, { kind = 'acceptance', env = {}, timeout = 30000 } = {}) {
  return check(id, kind, title, run(ctx.tools.node, ['--test', path.join(ctx.evaluatorDir, file)], {
    cwd: ctx.evaluatorDir, timeout, env: { CANDIDATE: ctx.candidateDir, WORKSPACE: ctx.workspaceDir, ...env },
  }));
}

// The candidate's own suite, as a regression signal only.
function ownTests(ctx, { timeout = 60000 } = {}) {
  return check('own-tests', 'regression', "the candidate's own npm test passes", run(ctx.tools.npm, ['test', '--silent'], { cwd: ctx.candidateDir, timeout, env: { CI: '1' } }));
}

// --- The browser seam -------------------------------------------------------------------
// `adapter.observe({candidate,page,expectations,...})` may be async and must return
// boolean ok plus nonempty observations. Real adapters also retain candidate-bound
// artifacts. Injected doubles exercise this seam without claiming browser evidence.
// No adapter means `unverified`, and the caller turns that into `unavailable`.
async function observed(ctx, id, title, page, expectations) {
  const adapter = ctx.browser;
  if (!adapter || typeof adapter.observe !== 'function') {
    return check(id, 'acceptance', title, { result: 'unverified', exit: null, detail: 'no browser adapter configured: this UI requirement was not observed, which is not the same as satisfied' }, { observed: false });
  }
  let outcome;
  try {
    outcome = await adapter.observe({ candidate: ctx.candidate, candidateDir: ctx.candidateDir, page, expectations, id,
      artifactDir: path.join(path.dirname(ctx.candidateDir), 'browser-artifacts'), signal: ctx.signal });
    if (!outcome || typeof outcome.ok !== 'boolean' || !outcome.observations || typeof outcome.observations !== 'object' || !Object.keys(outcome.observations).length) {
      throw new Error('browser adapter returned no valid observations');
    }
    if (adapter.real && (outcome.candidate !== ctx.candidate || !Array.isArray(outcome.artifacts) || outcome.artifacts.length < 2 || outcome.artifacts.some(a => !a.path || !/^[0-9a-f]{64}$/.test(a.sha256) || !fs.existsSync(a.path) || sha256(fs.readFileSync(a.path)) !== a.sha256))) {
      throw new Error('browser artifacts missing or not bound to the tested candidate');
    }
  } catch (e) {
    return check(id, 'acceptance', title, { result: 'error', exit: null, detail: `browser adapter failed: ${e && e.message ? e.message : e}` }, { observed: false });
  }
  const result = outcome && outcome.ok ? 'passed' : 'failed';
  return check(id, 'acceptance', title, { result, exit: outcome && outcome.ok ? 0 : 1, detail: `${adapter.name}@${adapter.version}: ${outcome && outcome.detail ? outcome.detail : '(no detail)'}` }, { observed: true, adapter: `${adapter.name}@${adapter.version}`, observations: outcome.observations, ...(outcome.artifacts ? { artifacts: outcome.artifacts } : {}) });
}

// --- Structural checks, run through this file so each has a real exit status ------------
const structural = (ctx, id, kind, title, sub, args, { timeout = 20000 } = {}) =>
  check(id, kind, title, run(ctx.tools.node, [__filename, sub, ...args], { timeout }));

// Evidence inside the candidate must name this candidate — or the commit its evaluation
// commit sits on, which is the PINCER post-candidate convention. The allowlist is the
// runtime's: NOTES.md and the candidate's own listed evidence, never a whole directory.
const evidenceBinding = ctx => structural(ctx, 'evidence-binding', 'evidence', 'evidence in the candidate names this candidate', 'evidence-binding', [ctx.candidateDir, ctx.candidate, ctx.workspaceDir]);
// Unrelated uncommitted edits recorded at preparation are still present and uncommitted.
const preservation = ctx => structural(ctx, 'unrelated-edits', 'preservation', 'unrelated uncommitted edits preserved', 'preservation', [ctx.workspaceDir, JSON.stringify(ctx.record && ctx.record.workspace ? ctx.record.workspace.unrelated_edits || {} : {})]);

function walk(dir, rel = '', out = []) {
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const next = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(dir, next, out); else out.push(next);
  }
  return out;
}
// The only paths that may differ between an evaluated candidate and the commit its
// evidence names. Anything else means the evidence describes a different tree.
const POST_CANDIDATE = rel => rel === 'NOTES.md' || rel.startsWith('.prd/evidence/');

function evaluationOf(ws, candidate, named) {
  if (named === candidate) return { ok: true, why: 'the evaluated commit' };
  if (!/^[0-9a-f]{40}$/.test(named)) return { ok: false, why: `${named} is not a full commit id` };
  if (spawnSync('git', ['merge-base', '--is-ancestor', named, candidate], { cwd: ws }).status !== 0) {
    return { ok: false, why: `${named.slice(0, 7)} is not an ancestor of ${candidate.slice(0, 7)}` };
  }
  const diff = spawnSync('git', ['diff', '--name-only', named, candidate], { cwd: ws, encoding: 'utf8' });
  const changed = diff.stdout.split('\n').filter(Boolean);
  const outside = changed.filter(rel => !POST_CANDIDATE(rel));
  if (outside.length) return { ok: false, why: `${candidate.slice(0, 7)} changes ${outside.slice(0, 5).join(', ')} after ${named.slice(0, 7)}: the evidence describes another tree` };
  return { ok: true, why: `${candidate.slice(0, 7)} is the evaluation commit of ${named.slice(0, 7)}` };
}

function cliEvidenceBinding(dir, candidate, ws) {
  const problems = [], notes = [];
  const bind = (what, named) => {
    const r = evaluationOf(ws, candidate, named);
    if (r.ok) notes.push(`${what}: ${r.why}`);
    else problems.push(`${what} names candidate ${String(named).slice(0, 7)}, evaluated ${candidate.slice(0, 7)} — ${r.why}`);
  };
  const notesFile = path.join(dir, 'NOTES.md');
  if (fs.existsSync(notesFile)) {
    const m = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(notesFile, 'utf8'));
    const fm = m ? Object.fromEntries(m[1].split('\n').map(l => l.split(/:\s*/)).filter(x => x.length >= 2).map(([k, ...v]) => [k, v.join(': ').trim()])) : {};
    if (fm.candidate) bind('NOTES.md', fm.candidate);
    if (fm.evidence && !fs.existsSync(path.join(dir, fm.evidence))) problems.push(`NOTES.md points at missing evidence ${fm.evidence}`);
  }
  const files = fs.existsSync(dir) ? walk(dir) : [];
  for (const rel of files.filter(r => /^\.prd\/evidence\/.*manifest\.json$/.test(r))) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8'));
      if (m.candidate) bind(rel, String(m.candidate));
      // The runtime admits only a manifest's own listed artifacts after the candidate.
      // An artifact present in the evidence directory but absent from the manifest's
      // list is exactly the "whole directory" loophole the v6 helper left open.
      const listed = new Set((m.artifacts || []).map(a => a.path));
      const dirRel = path.posix.dirname(rel);
      for (const other of files.filter(f => f.startsWith(`${dirRel}/`) && f !== rel)) {
        if (!listed.has(other)) problems.push(`${other} is under ${dirRel} but is not listed in ${rel}: the manifest admits its own listed artifacts, never a whole directory`);
      }
    } catch (e) { problems.push(`${rel}: unreadable (${e.message})`); }
  }
  if (problems.length) { process.stdout.write(`${problems.join('\n')}\n`); return 1; }
  process.stdout.write(`${notes.length ? notes.join('\n') : 'no evidence names another candidate'}\n`);
  return 0;
}

function cliPreservation(ws, editsJson) {
  const edits = JSON.parse(editsJson);
  const problems = [];
  for (const [rel, e] of Object.entries(edits)) {
    const p = path.join(ws, rel);
    if (!fs.existsSync(p)) { problems.push(`${rel}: missing`); continue; }
    if (e.kind === 'append') {
      if (!fs.readFileSync(p, 'utf8').includes(e.text)) problems.push(`${rel}: the unrelated edit is no longer in the working file`);
      const head = spawnSync('git', ['show', `HEAD:${rel}`], { cwd: ws, encoding: 'utf8' });
      if (head.status === 0 && head.stdout.includes(e.text)) problems.push(`${rel}: the unrelated edit was committed`);
    } else {
      if (sha256(fs.readFileSync(p)) !== e.digest) problems.push(`${rel}: content changed`);
      if (spawnSync('git', ['ls-files', '--error-unmatch', rel], { cwd: ws, encoding: 'utf8' }).status === 0) problems.push(`${rel}: the untracked file was committed`);
    }
  }
  if (problems.length) { process.stdout.write(`${problems.join('\n')}\n`); return 1; }
  process.stdout.write(`${Object.keys(edits).length} unrelated edit(s) intact\n`);
  return 0;
}

if (require.main === module) {
  const [sub, ...args] = process.argv.slice(2);
  if (sub === 'evidence-binding') process.exit(cliEvidenceBinding(args[0], args[1], args[2]));
  if (sub === 'preservation') process.exit(cliPreservation(args[0], args[1]));
  process.stderr.write(`unknown structural check ${sub}\n`);
  process.exit(2);
}

module.exports = { LIMITS, sha256, check, run, hidden, ownTests, observed, structural, evidenceBinding, preservation, evaluationOf, walk };
