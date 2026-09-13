// Validates the PRD v6 review packet (docs/prd-v6-review-packet.md): every requirement
// and scenario has one row with a disposition, every referenced suite exists and runs
// under npm test, every "suite S-NN" reference points at a file that mentions that
// scenario, every referenced artifact, record, fixture and commit resolves, the
// verification record carries a real result for each gate, the CI gate is recorded as
// outstanding or as a named run, no release/merge/publish claim is made, and the eight
// independent replay cases execute (bash docs/prd-v6-artifacts/replay.sh all).
// It checks completeness and resolvability, not the reviewer's judgment.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(repo, rel));
const packet = read('docs/prd-v6-review-packet.md');
const npmTest = JSON.parse(read('package.json')).scripts.test;
const suites = [...npmTest.matchAll(/node (test\/[a-z-]+\.test\.js)/g)].map(m => m[1]);

function section(n) {
  const m = packet.match(new RegExp(`\\n## ${n}\\. [^\\n]*\\n([\\s\\S]*?)(?=\\n## \\d+\\. |$)`));
  assert.ok(m, `section ${n} present`);
  return m[1];
}
const rows = (text, columns) => text.split('\n').filter(l => l.startsWith('| ')).map(l => l.split('|').slice(1, -1).map(c => c.trim()))
  .filter(cells => cells.length === columns && !/^-+$/.test(cells[0]) && cells[0] !== '');
const commitExists = sha => spawnSync('git', ['-C', repo, 'cat-file', '-e', `${sha}^{commit}`]).status === 0;

// --- 1. Implementation reference: base and ticket commits exist; tickets are closed ----------
const ref = section(1);
assert.match(ref, /Branch: `feat\/prd-v6`, base `07b2210`/, 'base commit named');
const ticketRows = rows(ref, 3).filter(r => /^T-\d\d$/.test(r[0]));
assert.deepEqual(ticketRows.map(r => r[0]), Array.from({ length: 12 }, (_, i) => `T-${66 + i}`), 'T-66..T-77 in build order');
for (const [id, commit, what] of ticketRows) {
  const sha = commit.replace(/`/g, '');
  assert.ok(commitExists(sha), `${id} commit ${sha} exists`);
  const subject = spawnSync('git', ['-C', repo, 'log', '-1', '--format=%s', sha], { encoding: 'utf8' }).stdout;
  assert.ok(subject.startsWith(`${id}:`), `${sha} is the ${id} commit (subject: ${subject.slice(0, 40)})`);
  const file = fs.readdirSync(path.join(repo, 'tickets')).find(f => f.startsWith(`${id}-`));
  assert.ok(file, `${id} ticket file exists`);
  assert.match(read(`tickets/${file}`), /^status: done$/m, `${id} is done`);
  assert.ok(what.length > 20, `${id} says what it added`);
}
assert.match(ref, /Candidate commit: not chosen by this packet/, 'the packet does not choose the candidate');
assert.match(ref, /PRD revisions during implementation: none/, 'PRD revisions stated');
// The claim that the PRD was never revised is checked, not trusted: the only change the
// packet allows since the base is the lifecycle status line that closing the PRD writes.
const prdDiff = spawnSync('git', ['-C', repo, 'diff', '-U0', '07b2210..HEAD', '--', '.prd/prd-v6.md'], { encoding: 'utf8' }).stdout;
const changed = prdDiff.split('\n').filter(l => /^[+-][^+-]/.test(l)).map(l => l.slice(1).trim());
for (const line of changed) assert.match(line, /^status: (ticketed|built)$/, `the PRD was revised since the base: ${line}`);

// --- 2. Traceability: R-01..R-10 and S-01..S-30 once each, with honest dispositions ----------
const trace = section(2);
const reqRows = rows(trace, 5).filter(r => /^R-\d\d$/.test(r[0]));
assert.deepEqual(reqRows.map(r => r[0]), Array.from({ length: 10 }, (_, i) => `R-${String(i + 1).padStart(2, '0')}`), 'ten requirement rows in order');
const scenRows = rows(trace, 3).filter(r => /^S-\d\d/.test(r[0]));
assert.deepEqual(scenRows.map(r => r[0].slice(0, 4)), Array.from({ length: 30 }, (_, i) => `S-${String(i + 1).padStart(2, '0')}`), '30 scenario rows in order');
const DISPOSITION = /^(delivered|blocked|deferred|outstanding)\b/;
for (const r of reqRows) {
  assert.match(r[4], DISPOSITION, `${r[0]} has a disposition (${r[4]})`);
  assert.ok(r[2].split(',').every(t => /^\s*T-\d\d\s*$/.test(t)), `${r[0]} names its tickets`);
}
for (const r of scenRows) {
  const id = r[0].slice(0, 4);
  assert.match(r[2], DISPOSITION, `${id} has a disposition (${r[2]})`);
  assert.ok(r[1].length > 20, `${id} names where it is exercised`);
}
// Every cited suite exists, runs under npm test, and mentions the scenario it is cited for.
const citations = [];
for (const r of scenRows) {
  const id = r[0].slice(0, 4);
  for (const m of r[1].matchAll(/`(test\/[a-z-]+\.test\.js)` (S-\d\d)/g)) citations.push([id, m[1], m[2]]);
  for (const m of r[1].matchAll(/`(docs\/[a-z0-9-]+\.md)`|(docs\/trial-prd-v6\.md)|`(docs\/prd-v6-artifacts\/[^`]+)`/g)) {
    const rel = (m[1] || m[2] || m[3] || '').split(' ')[0];
    if (rel) assert.ok(exists(rel), `${id} cites ${rel} which exists`);
  }
}
assert.ok(citations.length >= 30, `every scenario cites at least one tagged suite (${citations.length} citations)`);
for (const [id, suite, tag] of citations) {
  assert.equal(tag, id, `${id} cites ${suite} under its own id`);
  assert.ok(exists(suite), `${suite} exists`);
  assert.ok(suites.includes(suite), `${suite} runs under npm test`);
  assert.match(read(suite), new RegExp(id), `${suite} mentions ${id}`);
}
const cited = new Set(citations.map(c => c[1]));
for (const s of ['test/coverage-inventory.test.js', 'test/coverage-map.test.js', 'test/coverage-agreement.test.js', 'test/coverage-adoption.test.js', 'test/coverage-readiness.test.js', 'test/coverage-impact.test.js', 'test/coverage-checks.test.js', 'test/coverage-evidence.test.js', 'test/coverage-reports.test.js', 'test/coverage-distribution.test.js', 'test/delivery-benchmark.test.js', 'test/coverage-trial-record.test.js']) {
  assert.ok(cited.has(s), `${s} is cited by at least one scenario`);
}

// --- 3. Contracts: schema table matches what the runtime writes -------------------------------
const contracts = section(3);
for (const phrase of ['schema 3', 'schema 2', 'runtime-contracts.md', 'coverage-contracts.test.js']) assert.ok(contracts.includes(phrase), `contracts section names ${phrase}`);
const manifest = JSON.parse(read('docs/prd-v6-artifacts/records/evidence-manifest-schema3.json'));
assert.equal(manifest.schema, 3, 'the representative manifest is schema 3');
const record = JSON.parse(read('docs/prd-v6-artifacts/records/change-record-schema3.json'));
assert.equal(record.schema, 3); assert.equal(record.runtime, 3);
assert.ok(record.coverage && record.coverage.map && record.coverage.agreement, 'the record carries its coverage binding');
assert.equal(JSON.parse(read('docs/prd-v6-artifacts/records/agreement-snapshot-schema2.json')).schema, 2);
assert.equal(JSON.parse(read('docs/prd-v6-artifacts/records/coverage-map.json')).schema, 1);
assert.equal(JSON.parse(read('docs/prd-v6-artifacts/records/coverage-complete.json')).schema, 1);
assert.equal(JSON.parse(read('docs/prd-v6-artifacts/records/impact-after-revision.json')).schema, 1);

// --- 4. Verification record: every gate has a result; CI is not claimed green ------------------
const verification = section(4);
const gates = rows(verification, 3);
assert.ok(gates.length >= 6, 'the verification record lists the gates');
for (const [gate, command, result] of gates) {
  assert.ok(result.length > 5, `${gate} has a recorded result`);
  assert.doesNotMatch(result, /^RESULT_/, `${gate} still has an unfilled placeholder (${result})`);
}
const ci = gates.find(g => /CI matrix/.test(g[0]));
assert.ok(ci, 'the CI matrix is a listed gate');
assert.match(ci[2], /outstanding|run `?\d+`?|https:\/\//, `the CI gate is outstanding or names a run: ${ci[2]}`);
if (/outstanding/.test(ci[2])) assert.doesNotMatch(verification, /CI (is )?green/i, 'an outstanding CI gate is never described as green');
const ciYml = read('.github/workflows/ci.yml');
// The dimensions come from the gate itself, so the packet and the workflow are checked
// against each other rather than against a list that has to be edited in two places.
const osNames = [...ci[1].matchAll(/\b([a-z]+-latest)\b/g)].map(m => m[1]);
const nodeVersions = (ci[1].match(/Node \{([^}]+)\}/) || [, ''])[1].split(',').map(s => s.trim()).filter(Boolean);
assert.ok(osNames.length && nodeVersions.length, `the CI gate names its matrix dimensions: ${ci[1]}`);
for (const dim of [...osNames, ...nodeVersions]) assert.ok(ciYml.includes(dim), `the CI workflow covers ${dim}`);
assert.match(ci[1], /ci\.yml/, 'the CI gate names the workflow');

// --- 5-7. Artifacts, adoption and the trial are resolvable -------------------------------------
const artifacts = section(5);
for (const m of artifacts.matchAll(/`([a-z0-9-]+\.(?:json|txt))`/g)) {
  assert.ok(exists(`docs/prd-v6-artifacts/records/${m[1]}`), `records/${m[1]} exists`);
}
for (const f of fs.readdirSync(path.join(repo, 'docs/prd-v6-artifacts/records'))) {
  assert.ok(artifacts.includes(`\`${f}\``), `records/${f} is described in the packet`);
  assert.doesNotMatch(read(`docs/prd-v6-artifacts/records/${f}`), /\/Users\/|\/private\/tmp\//, `records/${f} is sanitized`);
}
const trial = section(7);
assert.ok(exists('docs/trial-prd-v6.md'), 'the trial record exists');
assert.match(trial, /17\/18/, 'the trial summary carries the acceptance denominators');
assert.match(trial, /[Nn]o\s*\*?\*?parity or\s*\*?\*?\s*superiority claim/, 'the trial summary refuses a parity claim');
assert.match(trial, /no live run adopted strict coverage/, 'the trial summary states that the live runs did not exercise adoption');

// --- 9. Replay: the eight cases are listed and they execute -------------------------------------
const replay = section(9);
const replayRows = rows(replay, 4).filter(r => /^`[a-z-]+`$/.test(r[0]));
const cases = replayRows.map(r => r[0].replace(/`/g, ''));
assert.deepEqual(cases, ['omitted', 'revision', 'removal', 'substituted', 'race', 'shared', 'rollback', 'clone'], 'the eight replay cases are listed');
for (const r of replayRows) { assert.ok(r[1].length > 10, `${r[0]} names its injected fault`); assert.ok(r[2].length > 10, `${r[0]} names the expected refusal`); assert.ok(r[3].length > 10, `${r[0]} names a working control`); }
const script = read('docs/prd-v6-artifacts/replay.sh');
for (const c of cases) assert.match(script, new RegExp(`^case_${c}\\(\\)`, 'm'), `replay.sh implements ${c}`);
assert.match(script, /^CASES="omitted revision removal substituted race shared rollback clone"$/m, 'replay.sh runs the same eight cases');

// --- 10-11. Limitations, and no release claim ---------------------------------------------------
const limits = section(10);
for (const phrase of ['adequacy', 'Node 18', 'provenance, not authenticated identity']) assert.ok(limits.includes(phrase), `limitations name ${phrase}`);
assert.match(section(11), /does not choose an evaluation candidate/, 'the packet disclaims the evaluation stage');
for (const claim of [/\breleased\b/i, /\bpublished to npm\b/i, /\bmerged to main\b/i]) assert.doesNotMatch(packet, claim, `the packet makes no release claim (${claim})`);

// --- The replay cases actually run ---------------------------------------------------------------
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'pincer-v6-packet-'));
const r = spawnSync('bash', [path.join(repo, 'docs/prd-v6-artifacts/replay.sh'), 'all', scratch], { encoding: 'utf8', cwd: repo, timeout: 600000 });
assert.equal(r.status, 0, `replay.sh all failed:\n${r.stdout}\n${r.stderr}`);
for (const c of cases) assert.match(r.stdout, new RegExp(`^ok ${c}$`, 'm'), `replay case ${c} passed`);
assert.match(r.stdout, /^ok all \(8 cases\)$/m, 'all eight replay cases passed');
fs.rmSync(scratch, { recursive: true, force: true });

console.log(`coverage review packet tests passed (${reqRows.length} requirements, ${scenRows.length} scenarios, ${cases.length} replay cases)`);
