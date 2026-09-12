'use strict';
// Shared helpers for the independent delivery benchmark (PRD v6, R-10). No dependencies.
// The harness owns run metadata (records) and invokes the frozen evaluators on produced
// candidates; it never copies evaluator assets into an implementation workspace.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'test', 'fixtures', 'delivery-benchmark');
const BRIEFS_DIR = path.join(FIXTURES, 'briefs');
const FROZEN = path.join(FIXTURES, 'frozen.json');
const PROTOCOL = path.join(REPO, 'docs', 'delivery-benchmark.md');
const RECORD_SCHEMA = 1;
const ARMS = ['pincer', 'plain'];
const PAIRS = 3; // planned pairs per brief; reruns of invalid runs take pair numbers up to MAX_PAIR
const MAX_PAIR = 9;
const OUTCOMES = ['accepted', 'rejected', 'unverified', 'error'];
const RESULTS = ['passed', 'failed', 'unverified', 'error'];
const STATUSES = ['pending', 'valid', 'invalid', 'unavailable'];
const INTERVENTIONS = ['clarification', 'reapproval', 'repair', 'operator'];
const LIMITS = { prompt: 8000, note: 2000, detail: 4000, interventions: 100, checks: 64, sessions: 8 };
// Files an implementation workspace may never receive from a brief directory.
const HELD_OUT = ['evaluator', 'controls.cjs', 'base.cjs'];

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const nowIso = () => new Date().toISOString();
const isSha = s => typeof s === 'string' && /^[0-9a-f]{40}$/.test(s);
const isHex64 = s => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);

function walk(dir, rel = '', out = []) {
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const next = rel ? `${rel}/${e.name}` : e.name;
    if (e.name === '.git' || e.name === 'node_modules') continue;
    if (e.isDirectory()) walk(dir, next, out); else if (e.isFile()) out.push(next);
  }
  return out;
}
// Deterministic digest of a directory tree: sha256 over "<rel>\n<sha256(content)>\n" lines.
function treeDigest(dir) {
  const files = walk(dir);
  const lines = files.map(rel => `${rel}\n${sha256(fs.readFileSync(path.join(dir, rel)))}\n`);
  return { digest: sha256(lines.join('')), files: Object.fromEntries(files.map((rel, i) => [rel, lines[i].split('\n')[1]])) };
}

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: opts.cwd, env: { ...process.env, ...(opts.env || {}) }, input: opts.input, timeout: opts.timeout, maxBuffer: 16 * 1024 * 1024 });
  return { status: r.status, signal: r.signal, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error || null };
}
function git(cwd, ...args) {
  const r = sh('git', args, { cwd, env: { GIT_TERMINAL_PROMPT: '0' } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${r.stderr.trim()}`);
  return r.stdout.trim();
}
const GIT_ID = { GIT_AUTHOR_NAME: 'benchmark', GIT_AUTHOR_EMAIL: 'benchmark@example.invalid', GIT_COMMITTER_NAME: 'benchmark', GIT_COMMITTER_EMAIL: 'benchmark@example.invalid' };
function gitInit(dir) {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.name', 'benchmark');
  git(dir, 'config', 'user.email', 'benchmark@example.invalid');
  git(dir, 'config', 'commit.gpgsign', 'false');
}
// Commit everything with an optional fixed date (ISO) so evaluators can place commits in
// session windows deterministically.
function commitAll(dir, message, date) {
  const env = { ...GIT_ID };
  if (date) { env.GIT_AUTHOR_DATE = date; env.GIT_COMMITTER_DATE = date; }
  const r1 = sh('git', ['add', '-A'], { cwd: dir, env });
  if (r1.status !== 0) throw new Error(`git add failed: ${r1.stderr}`);
  const r2 = sh('git', ['commit', '-q', '-m', message], { cwd: dir, env });
  if (r2.status !== 0) throw new Error(`git commit failed: ${r2.stderr}`);
  return git(dir, 'rev-parse', 'HEAD');
}
function write(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, doc) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

// "## Title" sections of a brief: { Title: body }.
function sections(text) {
  const out = {};
  let key = null;
  for (const line of text.split('\n')) {
    const m = /^## (.+)$/.exec(line);
    if (m) { key = m[1].trim(); out[key] = ''; continue; }
    if (key !== null) out[key] += `${line}\n`;
  }
  return out;
}
function briefIds(dir = BRIEFS_DIR) {
  return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
}
function loadBrief(id, dir = BRIEFS_DIR) {
  const root = path.join(dir, id);
  if (!fs.existsSync(path.join(root, 'brief.md'))) throw new Error(`unknown brief: ${id}`);
  const base = require(path.join(root, 'base.cjs'));
  const text = fs.readFileSync(path.join(root, 'brief.md'), 'utf8');
  const secs = sections(text);
  const prompts = Object.keys(secs).filter(k => /^Prompt \d+$/.test(k)).sort((x, y) => Number(x.split(' ')[1]) - Number(y.split(' ')[1])).map(k => ({ name: `S${k.split(' ')[1]}`, prompt: secs[k].trim() }));
  if (!prompts.length) throw new Error(`${id}: brief.md declares no "## Prompt N" section`);
  if (!secs.Task) throw new Error(`${id}: brief.md has no "## Task" section`);
  return { id, root, text, base, prompts, task: secs.Task.trim(), sections: secs, evaluatorDir: path.join(root, 'evaluator'), sessions: prompts.length };
}
// Digest of the evaluator assets of a brief: the evaluator directory plus base.cjs,
// controls.cjs and brief.md (everything a run's inputs and judgment depend on).
function briefDigest(id, dir = BRIEFS_DIR) {
  const root = path.join(dir, id);
  const files = walk(root).filter(rel => !rel.startsWith('.'));
  const entries = files.map(rel => [rel, sha256(fs.readFileSync(path.join(root, rel)))]);
  return { digest: sha256(entries.map(([rel, d]) => `${rel}\n${d}\n`).join('')), files: Object.fromEntries(entries), evaluator: sha256(entries.filter(([rel]) => rel.startsWith('evaluator/')).map(([rel, d]) => `${rel}\n${d}\n`).join('')) };
}

// Balanced schedule: PAIRS rounds, every brief in each round, the first arm of a pair
// alternating with the brief index and the round so each brief starts with both arms and
// the overall count of pincer-first and plain-first runs is equal.
function schedule(ids = briefIds()) {
  const runs = [];
  let order = 0;
  for (let pair = 1; pair <= PAIRS; pair++) {
    ids.forEach((brief, i) => {
      const first = (i + pair) % 2 === 0 ? 'pincer' : 'plain';
      for (const arm of [first, first === 'pincer' ? 'plain' : 'pincer']) runs.push({ order: ++order, brief, pair, arm, run: runId(brief, pair, arm) });
    });
  }
  return runs;
}
const runId = (brief, pair, arm) => `${brief}/pair-${pair}/${arm}`;
const runDir = (root, id) => path.join(root, ...id.split('/'));

module.exports = { REPO, FIXTURES, BRIEFS_DIR, FROZEN, PROTOCOL, RECORD_SCHEMA, ARMS, PAIRS, MAX_PAIR, OUTCOMES, RESULTS, STATUSES, INTERVENTIONS, LIMITS, HELD_OUT, GIT_ID, sha256, nowIso, isSha, isHex64, walk, treeDigest, sh, git, gitInit, commitAll, write, readJson, writeJson, briefIds, loadBrief, sections, briefDigest, schedule, runId, runDir };
