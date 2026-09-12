'use strict';
// Runs the frozen, held-out evaluator of a brief against a produced candidate and writes
// the observed outcome into the run record. The candidate is exported from the commit
// (`git archive`), so uncommitted work is not judged; preservation checks read the
// workspace itself. A missing tool yields `unverified`, an evaluator failure `error`,
// and neither can become `accepted`.
const fs = require('node:fs');
const path = require('node:path');
const lib = require('./lib.cjs');
const record = require('./record.cjs');

const DEFAULT_TOOLS = () => ({ node: process.execPath, git: 'git', npm: 'npm' });

// Run a node script with a timeout and return a normalized check outcome. A tool that
// cannot be spawned (ENOENT) is `unverified`; a timeout is `failed` with the signal noted.
// opts.unverifiedExit: a structural check that exits with this status could not decide
// (missing inputs), which is `unverified`, never passed.
function run(tools, tool, args, { cwd, timeout = 20000, env = {}, unverifiedExit = null } = {}) {
  const bin = tools[tool];
  if (!bin) return { result: 'unverified', exit: null, detail: `tool unavailable: ${tool} (not configured)`, stdout: '', stderr: '' };
  const r = lib.sh(bin, args, { cwd, timeout, env });
  if (r.error && (r.error.code === 'ENOENT' || r.error.code === 'EACCES')) return { result: 'unverified', exit: null, detail: `tool unavailable: ${bin} (${r.error.code})`, stdout: '', stderr: '' };
  if (r.error && r.error.code === 'ETIMEDOUT') return { result: 'failed', exit: r.status ?? 124, detail: `timed out after ${timeout} ms (${r.signal || 'killed'})`, stdout: r.stdout, stderr: r.stderr };
  if (r.status === null) return { result: 'failed', exit: 128, detail: `terminated by ${r.signal}`, stdout: r.stdout, stderr: r.stderr };
  if (unverifiedExit !== null && r.status === unverifiedExit) return { result: 'unverified', exit: r.status, detail: `${r.stdout}${r.stderr}`.trim().slice(-lib.LIMITS.detail), stdout: r.stdout, stderr: r.stderr };
  return { result: r.status === 0 ? 'passed' : 'failed', exit: r.status, detail: (r.status === 0 ? r.stdout : `${r.stdout}${r.stderr}`).trim().slice(-lib.LIMITS.detail), stdout: r.stdout, stderr: r.stderr };
}

function exportCandidate(ws, sha, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  const r = lib.sh('sh', ['-c', `git archive --format=tar "$1" | tar -x -C "$2"`, 'sh', sha, dest], { cwd: ws });
  if (r.status !== 0) throw new Error(`export of ${sha} failed: ${r.stderr.trim()}`);
}

async function evaluateRun({ runsRoot, id, candidate, evaluatorsDir = lib.BRIEFS_DIR, tools = DEFAULT_TOOLS(), now = lib.nowIso }) {
  const dir = lib.runDir(runsRoot, id);
  const file = path.join(dir, 'record.json');
  if (!fs.existsSync(file)) throw new Error(`no record at ${file}`);
  const rec = lib.readJson(file);
  const ws = path.join(dir, 'workspace');
  const logFile = path.join(dir, 'evaluation.log');
  const log = [];
  const say = line => log.push(line);
  const digest = lib.briefDigest(rec.brief, evaluatorsDir);
  const checks = [];
  let sha = candidate || null;
  const finish = (outcome) => {
    const evaluation = { evaluator: { brief: rec.brief, digest: digest.evaluator }, at: now(), candidate: sha, outcome, checks: checks.map(c => ({ id: c.id, title: c.title || c.id, kind: c.kind || 'acceptance', result: c.result, exit: c.exit ?? null, detail: String(c.detail || '').slice(0, lib.LIMITS.detail) })), regressions: checks.filter(c => c.kind === 'regression' && c.result === 'failed').length, log: 'evaluation.log' };
    rec.workspace.candidate = sha;
    rec.evaluation = evaluation;
    if (rec.status === 'pending' && rec.sessions.every(s => s.started && s.ended)) rec.status = 'valid';
    say(`outcome: ${outcome}`);
    fs.writeFileSync(logFile, `${log.join('\n')}\n`);
    lib.writeJson(file, rec);
    return { record: rec, dir };
  };
  try {
    if (!sha) {
      const r = lib.sh(tools.git, ['rev-parse', 'HEAD'], { cwd: ws });
      if (r.error || r.status !== 0) { checks.push({ id: 'candidate', kind: 'protocol', result: r.error ? 'unverified' : 'error', exit: r.status, detail: r.error ? `git unavailable: ${r.error.code}` : `no candidate commit: ${r.stderr.trim()}` }); return finish(record.outcomeOf(checks)); }
      sha = r.stdout.trim();
    }
    if (!lib.isSha(sha)) { checks.push({ id: 'candidate', kind: 'protocol', result: 'error', exit: null, detail: `candidate ${sha} is not a full commit id` }); return finish('error'); }
    say(`evaluating ${id} candidate ${sha} with evaluator ${digest.evaluator} from ${evaluatorsDir}`);
    const status = lib.sh(tools.git, ['status', '--porcelain'], { cwd: ws });
    say(`workspace status:\n${status.stdout || '(clean)'}`);
    const candidateDir = path.join(dir, 'candidate');
    exportCandidate(ws, sha, candidateDir);
    const evaluator = require(path.join(evaluatorsDir, rec.brief, 'evaluator', 'evaluate.cjs'));
    const kit = require('./evaluator-kit.cjs');
    const ctx = { candidateDir, workspaceDir: ws, record: rec, candidate: sha, tools, run: (tool, args, opts) => run(tools, tool, args, opts), runNode: (args, opts) => run(tools, 'node', args, opts), lib, kit, log: say, evaluatorDir: path.join(evaluatorsDir, rec.brief, 'evaluator') };
    const produced = await evaluator.evaluate(ctx);
    if (!Array.isArray(produced) || produced.length === 0) throw new Error('evaluator returned no checks');
    for (const c of produced) { checks.push(c); say(`check ${c.id}: ${c.result}${c.exit === null || c.exit === undefined ? '' : ` (exit ${c.exit})`} — ${String(c.detail || '').split('\n')[0].slice(0, 200)}`); }
    return finish(record.outcomeOf(checks));
  } catch (e) {
    say(`evaluator error: ${e && e.stack ? e.stack : e}`);
    checks.push({ id: 'evaluator', kind: 'protocol', result: 'error', exit: null, detail: `evaluator failed: ${e && e.message ? e.message : e}` });
    return finish('error');
  }
}

const runNode = (tools, args, opts) => run(tools, 'node', args, opts);
module.exports = { evaluateRun, run, runNode, exportCandidate, DEFAULT_TOOLS };
