// PRD v7 T-89 (R-03, S-07..S-09): the baseline pilot record and its validator.
//
// The thing this suite must not do is make a passing validator look like an
// observation. So every assertion here is about record *properties*, and the fixtures
// include the exact forgeries the ticket names: a record with a stage simply missing, a
// synthetic record relabelled as live, a candidate reference that is not a commit, a
// repaired stage whose original failure has been deleted, and a revision authorized by
// a generic "continue". Each must fail, by code.
//
// The live pilots themselves are outstanding (docs/prd-v7-pilots.md, section 5). This
// suite asserts that the repository records them as outstanding rather than asserting
// they happened — a validator that passed on an empty study would be the failure.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo } from './helpers.js';

const require = createRequire(import.meta.url);
const obs = require(path.join(repo, 'scripts/delivery-benchmark-v7/observations.cjs'));
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8');

const SHA = 'b'.repeat(40);
const HEX = 'a'.repeat(64);
const ref = (p = 'docs/prd-v7-artifacts/pilots/baseline/greenfield/session-1.json') => ({ kind: 'tracked', path: p, digest: HEX });
const codes = r => obs.problems(r).map(p => p.code);
const ok = (r, label) => assert.deepEqual(obs.problems(r), [], `${label}: ${JSON.stringify(obs.problems(r))}`);

// An observed pilot with every stage accounted for. Each case below breaks one thing.
function pilot(over = {}) {
  const stages = {};
  for (const s of obs.STAGES) stages[s] = { state: 'observed', artifacts: [ref()] };
  return {
    schema: 1, kind: 'pilot', id: 'pilot-greenfield-1', recorded: '2026-09-20T10:00:00Z',
    status: 'complete', observed: true, fixture: false,
    project: 'greenfield-alpha', project_kind: 'greenfield', preexisting_edits: false,
    provenance: { kit: HEX, kit_source: 'pincer-workflow@0.6.0 tarball', base: SHA, tool_version: 'claude-code 2.1.267', model: 'sonnet' },
    stages,
    revision_authorization: { agreement: HEX, reference: 'chat message 2026-09-20T11:04Z', excerpt: 'yes, add the export format too', generic_continue: false },
    candidate: { commit: SHA, evidence_schema: 3, artifacts: [ref('docs/prd-v7-artifacts/pilots/baseline/greenfield/manifest.json')] },
    interventions: [],
    ...over,
  };
}

// --- S-07: a full journey, its authorization and its preserved unrelated work -------
{
  ok(pilot(), 'the complete fixture validates');

  // Every stage must be accounted for. A stage that did not happen is outstanding with
  // a reason; a stage that is simply absent is the omission this refuses.
  for (const stage of obs.STAGES) {
    const missing = pilot();
    delete missing.stages[stage];
    assert.ok(codes(missing).includes('STAGE_MISSING'), `a missing ${stage} stage is refused`);
    assert.match(obs.problems(missing).find(p => p.code === 'STAGE_MISSING').detail, new RegExp(stage));
  }
  const unknownStage = pilot();
  unknownStage.stages.publish = { state: 'observed', artifacts: [ref()] };
  assert.ok(codes(unknownStage).includes('RECORD_INVALID'), 'an invented stage is refused');

  // An observed stage points at something a reviewer can open.
  const unevidenced = pilot();
  unevidenced.stages.adopt = { state: 'observed', artifacts: [] };
  assert.ok(codes(unevidenced).includes('ARTIFACT_MISSING'), 'an observed stage with no artifact is refused');
  const badRef = pilot();
  badRef.stages.adopt = { state: 'observed', artifacts: [{ kind: 'tracked', path: '../outside/session.json' }] };
  assert.ok(codes(badRef).includes('REFERENCE_INVALID'), 'an escaping artifact path is refused');
  const absoluteRef = pilot();
  absoluteRef.stages.adopt = { state: 'observed', artifacts: [{ kind: 'tracked', path: '/etc/passwd' }] };
  assert.ok(codes(absoluteRef).includes('REFERENCE_INVALID'), 'an absolute artifact path is refused');
  // A private capture is allowed, but must say where it is and why it is not committed.
  const privateOk = pilot();
  privateOk.stages.adopt = { state: 'observed', artifacts: [{ kind: 'private', path: '~/captures/pilot-1/session-1.jsonl', reason: 'raw transcript carries private project content and stays outside the tree' }] };
  ok(privateOk, 'a named private capture is a valid reference');
  const privateSilent = pilot();
  privateSilent.stages.adopt = { state: 'observed', artifacts: [{ kind: 'private', path: '~/captures/x' }] };
  assert.ok(codes(privateSilent).includes('REFERENCE_INVALID'), 'a private capture without a reason is refused');

  // The revised scope needs its own authorization, and a generic continue is not one.
  const generic = pilot();
  generic.revision_authorization = { agreement: HEX, reference: 'chat', excerpt: 'continue', generic_continue: true };
  assert.ok(codes(generic).includes('AUTHORIZATION_GENERIC'), 'a generic continue authorizes no revised scope');
  assert.match(obs.problems(generic).find(p => p.code === 'AUTHORIZATION_GENERIC').detail, /this revision has no authorization/);
  const noAuth = pilot({ revision_authorization: undefined });
  assert.ok(codes(noAuth).includes('AUTHORIZATION_MISSING'), 'an observed revision without an authorization is refused');
  const noAgreement = pilot();
  delete noAgreement.revision_authorization.agreement;
  assert.ok(codes(noAgreement).includes('AUTHORIZATION_MISSING'), 'the authorization must name the agreement it covered');

  // A brownfield pilot with pre-existing edits records their preservation.
  const brownfield = pilot({ project_kind: 'brownfield', project: 'brownfield-beta', preexisting_edits: true });
  assert.ok(codes(brownfield).includes('PRESERVATION_MISSING'), 'unrelated work surviving is a claim that needs a check');
  brownfield.preservation = { paths: ['src/local-notes.md', 'config/local.json'], verified: true, evidence: [ref('docs/prd-v7-artifacts/pilots/baseline/brownfield/preservation.log')] };
  ok(brownfield, 'a recorded, verified preservation completes it');
  const unverified = pilot({ project_kind: 'brownfield', preexisting_edits: true, preservation: { paths: ['src/x'], verified: false } });
  assert.ok(codes(unverified).includes('PRESERVATION_MISSING'), 'an unverified preservation claim is refused');

  // The candidate and its schema 3 evidence.
  const notACommit = pilot();
  notACommit.candidate = { ...notACommit.candidate, commit: 'HEAD' };
  assert.ok(codes(notACommit).includes('CANDIDATE_INVALID'), 'a candidate that is not a commit id is refused');
  const wrongSchema = pilot();
  wrongSchema.candidate = { ...wrongSchema.candidate, evidence_schema: 1 };
  assert.ok(codes(wrongSchema).includes('CANDIDATE_INVALID'), 'a strict pilot produces schema 3 evidence');
  const noCandidate = pilot({ candidate: undefined });
  assert.ok(codes(noCandidate).includes('CANDIDATE_MISSING'), 'an observed evaluation names its candidate');
}

// --- S-08: failures and repairs stay visible; unavailable stages cannot close --------
{
  // A failed stage is a legitimate record and keeps what failed.
  const failed = pilot();
  failed.status = 'partial';
  failed.stages.recover = { state: 'failed', artifacts: [ref()], detail: 'the fresh session selected the wrong change and ran verify against it' };
  ok(failed, 'a failed stage is retained, not hidden');
  const silentFailure = pilot({ status: 'partial' });
  silentFailure.stages.recover = { state: 'failed', artifacts: [ref()] };
  assert.ok(codes(silentFailure).includes('STAGE_INVALID'), 'a failed stage must say what failed');

  // A repaired stage keeps the original failure. Deleting it would turn a journey that
  // went wrong into one that never did — the exact rewrite this refuses.
  const repaired = pilot();
  repaired.stages.recover = { state: 'repaired', artifacts: [ref()], original_failure: 'first attempt selected the wrong change; corrected by change select and re-run' };
  ok(repaired, 'a repaired stage with its original failure validates');
  const scrubbed = pilot();
  scrubbed.stages.recover = { state: 'repaired', artifacts: [ref()] };
  assert.ok(codes(scrubbed).includes('FAILURE_DISCARDED'), 'a repaired stage that discarded its failure is refused');

  // An outstanding or unavailable stage keeps the pilot from being complete.
  const outstanding = pilot();
  outstanding.stages.evaluate = { state: 'outstanding', reason: 'no spending decision, so the evaluation session has not run' };
  assert.ok(codes(outstanding).includes('STAGE_OUTSTANDING'), 'a complete pilot cannot have an unobserved stage');
  assert.match(obs.problems(outstanding).find(p => p.code === 'STAGE_OUTSTANDING').detail, /evaluate/);
  outstanding.status = 'partial';
  delete outstanding.candidate;
  ok(outstanding, 'the same record is valid as partial');
  const silentOutstanding = pilot({ status: 'partial' });
  silentOutstanding.stages.evaluate = { state: 'outstanding' };
  assert.ok(codes(silentOutstanding).includes('REASON_REQUIRED'), 'an outstanding stage says why');

  // The two rules that stop this suite from becoming evidence.
  const relabelled = pilot({ fixture: true });
  assert.ok(codes(relabelled).includes('FIXTURE_MISLABELLED'), 'a fixture cannot be relabelled as a live observation');
  assert.match(obs.problems(relabelled).find(p => p.code === 'FIXTURE_MISLABELLED').detail, /a synthetic record is never live evidence, however it is labelled/);
  const unobservedComplete = pilot({ observed: false, status: 'complete' });
  assert.ok(codes(unobservedComplete).includes('NOT_OBSERVED'), 'a record no session produced cannot be complete');
  assert.match(obs.problems(unobservedComplete).find(p => p.code === 'NOT_OBSERVED').detail, /record validation is not observation/);
  const unobserved = pilot({ observed: false, status: 'outstanding', outstanding_reason: 'the three projects are not selected and no spending cap has been set' });
  ok(unobserved, 'an honestly outstanding record validates');
  const unobservedSilent = pilot({ observed: false, status: 'outstanding' });
  assert.ok(codes(unobservedSilent).includes('REASON_REQUIRED'), 'and must say what is missing');

  // Provenance is required of anything claiming to be observed.
  for (const key of ['kit', 'kit_source', 'base', 'tool_version', 'model']) {
    const missing = pilot();
    delete missing.provenance[key];
    assert.ok(codes(missing).includes('PROVENANCE_MISSING'), `an observed pilot records provenance.${key}`);
  }

  // The verdict never claims more than it can.
  const v = obs.verdict([pilot(), unobserved]);
  assert.equal(v.code, 'RECORD_VALID');
  assert.equal(v.observed, 1);
  assert.equal(v.outstanding, 1);
  assert.match(v.note, /does not establish that a session happened/);
  assert.ok(!/\bOBSERVED\b/.test(v.code), 'the verdict vocabulary never says "observed"');
  const bad = obs.verdict([pilot({ fixture: true })]);
  assert.equal(bad.code, 'RECORD_INVALID');
  assert.equal(bad.invalid.length, 1);
}

// --- S-09: the friction record exists, is cited, and does not pose as the pilots ----
{
  const pilots = read('docs/prd-v7-pilots.md');
  // It ranks friction by measured events and ties both improvements to them.
  assert.match(pilots, /^## 2\. Measured baseline$/m);
  assert.match(pilots, /^## 3\. Design basis for T-90 and T-91$/m);
  assert.match(pilots, /^## 4\. What is designed against what was measured$/m);
  // Every row of the design table points at a numbered observation.
  const designTable = pilots.slice(pilots.indexOf('## 4.'), pilots.indexOf('## 5.'));
  const rows = designTable.split('\n').filter(l => /^\| §|^\| \*/.test(l));
  assert.ok(rows.length >= 5, `the design table cites observations (${rows.length} rows)`);
  for (const row of rows) assert.match(row, /§\d\.\d/, `each design row cites a measured observation: ${row.slice(0, 60)}`);
  // The measurement harnesses it cites exist and run.
  for (const rel of ['scripts/delivery-benchmark-v7/baseline-journey.cjs', 'scripts/delivery-benchmark-v7/scale-measure.cjs']) {
    assert.ok(fs.existsSync(path.join(repo, rel)), `${rel} exists`);
    assert.match(read(rel), /^'use strict';/, `${rel} is a runnable module`);
  }
  // It is explicit that it is not the pilots, and leaves S-07/S-08 unchecked.
  assert.match(pilots, /It does not deliver the pilots/);
  assert.match(pilots, /S-07 and S-08 are therefore \*\*unchecked\*\*, and T-89 stays open/);
  assert.match(pilots, /An operator walking the commands cannot show any of what those pilots exist to find/);
  // And it reports its unfavourable measurement rather than only the flattering one.
  assert.match(pilots, /At three scenarios the draft \(1,040 bytes\) is no smaller/);

  // The repository records the pilots as outstanding. A validator that passed over an
  // empty study while the ticket claimed completion is exactly the failure S-08 names.
  const dir = path.join(repo, 'docs/prd-v7-artifacts/pilots/baseline');
  const records = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(read(`docs/prd-v7-artifacts/pilots/baseline/${f}`))) : [];
  assert.ok(records.length >= 3, `the three pilots have records (${records.length})`);
  for (const r of records) {
    assert.deepEqual(obs.problems(r), [], `${r.id} validates: ${JSON.stringify(obs.problems(r))}`);
    assert.equal(r.fixture, false, `${r.id} is not a fixture`);
    // Each is honestly outstanding until a real session produces it.
    assert.equal(r.observed, false, `${r.id} has not been observed`);
    assert.equal(r.status, 'outstanding');
    assert.ok(r.outstanding_reason.length > 20, `${r.id} says what is missing`);
  }
  const kinds = records.map(r => r.project_kind);
  assert.equal(kinds.filter(k => k === 'greenfield').length, 1, 'one greenfield project');
  assert.equal(kinds.filter(k => k === 'brownfield').length, 2, 'two brownfield projects');
  assert.ok(records.some(r => r.preexisting_edits === true), 'at least one brownfield project carries pre-existing user edits');
  const v = obs.verdict(records);
  assert.equal(v.code, 'RECORD_VALID');
  assert.equal(v.observed, 0, 'nothing is observed yet');
  assert.equal(v.outstanding, 3);
}

console.log('strict pilot record tests passed');
