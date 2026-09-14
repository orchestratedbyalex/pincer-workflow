'use strict';
// PRD v7 T-89 — the baseline strict-journey probe.
//
// Drives a pinned released kit through a complete strict-coverage journey in a
// disposable project — register, select, author the map, adopt, authorize, activate,
// implement, pause, resume from a fresh session, revise the scope under authorization,
// complete, check and export — recording every command with its exit code, its
// stdout/stderr byte counts and its wall-clock, plus every byte a human had to author.
//
// What this measures is the MECHANICAL cost of the journey: how many commands it
// takes, how many bytes a fresh session must read to find its next action, and how
// much of the coverage map is transcription of IDs the runtime already parsed. It
// runs no model and costs nothing.
//
// What it therefore does NOT establish is R-03's observation requirement. S-07 and
// S-08 need real agents following the shipped instructions on three real projects;
// an operator walking the commands cannot show whether an agent understands them,
// where it goes wrong, or what it asks the user for. Those remain outstanding
// (docs/prd-v7-pilots.md, "What this does not establish").
//
//   node scripts/delivery-benchmark-v7/baseline-journey.cjs <kit-dir> <out.json>
//
// <kit-dir> holds the released kit's scripts: pincer-runtime.cjs, pincer-evidence.cjs,
// pincer-ticket.sh, pincer-status.sh and pincer-runtime/*.cjs.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const KIT = process.argv[2];
const OUT = process.argv[3];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pincer-baseline-'));
const events = [];
const RUNTIME = path.join(dir, 'scripts/pincer-runtime.cjs');

function sh(cmd, args, opts = {}) {
  const started = Date.now();
  const r = spawnSync(cmd, args, { cwd: opts.cwd || dir, encoding: 'utf8', timeout: 120000,
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir, GIT_TERMINAL_PROMPT: '0' }, input: opts.input });
  const out = r.stdout || '', err = r.stderr || '';
  return { status: r.status, stdout: out, stderr: err, ms: Date.now() - started };
}
// A recorded workflow operation: a runtime command the journey needs.
function op(stage, label, args, opts = {}) {
  const r = sh(process.execPath, [RUNTIME, ...args], opts);
  events.push({ kind: 'command', stage, label, argv: ['pincer-runtime.cjs', ...args],
    exit: r.status, stdout_bytes: Buffer.byteLength(r.stdout), stderr_bytes: Buffer.byteLength(r.stderr), ms: r.ms,
    diagnostic: r.status === 0 ? null : (r.stderr || r.stdout).trim().slice(0, 400) });
  if (process.env.VERBOSE) console.log(`[${stage}] ${label} exit=${r.status} out=${Buffer.byteLength(r.stdout)}B`);
  return r;
}
// An authoring operation: bytes a human or agent had to write by hand.
function authored(stage, label, file, content) {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), content);
  events.push({ kind: 'authored', stage, label, file, bytes: Buffer.byteLength(content), lines: content.split('\n').length - 1 });
}
function git(...args) { return sh('git', args); }

// --- the project -------------------------------------------------------------------
fs.mkdirSync(path.join(dir, 'scripts/pincer-runtime'), { recursive: true });
for (const f of ['pincer-runtime.cjs', 'pincer-evidence.cjs', 'pincer-ticket.sh', 'pincer-status.sh']) {
  fs.copyFileSync(path.join(KIT, f), path.join(dir, 'scripts', f));
}
for (const f of fs.readdirSync(path.join(KIT, 'pincer-runtime'))) {
  fs.copyFileSync(path.join(KIT, 'pincer-runtime', f), path.join(dir, 'scripts/pincer-runtime', f));
}
fs.chmodSync(path.join(dir, 'scripts/pincer-ticket.sh'), 0o755);
git('init', '-q', '-b', 'main');
git('config', 'user.name', 'baseline'); git('config', 'user.email', 'baseline@example.invalid');
git('config', 'commit.gpgsign', 'false');
fs.writeFileSync(path.join(dir, 'value.txt'), 'good\n');
fs.writeFileSync(path.join(dir, '.gitignore'), '.pincer/\n');
git('add', '-A'); git('commit', '-q', '-m', 'base');
const base = sh('git', ['rev-parse', 'HEAD']).stdout.trim();

// --- stage: author the PRD ---------------------------------------------------------
authored('plan', 'PRD', '.prd/prd-v1.md', `---
version: 1
status: ticketed
date: 2026-09-14
---
# Example strict PRD

## 1. Problem

A disposable project used to measure the baseline strict journey.

## 4. Requirements

### R-01 — Read the value

- **S-01:** The stored value reads back as \`good\`.
- **S-02:** A wrong value is reported, not accepted.

### R-02 — Report the value

- **S-03:** The value is printed with its source path.
`);
const TICKETS = [
  ['T-01', 'read', 'Read the value'],
  ['T-02', 'report', 'Report the value'],
];
for (const [id, slug, objective] of TICKETS) {
  authored('narrow', `ticket ${id}`, `tickets/${id}-${slug}.md`, `---
ticket: ${id}
status: open
size: S
prd: .prd/prd-v1.md
depends_on: []
---

## Objective
${objective}

## Acceptance Criteria
- [x] behaves as specified

## Verification
\`\`\`bash
test "$(cat value.txt)" = good
\`\`\`
`);
}
git('add', '-A'); git('commit', '-q', '-m', 'prd and tickets');

// --- stage: register and select ----------------------------------------------------
op('adopt', 'register', ['register', '--prd', '.prd/prd-v1.md']);
op('adopt', 'change select', ['change', 'select', 'prd-v1']);
op('adopt', 'status (orientation)', ['status']);
op('adopt', 'coverage (before map)', ['coverage']);

// --- stage: author the coverage map BY HAND ---------------------------------------
// This is the transcription the scaffold is meant to remove: every live scenario, every
// ticket role, every check declaration, written out from the PRD and the ticket files.
authored('adopt', 'coverage map', '.prd/coverage/prd-v1.json', `${JSON.stringify({
  schema: 1,
  change: 'prd-v1',
  prd: '.prd/prd-v1.md',
  scenarios: {
    'S-01': { tickets: ['T-01'], checks: ['C-01'] },
    'S-02': { tickets: ['T-01'], checks: ['C-01'] },
    'S-03': { tickets: ['T-02'], checks: ['C-01'] },
  },
  scope: {},
  tickets: { 'T-01': { role: 'implements', rationale: null }, 'T-02': { role: 'implements', rationale: null } },
  checks: { 'C-01': { kind: 'command', required: true, command: 'test "$(cat value.txt)" = good', timeout: 60, cwd: null, obligation: null, note: null } },
}, null, 2)}\n`);

op('adopt', 'coverage adopt --preview', ['coverage', 'adopt', '--preview', '--change', 'prd-v1']);
const applied = op('adopt', 'coverage adopt --apply', ['coverage', 'adopt', '--apply', '--change', 'prd-v1']);
const digest = (applied.stdout.match(/agreement G-\d+ ([0-9a-f]{12})/) || [])[1];
// The full digest comes from the record; the CLI prints twelve characters.
const record = JSON.parse(fs.readFileSync(path.join(dir, '.prd/changes/prd-v1.json'), 'utf8'));
const full = (record.agreements.at(-1) || {}).digest;
op('adopt', 'change authorize', ['change', 'authorize', 'prd-v1', '--agreement', full,
  '--reference', 'operator instruction', '--excerpt', 'implement the strict journey']);
op('adopt', 'change activate', ['change', 'activate', 'prd-v1']);
git('add', '-A'); git('commit', '-q', '-m', 'adopt strict coverage');

// --- stage: implement --------------------------------------------------------------
for (const [id] of TICKETS) {
  op('code', `start ${id}`, ['start', id]);
  op('code', `verify ${id}`, ['verify', id]);
  op('code', `done ${id}`, ['done', id]);
  git('add', '-A'); git('commit', '-q', '-m', `${id} done`);
}

// --- stage: pause and fresh-session recovery ---------------------------------------
op('pause', 'change pause', ['change', 'pause', 'prd-v1', '--reason', 'end of session', '--note', 'T-02 next']);
git('add', '-A'); git('commit', '-q', '-m', 'pause');
// What a fresh session reads to find out what to do next.
op('resume', 'resume (full)', ['resume']);
op('resume', 'resume --json', ['resume', '--json']);
op('resume', 'status', ['status']);
op('resume', 'coverage', ['coverage']);
op('resume', 'change resume', ['change', 'resume', 'prd-v1']);
git('add', '-A'); git('commit', '-q', '-m', 'resume');

// --- stage: an authorized scope revision -------------------------------------------
// A new scenario in the PRD changes the inventory, so the agreement no longer matches
// the authorized one and the map must gain its row before work continues.
const prdPath = path.join(dir, '.prd/prd-v1.md');
authored('revise', 'PRD revision (new scenario)', '.prd/prd-v1.md',
  `${fs.readFileSync(prdPath, 'utf8')}\n- **S-04:** A missing value is reported as missing.\n`);
op('revise', 'impact', ['impact']);
op('revise', 'coverage (stale map)', ['coverage']);
op('revise', 'resume (stale agreement)', ['resume']);
// The map must be re-authored by hand for the new scenario.
const mapPath = '.prd/coverage/prd-v1.json';
const mapDoc = JSON.parse(fs.readFileSync(path.join(dir, mapPath), 'utf8'));
mapDoc.scenarios['S-04'] = { tickets: ['T-02'], checks: ['C-01'] };
authored('revise', 'coverage map (re-authored)', mapPath, `${JSON.stringify(mapDoc, null, 2)}\n`);
op('revise', 'change revise', ['change', 'revise', 'prd-v1']);
const revised = JSON.parse(fs.readFileSync(path.join(dir, '.prd/changes/prd-v1.json'), 'utf8'));
op('revise', 'change authorize (revised scope)', ['change', 'authorize', 'prd-v1',
  '--agreement', (revised.agreements.at(-1) || {}).digest,
  '--reference', 'operator instruction', '--excerpt', 'add the missing-value scenario']);
// The revised PRD revision invalidates every passing attempt of the change, including
// the tickets the revision did not touch: each one must be verified again.
op('revise', 'register --rebind', ['register', '--prd', '.prd/prd-v1.md', '--rebind']);
for (const [id] of TICKETS) {
  op('revise', `verify ${id} (after revision)`, ['verify', id]);
  op('revise', `done ${id} (after revision)`, ['done', id]);
}
git('add', '-A'); git('commit', '-q', '-m', 'scope revision');

// --- stage: complete and evaluate --------------------------------------------------
op('evaluate', 'change complete', ['change', 'complete', 'prd-v1']);
// The completion event is a record write, so the candidate is the commit that carries it.
git('add', '-A'); git('commit', '-q', '-m', 'complete');
const head = sh('git', ['rev-parse', 'HEAD']).stdout.trim();
op('evaluate', 'check C-01', ['check', 'C-01', '--candidate', head]);
op('evaluate', 'coverage (after check)', ['coverage']);
op('evaluate', 'resume (final)', ['resume']);
op('evaluate', 'evidence export', ['evidence', 'export', '--candidate', head, '--base', base]);

fs.writeFileSync(OUT, `${JSON.stringify({ generated: new Date().toISOString(), project: dir, events }, null, 2)}\n`);
const commands = events.filter(e => e.kind === 'command');
const auth = events.filter(e => e.kind === 'authored');
console.log(`commands=${commands.length} nonzero=${commands.filter(c => c.exit !== 0).length} stdout_bytes=${commands.reduce((n, c) => n + c.stdout_bytes, 0)}`);
console.log(`authored_files=${auth.length} authored_bytes=${auth.reduce((n, a) => n + a.bytes, 0)}`);
console.log(`map_bytes=${(auth.find(a => a.label === 'coverage map') || {}).bytes}`);
console.log(`resume_full_bytes=${(commands.find(c => c.label === 'resume (full)') || {}).stdout_bytes}`);
console.log(`project=${dir}`);
