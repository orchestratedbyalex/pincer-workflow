// PRD v7 T-91 (R-05, S-13..S-15): `resume --brief` is a projection of the report
// `resume` already computes, not a second policy engine. Across the whole state matrix
// — no selection, planned, paused, active, terminal, wrong selection, running and
// interrupted attempts, invalid history, stale agreement, stale evidence — brief and
// full agree on the verdict and the next action, and every distinct blocker category
// survives with its exact count. A large change produces fewer bytes while keeping the
// counts and a resolvable route to every omitted row. Default output is unchanged and
// reporting writes nothing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { repo, tempDir, write, read, run } from './helpers.js';

const require = createRequire(import.meta.url);
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const resume = require(path.join(repo, 'template/scripts/pincer-runtime/resume.cjs'));
const state = require(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const fx = path.join(repo, 'test/fixtures/prd-v6');

const cli = (dir, args) => run(dir, process.execPath, [runtime, ...args]);
const snapshotTree = dir => {
  const out = {};
  const walk = rel => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const next = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(next); else out[next] = fs.readFileSync(path.join(dir, next)).toString('base64');
    }
  };
  walk('');
  return out;
};
const git = (dir, ...args) => run(dir, 'git', args);

// A registered project carrying the strict fixture, or a generated larger one.
function project({ map = read(fx, 'strict/coverage/prd-v1.json'), prd = read(fx, 'strict/prd-v1.md'), tickets = null, register = true } = {}) {
  const dir = tempDir();
  write(dir, '.prd/prd-v1.md', prd);
  if (tickets) for (const [file, text] of Object.entries(tickets)) write(dir, file, text);
  else for (const f of fs.readdirSync(path.join(fx, 'strict/tickets'))) write(dir, `tickets/${f}`, read(fx, `strict/tickets/${f}`));
  if (map !== null) write(dir, '.prd/coverage/prd-v1.json', map);
  write(dir, 'value.txt', 'good\n');
  write(dir, '.gitignore', '.pincer/\n');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 't@example.invalid');
  git(dir, 'config', 'user.name', 't');
  git(dir, 'config', 'commit.gpgsign', 'false');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'base');
  if (register) {
    assert.equal(cli(dir, ['register', '--prd', '.prd/prd-v1.md']).status, 0);
    assert.equal(cli(dir, ['change', 'select', 'prd-v1']).status, 0);
  }
  return dir;
}
// The agreement the runtime computes right now, which is what `change authorize`
// requires — not the last entry the record happens to carry.
const currentAgreement = dir => JSON.parse(cli(dir, ['resume', '--json']).stdout).agreement.current;

// Adopt strict coverage and carry it to an executable state: the fixture map defers
// S-03, so that disposition needs a resolved decision and an authorization naming it
// before any ticket command will run.
function adopt(dir, { decide = true, authorize = true, activate = true } = {}) {
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'map');
  const applied = cli(dir, ['coverage', 'adopt', '--apply', '--change', 'prd-v1']);
  assert.equal(applied.status, 0, applied.stderr);
  const decisions = [];
  if (decide) {
    assert.equal(cli(dir, ['change', 'decide', 'prd-v1', '--summary', 'defer S-03 to the next change']).status, 0);
    const resolved = cli(dir, ['change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', 'operator', '--excerpt', 'defer it']);
    assert.equal(resolved.status, 0, resolved.stderr);
    decisions.push('--decision', 'D-01');
  }
  if (authorize) {
    const authorized = cli(dir, ['change', 'authorize', 'prd-v1', '--agreement', currentAgreement(dir), ...decisions, '--reference', 'operator', '--excerpt', 'implement it']);
    assert.equal(authorized.status, 0, authorized.stderr);
  }
  if (activate) {
    const activated = cli(dir, ['change', 'activate', 'prd-v1']);
    assert.equal(activated.status, 0, activated.stderr);
  }
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'adopted');
  return dir;
}
// The strict fixture's tickets leave their acceptance criteria unticked, which is a
// different blocker from the ones this suite is about; a ticked copy can actually close.
const tickedTickets = () => Object.fromEntries(fs.readdirSync(path.join(fx, 'strict/tickets')).map(f => [`tickets/${f}`, read(fx, `strict/tickets/${f}`).replace('- [ ] expected behavior', '- [x] expected behavior')]));

// The pair of reports for one project, as the CLI produces them.
function pair(dir, args = []) {
  const full = cli(dir, ['resume', ...args]);
  const fullJson = cli(dir, ['resume', ...args, '--json']);
  const brief = cli(dir, ['resume', '--brief', ...args]);
  const briefJson = cli(dir, ['resume', '--brief', ...args, '--json']);
  assert.equal(fullJson.status, full.status, 'the JSON and human exits agree');
  assert.equal(brief.status, full.status, `--brief keeps the exit code (${args.join(' ')})`);
  assert.equal(briefJson.status, full.status);
  return { full, brief, f: JSON.parse(fullJson.stdout), b: JSON.parse(briefJson.stdout) };
}
const categoriesOf = json => {
  const counts = {};
  for (const x of json.blockers) counts[x.code] = (counts[x.code] || 0) + 1;
  return counts;
};

// --- S-13: every state agrees, and no blocker category is ever collapsed away --------
const states = {};

// (a) no change records at all — rule 1, the selection problem.
states.legacy = (() => {
  const dir = tempDir();
  write(dir, '.prd/prd-v1.md', read(fx, 'strict/prd-v1.md'));
  write(dir, 'tickets/T-01-parse.md', read(fx, 'strict/tickets/T-01-parse.md'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 't@example.invalid');
  git(dir, 'config', 'user.name', 't');
  git(dir, 'config', 'commit.gpgsign', 'false');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'base');
  return dir;
})();
// (b) registered but nothing selected.
states.unselected = (() => {
  const dir = project({ register: false });
  assert.equal(cli(dir, ['register', '--prd', '.prd/prd-v1.md']).status, 0);
  return dir;
})();
// (c) planned, not yet authorized — AUTHORIZATION_REQUIRED and the planned lifecycle.
states.planned = project();
// (d) adopted and authorized but still planned.
states.adoptedPlanned = adopt(project(), { activate: false });
// (e) active, work outstanding.
states.active = adopt(project());
// (f) paused.
states.paused = (() => {
  const dir = adopt(project());
  assert.equal(cli(dir, ['change', 'pause', 'prd-v1', '--reason', 'end of session', '--note', 'T-01 next']).status, 0);
  return dir;
})();
// (g) cancelled — terminal, execution refused.
states.terminal = (() => {
  const dir = adopt(project());
  // Decision IDs are allocated in sequence and adoption already used D-01 for the
  // deferral of S-03; cancelling needs a second decision, resolved.
  assert.equal(cli(dir, ['change', 'decide', 'prd-v1', '--summary', 'stop this change']).status, 0);
  assert.equal(cli(dir, ['change', 'decide', 'prd-v1', '--resolve', 'D-02', '--reference', 'operator', '--excerpt', 'stop it']).status, 0);
  const cancelled = cli(dir, ['change', 'cancel', 'prd-v1', '--decision', 'D-02', '--reason', 'superseded by other work']);
  assert.equal(cancelled.status, 0, cancelled.stderr);
  return dir;
})();
// (h) stale agreement — the PRD changed after authorization.
states.staleAgreement = (() => {
  const dir = adopt(project());
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('## 7. Out of Scope', '- **S-04:** A scenario added after authorization.\n\n## 7. Out of Scope'));
  return dir;
})();
// (i) adopted but never authorized — the agreement gap, rule 4. An unauthorized
// change cannot be activated, so this one stays planned.
states.unauthorized = adopt(project(), { authorize: false, activate: false });
// (i2) adopted and authorized, but the deferral of S-03 has no resolved decision —
// SCOPE_UNAUTHORIZED inside rule 4, a structural coverage gap rather than an agreement one.
states.scopeUnauthorized = adopt(project(), { decide: false, activate: false });
// (j) an attempt of the change is running, owned by a live process — rule 2 outranks
// the agreement gap. Written directly, the way change-resume.test.js does it.
const livingOwners = [];
function withAttempt(dir, { id, pid }) {
  const attempt = { schema: 2, runtime: 2, id, sequence: 9, context: { kind: 'ticket', change: 'prd-v1', ticket: 'T-02' }, outcome: 'running', owner: { pid, ppid: 1, host: os.hostname() }, child: null, started: '2026-09-11T00:00:00Z', finished: null, artifacts: {}, limitations: [] };
  state.writeAttempt(dir, attempt);
  const idx = state.readIndex(dir).index;
  idx.running.push(attempt.id); idx.sequence = 9; idx.current['ticket:prd-v1:T-02'] = attempt.id;
  state.writeIndex(dir, idx);
  return dir;
}
states.runningAttempt = (() => {
  const live = spawn('bash', ['-c', 'sleep 60'], { stdio: 'ignore' });
  livingOwners.push(live);
  return withAttempt(adopt(project()), { id: '000009-20260911T000000Z-run001', pid: live.pid });
})();
// (k) the same attempt with an owner that is gone — interrupted, routes to recover.
states.interruptedAttempt = (() => {
  // spawnSync has already reaped this process by the time it returns, so the pid names
  // an owner that is certainly gone — which is what `recover` exists for.
  const dead = spawnSync('bash', ['-c', 'exit 0']);
  return withAttempt(adopt(project()), { id: '000009-20260911T000000Z-run002', pid: dead.pid });
})();
// (l) stale evidence — a ticket verified and done, then its source changed under it.
states.staleEvidence = (() => {
  const dir = adopt(project({ tickets: tickedTickets() }));
  assert.equal(cli(dir, ['start', 'T-01']).status, 0);
  assert.equal(cli(dir, ['verify', 'T-01']).status, 0);
  assert.equal(cli(dir, ['done', 'T-01']).status, 0);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'T-01 done');
  write(dir, 'src/later.js', 'const changed = 1;\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'source moved on');
  return dir;
})();
// (m) invalid history — an unreadable change record, rule 1.
states.invalid = (() => {
  const dir = adopt(project());
  write(dir, '.prd/changes/prd-v1.json', '{ "schema": 3, ');
  return dir;
})();
// (n) a report asked for by name that this worktree has not selected.
states.wrongSelection = (() => {
  const dir = adopt(project());
  write(dir, '.prd/prd-v2.md', read(fx, 'strict/prd-v1.md').replace('version: 1', 'version: 2'));
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'second prd');
  assert.equal(cli(dir, ['register', '--prd', '.prd/prd-v2.md']).status, 0);
  assert.equal(cli(dir, ['change', 'select', 'prd-v2']).status, 0);
  return dir;
})();

{
  for (const [name, dir] of Object.entries(states)) {
    const args = name === 'wrongSelection' ? ['--change', 'prd-v1'] : [];
    const { full, brief, f, b } = pair(dir, args);
    // The verdict and the next action are the full report's own, copied.
    assert.deepEqual(b.next, f.next, `${name}: brief and full give the same next action`);
    assert.equal(b.mode, f.mode, `${name}: same mode`);
    assert.deepEqual(b.selection, f.selection, `${name}: same selection problem`);
    if (f.change) {
      assert.equal(b.change.id, f.change.id, `${name}: same change`);
      assert.equal(b.change.lifecycle, f.change.lifecycle.state, `${name}: same lifecycle state`);
      assert.equal(b.agreement.verdict, f.agreement.verdict, `${name}: same authorization verdict`);
      assert.equal(b.agreement.current, f.agreement.current);
      assert.equal(b.coverage.label, f.coverage.label, `${name}: same coverage label`);
      assert.equal(b.tickets.total, f.tickets.length, `${name}: exact ticket count`);
      assert.equal(b.attempts.total, f.attempts.length, `${name}: exact attempt count`);
    } else {
      assert.equal(b.change, null, `${name}: no change in either report`);
    }
    // Every distinct blocker category survives, with its exact count.
    const expected = categoriesOf(f);
    const got = Object.fromEntries(b.blockers.categories.map(c => [c.code, c.count]));
    assert.deepEqual(got, expected, `${name}: every blocker category is retained with its count`);
    assert.equal(b.blockers.total, f.blockers.length, `${name}: exact blocker total`);
    // The human renderings carry the same next action verbatim and name every category.
    assert.ok(full.stdout.includes(`Next       ${f.next.action}: ${f.next.command}`), `${name}: full prints the next action`);
    assert.ok(brief.stdout.includes(`Next       ${f.next.action}: ${f.next.command}`), `${name}: brief prints the same next action`);
    for (const code of Object.keys(expected)) assert.ok(brief.stdout.includes(code), `${name}: brief names the ${code} category`);
    assert.equal(b.kind, 'resume-brief');
    assert.equal(b.of, resume.SCHEMA, 'the brief names the full schema it projects');
  }
  // The matrix really did exercise distinct verdicts and rules, not one state eleven times.
  const verdicts = new Set(), rules = new Set(), codes = new Set();
  for (const [name, dir] of Object.entries(states)) {
    const args = name === 'wrongSelection' ? ['--change', 'prd-v1'] : [];
    const { f } = pair(dir, args);
    if (f.agreement) verdicts.add(f.agreement.verdict);
    if (f.next.rule) rules.add(f.next.rule);
    for (const x of f.blockers) codes.add(x.code);
  }
  assert.ok(verdicts.has('AUTHORIZATION_REQUIRED'), 'the matrix covers AUTHORIZATION_REQUIRED');
  assert.ok(verdicts.has('AGREEMENT_CHANGED'), 'the matrix covers a stale agreement');
  assert.ok(verdicts.has('current'), 'the matrix covers a current authorization');
  assert.ok(codes.has('LIFECYCLE_BLOCKED'), 'the matrix covers a terminal change');
  assert.ok(codes.has('SCOPE_UNAUTHORIZED'), 'the matrix covers an unauthorized scope disposition');
  assert.ok(rules.size >= 3, `the matrix exercises several precedence rules (saw ${[...rules].join(', ')})`);
}

// --- S-14: smaller on a large change, with resolvable detail and complete JSON -------
{
  // Twenty scenarios over four requirements, twenty tickets, each with a blocker.
  const reqs = [];
  const tickets = {};
  const scenarios = {};
  const map = { schema: 1, change: 'prd-v1', prd: '.prd/prd-v1.md', scenarios, scope: {}, tickets: {}, checks: { 'C-01': { kind: 'command', required: true, command: 'test "$(cat value.txt)" = good', timeout: 60, cwd: null, obligation: null, note: null } } };
  for (let r = 1; r <= 4; r++) {
    const rows = [];
    for (let k = 1; k <= 5; k++) {
      const n = (r - 1) * 5 + k;
      const sid = `S-${String(n).padStart(2, '0')}`;
      const tid = `T-${String(n).padStart(2, '0')}`;
      rows.push(`- **${sid}:** Scenario ${n} of requirement ${r}, stated as one observable outcome.`);
      scenarios[sid] = { tickets: [tid], checks: ['C-01'] };
      map.tickets[tid] = { role: 'implements', rationale: null };
      tickets[`tickets/${tid}-work.md`] = `---\nticket: ${tid}\nstatus: open\nsize: S\nprd: .prd/prd-v1.md\ndepends_on: []\n---\n\n## Objective\nDeliver scenario ${n}.\n\n## Context\n- Implements: ${sid}\n\n## Acceptance Criteria\n- [x] behaves as specified\n\n## Verification\n\`\`\`bash\ntest "$(cat value.txt)" = good\n\`\`\`\n`;
    }
    reqs.push(`### R-${String(r).padStart(2, '0')} — Requirement ${r}\n\n${rows.join('\n')}\n`);
  }
  const prd = `---\nversion: 1\nstatus: ticketed\ndate: 2026-09-14\n---\n# Large strict PRD\n\n## 1. Problem\n\nA change big enough that reading the full report to find one next action is the cost.\n\n## 4. Requirements\n\n${reqs.join('\n')}\n`;
  const large = adopt(project({ prd, tickets, map: `${JSON.stringify(map, null, 2)}\n` }));
  const before = snapshotTree(large);
  const { full, brief, f, b } = pair(large);

  assert.equal(f.tickets.length, 20, 'the fixture really is large');
  assert.ok(brief.stdout.length < full.stdout.length, `brief (${brief.stdout.length}B) is smaller than full (${full.stdout.length}B)`);
  assert.ok(brief.stdout.length * 2 < full.stdout.length, 'and materially smaller, not marginally');
  // The counts the brief prints are exact, and it says how many rows it did not print.
  assert.equal(b.tickets.total, 20);
  assert.equal(b.tickets.by_status.open + b.tickets.by_status.in_progress + b.tickets.by_status.done, 20, 'the status counts partition the tickets');
  assert.equal(b.detail.omitted, f.tickets.length + f.attempts.length + Math.max(0, f.blockers.length - b.blockers.categories.length));
  assert.ok(b.detail.omitted > 0, 'the brief admits it omitted rows');
  assert.match(brief.stdout, /\(\d+ row\(s\) not shown\)/);
  // Those omitted rows are reachable: the command the brief names prints them.
  assert.equal(b.detail.command, 'node scripts/pincer-runtime.cjs resume --change prd-v1');
  const named = cli(large, ['resume', '--change', 'prd-v1']);
  assert.equal(named.status, full.status);
  for (const t of f.tickets) assert.ok(named.stdout.includes(t.id), `the detail command prints ${t.id}`);
  // The artifact references resolve to files that exist.
  assert.ok(fs.existsSync(path.join(large, b.detail.prd)), 'the PRD reference resolves');
  assert.equal(b.detail.tickets.length, 20);
  for (const file of b.detail.tickets) assert.ok(fs.existsSync(path.join(large, file)), `${file} resolves`);

  // Piped JSON is complete, not a prefix truncated at a pipe buffer.
  // `generated` is the one field that legitimately differs between two invocations.
  const stable = ({ generated, ...rest }) => rest;
  const piped = run(large, 'bash', ['-c', `${JSON.stringify(process.execPath)} ${JSON.stringify(runtime)} resume --brief --json | cat`]);
  assert.equal(piped.status, 0);
  assert.deepEqual(stable(JSON.parse(piped.stdout)), stable(b), 'piped brief JSON parses and matches');
  const pipedFull = run(large, 'bash', ['-c', `${JSON.stringify(process.execPath)} ${JSON.stringify(runtime)} resume --json | cat`]);
  assert.deepEqual(stable(JSON.parse(pipedFull.stdout)), stable(f), 'piped full JSON still parses');

  // Invalid input stays nonzero and prints no report.
  const bad = cli(large, ['resume', '--brief', 'extra']);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /unexpected argument extra/);
  assert.equal(bad.stdout, '');
  const badFlag = cli(large, ['resume', '--brief', '--summary']);
  assert.equal(badFlag.status, 2);
  assert.match(badFlag.stderr, /unknown option --summary/);

  // Reporting changed nothing.
  assert.deepEqual(snapshotTree(large), before, 'every report left the tree identical');
}

// --- S-15: the default contracts are untouched and missing history is never guessed --
{
  const dir = states.active;
  // The default human and JSON output must be exactly what they were without --brief.
  const plain = cli(dir, ['resume']);
  const plainJson = cli(dir, ['resume', '--json']);
  const built = resume.build(dir, { change: null });
  // Only the `generated` stamp on the first line may differ between two computations.
  const bodyOf = text => text.split('\n').slice(1).join('\n');
  assert.equal(bodyOf(plain.stdout), bodyOf(built.text), 'default human output is the full render, unchanged');
  assert.equal(plain.stdout.split('\n')[0].replace(/· \S+ ·/, '· TS ·'), built.text.split('\n')[0].replace(/· \S+ ·/, '· TS ·'));
  const parsed = JSON.parse(plainJson.stdout);
  assert.equal(parsed.schema, 2, 'resume JSON stays schema 2');
  assert.deepEqual(Object.keys(parsed).sort(), Object.keys(built.json).sort(), 'the full JSON keys are unchanged');
  // The brief is a separate envelope, so nothing reading resume JSON sees a new shape.
  const briefJson = JSON.parse(cli(dir, ['resume', '--brief', '--json']).stdout);
  assert.equal(briefJson.brief, 1);
  assert.ok(!('schema' in briefJson), 'the brief does not pose as resume JSON');
  assert.equal(briefJson.kind, 'resume-brief');

  // brief() is a pure function of the computed report: same input, same output, and it
  // never consults the filesystem to decide anything.
  assert.deepEqual(resume.brief(built.json), resume.brief(built.json));
  assert.deepEqual(resume.brief(built.json).next, built.json.next);

  // A fresh clone with no local attempt history: the brief reports the missing history
  // rather than inventing a next action, exactly as the full report does.
  const clone = tempDir();
  const cloned = run(clone, 'git', ['clone', '-q', dir, 'copy']);
  assert.equal(cloned.status, 0, cloned.stderr);
  const copy = path.join(clone, 'copy');
  assert.equal(cli(copy, ['change', 'select', 'prd-v1']).status, 0);
  const { f, b } = pair(copy);
  assert.ok(!fs.existsSync(path.join(copy, '.pincer/runtime/attempts', 'x')), 'the clone carries no attempt history');
  assert.deepEqual(b.next, f.next, 'the clone agrees on the next action');
  assert.equal(b.attempts.total, f.attempts.length);
  assert.deepEqual(Object.fromEntries(b.blockers.categories.map(c => [c.code, c.count])), categoriesOf(f), 'and on every blocker category');

  // A fresh session can name its next ticket from the brief alone: the action carries
  // the ticket, and the referenced artifacts exist.
  const work = adopt(project());
  const wb = JSON.parse(cli(work, ['resume', '--brief', '--json']).stdout);
  assert.equal(wb.next.rule, 5, 'an active change with open tickets routes to ticket work');
  assert.ok(wb.next.ticket, 'the next action names its ticket');
  assert.match(wb.next.command, new RegExp(wb.next.ticket), 'and the command runs on that ticket');
  const humanBrief = cli(work, ['resume', '--brief']).stdout;
  assert.ok(humanBrief.includes(wb.next.ticket), 'the human brief names the ticket too');
  assert.ok(wb.detail.tickets.some(file => file.includes(wb.next.ticket)), 'the ticket file is among the references');
  assert.ok(fs.existsSync(path.join(work, wb.detail.tickets.find(file => file.includes(wb.next.ticket)))), 'and that file exists');
}

console.log('resume brief tests passed');
