'use strict';
// PRD v7 T-94 (R-08) — preparing a workspace and evaluating what came out of it.
//
// The harness owns run metadata and invokes the held-out evaluator on a produced
// candidate. It never copies evaluator assets into a workspace, and it judges the
// EXPORTED COMMIT rather than the working tree: uncommitted work is not a candidate.
// Preservation checks read the workspace itself, because "the unrelated edit is still
// uncommitted" is a claim about the tree, not about the commit.
//
// `evaluateCandidate` takes its tools and its browser adapter as arguments. That is what
// makes the default path offline and testable: the suite injects controlled tools and a
// deterministic browser adapter, and nothing here can reach a model or a network.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const briefs = require('./briefs.cjs');
const effort = require('./effort.cjs');
const kit = require('./evaluator-kit.cjs');

const GIT_ID = {
  GIT_AUTHOR_NAME: 'benchmark', GIT_AUTHOR_EMAIL: 'benchmark@example.invalid',
  GIT_COMMITTER_NAME: 'benchmark', GIT_COMMITTER_EMAIL: 'benchmark@example.invalid',
};
const DEFAULT_TOOLS = () => ({ node: process.execPath, git: 'git', npm: 'npm' });

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: opts.cwd, env: { ...process.env, ...GIT_ID, ...(opts.env || {}) }, timeout: opts.timeout, maxBuffer: 8 * 1024 * 1024 });
  return { status: r.status, signal: r.signal, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error || null };
}
function git(cwd, ...args) {
  const r = sh('git', args, { cwd, env: { GIT_TERMINAL_PROMPT: '0' } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${r.stderr.trim()}`);
  return r.stdout.trim();
}
function write(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function gitInit(dir) {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.name', 'benchmark');
  git(dir, 'config', 'user.email', 'benchmark@example.invalid');
  git(dir, 'config', 'commit.gpgsign', 'false');
}
// Stage only the named paths. The briefs that carry a preservation check use this,
// because `git add -A` is exactly the behaviour those checks exist to catch: it sweeps
// an operator's uncommitted work into a commit that was supposed to be about the task.
function commitPaths(dir, message, paths, date) {
  const env = date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {};
  for (const rel of paths) {
    const r = sh('git', ['add', '--', rel], { cwd: dir, env });
    if (r.status !== 0) throw new Error(`git add ${rel} failed: ${r.stderr}`);
  }
  const c = sh('git', ['commit', '-q', '--allow-empty', '-m', message], { cwd: dir, env });
  if (c.status !== 0) throw new Error(`git commit failed: ${c.stderr}`);
  return git(dir, 'rev-parse', 'HEAD');
}
function commitAll(dir, message, date) {
  const env = date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {};
  if (sh('git', ['add', '-A'], { cwd: dir, env }).status !== 0) throw new Error('git add failed');
  const r = sh('git', ['commit', '-q', '--allow-empty', '-m', message], { cwd: dir, env });
  if (r.status !== 0) throw new Error(`git commit failed: ${r.stderr}`);
  return git(dir, 'rev-parse', 'HEAD');
}
// The helpers a brief's base.cjs and controls.cjs are handed. Deliberately small: a
// fixture that needs more than this is doing something the harness should own.
const LIB = { write, gitInit, commitAll, commitPaths, git, sh, sha256: kit.sha256 };

// Prepare a workspace for one run. The brief's own files go in MINUS the held-out ones;
// the arm decides only whether a kit is installed and whether strict coverage is to be
// adopted, never what the task is.
function prepare(ws, id, { arm = 'plain', dir = briefs.BRIEFS_DIR, unrelatedEdits = null } = {}) {
  const brief = briefs.loadBrief(id, dir);
  fs.mkdirSync(ws, { recursive: true });
  brief.base.create(ws, LIB);
  // BRIEF.md is the task the agent reads. Everything held out stays out of the tree.
  write(ws, 'BRIEF.md', `# ${id}\n\n${brief.task}\n`);
  commitAll(ws, `Add BRIEF.md for ${id}`);
  const edits = {};
  if (unrelatedEdits) {
    for (const [rel, e] of Object.entries(unrelatedEdits)) {
      if (e.kind === 'append') {
        fs.appendFileSync(path.join(ws, rel), e.text);
        edits[rel] = { kind: 'append', text: e.text };
      } else {
        write(ws, rel, e.content);
        edits[rel] = { kind: 'untracked', digest: kit.sha256(e.content) };
      }
    }
  }
  return { brief, workspace: ws, arm, unrelated_edits: edits };
}

// Export a commit into a directory: the candidate is the commit, never the dirty tree.
function exportCandidate(ws, sha, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  const r = sh('sh', ['-c', 'git archive --format=tar "$1" | tar -x -C "$2"', 'sh', sha, dest], { cwd: ws });
  if (r.status !== 0) throw new Error(`export of ${sha} failed: ${r.stderr.trim()}`);
  return dest;
}

// Run the held-out evaluator of a brief against a candidate commit. Returns the checks
// and the outcome those checks imply — `outcomeOf` decides, not the evaluator's opinion.
async function evaluateCandidate({ id, workspace, candidate, dir = briefs.BRIEFS_DIR, tools = DEFAULT_TOOLS(), browser = null, record = null, scratch }) {
  const candidateDir = exportCandidate(workspace, candidate, path.join(scratch, 'candidate'));
  const evaluator = require(path.join(dir, id, 'evaluator', 'evaluate.cjs'));
  const ctx = {
    id, candidate, candidateDir, workspaceDir: workspace, tools, browser, record, kit,
    evaluatorDir: path.join(dir, id, 'evaluator'),
  };
  const checks = await evaluator.evaluate(ctx);
  if (!Array.isArray(checks) || !checks.length) throw new Error(`${id}: evaluator returned no checks`);
  return { candidate, checks, outcome: effort.outcomeOf(checks) };
}

// A run whose evaluation could not decide is `unavailable`, never accepted: the whole
// point of the browser seam is that missing tooling is a gap in the study, not a pass.
function statusFor(outcome) {
  if (outcome === 'accepted' || outcome === 'rejected') return 'valid';
  if (outcome === 'unverified') return 'unavailable';
  return 'invalid';
}

module.exports = { GIT_ID, DEFAULT_TOOLS, LIB, sh, git, write, gitInit, commitAll, commitPaths, prepare, exportCandidate, evaluateCandidate, statusFor };
