// PRD v7 T-93 (R-07, S-19..S-21): the platform journey record, the cross-agent handoff
// and the support matrix.
//
// The substitution this suite exists to prevent is the easy one: reporting that a
// package installed and its checks passed as though a live journey had been observed
// on that surface. The record shape makes the two different things — `installed` and
// `observed` are separate support levels, an `observed` row must name the artifact and
// version that show it, and a row whose basis is packaged parity is refused outright
// as `observed`. A record mislabelled as a live observation fails the same way.
//
// The live journeys are outstanding. This suite asserts the repository says so.
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
const ref = (p = 'docs/prd-v7-artifacts/platforms/claude-code/session-1.json') => ({ kind: 'tracked', path: p, digest: HEX });
const codes = r => obs.problems(r).map(p => p.code);
const ok = (r, label) => assert.deepEqual(obs.problems(r), [], `${label}: ${JSON.stringify(obs.problems(r))}`);

function platform(over = {}) {
  const stages = {};
  for (const s of obs.STAGES) stages[s] = { state: 'observed', artifacts: [ref()] };
  return {
    schema: 1, kind: 'platform', id: 'platform-claude-code', recorded: '2026-09-21T10:00:00Z',
    status: 'complete', observed: true, fixture: false, surface: 'claude-code',
    provenance: { kit: HEX, kit_source: 'pincer-workflow@0.6.0 tarball', base: SHA, tool_version: 'claude-code 2.1.267', model: 'sonnet' },
    stages,
    handoff: { from: 'claude-code', to: 'codex', observed: true, conversational_recap: false, artifacts: [ref()], authorization_preserved: 'the resumed surface read A-01 from the change record and did not re-request it' },
    support: [
      { surface: 'claude-code', capability: 'full strict journey with revision, pause, recovery and schema 3 evaluation', support: 'observed', version: 'claude-code 2.1.267 / sonnet', evidence: [ref()] },
      { surface: 'codex', capability: 'full strict journey', support: 'observed', version: 'codex 1.4.0', evidence: [ref('docs/prd-v7-artifacts/platforms/codex/session-1.json')] },
      { surface: 'copilot', capability: 'full strict journey', support: 'unobserved', reason: 'no Copilot account available for this study' },
      { surface: 'plugin-only', capability: 'bootstrap of project artifacts from the plugin alone', support: 'installed', basis: 'the plugin installs and test/distribution.test.js checks its parity with the template' },
    ],
    ...over,
  };
}

// --- S-19: a full journey on each surface, with repairs retained --------------------
{
  ok(platform(), 'the complete fixture validates');

  for (const stage of obs.STAGES) {
    const missing = platform();
    delete missing.stages[stage];
    assert.ok(codes(missing).includes('STAGE_MISSING'), `a missing ${stage} stage is refused`);
  }
  // A repaired stage keeps what it repaired; a failed one keeps what failed.
  const repaired = platform();
  repaired.stages.adopt = { state: 'repaired', artifacts: [ref()], original_failure: 'the agent ran coverage adopt --apply before authoring the map and was refused COVERAGE_INVALID' };
  ok(repaired, 'a repaired stage validates with its original failure');
  const scrubbed = platform();
  scrubbed.stages.adopt = { state: 'repaired', artifacts: [ref()] };
  assert.ok(codes(scrubbed).includes('FAILURE_DISCARDED'), 'a repair that discarded its failure is refused');
  // A missing environment leaves the journey open rather than closing it.
  const unavailable = platform({ status: 'partial' });
  unavailable.stages.evaluate = { state: 'unavailable', reason: 'the Codex CLI is not installed on this host' };
  ok(unavailable, 'an unavailable stage is a legitimate partial record');
  const silent = platform({ status: 'partial' });
  silent.stages.evaluate = { state: 'unavailable' };
  assert.ok(codes(silent).includes('REASON_REQUIRED'), 'and must say why');
  // An unknown surface is not a surface.
  assert.ok(codes(platform({ surface: 'emacs' })).includes('RECORD_INVALID'), 'an unlisted surface is refused');
}

// --- S-20: the handoff recovers from files, not from a recap -------------------------
{
  // The thing being tested is recovery from files. A handoff that carried a
  // conversational recap tested something else and is refused as this record.
  const recap = platform();
  recap.handoff = { ...recap.handoff, conversational_recap: true };
  assert.ok(codes(recap).includes('HANDOFF_INVALID'), 'a handoff with a conversational recap is not the thing being tested');
  assert.match(obs.problems(recap).find(p => p.code === 'HANDOFF_INVALID').detail, /recover context from files/);
  const sameSurface = platform();
  sameSurface.handoff = { ...sameSurface.handoff, to: 'claude-code' };
  assert.ok(codes(sameSurface).includes('HANDOFF_INVALID'), 'a handoff to the same surface is not a handoff');
  const unevidenced = platform();
  unevidenced.handoff = { ...unevidenced.handoff, artifacts: [] };
  assert.ok(codes(unevidenced).includes('ARTIFACT_MISSING'), 'an observed handoff names its artifacts');
  // The existing authorization must survive the handoff, and the record says how.
  const lostAuth = platform();
  delete lostAuth.handoff.authorization_preserved;
  assert.ok(codes(lostAuth).includes('AUTHORIZATION_MISSING'), 'the handoff records how the existing authorization survived');
  // An unobserved handoff says what is missing.
  const pendingHandoff = platform({ status: 'partial' });
  pendingHandoff.handoff = { from: 'claude-code', to: 'codex', observed: false, conversational_recap: false, reason: 'the Codex CLI is not installed, so the second half of the handoff has not run' };
  ok(pendingHandoff, 'an unobserved handoff with its reason validates');
  const pendingSilent = platform({ status: 'partial' });
  pendingSilent.handoff = { from: 'claude-code', to: 'codex', observed: false, conversational_recap: false };
  assert.ok(codes(pendingSilent).includes('REASON_REQUIRED'), 'and without a reason is refused');
}

// --- S-21: installed is not observed, and packaged parity is never a live trial -----
{
  // The substitution, by name: a row whose basis is packaged parity cannot be observed.
  const substituted = platform();
  substituted.support = [...substituted.support];
  substituted.support[3] = { surface: 'plugin-only', capability: 'full strict journey', support: 'observed', version: '0.6.0', basis: 'packaged-parity', evidence: [ref()] };
  assert.ok(codes(substituted).includes('SUPPORT_SUBSTITUTED'), 'packaged parity cannot close a live criterion');
  assert.match(obs.problems(substituted).find(p => p.code === 'SUPPORT_SUBSTITUTED').detail, /an installation check, not a live observation/);

  // An observed row names its evidence and the version it was observed on.
  const noEvidence = platform();
  noEvidence.support = [{ ...noEvidence.support[0], evidence: [] }, ...noEvidence.support.slice(1)];
  assert.ok(codes(noEvidence).includes('SUPPORT_UNEVIDENCED'), 'an observed capability names the artifact that shows it');
  const noVersion = platform();
  noVersion.support = [{ surface: 'claude-code', capability: 'x', support: 'observed', evidence: [ref()] }, ...noVersion.support.slice(1)];
  assert.ok(codes(noVersion).includes('SUPPORT_UNEVIDENCED'), 'and the version it was observed on');
  // An installed row says what was installed and checked; an unobserved one says why.
  const vagueInstalled = platform();
  vagueInstalled.support = [...vagueInstalled.support.slice(0, 3), { surface: 'plugin-only', capability: 'x', support: 'installed' }];
  assert.ok(codes(vagueInstalled).includes('SUPPORT_INVALID'), 'an installed row says what was checked');
  const vagueUnobserved = platform();
  vagueUnobserved.support = [...vagueUnobserved.support.slice(0, 2), { surface: 'copilot', capability: 'x', support: 'unobserved' }, vagueUnobserved.support[3]];
  assert.ok(codes(vagueUnobserved).includes('SUPPORT_INVALID'), 'an unobserved row says why');
  // A record claiming a surface must have a row for it.
  const noRow = platform();
  noRow.support = noRow.support.slice(1);
  assert.ok(codes(noRow).includes('SUPPORT_INVALID'), 'the matrix has a row for the surface the record is about');
  // Unobserved combinations the PRD names are marked accurately, not omitted.
  assert.ok(obs.SURFACES.includes('copilot') && obs.SURFACES.includes('plugin-only'), 'Copilot and plugin-only are surfaces the matrix can mark');

  // A fixture relabelled as a live observation fails, the same as for a pilot.
  assert.ok(codes(platform({ fixture: true })).includes('FIXTURE_MISLABELLED'), 'a fixture cannot be relabelled as a live trial');
  assert.ok(codes(platform({ observed: false, status: 'complete' })).includes('NOT_OBSERVED'), 'an unobserved record cannot be complete');
}

// --- The repository records the platform journeys as outstanding --------------------
{
  const dir = path.join(repo, 'docs/prd-v7-artifacts/platforms');
  const records = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(read(`docs/prd-v7-artifacts/platforms/${f}`)))
    : [];
  assert.ok(records.length >= 2, `both required surfaces have records (${records.length})`);
  const surfaces = records.map(r => r.surface);
  assert.ok(surfaces.includes('claude-code') && surfaces.includes('codex'), 'Claude Code and Codex are the two required surfaces');
  for (const r of records) {
    assert.deepEqual(obs.problems(r), [], `${r.id} validates: ${JSON.stringify(obs.problems(r))}`);
    assert.equal(r.fixture, false, `${r.id} is not a fixture`);
    assert.equal(r.observed, false, `${r.id} has not been observed`);
    assert.equal(r.status, 'outstanding');
    // No row in an unobserved record may claim an observed capability.
    for (const row of r.support || []) {
      assert.notEqual(row.support, 'observed', `${r.id}: no capability is claimed observed before a session ran (${row.capability})`);
    }
  }
  const v = obs.verdict(records);
  assert.equal(v.code, 'RECORD_VALID');
  assert.equal(v.observed, 0, 'no platform journey has been observed');

  // The support matrix document separates the three levels and claims nothing more.
  const matrix = read('docs/prd-v7-platforms.md');
  assert.match(matrix, /^# PRD v7 platform support/m);
  assert.match(matrix, /\*\*observed\*\*/, 'the document defines the observed level');
  assert.match(matrix, /\*\*installed\*\*/, 'and the installed level');
  assert.match(matrix, /\*\*unobserved\*\*/, 'and the unobserved level');
  assert.match(matrix.replace(/\s+/g, ' '), /packaged parity .{0,80}never .{0,40}live/i, 'and says packaged parity is never a live trial');
  // Every row of the matrix proper carries a level the validator recognises. The
  // definitions table above it is prose, not claims.
  const table = matrix.slice(matrix.indexOf('## Matrix'), matrix.indexOf('## What each observed row'));
  const rows = table.split('\n').filter(l => /^\| /.test(l) && !/^\| ---/.test(l) && !/^\| Surface/.test(l));
  assert.ok(rows.length >= 6, `the matrix has rows (${rows.length})`);
  for (const row of rows) {
    const level = obs.SUPPORT.find(s => row.includes(`\`${s}\``));
    assert.ok(level, `every row names a support level: ${row.slice(0, 70)}`);
    // Nothing is claimed observed while the journeys are outstanding.
    assert.notEqual(level, 'observed', `no row claims an observed capability yet: ${row.slice(0, 70)}`);
  }
  assert.match(matrix, /T-93/, 'the document names the ticket that would fill it in');
}

console.log('platform trial record tests passed');
