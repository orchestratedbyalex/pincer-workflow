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
const runtime = require(path.join(V7, 'orchestrator.cjs'));
// Explicit fixture seam: all programmatic sessions terminate in this callback. It
// executes only a verified synthetic script and never falls back to the live driver.
function fixtureSession(options) {
  const executable = path.join(process.env.PATH.split(path.delimiter)[0], 'claude');
  assert.match(fs.readFileSync(executable, 'utf8'), /PINCER_SYNTHETIC_CLI/);
  const started = new Date().toISOString();
  const r = spawnSync('bash', [executable, fs.readFileSync(options.promptFile, 'utf8')], {
    cwd: options.workspace, encoding: 'utf8', env: { ...process.env, CLAUDECODE: '', CLAUDE_CODE_ENTRYPOINT: '' },
  });
  const ended = new Date().toISOString();
  fs.mkdirSync(options.logDir, { recursive: true });
  fs.writeFileSync(path.join(options.logDir, `${options.name}.json`), r.stdout || '');
  fs.writeFileSync(path.join(options.logDir, `${options.name}.err`), r.stderr || '');
  return { ...r, started, ended, refused: false, end: runtime.endOf(r), limit: runtime.limitHit(r.stdout) || runtime.limitHit(r.stderr) };
}
const orchestrator = {
  ...runtime,
  driveRun: (runs, cell, opts) => runtime.driveRun(runs, cell, { ...opts, fixtureSession }),
  driveSchedule: (runs, opts) => runtime.driveSchedule(runs, { ...opts, fixtureSession }),
};
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
  const prompts = path.join(dir, 'prompts.log');
  fs.writeFileSync(path.join(dir, 'claude'), `#!/usr/bin/env bash
set -u
# PINCER_SYNTHETIC_CLI
echo "$PWD" >> ${JSON.stringify(sentinel)}
# The prompt is the last positional argument. Recorded verbatim so a case can prove what
# the agent was actually told, rather than inspecting the script that composes it.
{ printf '%s' "\${@: -1}"; printf '\\n<<<END-OF-PROMPT>>>\\n'; } >> ${JSON.stringify(prompts)}
if [ -n "\${CLAUDECODE:-}" ] || [ -n "\${CLAUDE_CODE_ENTRYPOINT:-}" ]; then
  echo "stand-in: the session is not fresh; CLAUDECODE/CLAUDE_CODE_ENTRYPOINT survived" >&2
  exit 90
fi
case "\${FAKE_MODE:-ok}" in
  ok)
    git add -A >/dev/null 2>&1 || true
    git -c user.name=stand-in -c user.email=s@example.invalid commit -q --allow-empty -m "stand-in session" >/dev/null 2>&1 || true
    echo '{"type":"result","subtype":"success","is_error":false,"result":"done","total_cost_usd":1.25,"duration_api_ms":120000,"modelUsage":{"test-model":{"inputTokens":1000,"outputTokens":500,"cacheReadInputTokens":250,"cacheCreationInputTokens":0}}}'
    ;;
  bare)
    git -c user.name=stand-in -c user.email=s@example.invalid commit -q --allow-empty -m "stand-in session" >/dev/null 2>&1 || true
    echo '{"type":"result","subtype":"success","is_error":false,"result":"done"}'
    ;;
  tidy)
    git -c user.name=stand-in -c user.email=s@example.invalid commit -q --allow-empty -m "stand-in session" >/dev/null 2>&1 || true
    echo '{"type":"result","subtype":"success","is_error":false,"result":"done","total_cost_usd":1.25,"duration_api_ms":120000,"modelUsage":{"test-model":{"inputTokens":1000,"outputTokens":500,"cacheReadInputTokens":250,"cacheCreationInputTokens":0}}}'
    ;;
  adopt)
    mkdir -p .prd/evidence/changes
    cat > .prd/evidence/changes/C-01.json <<'JSON'
{"schema":3,"coverage":{"map":".prd/coverage/C-01.json","adopted":"2026-09-15T00:00:00Z","agreement":"G-01"},"events":[{"sequence":1,"kind":"adopt"}]}
JSON
    git add .prd >/dev/null 2>&1 || true
    git -c user.name=stand-in -c user.email=s@example.invalid commit -q --allow-empty -m "stand-in session" >/dev/null 2>&1 || true
    echo '{"type":"result","subtype":"success","is_error":false,"result":"done","total_cost_usd":1.25,"duration_api_ms":120000,"modelUsage":{"test-model":{"inputTokens":1000,"outputTokens":500,"cacheReadInputTokens":0,"cacheCreationInputTokens":0}}}'
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
  return {
    dir, sentinel,
    invocations: () => (fs.existsSync(sentinel) ? fs.readFileSync(sentinel, 'utf8').trim().split('\n').filter(Boolean) : []),
    prompts: () => (fs.existsSync(prompts) ? fs.readFileSync(prompts, 'utf8').split('\n<<<END-OF-PROMPT>>>\n').filter(Boolean) : []),
  };
}

// The seven digests a `valid` record's provenance must carry. The orchestrator fills
// `base` and `kit` itself; the rest come from the freeze, and a test that omitted them
// would be asserting against a record no study could ever produce.
const PROVENANCE = {
  prompts: 'b'.repeat(64), driver: 'c'.repeat(64), collector: 'd'.repeat(64),
  evaluator: 'e'.repeat(64), protocol: 'f'.repeat(64), caps: '1'.repeat(64), configuration: '2'.repeat(64),
};

// Drive real cells through the real loop with the stand-in on PATH. PATH is replaced, not
// prepended, for the same reason as everywhere else in this file.
async function withStandIn(fake, mode, run) {
  const savedPath = process.env.PATH;
  const savedMode = process.env.FAKE_MODE;
  process.env.PATH = `${fake.dir}:/usr/bin:/bin`;
  process.env.FAKE_MODE = mode;
  try { return await run(); } finally {
    process.env.PATH = savedPath;
    if (savedMode === undefined) delete process.env.FAKE_MODE; else process.env.FAKE_MODE = savedMode;
  }
}

const briefs = require(path.join(V7, 'briefs.cjs'));
const TASK = briefs.loadBrief('cli-greenfield').prompts[0].prompt;

const cellFor = (ids, brief, arm, repetition = 1) =>
  schedule.schedule(ids).find(c => c.brief === brief && c.arm === arm && c.repetition === repetition);

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

// --- the historical direct shell route is closed ----------------------------------------
// T-102's new isolation suite observes subprocess cwd, environment and watchdog
// behavior. Legacy argv must not remain a second route to an inherited-config CLI.
{
  const fake = fakeCli(), ws = workspace(), prompt = path.join(ws, 'PROMPT.txt');
  for (const args of [flags(ws, prompt), [...flags(ws, prompt), '--i-have-a-spending-cap']]) {
    const result = drive(fake, args);
    assert.equal(result.status, 3);
    assert.match(result.stderr, /historical direct launch route is disabled/);
  }
  assert.equal(fake.invocations().length, 0);
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
  // The replaced run is named in the operator event and NOT on `record.reason`: a fresh
  // rerun is `pending`, and the validator allows a reason only on a run that admits
  // something went wrong. Setting it there made every rerun invalid the moment it existed.
  assert.equal(rerun.record.reason, null, 'a pending rerun carries no reason');
  const claim = rerun.record.events.find(e => e.kind === 'intervention' && e.intervention === 'operator');
  assert.ok(claim, 'the rerun is claimed by an operator event');
  assert.match(claim.detail, new RegExp(`replacing the invalid run ${spoiled.run.replace(/\//g, '\\/')}`));
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

// --- the three arms are three arms ----------------------------------------------------------
// The edition shipped with `loadBrief` taking no arm, so every arm received a byte-identical
// prompt in a byte-identical tree: `strict` was not an arm, and a third of the schedule
// bought a duplicate of another one. Proven from the prompt the stand-in was HANDED, not
// from the code that composes it.
{
  const ids = ['cli-greenfield'];
  const runs = tempDir();
  const kit = fakeKit();
  const fake = fakeCli();
  orchestrator.plan(runs, { cohort: COHORT, ids, provenance: PROVENANCE });
  const opts = { cohort: COHORT, ids, spendingCap: true, model: 'stand-in', maxTurns: 5, kit };
  await withStandIn(fake, 'tidy', async () => {
    for (const arm of ['plain', 'pincer', 'strict']) {
      await orchestrator.driveRun(runs, cellFor(ids, 'cli-greenfield', arm), opts);
    }
  });

  const given = fake.prompts();
  assert.equal(given.length, 3, 'one session per arm');
  assert.equal(new Set(given).size, 3, 'the three arms are told three different things');
  for (const prompt of given) assert.ok(prompt.includes(TASK), 'and every arm receives the identical task');
  assert.ok(!given[0].includes('PINCER'), 'the plain arm is told nothing about a kit it does not have');
  assert.ok(given[1].includes('PINCER') && !given[1].includes('coverage adopt'), 'the default arm is told to use the kit and not to adopt');
  assert.ok(given[2].includes('coverage adopt'), 'the strict arm is told to adopt strict coverage');
}

// --- a completed run produces a record its own validator accepts -----------------------------
// This is the assertion whose absence let the edition ship: the suite proved orchestration
// behaviour and the validator proved its opinions on hand-built records, and the two never
// met. Every record the orchestrator produced failed `effort.problems()`.
{
  const ids = ['cli-greenfield'];
  const kit = fakeKit();

  for (const [arm, mode] of [['plain', 'tidy'], ['strict', 'adopt']]) {
    const runs = tempDir();
    const fake = fakeCli();
    orchestrator.plan(runs, { cohort: COHORT, ids, provenance: PROVENANCE });
    const cell = cellFor(ids, 'cli-greenfield', arm);
    const out = await withStandIn(fake, mode, () => orchestrator.driveRun(runs, cell, {
      cohort: COHORT, ids, spendingCap: true, model: 'stand-in', maxTurns: 5, kit,
    }));
    const record = orchestrator.readRecord(runs, cell);
    assert.deepEqual(effort.problems(record), [], `the ${arm} arm's record validates`);
    assert.deepEqual(out.problems, [], 'and driveRun says so');
    assert.equal(record.status, 'valid', 'a rejected candidate is still a valid measurement');
    assert.ok(record.evaluation && record.evaluation.checks.length, 'and the evaluation is on the record either way');

    // The provider's own figures, from the payload the driver saved.
    assert.equal(record.reported.cost_usd, 1.25, 'the cost is the one the session reported');
    assert.equal(record.reported.tokens, mode === 'adopt' ? 1500 : 1750, 'tokens are summed across the payload');
    assert.equal(record.reported.provider_minutes, 2, '120000ms is two minutes, not 120000');
    assert.deepEqual(record.unavailable, {}, 'nothing is unavailable when everything was reported');

    if (arm === 'strict') {
      assert.equal(record.adoption.observed, true, 'adoption is observed from the workspace');
      assert.match(record.adoption.evidence, /schema 3.*adopt event/, 'and names the record it read');
    } else {
      assert.equal(record.adoption.observed, false, 'a default arm is looked at and found not to have adopted');
    }
  }

  // A strict run that did not adopt is a protocol failure, not a strict result.
  {
    const runs = tempDir();
    const fake = fakeCli();
    orchestrator.plan(runs, { cohort: COHORT, ids, provenance: PROVENANCE });
    const cell = cellFor(ids, 'cli-greenfield', 'strict');
    await withStandIn(fake, 'tidy', () => orchestrator.driveRun(runs, cell, {
      cohort: COHORT, ids, spendingCap: true, model: 'stand-in', maxTurns: 5, kit,
    }));
    const record = orchestrator.readRecord(runs, cell);
    assert.equal(record.status, 'invalid');
    assert.match(record.reason, /did not adopt strict coverage/);
    assert.deepEqual(effort.problems(record), [], 'and the protocol failure is itself a valid record');
  }

  // A metric no payload carried is null WITH its reason, never a fabricated zero.
  {
    const runs = tempDir();
    const fake = fakeCli();
    orchestrator.plan(runs, { cohort: COHORT, ids, provenance: PROVENANCE });
    const cell = cellFor(ids, 'cli-greenfield', 'plain');
    await withStandIn(fake, 'bare', () => orchestrator.driveRun(runs, cell, {
      cohort: COHORT, ids, spendingCap: true, model: 'stand-in', maxTurns: 5, kit,
    }));
    const record = orchestrator.readRecord(runs, cell);
    for (const key of ['tokens', 'cost_usd', 'provider_minutes']) {
      assert.equal(record.reported[key], null, `${key} is null, not zero`);
      assert.ok(record.unavailable[key], `and ${key} says why`);
    }
    assert.deepEqual(effort.problems(record), [], 'a record that measured nothing is still reportable, with its reasons');
  }
}

// --- a rerun record is valid the moment it exists --------------------------------------------
{
  const runs = tempDir();
  const ids = ['cli-greenfield'];
  orchestrator.plan(runs, { cohort: COHORT, ids, provenance: PROVENANCE });
  const cell = cellFor(ids, 'cli-greenfield', 'plain');
  const original = orchestrator.readRecord(runs, cell);
  original.status = 'invalid';
  original.reason = 'account limit during S1';
  orchestrator.writeRecord(runs, cell, original);

  const claimed = orchestrator.claimRerun(runs, cell, { cohort: COHORT, provenance: PROVENANCE });
  assert.equal(claimed.record.repetition, orchestrator.RERUN_FIRST, 'a rerun is numbered above the schedule');
  assert.equal(claimed.record.reason, null, 'a pending rerun carries no reason: the validator refuses one');
  assert.deepEqual(effort.problems(claimed.record), [], 'so the replacement is valid the moment it is created');
  const event = claimed.record.events.find(e => e.kind === 'intervention');
  assert.match(event.detail, new RegExp(`replacing the invalid run ${original.run}`), 'and the replaced run is still named');
  assert.equal(orchestrator.readRecord(runs, cell).reason, 'account limit during S1', 'the original keeps its own reason');
}

// --- the harness preserves what it asks the agent to preserve ---------------------------------
// `harness.prepare` used to inject the unrelated edits BEFORE the kit install, whose final
// act is `git add -A`. The harness therefore committed the very work the brief tells the
// agent to leave alone, on kit arms only — and nothing noticed, because the check read its
// edits from a record key that did not exist.
{
  const ids = ['brownfield-maintenance'];
  const kit = fakeKit();
  for (const arm of ['plain', 'pincer', 'strict']) {
    const runs = tempDir();
    const fake = fakeCli();
    orchestrator.plan(runs, { cohort: COHORT, ids, provenance: PROVENANCE });
    const cell = cellFor(ids, 'brownfield-maintenance', arm);
    await withStandIn(fake, arm === 'strict' ? 'adopt' : 'tidy', () => orchestrator.driveRun(runs, cell, {
      cohort: COHORT, ids, spendingCap: true, model: 'stand-in', maxTurns: 5, kit,
    }));
    const record = orchestrator.readRecord(runs, cell);
    const ws = path.join(orchestrator.runDir(runs, cell), record.attempts.at(-1).directory, 'workspace');

    assert.deepEqual(
      Object.keys(record.workspace.unrelated_edits).sort(), ['README.md', 'operator-notes.md'],
      `the ${arm} arm records what was injected, so the check has something to compare`,
    );
    const tracked = spawnSync('git', ['ls-files', '--error-unmatch', 'operator-notes.md'], { cwd: ws, encoding: 'utf8' });
    assert.notEqual(tracked.status, 0, `the ${arm} arm leaves the untracked file untracked`);
    const head = spawnSync('git', ['show', 'HEAD:README.md'], { cwd: ws, encoding: 'utf8' });
    assert.ok(!head.stdout.includes('do not commit'), `the ${arm} arm does not commit the unrelated edit`);

    const check = record.evaluation.checks.find(c => c.id === 'unrelated-edits');
    assert.ok(check, 'the preservation check ran');
    assert.equal(check.result, 'passed', `and passes on ${arm} because the edits really are intact`);
    assert.match(check.detail, /2 unrelated edit\(s\) intact/, 'over two real edits, not a vacuous zero');
  }

  // And the check is alive: an agent that sweeps the tree with `git add -A` fails it. A
  // passing preservation column over zero edits, which is what the edition would have
  // reported for all 72 runs, proves nothing at all.
  {
    const runs = tempDir();
    const fake = fakeCli();
    orchestrator.plan(runs, { cohort: COHORT, ids, provenance: PROVENANCE });
    const cell = cellFor(ids, 'brownfield-maintenance', 'pincer');
    await withStandIn(fake, 'ok', () => orchestrator.driveRun(runs, cell, {
      cohort: COHORT, ids, spendingCap: true, model: 'stand-in', maxTurns: 5, kit,
    }));
    const record = orchestrator.readRecord(runs, cell);
    const check = record.evaluation.checks.find(c => c.id === 'unrelated-edits');
    assert.equal(check.result, 'failed', 'a sweeping agent fails preservation');
    assert.match(check.detail, /operator-notes\.md: the untracked file was committed/);
    assert.match(check.detail, /README\.md: the unrelated edit was committed/);
    assert.equal(record.status, 'valid', 'and that is a rejected candidate, not an invalid experiment');
  }
}

// --- an interrupted cell is re-driven clean, not resumed into --------------------------------
// A killed cell used to leave `pending` with no events, and the restart did not wipe: the
// dead attempt's commits were swept into the restarted run's recorded base by `git add -A`,
// producing a record that looks clean and that nothing can detect.
{
  const ids = ['cli-greenfield'];
  const runs = tempDir();
  const kit = fakeKit();
  const fake = fakeCli();
  orchestrator.plan(runs, { cohort: COHORT, ids, provenance: PROVENANCE });
  const cell = cellFor(ids, 'cli-greenfield', 'plain');
  const home = orchestrator.runDir(runs, cell);
  const ws = path.join(home, 'workspace');

  // Stage an interrupted attempt by hand: a workspace with a commit in it and a log, and a
  // record still reading pending — exactly the state a kill leaves behind.
  fs.mkdirSync(ws, { recursive: true });
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: ws });
  spawnSync('git', ['config', 'user.email', 's@example.invalid'], { cwd: ws });
  spawnSync('git', ['config', 'user.name', 'stand-in'], { cwd: ws });
  fs.writeFileSync(path.join(ws, 'DEAD-ATTEMPT'), 'work from the killed run\n');
  spawnSync('git', ['add', '-A'], { cwd: ws });
  spawnSync('git', ['commit', '-q', '-m', 'dead attempt'], { cwd: ws });
  const dead = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ws, encoding: 'utf8' }).stdout.trim();
  fs.mkdirSync(path.join(home, 'logs'), { recursive: true });
  fs.writeFileSync(path.join(home, 'logs', 'S1.json'), '{"result":"the killed session"}');

  await withStandIn(fake, 'tidy', () => orchestrator.driveRun(runs, cell, {
    cohort: COHORT, ids, spendingCap: true, model: 'stand-in', maxTurns: 5, kit,
    resumeInterrupted: { attempt: 'legacy', reason: 'Explicitly restart the retained historical interrupted fixture' },
  }));
  const record = orchestrator.readRecord(runs, cell);

  const fresh = path.join(home, record.attempts.at(-1).directory, 'workspace');
  assert.ok(fs.existsSync(path.join(ws, 'DEAD-ATTEMPT')), 'the historical workspace is preserved');
  assert.ok(!fs.existsSync(path.join(fresh, 'DEAD-ATTEMPT')), 'the new workspace excludes dead work');
  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', dead, 'HEAD'], { cwd: fresh });
  assert.notEqual(ancestor.status, 0, 'and its commit is not in the restarted run at all');
  assert.equal(
    fs.readFileSync(path.join(home, 'logs', 'S1.json'), 'utf8'), '{"result":"the killed session"}',
    'the killed session\'s log is retained rather than overwritten',
  );
  const event = record.events.find(e => e.kind === 'intervention' && /Explicit resume after legacy-000001/.test(e.detail));
  assert.ok(event, 'and the discarded attempt is named on the record, so the repetition is visible');
  assert.deepEqual(effort.problems(record), [], 'the re-driven record is reportable');
}

// --- nothing is prepared and nothing is spent until the inputs agree --------------------------
// Each of these used to be discovered after the workspace was built, or not at all: the
// driver validated a cohort's SHAPE and never its correspondence to what it was executing.
{
  const ids = ['cli-greenfield'];
  const kit = fakeKit();
  const base = { ids, spendingCap: true, model: 'stand-in', maxTurns: 5, wallClockMinutes: 30, kit };

  const cases = [
    ['a different cohort', { cohort: 'b'.repeat(64) }, /not the cohort this cell was planned under/],
    ['a moved execution path', { cohort: COHORT, frozen: { cohort: 'c'.repeat(64) } }, /the execution path has changed/],
    ['a different model', { cohort: COHORT, model: 'other' }, /planned for model stand-in/],
    ['a different turn cap', { cohort: COHORT, maxTurns: 400 }, /planned for 5 turns per session/],
    ['a different wall clock', { cohort: COHORT, wallClockMinutes: 5 }, /planned for a 30-minute wall clock/],
    ['no spending cap', { cohort: COHORT, spendingCap: false }, /no spending cap has been asserted/],
  ];
  for (const [what, override, expected] of cases) {
    const runs = tempDir();
    const fake = fakeCli();
    orchestrator.plan(runs, {
      cohort: COHORT, ids, provenance: PROVENANCE,
      environment: { model: 'stand-in', caps: { turns_per_session: 5, wall_clock_minutes: 30 } },
    });
    const cell = cellFor(ids, 'cli-greenfield', 'plain');
    const out = await withStandIn(fake, 'tidy', () => orchestrator.driveRun(runs, cell, { ...base, ...override }));

    assert.equal(out.refused, true, `${what} is refused`);
    assert.match(out.detail, expected, `${what} says which input disagreed`);
    assert.equal(fake.invocations().length, 0, `${what} never reaches a session`);
    assert.ok(!fs.existsSync(path.join(orchestrator.runDir(runs, cell), 'workspace')), `${what} never touches the workspace`);

    // And the cell is still drivable. A refusal that marked it terminal would strand it:
    // `driveRun` skips any non-pending cell forever and `claimRerun` replaces only invalid
    // runs, so one dry run would cost a cell of the study permanently.
    const record = orchestrator.readRecord(runs, cell);
    assert.equal(record.status, 'pending', `${what} leaves the cell as it found it`);
    assert.equal(record.reason, null);
    const after = await withStandIn(fake, 'tidy', () => orchestrator.driveRun(runs, cell, { ...base, cohort: COHORT }));
    assert.equal(after.record.status, 'valid', `and the cell still runs afterwards (${what})`);
  }
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

  // It has an operator entry point. Without one the schedule is only reachable by writing
  // the unfrozen caller this file exists to make unnecessary, and the cohort would then
  // describe a configuration that some other script decided.
  assert.ok(source.includes('require.main === module'), 'the orchestrator is runnable');
  const help = spawnSync(process.execPath, [path.join(V7, 'orchestrator.cjs'), '--help'], { encoding: 'utf8' });
  assert.match(help.stdout, /--runs <dir>/, 'and documents how to run it');
  assert.match(help.stdout, /--browser <module>/, 'including how to supply a browser adapter');
  assert.match(help.stdout, /unavailable/, 'and what happens to UI checks without one');
  assert.match(help.stdout, /--i-have-a-spending-cap/, 'and that spending is an assertion a human makes');
  assert.equal(spawnSync(process.execPath, [path.join(V7, 'orchestrator.cjs')], { encoding: 'utf8' }).status, 2, 'and refuses with no --runs');
}

console.log('benchmark orchestrator tests passed');
