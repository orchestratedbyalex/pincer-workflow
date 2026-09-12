// Validates the PRD v6 live trial record (docs/trial-prd-v6.md) and the benchmark
// artifacts under docs/prd-v6-artifacts/benchmark/ for completeness and resolvability:
// every one of the 36 scheduled runs has a sanitized record that validates under the
// frozen evaluator, the report is recomputable from those records, every pincer run
// installed the kit the record names, the Results table dispositions every required
// scenario and names its runs, the interventions and unavailable values are listed with
// their denominators, and the S-27 transcript review counts match the extracted command
// logs. It checks evidence completeness, not whether an agent genuinely complied — that
// is read from the referenced outputs and transcripts by a reviewer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8');
const lib = require(path.join(repo, 'scripts/delivery-benchmark/lib.cjs'));
const record = require(path.join(repo, 'scripts/delivery-benchmark/record.cjs'));
const report = require(path.join(repo, 'scripts/delivery-benchmark/report.cjs'));
const frozen = JSON.parse(read('test/fixtures/delivery-benchmark/frozen.json'));
const doc = read('docs/trial-prd-v6.md');
const ART = 'docs/prd-v6-artifacts/benchmark';
const runsRoot = path.join(repo, ART, 'runs');

function section(title) {
  const start = doc.indexOf(`\n## ${title}\n`);
  assert.ok(start >= 0, `section "${title}" present`);
  const rest = doc.slice(start + 1);
  const end = rest.indexOf('\n## ', 1);
  return end < 0 ? rest : rest.slice(0, end);
}
const tableRows = (text, columns) => text.split('\n').filter(l => l.startsWith('| ')).map(l => l.split('|').slice(1, -1).map(c => c.trim())).filter(cells => cells.length === columns && !/^-+$/.test(cells[0]) && cells[0] !== '');

// --- Header: kit, versions, protocol freeze, attribution -----------------------------------
const kitDigest = /Kit: `npm pack` of `feat\/prd-v6` at `([0-9a-f]{7,40})`[^`]*`([0-9a-f]{64})`/.exec(doc);
assert.ok(kitDigest, 'the kit tarball provenance (commit and sha256) is recorded');
assert.match(doc, /Versions: Claude Code [\d.]+ · model `\w+` · Node v[\d.]+ · macOS [\d.]+/, 'tool and model versions');
assert.match(doc, new RegExp(`Protocol: frozen ${frozen.frozen.slice(0, 10)}`), 'the protocol freeze date matches frozen.json');
assert.match(doc, /Caps: 150 turns and 30 minutes per session/, 'the caps are stated');
assert.match(doc, /Attribution:/); assert.match(doc, /Prompts:/); assert.match(doc, /Deviations:/);

// --- Every scheduled run has a valid sanitized record judged by the frozen evaluator ---
const schedule = lib.schedule();
const records = new Map();
const replaces = new Map();
const files = lib.walk(runsRoot).filter(rel => rel.endsWith('/record.json'));
for (const slot of schedule) assert.ok(files.includes(`${slot.run}/record.json`), `record for scheduled run ${slot.run}`);
for (const rel of files) {
  const file = path.join(runsRoot, rel);
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(record.problems(r, { frozen }), [], `${rel} validates`);
  const slot = schedule.find(x => x.run === r.run);
  assert.equal(r.order, slot ? slot.order : null, `${r.run}: order`);
  if (!slot) {
    const note = r.interventions.find(i => /replacing the invalid run /.test(i.note || ''));
    assert.ok(note, `${r.run}: a rerun records which invalid run it replaces`);
    const replaced = /replacing the invalid run (\S+)/.exec(note.note)[1];
    assert.ok(files.includes(`${replaced}/record.json`), `${r.run}: replaces a recorded run`);
    replaces.set(r.run, replaced);
  }
  records.set(r.run, r);
  const dir = path.dirname(file);
  // An evaluated run keeps its evaluator log; a run abandoned before evaluation (the
  // limit-destroyed ones) keeps its record and its reason, and is replaced by a rerun.
  if (r.evaluation) assert.ok(fs.existsSync(path.join(dir, 'evaluation.log')), `${r.run}: evaluation log`);
  for (const s of r.sessions) {
    assert.ok(fs.existsSync(path.join(dir, 'logs', `${s.name}.prompt.txt`)), `${r.run}: logs/${s.name}.prompt.txt`);
    assert.equal(fs.readFileSync(path.join(dir, 'logs', `${s.name}.prompt.txt`), 'utf8'), s.prompt, `${r.run} ${s.name}: the prompt file is the recorded prompt`);
    if (r.status !== 'valid') continue;
    for (const f of [`${s.name}.json`, `${s.name}.git-log.txt`, `${s.name}.git-status.txt`, `${s.name}.commands.txt`]) assert.ok(fs.existsSync(path.join(dir, 'logs', f)), `${r.run}: logs/${f}`);
    const out = JSON.parse(fs.readFileSync(path.join(dir, 'logs', `${s.name}.json`), 'utf8'));
    assert.match(out.session_id || '', /^[0-9a-f-]{36}$/, `${r.run} ${s.name}: session id`);
  }
  if (r.arm === 'pincer') assert.equal(r.environment.kit.digest, kitDigest[2], `${r.run}: the kit is the tarball named in the record`);
  else assert.equal(r.environment.kit, null);
  assert.equal(r.environment.caps.turns_per_session, 150); assert.equal(r.environment.caps.wall_clock_minutes, 30);
  assert.equal(r.environment.model, 'sonnet'); assert.equal(r.environment.tool, 'claude-code');
  if (r.status === 'invalid') assert.ok(r.reason && r.reason.length > 20, `${r.run}: an invalid run says why`);
}
// Every invalid run is either replaced by a rerun or named in the trial record.
for (const r of records.values()) {
  if (r.status !== 'invalid') continue;
  if ([...replaces.values()].includes(r.run)) continue;
  assert.ok(doc.includes(r.run), `${r.run} is invalid with no rerun, so the trial record names it`);
}
const same = new Set([...records.values()].map(r => `${r.environment.tool_version}|${r.environment.node}|${r.environment.os}`));
assert.equal(same.size, 1, 'one tool, node and OS version for every run');
for (const rel of lib.walk(path.join(repo, ART))) {
  const text = fs.readFileSync(path.join(repo, ART, rel), 'utf8');
  assert.doesNotMatch(text, /\/private\/tmp\/claude-501|\/Users\/[a-z]+\//, `${rel}: sanitized`);
}

// --- The report is recomputable from the sanitized records ---------------------------------
const rep = report.compute(runsRoot, { frozen });
const saved = JSON.parse(read(`${ART}/report.json`));
assert.deepEqual(rep.total, saved.total, 'report totals match the records');
for (const id of lib.briefIds()) for (const arm of lib.ARMS) assert.deepEqual(rep.briefs[id][arm].acceptance, saved.briefs[id][arm].acceptance, `${id}/${arm} acceptance`);
assert.equal(rep.malformed.length, 0);
assert.match(read(`${ART}/report.md`), /no parity or superiority claim/);

// --- Results: required scenarios and their dispositions -------------------------------------
const results = tableRows(section('Results'), 4);
assert.deepEqual(results[0], ['Scenario', 'Runs', 'Disposition', 'Observed']);
const rows = results.slice(1);
const DISPOSITIONS = /^(observed|failed|outstanding)(\s*→\s*observed on the re-run)?$/;
for (const row of rows) assert.match(row[2], DISPOSITIONS, `disposition of "${row[0].slice(0, 40)}": ${row[2]}`);
for (const [name, re] of [['S-27', /^S-27/], ['S-29', /^S-29/], ['S-30', /^S-30/]]) {
  const row = rows.find(r => re.test(r[0]));
  assert.ok(row, `${name} has a row`);
  assert.ok(row[3].length > 200, `${name}: substantive observation`);
  if (row[2].startsWith('failed')) { assert.match(row[2], /observed on the re-run$/); assert.match(row[3], /Fixed in T-\d\d/); }
  const complete = rep.total.outstanding === 0 && rep.total.valid === 36;
  if (complete) assert.ok(!row[2].startsWith('outstanding'), `${name} is not outstanding when every run is valid`);
  else assert.match(doc, /outstanding/, 'incomplete runs are declared outstanding');
}

// --- Per-run table matches the records --------------------------------------------------------
const perRun = tableRows(section('Runs'), 8).slice(1);
assert.equal(perRun.length, records.size, 'one row per recorded run, reruns included');
for (const [order, run, status, outcome, cost, active, turns, interventions] of perRun) {
  const r = records.get(run); assert.ok(r, `run row ${run}`);
  assert.equal(order, r.order === null ? 'rerun' : String(r.order), `${run}: order column`);
  assert.equal(status, r.status, `${run}: status column`);
  assert.equal(outcome, r.evaluation ? r.evaluation.outcome : '—', `${run}: outcome column`);
  if (r.effort.cost_usd !== null) assert.equal(Number(cost), Number(r.effort.cost_usd.toFixed(2)), `${run}: cost column`); else assert.equal(cost, 'n/a');
  if (r.effort.active_minutes !== null) assert.equal(Number(active), Number(r.effort.active_minutes.toFixed(1)), `${run}: active minutes`); else assert.equal(active, 'n/a');
  assert.equal(Number(interventions), r.interventions.filter(i => i.type !== 'operator').length, `${run}: intervention count`);
  assert.ok(Number.isInteger(Number(turns)), `${run}: turns`);
}

// --- S-27 transcript review: the counts in the doc match the extracted command logs ------------
const scope = section('Changed-scope review (S-27)');
for (const [run, r] of [...records].filter(([id]) => id.startsWith('scope-revision/'))) {
  if (r.status !== 'valid') continue;
  const s2 = path.join(runsRoot, ...run.split('/'), 'logs', 'S2.commands.txt');
  assert.ok(fs.existsSync(s2), `${run}: S2 commands extracted for the changed-scope review`);
  const commands = fs.readFileSync(s2, 'utf8');
  const authorized = (commands.match(/change authorize/g) || []).length;
  const row = tableRows(scope, 5).find(cells => cells[0] === run);
  assert.ok(row, `S-27 row for ${run}`);
  assert.equal(Number(row[1]), authorized, `${run}: change authorize count in S2`);
  const check = r.evaluation && r.evaluation.checks.find(c => c.id === 'scope-approval');
  assert.equal(row[2], check ? check.result : '—', `${run}: scope-approval result`);
}

// --- Counts and limitations ------------------------------------------------------------------------
const counts = section('Counts');
assert.match(counts, /accepted \d+\/\d+/);
assert.match(section('Limitations'), /print mode|non-interactive/i);
assert.match(section('Limitations'), /n=3|three pairs/i);
console.log(`coverage trial record tests passed (${schedule.length} runs, ${rows.length} scenario rows, ${perRun.length} run rows)`);
