// Validates the PRD v5 review packet (docs/prd-v5-review-packet.md): every requirement
// and scenario has one row with a disposition, every referenced test suite exists and
// runs under npm test, every "suite S-NN" reference points at a block tagged with that
// scenario, every referenced artifact, fixture and commit resolves, the CI gate is
// recorded as outstanding or as a named run, no release/merge/publish claim is made,
// and the eight independent replay cases execute (bash docs/prd-v5-artifacts/replay.sh all).
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
const packet = read('docs/prd-v5-review-packet.md');
const npmTest = JSON.parse(read('package.json')).scripts.test;
const suites = [...npmTest.matchAll(/node (test\/[a-z-]+\.test\.js)/g)].map(m => m[1]);

function section(n) {
  const m = packet.match(new RegExp(`\\n## ${n}\\. [^\\n]*\\n([\\s\\S]*?)(?=\\n## \\d+\\. |$)`));
  assert.ok(m, `section ${n} present`);
  return m[1];
}
function rows(text, columns) {
  return text.split('\n').filter(l => l.startsWith('| ')).map(l => l.split('|').slice(1, -1).map(c => c.trim()))
    .filter(cells => cells.length === columns && !/^-+$/.test(cells[0]));
}

// --- 1. Implementation reference: base and ticket commits exist; tickets exist and are closed ----
const ref = section(1);
assert.match(ref, /Branch: `feat\/prd-v5`, base `9bcf8df`/, 'base commit named');
// The expected list, in the packet's own build order — T-62 came from a trial finding
// and sits between T-59 and T-60. Without it the loop proved nothing when it matched
// nothing, and a citation was never tied to the ticket it names: pointing all nineteen
// at the base commit passed, and so did deleting every SHA.
const EXPECTED_TICKETS = ['T-47', 'T-48', 'T-49', 'T-50', 'T-51', 'T-52', 'T-53', 'T-54', 'T-55', 'T-56', 'T-57', 'T-58', 'T-59', 'T-62', 'T-60', 'T-61', 'T-63', 'T-64', 'T-65'];
const cited = [...ref.matchAll(/(T-\d\d) `([0-9a-f]{7})`/g)];
assert.deepEqual(cited.map(m => m[1]), EXPECTED_TICKETS, 'section 1 cites every ticket of this PRD, in build order');
for (const m of cited) {
  const r = spawnSync('git', ['-C', repo, 'cat-file', '-e', `${m[2]}^{commit}`]);
  assert.equal(r.status, 0, `${m[1]} commit ${m[2]} exists`);
  const subject = spawnSync('git', ['-C', repo, 'log', '-1', '--format=%s', m[2]], { encoding: 'utf8' }).stdout;
  assert.ok(subject.startsWith(`${m[1]}:`), `${m[2]} is ${m[1]}'s own commit, not another (${subject.slice(0, 60).trim()})`);
  const ticket = fs.readdirSync(path.join(repo, 'tickets')).find(f => f.startsWith(`${m[1]}-`));
  assert.ok(ticket, `${m[1]} ticket file exists`);
  assert.match(read(`tickets/${ticket}`), /^status: done$/m, `${m[1]} is done`);
}
assert.match(ref, /Candidate commit: not chosen by this packet/, 'the packet does not choose the candidate');
assert.match(ref, /PRD revisions during implementation: none/, 'PRD revisions stated');

// --- 2. Traceability: R-01..R-10 and S-01..S-32 once each, honest dispositions ---------------
const trace = section(2);
const reqRows = rows(trace, 5).filter(r => /^R-\d\d/.test(r[0]));
assert.deepEqual(reqRows.map(r => r[0].slice(0, 4)), Array.from({ length: 10 }, (_, i) => `R-${String(i + 1).padStart(2, '0')}`), 'ten requirement rows in order');
const scenRows = rows(trace, 3).filter(r => /^S-\d\d/.test(r[0]));
assert.deepEqual(scenRows.map(r => r[0].slice(0, 4)), Array.from({ length: 32 }, (_, i) => `S-${String(i + 1).padStart(2, '0')}`), '32 scenario rows in order');
const DISPOSITION = /^(delivered|blocked|deferred|outstanding)\b/;
for (const r of [...reqRows.map(r => [r[0], r[4]]), ...scenRows.map(r => [r[0], r[2]])]) assert.match(r[1], DISPOSITION, `${r[0].slice(0, 4)} has a disposition (${r[1]})`);
for (const r of scenRows) assert.ok(r[1].length > 20, `${r[0].slice(0, 4)} names where it is exercised`);
// Live-only scenarios point at the trial record; the rest at a tagged test block.
for (const r of scenRows) {
  const id = r[0].slice(0, 4);
  if (['S-30', 'S-31', 'S-32'].includes(id)) assert.match(r[1], /docs\/trial-prd-v5\.md/, `${id} cites the trial record`);
  else assert.match(r[1], /`test\/[a-z-]+\.test\.js` S-\d\d/, `${id} cites a tagged test block`);
}

// --- Every referenced suite exists and runs under npm test; every "suite S-NN" is a real tag ---
for (const m of packet.matchAll(/`(test\/[a-z-]+\.test\.js)`/g)) {
  assert.ok(exists(m[1]), `${m[1]} exists`);
  assert.ok(suites.includes(m[1]), `${m[1]} runs under npm test`);
}
for (const m of packet.matchAll(/`(test\/[a-z-]+\.test\.js)` (S-\d\d(?:[/,] ?S-\d\d)*)/g)) {
  const text = read(m[1]);
  for (const tag of m[2].split(/[/,] ?/)) assert.ok(text.includes(tag), `${m[1]} carries the ${tag} tag it is cited for`);
}
assert.ok(suites.includes('test/change-review-packet.test.js'), 'this validator runs under npm test');

// --- 4. Verification record: suite count, gates, CI honesty ------------------------------------
const verification = section(4);
assert.match(verification, new RegExp(`\\(${suites.length} suites:`), `suite count matches package.json (${suites.length})`);
for (const suite of suites) assert.ok(verification.includes(suite.replace(/^test\//, '').replace(/\.test\.js$/, '')), `${suite} listed in the full-suite gate`);
const ci = rows(verification, 3).find(r => /^CI matrix/.test(r[0]));
assert.ok(ci, 'CI matrix row present');
assert.ok(/^outstanding/.test(ci[2]) || /run `\d+`.*(success|passed)/.test(ci[2]), `CI result is outstanding or a named run: ${ci[2]}`);
if (/^outstanding/.test(ci[2])) assert.match(ci[2], /Release readiness is blocked/, 'outstanding CI blocks release readiness');
assert.match(verification, /review replay .*replay\.sh all/, 'replay gate recorded');
assert.doesNotMatch(packet, /verdict `PASS`|release PASS|has been published|has been merged|version bumped/i, 'no release, merge or publish claim');
assert.match(packet, /merges nothing, bumps no version\s+and publishes nothing/, 'non-claims stated');

// --- 5–8. Artifacts, fixtures and examples resolve ------------------------------------------------
for (const m of packet.matchAll(/`((?:docs\/prd-v5-artifacts|test\/fixtures\/prd-v5)\/[A-Za-z0-9_./-]+)`/g)) {
  assert.ok(exists(m[1]), `${m[1]} exists`);
}
const records = 'docs/prd-v5-artifacts/records';
for (const f of ['change-record-prd-v1.json', 'change-record-prd-v1-paused-before-revision.json', 'agreement-G-01.json', 'agreement-G-03.json', 'resume-blocked-decision-required.json', 'resume-current-completed.json']) {
  assert.ok(exists(`${records}/${f}`), `${records}/${f} present`);
  JSON.parse(read(`${records}/${f}`));
  assert.doesNotMatch(read(`${records}/${f}`), /\/Users\/[a-z]+|claude-501|\.local\b/, `${f} is sanitized`);
}
const record = JSON.parse(read(`${records}/change-record-prd-v1.json`));
assert.equal(record.sequence, record.events.length, 'the example record is consistent');
assert.deepEqual(record.events.map(e => e.kind), ['register', 'authorize', 'activate', 'pause', 'authorize', 'resume', 'decide', 'resolve', 'authorize', 'complete'], 'events as the packet describes');
assert.equal(record.decisions[0].status, 'resolved');
assert.deepEqual(record.authorizations.map(a => a.id), ['A-01', 'A-02', 'A-03']);
const g3 = JSON.parse(read(`${records}/agreement-G-03.json`));
const quoted = section(7).match(/^ *```\n([\s\S]*?)^ *```/m);
assert.ok(quoted, 'section 7 quotes the projection in a fence');
assert.equal(g3.projection, quoted[1].replace(/^ +/gm, ''), 'the quoted projection is the snapshot text');
assert.equal(JSON.parse(read(`${records}/resume-blocked-decision-required.json`)).agreement.verdict, 'DECISION_REQUIRED');
assert.equal(JSON.parse(read(`${records}/resume-current-completed.json`)).agreement.verdict, 'current');
assert.match(section(6), /Rollback/, 'rollback documented');
assert.match(section(6), /migration plan for/, 'migration preview quoted');
assert.match(section(9), /not a parity or\s+superiority claim/);
assert.match(section(10), /^1\. /m, 'deviations are enumerated');
assert.match(section(12), /Dogfooding: this repository was not migrated/, 'dogfooding limitation stated');

// --- 11. Independent replay: eight cases documented, defined and executable -------------------
const CASES = ['aba', 'revision', 'delegated', 'wrong-change', 'shared-c01', 'crash', 'no-selection', 'conflict'];
const replayRows = rows(section(11), 4).filter(r => r[0] !== 'Case');
assert.equal(replayRows.length, 8, 'eight replay rows');
const script = read('docs/prd-v5-artifacts/replay.sh');
for (const c of CASES) {
  assert.ok(replayRows.some(r => r[1].includes(`replay.sh ${c}`)), `replay row for ${c}`);
  assert.ok(script.includes(`case_${c.replace('-', '_')}()`), `replay.sh defines ${c}`);
}
for (const r of replayRows) assert.match(r[3], /`test\/[a-z-]+\.test\.js` S-\d\d/, `${r[0]} names its deterministic twin`);
const scratch = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'pincer-replay-'));
const run = spawnSync('bash', [path.join(repo, 'docs/prd-v5-artifacts/replay.sh'), 'all', scratch], { encoding: 'utf8', timeout: 600000 });
assert.equal(run.status, 0, `replay.sh all exits 0\n${run.stdout}\n${run.stderr}`);
for (const c of CASES) assert.ok(run.stdout.includes(`ok ${c}\n`), `replay ${c} ok`);
fs.rmSync(scratch, { recursive: true, force: true });

console.log(`change review packet tests passed (${reqRows.length} requirements, ${scenRows.length} scenarios, ${CASES.length} replay cases)`);
