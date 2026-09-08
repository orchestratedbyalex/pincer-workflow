// Candidate identity (R-04) and evidence integration (R-03) in status:
// a candidate plus a valid evidence-only commit is current; every other change
// after the candidate is stale with the reason named; legacy notes never grant
// readiness; the audit mutates nothing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tempDir, createTicket, createPrd, write, read, step, run, statusScript, writeEvidence, writeNotes } from './helpers.js';

const status = dir => run(dir, 'bash', [statusScript]).stdout;
const line = (dir, key) => status(dir).split('\n').find(l => l.startsWith(key)) || '';
function passes(result) { assert.equal(result.status, 0, result.stdout + result.stderr); return result.stdout; }
function git(dir, ...args) { return passes(run(dir, 'git', args)).trim(); }
function commit(dir, message, paths = ['.']) {
  git(dir, 'add', ...paths);
  git(dir, '-c', 'user.name=Pincer Test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}

// Build: base -> ticket work + PRD built (candidate) -> NOTES + evidence commit.
function evaluated({ commitEvidence = true, notesEvidence = true, patch } = {}) {
  const dir = tempDir(); git(dir, 'init', '-q');
  write(dir, 'base.txt', 'original\n');
  const base = commit(dir, 'base');
  createPrd(dir);
  const ticket = createTicket(dir, { command: 'test "$(cat source.txt)" = good' });
  write(dir, 'source.txt', 'good');
  passes(step(dir, 'verify')); passes(step(dir, 'done'));
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('ticketed', 'built'));
  const candidate = commit(dir, 'candidate');
  const evidence = writeEvidence(dir, { base, candidate, patch });
  writeNotes(dir, { base, candidate, evidence: notesEvidence ? evidence.manifest : undefined });
  if (commitEvidence) commit(dir, 'evaluate: PRD v1', ['NOTES.md', evidence.dir]);
  else commit(dir, 'notes only', ['NOTES.md']);
  return { dir, base, candidate, ticket, evidence };
}
const expectStale = (dir, pattern, label) => {
  const notes = line(dir, 'Notes');
  assert.match(notes, /stale/, `${label}: stale\n${status(dir)}`);
  assert.match(notes, pattern, `${label}: names the reason\n${notes}`);
  assert.match(line(dir, 'Next'), /pincer-evaluate/, `${label}: next is evaluate`);
};

// Current: candidate + evidence-only commit.
{
  const { dir, candidate, evidence } = evaluated();
  assert.match(line(dir, 'Notes'), new RegExp(`current \\(${candidate}\\)`), status(dir));
  assert.equal(line(dir, 'Evidence'), `Evidence ${evidence.manifest} · ok`);
  assert.match(line(dir, 'Next'), /pincer-release/);

  // The audit changes nothing: tracked content, untracked files, index.
  const before = { porcelain: git(dir, 'status', '--porcelain', '--untracked-files=all'), ticket: read(dir, 'tickets/T-01-example.md'), manifest: read(dir, evidence.manifest) };
  status(dir);
  assert.deepEqual({ porcelain: git(dir, 'status', '--porcelain', '--untracked-files=all'), ticket: read(dir, 'tickets/T-01-example.md'), manifest: read(dir, evidence.manifest) }, before, 'status is read-only');
}

// Stale: every other change class after the candidate, with the path named.
{
  const { dir } = evaluated();
  write(dir, 'source.txt', 'better'); commit(dir, 'tweak');
  expectStale(dir, /candidate changed after evaluation: source\.txt/, 'source change');
}
{
  const { dir } = evaluated();
  write(dir, '.prd/prd-v1.md', `${read(dir, '.prd/prd-v1.md')}\nMore scope.\n`); commit(dir, 'prd edit');
  expectStale(dir, /\.prd\/prd-v1\.md/, 'PRD change');
}
{
  const { dir, ticket } = evaluated();
  write(dir, ticket, `${read(dir, ticket)}\n## Context\nlater note\n`); commit(dir, 'ticket edit');
  expectStale(dir, /tickets\/T-01-example\.md/, 'ticket change');
}
{
  const { dir, evidence } = evaluated();
  write(dir, `${evidence.dir}/extra.txt`, 'unlisted'); commit(dir, 'unlisted evidence file');
  expectStale(dir, /extra\.txt/, 'unlisted file under the evidence directory');
}
{
  const { dir, base } = evaluated();
  const other = writeEvidence(dir, { base, candidate: 'f'.repeat(40) }); commit(dir, 'unrelated evaluation');
  expectStale(dir, new RegExp(other.dir.replace(/[./]/g, '\\$&')), 'unrelated evaluation directory');
}
{
  const { dir } = evaluated();
  write(dir, 'config.json', '{}'); commit(dir, 'config');
  expectStale(dir, /config\.json/, 'configuration change');
}

// Legacy notes without a manifest stay readable but never grant readiness.
{
  const { dir } = evaluated({ notesEvidence: false });
  expectStale(dir, /legacy evaluation without evidence manifest.*re-run \/pincer-evaluate/, 'legacy notes');
  assert.equal(line(dir, 'Evidence'), '', 'no evidence line without a manifest');
}

// Evidence problems surface through the shared validator.
{
  const { dir, evidence } = evaluated();
  write(dir, evidence.log, 'rewritten after evaluation'); commit(dir, 'tamper');
  expectStale(dir, /evidence invalid: .*digest mismatch/, 'tampered artifact');
  assert.match(line(dir, 'Evidence'), /digest mismatch/);
}
{
  const { dir, evidence } = evaluated();
  fs.rmSync(path.join(dir, evidence.log)); commit(dir, 'remove artifact');
  expectStale(dir, /evidence invalid: .*missing/, 'missing artifact');
}
{
  const { dir } = evaluated({ commitEvidence: false });
  expectStale(dir, /evidence not tracked/, 'untracked evidence');
}
{
  const { dir } = evaluated({ patch: m => ({ ...m, checks: [{ ...m.checks[0], result: 'unverified' }] }) });
  expectStale(dir, /evidence invalid: .*required check C-01 is unverified/, 'unverified required check');
}
{
  const { dir } = evaluated({ patch: m => ({ ...m, requirements: [{ ...m.requirements[0], disposition: 'blocked' }] }) });
  expectStale(dir, /evidence invalid: .*R-01 is blocked/, 'blocked requirement');
}
{
  const { dir, base, candidate, evidence } = evaluated();
  const other = writeEvidence(dir, { base, candidate: 'e'.repeat(40) });
  writeNotes(dir, { base, candidate, evidence: other.manifest });
  commit(dir, 'notes point at another candidate', ['NOTES.md', other.dir]);
  expectStale(dir, /evidence invalid: .*wrong candidate/, 'manifest for a different candidate');
  assert.ok(fs.existsSync(path.join(dir, evidence.manifest)), 'original manifest untouched');
}

// Working tree changes outside NOTES.md are still stale (M0 rule preserved).
{
  const { dir } = evaluated();
  write(dir, 'scratch.txt', 'wip');
  expectStale(dir, /working tree has changes outside NOTES\.md/, 'dirty working tree');
}

console.log('candidate identity and evidence integration tests passed');
