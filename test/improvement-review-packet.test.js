// PRD v7 T-96 (R-10, S-28..S-30): the review packet, bound to the repository.
//
// A packet is only worth reading if its citations are checkable, so this suite binds
// them rather than counting them: every file it names exists, every suite it names is
// in `npm test`, every ticket it names is a real ticket of this PRD, and every scenario
// of the PRD has exactly one row. A citation that points at nothing, a disposition that
// claims delivery with no basis, and a scenario quietly omitted all fail here.
//
// The rule this suite exists to enforce is the one that is easiest to break under
// pressure: a scenario whose work has not been done must be dispositioned
// `outstanding`, and nothing may report it as delivered because a validator passed. So
// the outstanding rows are checked against the records they describe — if a pilot
// record says `observed: false`, the packet must not say S-07 is delivered.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { repo } from './helpers.js';

const require = createRequire(import.meta.url);
const obs = require(path.join(repo, 'scripts/delivery-benchmark-v7/observations.cjs'));
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(repo, rel));
const packet = read('docs/prd-v7-review-packet.md');
const prd = read('.prd/prd-v7.md');
const testScript = JSON.parse(read('package.json')).scripts.test;

// The packet is parsed by its numbered sections, so the numbering is load-bearing.
const section = n => {
  const start = packet.indexOf(`\n## ${n}. `);
  assert.notEqual(start, -1, `the packet has a section ${n}`);
  const next = packet.indexOf(`\n## ${n + 1}. `, start);
  return packet.slice(start, next === -1 ? packet.length : next);
};
const rowsOf = text => text.split('\n').filter(l => /^\| /.test(l) && !/^\| ---/.test(l));
const cellsOf = row => row.split('|').slice(1, -1).map(c => c.trim());

// --- S-28: every citation binds to the repository ------------------------------------
{
  // Every backticked path in the packet that looks like a repository path must exist.
  // This is the check that turns a citation into a reference.
  const cited = new Set();
  for (const m of packet.matchAll(/`([A-Za-z0-9_./-]+\.(?:cjs|js|json|md|sh))`/g)) cited.add(m[1]);
  for (const m of packet.matchAll(/`((?:docs|test|scripts|template|plugin|bin)\/[A-Za-z0-9_./-]+)`/g)) cited.add(m[1].replace(/\/$/, ''));
  assert.ok(cited.size >= 25, `the packet cites the work (${cited.size} paths)`);
  const missing = [...cited].filter(rel => !exists(rel) && !exists(rel.replace(/\/$/, '')));
  assert.deepEqual(missing, [], `every cited path exists:\n${missing.join('\n')}`);

  // Every suite the packet names is actually in `npm test`. A suite that exists but is
  // never run is a claim, not a gate.
  const suites = [...cited].filter(rel => /^test\/.*\.test\.js$/.test(rel));
  assert.ok(suites.length >= 10, `the packet names its suites (${suites.length})`);
  const unrun = suites.filter(rel => !testScript.includes(rel));
  assert.deepEqual(unrun, [], `every cited suite is in npm test:\n${unrun.join('\n')}`);

  // Every ticket the packet names is a real ticket of this PRD, and every v7 ticket
  // appears — a ticket quietly dropped from the table is work nobody reviews.
  const ticketFiles = fs.readdirSync(path.join(repo, 'tickets')).filter(f => /^T-\d+/.test(f));
  const v7 = ticketFiles.filter(f => read(`tickets/${f}`).includes('prd: .prd/prd-v7.md')).map(f => f.match(/^(T-\d+)/)[1]).sort();
  assert.ok(v7.length >= 10, `PRD v7 has its tickets (${v7.length})`);
  const implementation = section(1);
  for (const id of v7) assert.ok(implementation.includes(`| ${id} |`), `section 1 has a row for ${id}`);
  for (const m of implementation.matchAll(/^\| (T-\d+) \|/gm)) {
    assert.ok(v7.includes(m[1]), `${m[1]} is a ticket of PRD v7`);
    assert.ok(ticketFiles.some(f => f.startsWith(`${m[1]}-`)), `${m[1]} has a ticket file`);
  }

  // Every scenario of the PRD has exactly one disposition row, and every row names a
  // scenario the PRD defines.
  const defined = [...prd.matchAll(/^- \*\*(S-\d+):\*\*/gm)].map(m => m[1]);
  assert.equal(defined.length, 30, `the PRD defines thirty scenarios (${defined.length})`);
  const table = rowsOf(section(3)).filter(r => /\| S-\d+ \|/.test(r));
  const dispositioned = table.map(r => cellsOf(r)[1]);
  assert.deepEqual([...dispositioned].sort(), [...defined].sort(), 'every scenario has exactly one row, and no row invents one');
  assert.equal(new Set(dispositioned).size, dispositioned.length, 'no scenario is dispositioned twice');
  // Every requirement too.
  const requirements = [...prd.matchAll(/^### (R-\d+) — /gm)].map(m => m[1]);
  assert.equal(requirements.length, 10);
  for (const r of requirements) assert.ok(table.some(row => cellsOf(row)[0] === r), `${r} has rows`);

  // Every row's basis cites something real: a suite, a document or an artifact.
  for (const row of table) {
    const [req, scenario, disposition, basis] = cellsOf(row);
    assert.ok(disposition, `${scenario}: has a disposition`);
    assert.ok(basis && basis.length > 20, `${scenario}: the basis is not vacuous (${basis})`);
    assert.match(disposition, /delivered|outstanding/, `${scenario}: disposition is delivered or outstanding`);
    // A delivered scenario cites a suite, a document or a named judgment. A bare
    // "delivered" with nothing behind it is the vacuous citation this refuses.
    if (/delivered/.test(disposition)) {
      const citesFile = /`[A-Za-z0-9_./-]+\.(cjs|js|json|md|sh)`/.test(basis);
      const citesJudgment = /judgment/i.test(disposition) || /judgment/i.test(basis);
      assert.ok(citesFile || citesJudgment, `${scenario}: a delivered scenario cites a file or names a judgment — "${basis}"`);
      // Any file it cites must exist.
      for (const m of basis.matchAll(/`([A-Za-z0-9_./-]+\.(?:cjs|js|json|md|sh))`/g)) {
        assert.ok(exists(m[1]), `${scenario}: cited ${m[1]} exists`);
      }
    }
    if (/outstanding/.test(disposition)) {
      assert.ok(basis.length > 20, `${scenario}: an outstanding scenario says what is missing`);
    }
  }
}

// --- S-28: the outstanding rows agree with the records they describe -----------------
// The failure this prevents: a passing validator being read as a completed observation.
{
  const table = rowsOf(section(3)).filter(r => /\| S-\d+ \|/.test(r));
  const dispositionOf = id => cellsOf(table.find(r => cellsOf(r)[1] === id))[2];

  // The pilot, platform and comparison records all say nothing has been observed.
  const pilots = fs.readdirSync(path.join(repo, 'docs/prd-v7-artifacts/pilots/baseline'))
    .filter(f => f.endsWith('.json')).map(f => JSON.parse(read(`docs/prd-v7-artifacts/pilots/baseline/${f}`)));
  const platforms = fs.readdirSync(path.join(repo, 'docs/prd-v7-artifacts/platforms'))
    .filter(f => f.endsWith('.json')).map(f => JSON.parse(read(`docs/prd-v7-artifacts/platforms/${f}`)));
  const comparison = JSON.parse(read('docs/prd-v7-artifacts/comparison/comparison-v7.json'));
  for (const record of [...pilots, ...platforms, comparison]) {
    assert.deepEqual(obs.problems(record), [], `${record.id} validates: ${JSON.stringify(obs.problems(record))}`);
  }

  // Each live scenario's disposition must match the state of its records.
  const liveScenarios = {
    'S-07': pilots, 'S-08': pilots,
    'S-19': platforms, 'S-20': platforms, 'S-21': platforms,
    'S-25': [comparison], 'S-26': [comparison], 'S-27': [comparison],
  };
  for (const [scenario, records] of Object.entries(liveScenarios)) {
    const anyObserved = records.some(r => r.observed === true);
    const disposition = dispositionOf(scenario);
    if (!anyObserved) {
      assert.match(disposition, /outstanding/i, `${scenario}: no record is observed, so it cannot be reported as delivered`);
    }
  }
  // And the packet says so at the top, where a reader cannot miss it.
  assert.match(packet.replace(/\s+/g, ' '), /\*\*None of it has been run\.\*\*/, 'the packet leads with what was not run');
  assert.match(packet.replace(/\s+/g, ' '), /Nothing in this packet should be read as evidence that they happened/);

  // The outstanding section names each blocked requirement and what would unblock it.
  const outstanding = section(6);
  for (const item of ['Three pilot projects', 'spending cap', 'non-implementing reviewers', 'Codex CLI', 'Browser tooling', 'CI matrix']) {
    assert.ok(outstanding.includes(item), `section 6 names ${item}`);
  }
  assert.match(outstanding, /must be costed before it runs/, 'and that the schedule must be costed');
  assert.match(outstanding, /explicit recorded scope revision/, 'and that a smaller study needs a revision');

  // Limitations are stated, including the unflattering ones.
  const limits = section(7);
  for (const limit of ['operator-driven', 'Fewer bytes is not less effort', 'not separable', 'seam, not a browser', 'No live session', 'unverified']) {
    assert.ok(limits.includes(limit), `section 7 states the "${limit}" limitation`);
  }
}

// --- S-28: forged, missing and vacuous citations fail ------------------------------
// Mutation checks: each breaks the packet in a way a reader could not see, and the
// binding above must catch it. Run against a copy; the real packet is never edited.
{
  const scratch = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'v7-packet-'));
  const bind = text => {
    const problems = [];
    for (const m of text.matchAll(/`([A-Za-z0-9_./-]+\.(?:cjs|js|json|md|sh))`/g)) if (!exists(m[1])) problems.push(`missing ${m[1]}`);
    const rows = rowsOf(text).filter(r => /\| S-\d+ \|/.test(r));
    const ids = rows.map(r => cellsOf(r)[1]);
    const defined = [...prd.matchAll(/^- \*\*(S-\d+):\*\*/gm)].map(m => m[1]);
    for (const id of defined) if (!ids.includes(id)) problems.push(`undispositioned ${id}`);
    for (const row of rows) {
      const [, id, disposition, basis] = cellsOf(row);
      if (!basis || basis.length <= 20) problems.push(`vacuous ${id}`);
      if (/delivered/.test(disposition) && !/`[A-Za-z0-9_./-]+\.(cjs|js|json|md|sh)`/.test(basis) && !/judgment/i.test(disposition) && !/judgment/i.test(basis)) problems.push(`unevidenced ${id}`);
    }
    return problems;
  };
  assert.deepEqual(bind(packet), [], 'the real packet binds cleanly');

  // A citation pointing at a file that does not exist.
  const forged = packet.replace('`test/coverage-scaffold.test.js`', '`test/coverage-scaffold-v2.test.js`');
  assert.ok(bind(forged).some(p => /missing test\/coverage-scaffold-v2/.test(p)), 'a forged citation is caught');
  // A scenario quietly dropped from the table.
  const dropped = packet.split('\n').filter(l => !/^\| R-04 \| S-10 \|/.test(l)).join('\n');
  assert.ok(bind(dropped).some(p => p === 'undispositioned S-10'), 'a dropped scenario is caught');
  // A disposition with nothing behind it.
  const vacuous = packet.replace(/(\| R-04 \| S-10 \| delivered \(mechanical\) \| )[^|]+(\|)/, '$1done $2');
  assert.ok(bind(vacuous).some(p => /S-10/.test(p)), 'a vacuous basis is caught');
  // An outstanding scenario relabelled as delivered with no evidence.
  const relabelled = packet.replace(/(\| R-03 \| S-07 \| )\*\*outstanding\*\*( \| )[^|]+/, '$1delivered$2it works');
  assert.ok(bind(relabelled).some(p => /S-07/.test(p)), 'a relabelled outstanding scenario is caught');
  fs.rmSync(scratch, { recursive: true, force: true });
}

// --- S-29: the replay cases run, and the integration gates are identified -----------
{
  // Every replay case the packet names exists in the script and runs.
  const script = read('docs/prd-v7-artifacts/replay.sh');
  const named = rowsOf(section(4)).filter(r => /^\| `/.test(r)).map(r => cellsOf(r)[0].replace(/`/g, ''));
  assert.ok(named.length >= 6, `the packet names its replay cases (${named.length})`);
  for (const c of named) assert.ok(script.includes(`case_${c}()`), `replay.sh implements case_${c}`);
  const declared = (script.match(/^CASES="([^"]+)"/m) || [])[1].split(/\s+/);
  assert.deepEqual(named.sort(), [...declared].sort(), 'the packet and the script agree on the case list');

  // The cases actually pass. This is the slow part of the suite and the reason it
  // belongs at the integration boundary rather than on a ticket check.
  const result = spawnSync('bash', [path.join(repo, 'docs/prd-v7-artifacts/replay.sh'), 'all'], { cwd: repo, encoding: 'utf8', timeout: 600000 });
  assert.equal(result.status, 0, `replay.sh all passes:\n${result.stdout}\n${result.stderr}`);
  for (const c of declared) assert.match(result.stdout, new RegExp(`^ok ${c}$`, 'm'), `replay case ${c} passed`);

  // The v6 replay cases are untouched and still declared.
  const v6 = read('docs/prd-v6-artifacts/replay.sh');
  assert.match(v6, /^CASES="omitted revision removal substituted race shared rollback clone"$/m, 'the v6 case list is unchanged');

  // The CI matrix the packet calls outstanding is the one the workflow defines.
  const ci = read('.github/workflows/ci.yml');
  for (const token of ['ubuntu-latest', 'macos-latest', '22', '24']) assert.ok(ci.includes(token), `CI covers ${token}`);
  assert.match(section(6), /Ubuntu\/macOS × Node 22\/24/, 'the packet names the matrix it is waiting on');

  // npm test stays offline: no suite may invoke a paid session.
  assert.ok(!/live-driver|claude -p|codex exec/.test(testScript), 'npm test invokes no live driver');
  const live = path.join(repo, 'scripts/delivery-benchmark-v7/live-driver.sh');
  if (fs.existsSync(live)) {
    const files = fs.readdirSync(path.join(repo, 'test')).filter(f => f.endsWith('.test.js'));
    for (const f of files) {
      const text = read(`test/${f}`);
      assert.ok(!/live-driver\.sh['"]?\s*\]/.test(text) || /refus|exit 3|spending/.test(text), `test/${f} does not invoke the live driver for real`);
    }
  }
}

// --- S-30: the evaluation boundary is stated and nothing was published ---------------
{
  const boundary = section(8);
  assert.match(boundary, /No candidate has been selected and no evaluation exists/);
  assert.match(boundary.replace(/\s+/g, ' '), /Evaluation, merge, version bump and publication are separate actions/);
  assert.match(boundary, /legacy management mode/, 'the management mode is recorded');
  assert.match(boundary, /cc8c11e0584bec979fe22069700eeada3681b75919f95f2dc8ba9529da055410/, 'with the pinned kit digest');
  // The packet creates no approval provenance and says so.
  assert.match(packet.replace(/\s+/g, ' '), /It does not evaluate, merge, version, or publish/);
  assert.match(boundary.replace(/\s+/g, ' '), /creates no approval provenance/);

  // Authored metadata really does precede candidate selection: no v7 evidence exists.
  assert.ok(!fs.existsSync(path.join(repo, '.prd/evidence/prd-v7')), 'no v7 evidence directory exists yet');
  assert.match(read('NOTES.md'), /^prd: \.prd\/prd-v6\.md$/m, 'NOTES.md still names the v6 evaluation, not a v7 one');
  // The PRD is authored and its status is honest.
  assert.match(prd, /^status: ticketed$/m, 'the PRD is ticketed, not built');

  // The packet does not overstate: no superiority or performance claim.
  const flat = packet.replace(/\s+/g, ' ');
  assert.doesNotMatch(flat, /\bproves that (Pincer|the workflow) is\b/i, 'no superiority claim');
  assert.doesNotMatch(flat, /\bmeasured \d+% less effort\b/i, 'no effort claim beyond the bytes measured');
  assert.match(flat, /Fewer bytes is not less effort/, 'and it says so explicitly');
}

console.log('improvement review packet tests passed');
