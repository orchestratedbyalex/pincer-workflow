// PRD v7 T-87 (R-01, S-01..S-03): the frozen protocol, the frozen interface contract of
// the two additive surfaces, the preservation matrix, and the reconciled handover.
//
// This is a static contract suite, in the shape of contracts.test.js and
// coverage-contracts.test.js: it pins the wording and the shapes that the rest of v7 is
// built against, so a later change that quietly loosens one of them fails here rather
// than in a report nobody reads. What it deliberately does NOT establish is anything
// about the experiment: project suitability, reviewer independence and the spending
// decision are execution prerequisites, and this suite asserts they are still recorded
// as outstanding rather than asserting they are settled.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { repo } from './helpers.js';

const require = createRequire(import.meta.url);
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8');
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
// Markdown wraps prose at an arbitrary column, so a pin on wording must not also pin
// where the line happened to break. Structural pins (headings, table rows) keep their
// line anchors and match the raw text.
const flat = text => text.replace(/\s+/g, ' ');
const protocol = read('docs/prd-v7-protocol.md');
const flatProtocol = flat(protocol);
const pilots = read('docs/prd-v7-pilots.md');
const flatPilots = flat(pilots);
const contracts = read('template/docs/runtime-contracts.md');
const flatContracts = flat(contracts);
const scaffold = require(path.join(repo, 'template/scripts/pincer-runtime/scaffold.cjs'));
const resume = require(path.join(repo, 'template/scripts/pincer-runtime/resume.cjs'));
const coverage = require(path.join(repo, 'template/scripts/pincer-runtime/coverage.cjs'));
const effort = require(path.join(repo, 'scripts/delivery-benchmark-v7/effort.cjs'));
const freeze = require(path.join(repo, 'scripts/delivery-benchmark-v7/freeze.cjs'));

// --- S-01: a dated, versioned protocol that names everything before collection -------
{
  assert.match(protocol, /^# PRD v7 improvement protocol — frozen \d{4}-\d{2}-\d{2}$/m, 'the protocol is dated');
  assert.match(flatProtocol, /Protocol version \*\*v7\.\d+\*\*/, 'and versioned');
  assert.match(flatProtocol, /written \*before\* the first observed run/, 'and says when it was written relative to collection');

  // The baseline it freezes.
  assert.match(flatProtocol, /715853d/, 'the baseline commit');
  assert.match(flatProtocol, /694241c/, 'the released kit commit under test');
  assert.match(flatProtocol, /cc8c11e0584bec979fe22069700eeada3681b75919f95f2dc8ba9529da055410/, 'the pinned management-kit digest');

  // The schedule: eight briefs, three arms, three repetitions, 72 runs.
  for (const arm of effort.ARMS) assert.ok(protocol.includes(`\`${arm}\``), `the protocol names the ${arm} arm`);
  assert.match(flatProtocol, /8 briefs × 3 arms × 3 matched repetitions = \*\*72 runs\*\*/, 'the schedule size is stated');
  for (const brief of ['cli-greenfield', 'bugfix-brownfield', 'integration-untested', 'ui-states', 'scope-revision', 'handoff-two-changes', 'revision-recovery', 'brownfield-maintenance']) {
    assert.ok(protocol.includes(`\`${brief}\``), `the protocol names the ${brief} brief`);
  }
  assert.match(flatProtocol, /\*\*A `strict` run that did not actually adopt strict coverage is a protocol failure, not evidence about strict Pincer\.\*\*/, 'an unadopted strict run is a protocol failure');

  // Every metric the record computes is named, and every status it can carry.
  for (const stage of effort.STAGES) assert.ok(protocol.includes(`\`${stage}_minutes\``), `the protocol defines ${stage}_minutes`);
  for (const status of effort.STATUSES) assert.ok(new RegExp(`\\| \`${status}\` \\|`).test(protocol), `the protocol defines the ${status} status`);
  assert.match(flatProtocol, /`null` is never rendered as zero/, 'null is not zero');
  assert.match(flatProtocol, /overlapping intervals merged once/, 'overlapping intervals are merged');

  // The review rubric, its four questions and its independence requirement.
  assert.match(flatProtocol, /At least \*\*two reviewers who did not implement the candidate\*\*/, 'reviewer independence');
  assert.match(flatProtocol, /blinded to arm where the artifacts make blinding feasible/, 'blinding where feasible');
  assert.match(flatProtocol, /An automated record check never stands in for a review/, 'a record check is not a review');
  const rubric = protocol.slice(protocol.indexOf('Frozen rubric'), protocol.indexOf('## 7.'));
  for (const n of [1, 2, 3, 4]) assert.match(rubric, new RegExp(`^${n}\\. `, 'm'), `the rubric has question ${n}`);

  // The prerequisites are recorded as OUTSTANDING. This suite asserts they are still
  // open, not that they are settled: settling them is the user's decision and the live
  // tickets stay open until it is made.
  const prereq = protocol.slice(protocol.indexOf('## 9.'), protocol.indexOf('## 10.'));
  for (const item of ['Three pilot projects', 'Project access decision', 'Spending cap', 'Wall-clock cap', 'Two non-implementing reviewers', 'Browser tooling']) {
    const row = prereq.split('\n').find(l => l.includes(item));
    assert.ok(row, `the protocol lists ${item} as a prerequisite`);
    assert.match(row, /\*\*outstanding\*\*/, `${item} is recorded as outstanding, not settled`);
  }
  // The one prerequisite that was settleable without a person or a budget: T-98 verified
  // the Codex CLI on the supported host, so its row names a version instead of deferring.
  const codex = prereq.split('\n').find(l => l.includes('Codex CLI availability'));
  assert.ok(codex, 'the protocol still carries the Codex CLI row');
  assert.match(codex, /codex-cli \d+\.\d+\.\d+/, 'and it names the pinned version rather than deferring it');
  assert.doesNotMatch(codex, /\*\*outstanding\*\*/, 'a verified prerequisite is not still outstanding');
  assert.match(prereq, /must be costed before execution/, 'the schedule must be costed before it runs');
  assert.match(prereq, /A smaller study requires an\s*explicit recorded scope revision/, 'a smaller study needs a recorded revision');

  // And the protocol says what it does not establish, so a reader cannot take a valid
  // negative result as a failure of the method or a positive one as superiority.
  const limits = protocol.slice(protocol.indexOf('## 10.'));
  assert.match(limits, /A valid negative\s*comparison satisfies the measurement requirement/);
  assert.match(limits, /They do not establish superiority/);
  assert.match(limits, /A passing record validator proves record properties/);
}

// --- S-02: the interface contracts, with their counterexamples ----------------------
{
  // Both surfaces are documented in the canonical contract document, with the exact
  // grammar the runtime implements.
  assert.match(contracts, /^### Coverage draft$/m, 'the coverage draft is a contract section');
  assert.match(contracts, /^### Brief resume$/m, 'the brief resume is a contract section');
  assert.match(flatContracts, /`coverage scaffold --change <id> \[--json\]`/, 'the scaffold grammar');
  assert.match(flatContracts, /`resume --brief \[--change <id>\] \[--json\]`/, 'the brief grammar');
  assert.match(flatContracts, /\| `coverage scaffold` \| `--change <id> \[--json\]` \| nothing \|/, 'the commands table says it writes nothing');
  assert.match(flatContracts, /`resume \[--change <id>\] \[--brief\] \[--json\]` is read-only inspection/, 'the resume signature carries --brief');

  // The draft envelope is deliberately not a map schema, and the document says why.
  assert.equal(scaffold.DRAFT, 1);
  assert.equal(scaffold.KIND, 'coverage-draft');
  assert.match(flatContracts, /`draft: 1`, and deliberately \*\*no `schema` key\*\*/, 'the draft carries no map schema, on purpose');
  assert.match(flatContracts, /COVERAGE_INVALID: unsupported coverage map schema undefined/, 'and the refusal it produces is quoted');
  // The counterexample, executed: the documented envelope really is refused as a map.
  const envelope = { draft: scaffold.DRAFT, kind: scaffold.KIND, change: 'prd-v1', prd: '.prd/prd-v1.md', scenarios: {}, scope: {}, tickets: {}, checks: {} };
  const asMap = coverage.validateText(`${JSON.stringify(envelope, null, 2)}\n`, { change: 'prd-v1', prd: '.prd/prd-v1.md' });
  assert.match(asMap.problem, /unsupported coverage map schema undefined/, 'the draft envelope is refused by the map validator');
  // The guard is the missing key, not the extra ones: an otherwise valid map validates,
  // and the same document with `schema` removed fails with exactly the draft's refusal.
  const minimal = { schema: 1, change: 'prd-v1', prd: '.prd/prd-v1.md', scenarios: {}, scope: {}, tickets: {}, checks: {} };
  assert.ok(!coverage.validateText(`${JSON.stringify(minimal, null, 2)}\n`, { change: 'prd-v1', prd: '.prd/prd-v1.md' }).problem, 'a minimal map validates');
  const { schema: _dropped, ...withoutSchema } = minimal;
  assert.match(coverage.validateText(`${JSON.stringify(withoutSchema, null, 2)}\n`, { change: 'prd-v1', prd: '.prd/prd-v1.md' }).problem, /unsupported coverage map schema undefined/, 'and without the schema key it is refused the way the draft is');

  // Every unresolved code the contract names exists, in the documented order.
  for (const code of scaffold.UNRESOLVED_ORDER) assert.ok(contracts.includes(code), `the contract names the ${code} code`);
  assert.deepEqual(scaffold.UNRESOLVED_ORDER, ['SCENARIO_UNLINKED', 'CHECK_UNDECLARED', 'TICKET_UNCLASSIFIED', 'SCENARIO_STALE', 'TICKET_FOREIGN']);
  assert.match(flatContracts, /The draft body carries no timestamp, so two calls on identical authored inputs are byte-identical/, 'determinism is contracted');
  assert.match(flatContracts, /preserved and flagged\*\* \(`SCENARIO_STALE`\), never dropped/, 'stale authored rows are preserved');
  assert.match(flatContracts, /A draft is \*\*not a coverage map and confers no readiness\*\*/, 'a draft grants nothing');

  // The brief is contracted as a projection, and the envelope is distinct.
  assert.equal(resume.BRIEF, 1);
  assert.equal(resume.BRIEF_KIND, 'resume-brief');
  assert.match(flatContracts, /\*\*projection of the report `resume` already computes\*\*/, 'the brief is a projection');
  assert.match(flatContracts, /`next` is the full report's own object, copied/, 'next is copied, not recomputed');
  assert.match(flatContracts, /Grouping may collapse \*\*repetition\*\*; it may never collapse a \*\*category\*\*/, 'categories survive grouping');
  assert.match(flatContracts, /so nothing is hidden — only deferred/, 'omitted rows stay reachable');
  assert.match(flatContracts, /The default `resume` human output and resume JSON schema 2 are unchanged/, 'the default contract is unchanged');
  // The brief names the schema it projects, so a reader can tell what it is a view of.
  assert.equal(resume.SCHEMA, 2, 'resume JSON is still schema 2');

  // The protocol's own copy of the two grammars agrees with the runtime.
  assert.match(flatProtocol, /node scripts\/pincer-runtime\.cjs coverage scaffold --change <id> \[--json\]/);
  assert.match(flatProtocol, /node scripts\/pincer-runtime\.cjs resume --brief \[--change <id>\] \[--json\]/);
  assert.match(flatProtocol, /Both are \*\*read-only\*\*/, 'the protocol records that both write nothing');

  // --- The preservation matrix: every guarantee maps to a suite that exists ---------
  // A matrix row naming a suite that is not in the tree would be a promise with nothing
  // behind it, which is the failure mode this check exists for.
  const matrix = read('docs/prd-v7-preservation.md');
  // The first table is the guarantee matrix; the second lists the counterexamples and
  // is checked separately below.
  const guaranteeTable = matrix.slice(0, matrix.indexOf('## Counterexamples'));
  const rows = guaranteeTable.split('\n').filter(l => /^\| /.test(l) && !/^\| ---/.test(l) && !/^\| Guarantee/.test(l));
  assert.ok(rows.length >= 12, `the matrix covers the invariants (${rows.length} rows)`);
  const named = new Set();
  for (const row of rows) {
    const cells = row.split('|').map(c => c.trim());
    const [, guarantee, , suites] = cells;
    assert.ok(guarantee, 'every row names a guarantee');
    const files = suites.match(/`([^`]+\.test\.js)`/g) || [];
    assert.ok(files.length, `${guarantee}: names at least one suite`);
    for (const f of files) {
      const rel = `test/${f.replace(/`/g, '')}`;
      assert.ok(fs.existsSync(path.join(repo, rel)), `${guarantee}: ${rel} exists`);
      named.add(rel);
    }
  }
  // Every preserved guarantee the PRD lists appears in the matrix.
  for (const guarantee of ['agreement identity', 'explicit decisions', 'selection', 'latest-failure precedence', 'source mutation detection', 'source freshness', 'attempt locking', 'transaction recovery', 'artifact allowlist', 'legacy', 'migrated', 'changes', 'strict']) {
    assert.ok(new RegExp(guarantee, 'i').test(matrix), `the matrix covers "${guarantee}"`);
  }
  assert.match(matrix, /no efficiency target (changes|weakens|loosens)/i, 'the matrix says efficiency never relaxes a gate');
  // The counterexample table must also name suites that exist: a counterexample nobody
  // runs is a claim, not a check.
  const counter = matrix.slice(matrix.indexOf('## Counterexamples'));
  const counterRows = counter.split('\n').filter(l => /^\| /.test(l) && !/^\| ---/.test(l) && !/^\| Surface/.test(l));
  assert.ok(counterRows.length >= 10, `the counterexamples are listed (${counterRows.length} rows)`);
  for (const row of counterRows) {
    const suite = (row.split('|').map(c => c.trim())[3] || '').replace(/`/g, '');
    assert.ok(suite.endsWith('.test.js'), `each counterexample names its suite (saw "${suite}")`);
    assert.ok(fs.existsSync(path.join(repo, `test/${suite}`)), `test/${suite} exists`);
    named.add(`test/${suite}`);
  }
  // The two new surfaces really are covered by counterexamples, not only by happy paths.
  assert.ok(named.has('test/coverage-scaffold.test.js') && named.has('test/resume-brief.test.js'), 'both new surfaces are in the matrix');
}

// --- S-03: the handover agrees with this checkout, and v6 is byte-for-byte intact ----
{
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  const ancestor = sha => {
    try { execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: repo, stdio: 'ignore' }); return true; } catch { return false; }
  };
  // Every claim the reconciliation table makes about this checkout is checked against
  // the checkout, not against the prose.
  const table = protocol.slice(protocol.indexOf('## 2.'), protocol.indexOf('### v6 preservation'));
  for (const sha of ['350823e', '566b553', '694241c']) {
    assert.ok(table.includes(sha), `the reconciliation names ${sha}`);
    assert.ok(ancestor(sha), `${sha} really is an ancestor of HEAD, as the reconciliation says`);
  }
  assert.equal(JSON.parse(read('package.json')).version, '0.6.0', 'package.json says 0.6.0, as the reconciliation says');
  assert.match(read('NOTES.md'), /^prd: \.prd\/prd-v6\.md$/m, 'NOTES.md carries the v6 evaluation, not PRD v4\'s');
  assert.ok(fs.existsSync(path.join(repo, '.prd/evidence/prd-v6/ce98abdbc6edd4e8d4f5736fee35dd765b930452/manifest.json')), 'the v6 evidence manifest is present');
  assert.ok(git('tag', '-l', 'v0.6.0').includes('v0.6.0'), 'the v0.6.0 tag exists locally');

  // Remote publication state is NOT asserted, and the protocol says so rather than
  // claiming it: a remote-tracking ref records the last fetch, not the server.
  assert.match(flatProtocol, /\*\*Remote state is not asserted\.\*\*/, 'the protocol refuses to assert remote state');
  assert.match(flatProtocol, /is unverified here and must be checked against the server/, 'and says what would settle it');
  assert.doesNotMatch(protocol, /the tag is pushed\b(?!,)/, 'the protocol never claims the tag is pushed');
  // Historical evidence is distinguished from current readiness.
  assert.match(flatProtocol, /Historical evidence is not current readiness/);
  assert.match(flatProtocol, /`stale: candidate changed after evaluation` on this tree is the correct answer, not a defect/);

  // The v6 study is byte-for-byte intact. Every file is digested individually, so the
  // failure names the file that moved rather than only saying the set changed.
  const preservation = JSON.parse(read('docs/prd-v7-artifacts/v6-preservation.json'));
  assert.equal(preservation.schema, 1);
  const moved = [];
  for (const [rel, expected] of Object.entries(preservation.files)) {
    const full = path.join(repo, rel);
    if (!fs.existsSync(full)) { moved.push(`${rel}: deleted`); continue; }
    const actual = sha256(fs.readFileSync(full));
    if (actual !== expected) moved.push(`${rel}: content changed`);
  }
  assert.deepEqual(moved, [], `the v6 study is unchanged; fixing v6 methodology means a new study, never rewriting this one:\n${moved.join('\n')}`);
  const keys = Object.keys(preservation.files).sort();
  assert.equal(sha256(keys.map(k => `${k}\n${preservation.files[k]}\n`).join('')), preservation.digest, 'the manifest digest covers exactly its listed files');
  assert.ok(keys.length > 600, `the frozen set is the whole study (${keys.length} files)`);
  for (const required of ['docs/delivery-benchmark.md', 'docs/trial-prd-v6.md', 'scripts/delivery-benchmark/lib.cjs', 'test/fixtures/delivery-benchmark/frozen.json', 'NOTES.md']) {
    assert.ok(keys.includes(required), `the frozen set includes ${required}`);
  }
  // The v7 edition is separate: nothing under the v7 path is in the v6 frozen set.
  for (const key of keys) assert.ok(!key.includes('v7'), `${key} is v6, not v7`);
  assert.match(flatProtocol, /V7 is a \*\*new edition with its own cohort identity\*\*/, 'the protocol states the separation');
  assert.match(flatProtocol, /There is no re-freeze-and-re-evaluate path in v7/, 'and closes the v6 re-freeze hole by name');
}

// --- The measured friction record exists and is honest about what it is not ---------
{
  assert.match(flatPilots, /\*\*This document delivers the friction record\. It does not deliver the pilots\.\*\*/, 'the pilots document does not pose as the pilots');
  assert.match(flatPilots, /S-07 and S-08 are therefore \*\*unchecked\*\*, and T-89 stays open/, 'and leaves the live scenarios open');
  assert.match(pilots, /^## 5\. What this does not establish$/m, 'with a section saying what it cannot show');
  // It cites measured numbers, and the two improvements are tied to them.
  assert.match(flatPilots, /\*\*35 runtime commands\*\*/, 'the command count is measured');
  assert.match(flatPilots, /\*\*8,224\*\*/, 'the fresh-session read cost is measured');
  assert.match(flatPilots, /809 bytes, 53 lines/, 'the map-authoring cost is measured');
  assert.match(pilots, /^## 3\. Design basis for T-90 and T-91$/m, 'the improvements are tied to the observations');
  assert.match(flatPilots, /At three scenarios the draft \(1,040 bytes\) is no smaller/, 'and the unfavourable measurement is reported too');
  // The harnesses it cites exist and are runnable.
  for (const rel of ['scripts/delivery-benchmark-v7/baseline-journey.cjs', 'scripts/delivery-benchmark-v7/scale-measure.cjs']) {
    assert.ok(pilots.includes(rel), `the record names ${rel}`);
    assert.ok(fs.existsSync(path.join(repo, rel)), `${rel} exists`);
  }
  // The reproduced defect is recorded with its fix ticket, and the original is retained.
  assert.match(flatPilots, /2\.4 A reproduced defect/, 'the defect is recorded');
  assert.match(flatPilots, /carried as a fix ticket, and the original run is retained/, 'with the original retained');
  const fix = read('tickets/T-97-mode-aware-revision-changed-remedy.md');
  assert.match(fix, /^ticket: T-97$/m);
  assert.match(fix, /docs\/prd-v7-pilots\.md/, 'the fix ticket links back to the observation');
  // And the defect really is fixed: the remedy is mode-aware in the runtime.
  const readiness = read('template/scripts/pincer-runtime/readiness.cjs');
  assert.match(readiness, /mode === 'changes' \? 'change revise, record its authorization, then verify' : 'register --rebind, then verify'/, 'the remedy is mode-aware');
}

// --- The measurement modules match what the protocol froze --------------------------
{
  assert.deepEqual(effort.ARMS, ['plain', 'pincer', 'strict'], 'three arms, in the protocol\'s order');
  assert.deepEqual(effort.STAGES, ['setup', 'authoring', 'verification', 'recovery', 'review']);
  assert.equal(effort.SCHEMA, 7, 'the v7 record schema is distinct from v6\'s schema 1');
  const v6 = require(path.join(repo, 'scripts/delivery-benchmark/record.cjs'));
  assert.notEqual(effort.SCHEMA, require(path.join(repo, 'scripts/delivery-benchmark/lib.cjs')).RECORD_SCHEMA, 'and cannot be mistaken for it');
  assert.equal(typeof v6.problems, 'function', 'the v6 validator is still here and still callable');
  // The cohort inputs are exactly the ones the protocol lists, in order.
  assert.deepEqual(freeze.compute.length, 2);
  const order = protocol.slice(protocol.indexOf('## 3.'), protocol.indexOf('## 4.'));
  for (const input of ['protocol digest', 'harness digest', 'brief digests', 'evaluator digests', 'effort-collector digest', 'live-driver digest', 'cap settings', 'configuration fingerprint']) {
    assert.ok(order.includes(input), `the protocol lists the ${input} as a cohort input`);
  }
  assert.match(order, /Changing \*\*any\*\* of these starts a new cohort/, 'and says any change starts a new cohort');
  // Configuration capture is an allowlist, and the protocol says what is never captured.
  const isolation = protocol.slice(protocol.indexOf('## 7.'), protocol.indexOf('## 8.'));
  assert.match(isolation, /Never captured: environment dumps, credential values, secret-value hashes/, 'secrets are never captured');
  for (const key of freeze.CONFIG_ALLOWLIST) assert.ok(isolation.includes(`\`${key}\``), `the protocol lists ${key} in the capture allowlist`);
}

console.log('improvement contract tests passed');
