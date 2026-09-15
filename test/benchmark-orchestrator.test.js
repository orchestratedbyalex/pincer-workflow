// PRD v7 T-98 (R-08): the live driver places and caps a session, and the orchestrator
// stops on an account limit, checkpoints, reruns above the schedule and installs the kit
// per arm. Every session here is a stand-in CLI with a scripted outcome — the suite
// replaces PATH outright so the real binary is unreachable, and asserts the stand-in is
// what actually ran before asserting anything else. A test that bills is not a test.
//
// What this does NOT prove: any behaviour of a real model session. That is T-95, and it
// has not run. These cases prove the machinery around a session, not the session.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { repo, tempDir } from './helpers.js';

const require = createRequire(import.meta.url);
const V7 = path.join(repo, 'scripts/delivery-benchmark-v7');
const orchestrator = require(path.join(V7, 'orchestrator.cjs'));
const effort = require(path.join(V7, 'effort.cjs'));
const schedule = require(path.join(V7, 'schedule.cjs'));
const DRIVER = path.join(V7, 'live-driver.sh');
const COHORT = 'a'.repeat(64);

// --- the stand-in -----------------------------------------------------------------------
// Behaviour is chosen by FAKE_MODE. It writes a sentinel on every invocation so the suite
// can prove the real CLI was never reached, and refuses outright if the driver failed to
// unset the two variables that would make the session non-fresh.
function fakeCli() {
  const dir = tempDir();
  const sentinel = path.join(dir, 'invocations.log');
  fs.writeFileSync(path.join(dir, 'claude'), `#!/usr/bin/env bash
set -u
echo "$PWD" >> ${JSON.stringify(sentinel)}
if [ -n "\${CLAUDECODE:-}" ] || [ -n "\${CLAUDE_CODE_ENTRYPOINT:-}" ]; then
  echo "stand-in: the session is not fresh; CLAUDECODE/CLAUDE_CODE_ENTRYPOINT survived" >&2
  exit 90
fi
case "\${FAKE_MODE:-ok}" in
  ok)
    git add -A >/dev/null 2>&1 || true
    git -c user.name=stand-in -c user.email=s@example.invalid commit -q --allow-empty -m "stand-in session" >/dev/null 2>&1 || true
    echo '{"type":"result","subtype":"success","is_error":false,"result":"done","total_cost_usd":0}'
    ;;
  limit)
    echo '{"type":"result","subtype":"error","is_error":true,"result":"You'"'"'ve hit your session limit · resets 3pm","total_cost_usd":0}'
    exit 1
    ;;
  hang)    sleep 300 ;;
  exit7)   echo '{"type":"result"}'; exit 7 ;;
  exit124) echo '{"type":"result"}'; exit 124 ;;
esac
`);
  fs.chmodSync(path.join(dir, 'claude'), 0o755);
  return { dir, sentinel, invocations: () => (fs.existsSync(sentinel) ? fs.readFileSync(sentinel, 'utf8').trim().split('\n').filter(Boolean) : []) };
}

// PATH is REPLACED, never prepended: prepending leaves the real binary reachable if the
// stand-in's directory is ever misspelled, and a test that silently falls through to the
// real CLI is a test that spends money.
const drive = (fake, args, { mode = 'ok', cwd = repo } = {}) => spawnSync('bash', [DRIVER, ...args], {
  encoding: 'utf8', cwd,
  env: { ...process.env, PATH: `${fake.dir}:/usr/bin:/bin`, FAKE_MODE: mode, CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'cli' },
});

const flags = (ws, prompt, { turns = '5', wall = '30' } = {}) => [
  '--run', 'cli-greenfield/rep-1/plain', '--workspace', ws, '--prompt-file', prompt,
  '--model', 'stand-in', '--max-turns', turns, '--wall-clock-minutes', wall, '--cohort', COHORT,
];

// A stand-in kit: a real tarball with the layout the installer expects, whose `init` does
// one observable thing. Enough to prove the install happened and was committed, without
// packing the actual product.
function fakeKit() {
  const dir = tempDir();
  const pkg = path.join(dir, 'package');
  fs.mkdirSync(path.join(pkg, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'stand-in-kit', version: '0.0.0-stand-in' }));
  fs.writeFileSync(path.join(pkg, 'bin', 'pincer.js'), "#!/usr/bin/env node\nrequire('node:fs').writeFileSync('KIT-INSTALLED', 'stand-in\\n');\n");
  const tgz = path.join(dir, 'kit.tgz');
  const packed = spawnSync('tar', ['-czf', tgz, '-C', dir, 'package']);
  assert.equal(packed.status, 0, 'the stand-in kit packed');
  return tgz;
}

function workspace() {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, 'PROMPT.txt'), 'do the thing');
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  spawnSync('git', ['config', 'user.email', 's@example.invalid'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 'stand-in'], { cwd: dir });
  return dir;
}

// --- the driver refuses before it spends ------------------------------------------------
{
  const fake = fakeCli();
  const ws = workspace();
  const prompt = path.join(ws, 'PROMPT.txt');

  const noOptIn = drive(fake, flags(ws, prompt));
  assert.equal(noOptIn.status, 3, 'without the spending-cap assertion it refuses');
  assert.match(noOptIn.stderr, /no spending cap has been asserted/);
  assert.equal(fake.invocations().length, 0, 'and it refuses before launching anything');

  for (const [bad, what] of [['0', 'zero'], ['abc', 'non-numeric'], ['', 'empty']]) {
    const r = drive(fake, [...flags(ws, prompt, { wall: bad }), '--i-have-a-spending-cap']);
    assert.ok(r.status === 4 || r.status === 2, `a ${what} wall-clock cap is refused, not treated as no cap`);
  }
  assert.equal(fake.invocations().length, 0, 'a bad cap never reaches a session');

  const badCohort = drive(fake, [...flags(ws, prompt).slice(0, -1), 'not-a-cohort', '--i-have-a-spending-cap']);
  assert.equal(badCohort.status, 4, 'a run must carry the cohort it belongs to');
}

// --- the session runs IN the workspace it was given --------------------------------------
{
  const fake = fakeCli();
  const ws = workspace();
  const elsewhere = tempDir();
  const prompt = path.join(ws, 'PROMPT.txt');

  // Driven from a DIFFERENT directory: before T-98 the session inherited this one while
  // the frozen configuration recorded `cwd_kind: scratch`.
  const r = drive(fake, [...flags(ws, prompt), '--i-have-a-spending-cap'], { cwd: elsewhere });
  assert.equal(r.status, 0, `the stand-in session completed: ${r.stderr}`);
  const seen = fake.invocations();
  assert.equal(seen.length, 1, 'the stand-in ran, so the real CLI was never reached');
  assert.equal(fs.realpathSync(seen[0]), fs.realpathSync(ws), 'the session ran in the workspace, not the caller directory');
  assert.notEqual(fs.realpathSync(seen[0]), fs.realpathSync(elsewhere));
}

// --- a session's own exit status survives, and is never confused with the cap -------------
{
  const fake = fakeCli();
  const ws = workspace();
  const prompt = path.join(ws, 'PROMPT.txt');

  const failed = drive(fake, [...flags(ws, prompt), '--i-have-a-spending-cap'], { mode: 'exit7' });
  assert.equal(failed.status, 7, 'a failing session reports its own status');
  assert.doesNotMatch(failed.stderr, orchestrator.CAP_MARKER, 'and is not labelled a cap');

  // A session that exits 124 on its own carries no marker, so the orchestrator refuses to
  // call it capped rather than guessing.
  const own124 = drive(fake, [...flags(ws, prompt), '--i-have-a-spending-cap'], { mode: 'exit124' });
  assert.equal(own124.status, 124);
  assert.equal(orchestrator.endOf(own124), 'ambiguous', 'exit 124 without the marker is ambiguous, not a cap');
}

// --- the wall clock actually ends a session ----------------------------------------------
// The cap is whole minutes, so this case takes about a minute. That is the price of
// proving the watchdog rather than asserting it: the defect T-98 fixes was a cap that was
// validated and never enforced, which reads identically in source to one that works.
{
  const fake = fakeCli();
  const ws = workspace();
  const prompt = path.join(ws, 'PROMPT.txt');
  const started = Date.now();
  const r = drive(fake, [...flags(ws, prompt, { wall: '1' }), '--i-have-a-spending-cap'], { mode: 'hang' });
  const elapsed = (Date.now() - started) / 1000;

  assert.equal(r.status, orchestrator.CAP_EXIT, 'a session that outruns the clock exits 124');
  assert.match(r.stderr, orchestrator.CAP_MARKER, 'and says so, so 124 is never ambiguous');
  assert.equal(orchestrator.endOf(r), 'capped');
  assert.ok(elapsed < 120, `the cap ended it near its deadline, not late (${elapsed.toFixed(1)}s)`);
  assert.ok(elapsed >= 55, `and not early (${elapsed.toFixed(1)}s)`);
}

// --- the orchestrator refuses the same decision, one level up -----------------------------
{
  const fake = fakeCli();
  const ws = workspace();
  const s = orchestrator.driveSession({
    run: 'cli-greenfield/rep-1/plain', workspace: ws, promptFile: path.join(ws, 'PROMPT.txt'),
    model: 'stand-in', maxTurns: 5, wallClockMinutes: 30, cohort: COHORT,
    logDir: path.join(ws, 'logs'), name: 'S1',
  });
  assert.equal(s.refused, true, 'the loop cannot slip past the cap decision the session enforces');
  assert.equal(s.status, 3);
  assert.equal(fake.invocations().length, 0);
}

// --- planning is the checkpoint, and it never overwrites ----------------------------------
{
  const runs = tempDir();
  const ids = ['cli-greenfield', 'bugfix-brownfield'];
  const first = orchestrator.plan(runs, { cohort: COHORT, ids });
  assert.equal(first.created.length, ids.length * schedule.ARMS.length * schedule.REPETITIONS);
  assert.equal(first.cells.length, first.created.length);

  // A terminal record survives replanning: this is what lets a study span reset windows.
  const done = first.cells[0];
  const record = orchestrator.readRecord(runs, done);
  record.status = 'valid';
  record.reason = 'already finished';
  orchestrator.writeRecord(runs, done, record);

  const second = orchestrator.plan(runs, { cohort: COHORT, ids });
  assert.deepEqual(second.created, [], 'replanning creates nothing that already exists');
  assert.equal(orchestrator.readRecord(runs, done).status, 'valid', 'and never resets a finished cell');
  assert.equal(orchestrator.readRecord(runs, done).reason, 'already finished');
}

// --- a rerun is numbered above the schedule and names what it replaces ---------------------
{
  const runs = tempDir();
  const ids = ['cli-greenfield'];
  orchestrator.plan(runs, { cohort: COHORT, ids });
  const cell = schedule.schedule(ids)[0];

  const good = orchestrator.readRecord(runs, cell);
  good.status = 'valid';
  orchestrator.writeRecord(runs, cell, good);
  assert.throws(() => orchestrator.claimRerun(runs, cell, { cohort: COHORT }), /not invalid/, 'only an invalid run is rerun');

  const spoiled = orchestrator.readRecord(runs, cell);
  spoiled.status = 'invalid';
  spoiled.reason = 'account limit during S1';
  orchestrator.writeRecord(runs, cell, spoiled);

  const rerun = orchestrator.claimRerun(runs, cell, { cohort: COHORT });
  assert.equal(rerun.cell.repetition, schedule.REPETITIONS + 1, 'the rerun takes the first number above the schedule');
  assert.match(rerun.record.reason, new RegExp(`replacing the invalid run ${spoiled.run.replace(/\//g, '\\/')}`));
  assert.ok(rerun.record.events.some(e => e.kind === 'intervention' && e.intervention === 'operator'));
  assert.equal(orchestrator.readRecord(runs, cell).status, 'invalid', 'the original stays on disk');
  assert.equal(orchestrator.readRecord(runs, cell).reason, 'account limit during S1', 'with its reason');

  // The slots are finite, and running out is reported rather than silently reusing one.
  let claimed = 1;
  while (orchestrator.claimRerun(runs, cell, { cohort: COHORT })) claimed += 1;
  assert.equal(claimed, schedule.MAX_REPETITION - schedule.REPETITIONS);
  assert.equal(orchestrator.nextRepetition(runs, cell.brief, cell.arm), null);
}

// --- an account limit stops the schedule instead of walking into it ------------------------
// Driven through the real loop and the real driver, with the stand-in reporting a limit.
// Monkey-patching the loop would prove only that the test can monkey-patch.
{
  const runs = tempDir();
  const ids = ['cli-greenfield', 'bugfix-brownfield'];
  orchestrator.plan(runs, { cohort: COHORT, ids });
  const cells = schedule.schedule(ids);
  const fake = fakeCli();
  const kit = fakeKit();

  // A kit arm with no kit is refused before the first session, not at the cell that needs
  // one: discovering it halfway through is discovering it after the paid runs behind it.
  await assert.rejects(
    orchestrator.driveSchedule(tempDir(), { cohort: COHORT, ids, spendingCap: true, model: 'stand-in' }),
    /no kit was given/,
  );

  const savedPath = process.env.PATH;
  const savedMode = process.env.FAKE_MODE;
  process.env.PATH = `${fake.dir}:/usr/bin:/bin`;
  process.env.FAKE_MODE = 'limit';
  let result;
  try {
    result = await orchestrator.driveSchedule(runs, { cohort: COHORT, ids, spendingCap: true, model: 'stand-in', maxTurns: 5, kit });
  } finally {
    process.env.PATH = savedPath;
    if (savedMode === undefined) delete process.env.FAKE_MODE; else process.env.FAKE_MODE = savedMode;
  }

  assert.ok(fake.invocations().length >= 1, 'the stand-in ran, so the real CLI was never reached');
  assert.equal(result.stopped, cells[0].run, 'the schedule stops at the run that hit the limit');
  assert.match(result.reason, /account limit/);
  assert.equal(result.driven.length, 1, 'and never touches the cells behind it');
  assert.equal(fake.invocations().length, 1, 'so the remaining cells are not converted into one-turn failures');

  const stopped = orchestrator.readRecord(runs, cells[0]);
  assert.equal(stopped.status, 'invalid');
  assert.match(stopped.reason, /account limit during S1/);
  assert.ok(stopped.events.some(e => e.kind === 'intervention' && /account limit/.test(e.detail)));
  assert.equal(orchestrator.readRecord(runs, cells[1]).status, 'pending', 'the next cell is untouched and resumable');

  // Resuming after the window reopens starts at the next uncompleted cell, never at cell 1.
  const before = fake.invocations().length;
  process.env.PATH = `${fake.dir}:/usr/bin:/bin`;
  process.env.FAKE_MODE = 'limit';
  let resumed;
  try {
    resumed = await orchestrator.driveSchedule(runs, { cohort: COHORT, ids, spendingCap: true, model: 'stand-in', maxTurns: 5, kit });
  } finally {
    process.env.PATH = savedPath;
    if (savedMode === undefined) delete process.env.FAKE_MODE; else process.env.FAKE_MODE = savedMode;
  }
  assert.equal(resumed.driven[0].skipped, true, 'the finished cell is skipped, not re-driven');
  assert.equal(resumed.stopped, cells[1].run, 'resume continues at the next uncompleted cell');
  assert.equal(fake.invocations().length, before + 1, 'and pays for exactly one new session');
}

// --- the kit is installed per arm ----------------------------------------------------------
{
  const ws = workspace();
  assert.equal(orchestrator.installKit(ws, 'plain', null), null, 'the plain arm installs nothing — that is the arm');
  assert.throws(() => orchestrator.installKit(ws, 'pincer', null), /needs a kit/, 'a kit arm without a kit is an error, not a silent plain run');
  assert.throws(() => orchestrator.installKit(ws, 'strict', path.join(ws, 'absent.tgz')), /no kit at/);

  const kit = fakeKit();
  const before = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ws, encoding: 'utf8' }).stdout.trim();
  const installed = orchestrator.installKit(ws, 'pincer', kit);
  assert.ok(fs.existsSync(path.join(ws, 'KIT-INSTALLED')), 'the kit actually ran its installer in the workspace');
  assert.equal(installed.digest, effort.sha256(fs.readFileSync(kit)), 'provenance names the kit by its own bytes');
  assert.equal(installed.version, '0.0.0-stand-in');
  assert.notEqual(installed.base, before, 'and the install is its own commit, so it is never the agent\'s work');
  assert.match(spawnSync('git', ['log', '-1', '--format=%s'], { cwd: ws, encoding: 'utf8' }).stdout, /Install PINCER kit/);
}

// --- the loop is offline by construction ----------------------------------------------------
{
  const source = fs.readFileSync(path.join(V7, 'orchestrator.cjs'), 'utf8');
  for (const forbidden of ['node:http', 'node:https', 'node:net', 'fetch(']) {
    assert.ok(!source.includes(forbidden), `the orchestrator does not use ${forbidden}`);
  }
  // It reaches a model only by executing the one file that spends, so the refusal cannot
  // be bypassed by calling the loop instead of the session.
  assert.ok(source.includes('live-driver.sh'), 'the orchestrator drives sessions through the frozen driver');
  assert.ok(!/\bclaude -p\b/.test(source), 'and never invokes the CLI itself');

  // The orchestrator is a frozen input: editing it must move the cohort.
  const { REPO, SPEC } = require(path.join(V7, 'freeze-spec.cjs'));
  assert.ok(SPEC.harness.includes('scripts/delivery-benchmark-v7/orchestrator.cjs'), 'the orchestrator is named in the freeze');
  assert.equal(REPO, repo);
}

console.log('benchmark orchestrator tests passed');
