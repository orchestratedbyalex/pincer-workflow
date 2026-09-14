// Validates the PRD v5 live trial record (docs/trial-prd-v5.md) for completeness and
// resolvability: every required scenario has a non-outstanding disposition, every
// session named in the Results table has its artifacts under docs/prd-v5-artifacts/,
// the kit digests, versions and baseline counts are present, every `failed` row names a
// fix ticket that exists, and the artifacts are sanitized. It checks evidence
// completeness, not whether an agent genuinely complied — that is read from the
// referenced outputs and transcripts by a reviewer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8');
const record = read('docs/trial-prd-v5.md');
const artifacts = 'docs/prd-v5-artifacts/trial-logs';

function section(title) {
  const start = record.indexOf(`\n## ${title}\n`);
  assert.ok(start >= 0, `section "${title}" present`);
  const rest = record.slice(start + 1);
  const end = rest.indexOf('\n## ', 1);
  return end < 0 ? rest : rest.slice(0, end);
}
function tableRows(text, columns) {
  return text.split('\n').filter(l => l.startsWith('| ')).map(l => l.split('|').slice(1, -1).map(c => c.trim()))
    .filter(cells => cells.length === columns && !/^-+$/.test(cells[0]) && cells[0] !== '');
}

// --- Header: kits, versions, bases, attribution -------------------------------------
const digests = [...record.matchAll(/`([0-9a-f]{64})`/g)].map(m => m[1]);
assert.ok(new Set(digests).size >= 3, 'candidate, re-packed and baseline kit digests recorded');
assert.match(record, /Baseline: `git archive v0\.5\.0`/, 'baseline kit provenance');
assert.match(record, /Versions: Claude Code [\d.]+ · model `\w+` · Node v[\d.]+ · macOS [\d.]+/, 'tool and model versions');
assert.match(record, /Bases: greenfield `[0-9a-f]{7}`/, 'repository bases');
assert.match(record, /Attribution:/, 'attribution of observations');
assert.match(record, /Prompts:/, 'prompts recorded');

// --- Results: required scenarios and dispositions --------------------------------------
const results = tableRows(section('Results'), 4);
assert.deepEqual(results[0], ['Scenario', 'Sessions', 'Disposition', 'Observed'], 'results table columns');
const rows = results.slice(1);
const DISPOSITIONS = /^(observed|failed|outstanding)(\s*→\s*observed on the re-run)?$/;
for (const row of rows) assert.match(row[2], DISPOSITIONS, `disposition of "${row[0].slice(0, 40)}" is one word: ${row[2]}`);
const required = [
  ['S-30 greenfield', /^S-30 greenfield/],
  ['S-30 brownfield', /^S-30 brownfield/],
  ['S-31 changed scope', /^S-31 changed scope/],
  ['S-31 interruption', /^S-31 interruption/],
  ['S-32 baseline', /^S-32 baseline/]
];
for (const [name, re] of required) {
  const row = rows.find(r => re.test(r[0]));
  assert.ok(row, `required scenario ${name} has a row`);
  assert.ok(!row[2].startsWith('outstanding'), `required scenario ${name} is not outstanding (${row[2]})`);
  if (row[2].startsWith('failed')) {
    assert.match(row[2], /observed on the re-run$/, `${name}: a failed observation is closed only by a re-run`);
    assert.match(row[3], /Fixed in T-\d\d/, `${name}: the failed row names its fix ticket`);
  }
  assert.ok(row[3].length > 200, `${name}: the observation is substantive`);
}
assert.match(rows.find(r => /^S-30 brownfield/.test(r[0]))[3], /unchanged after B1, B2, B3/, 'S-30 brownfield states the unrelated edits survived');
assert.match(rows.find(r => /^S-30 greenfield/.test(r[0]))[3], /No approval was asked in G3/, 'S-30 greenfield states no repeated approval');

// --- Sessions and artifacts ------------------------------------------------------------
const sessions = new Set();
for (const row of rows) for (const m of row[1].matchAll(/\b(G\d|B\d|BL\d)\b/g)) sessions.add(m[1]);
assert.ok(sessions.size >= 12, `sessions named in Results: ${[...sessions].join(' ')}`);
for (const s of sessions) {
  for (const ext of ['out', 'commands.txt', 'git-log.txt', 'git-status.txt', 'resume.json']) {
    const file = path.join(repo, artifacts, `${s}.${ext}`);
    assert.ok(fs.existsSync(file), `${artifacts}/${s}.${ext} exists`);
    // An empty git-status is a clean tree; the baseline kit has no `resume`, so its report is empty.
    const mayBeEmpty = ext === 'git-status.txt' || (ext === 'resume.json' && s.startsWith('BL'));
    if (!mayBeEmpty) assert.ok(fs.statSync(file).size > 0, `${artifacts}/${s}.${ext} is not empty`);
  }
  if (s.startsWith('BL')) {
    assert.equal(read(`${artifacts}/${s}.resume.json`).trim(), '', `${s}: the baseline kit produces no resume report`);
  } else {
    const resume = JSON.parse(read(`${artifacts}/${s}.resume.json`));
    assert.equal(resume.schema, 1, `${s}.resume.json is a resume report`);
  }
}
// Every inline reference to a trial-logs file resolves.
for (const m of record.matchAll(/`((?:G\d|B\d|BL\d)\.(?:out|commands\.txt|git-log\.txt|git-status\.txt|resume\.json))`/g)) {
  assert.ok(fs.existsSync(path.join(repo, artifacts, m[1])), `referenced artifact ${m[1]} exists`);
}
// Sanitized: no hostname, home directory or scratchpad path.
for (const file of fs.readdirSync(path.join(repo, artifacts))) {
  const text = read(`${artifacts}/${file}`);
  assert.doesNotMatch(text, /\/Users\/[a-z]+|claude-501|\.local\b/, `${file} is sanitized`);
}
// Named fix tickets exist and are closed.
for (const m of record.matchAll(/fix ticket (T-\d\d)/g)) {
  const ticket = fs.readdirSync(path.join(repo, 'tickets')).find(f => f.startsWith(`${m[1]}-`));
  assert.ok(ticket, `fix ticket ${m[1]} exists`);
  assert.match(read(`tickets/${ticket}`), /^status: done$/m, `fix ticket ${m[1]} is done`);
}

// --- Counts: baseline comparison with every required measure ------------------------------
const counts = tableRows(section('Results'), 3).filter(r => r[0] !== 'Measure' && r[0] !== 'Scenario');
const measures = counts.map(r => r[0]);
for (const needle of ['wrong-change actions', 'repeated approvals of unchanged scope', 'manual repairs', 'commands to first action', 'unnecessary evaluations']) {
  const row = counts.find(r => r[0].startsWith(needle));
  assert.ok(row, `count row "${needle}" present (have: ${measures.join('; ')})`);
  assert.match(row[1], /^\d+/, `${needle}: runtime count is a number`);
  assert.match(row[2], /^\d+|^not (measured|supported)/, `${needle}: baseline count is a number or an explicit unsupported/unmeasured note`);
}
assert.ok(counts.some(r => /^not supported/.test(r[2])), 'baseline limitations recorded as "not supported"');
assert.match(record, /not a parity or superiority claim/, 'no parity/superiority claim');

// --- Interventions, findings, untested ---------------------------------------------------
assert.ok(tableRows(section('Interventions'), 1).length === 0, 'interventions are a numbered list');
assert.match(section('Interventions'), /^1\. /m);
assert.match(section('Findings'), /^1\. \*\*/m, 'findings are numbered and titled');
assert.match(section('Findings'), /invalid/, 'the invalid run is disclosed');
const untested = section('Untested');
const reqRows = tableRows(untested, 2).filter(r => /^R-\d\d$/.test(r[0]));
for (const r of ['R-02', 'R-04', 'R-05', 'R-06', 'R-08', 'R-10']) assert.ok(reqRows.some(x => x[0] === r), `requirement ${r} mapped`);

console.log(`change trial record tests passed (${rows.length} scenario rows, ${sessions.size} sessions, ${counts.length} count rows)`);
