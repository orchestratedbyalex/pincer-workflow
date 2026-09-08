import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { repo, tempDir, createTicket, createPrd, write, read, step, run, statusScript, ticketScript, writeEvidence } from './helpers.js';

const status = dir => run(dir, 'bash', [statusScript]);
const next = dir => status(dir).stdout.split('\n').find(line => line.startsWith('Next')) || '';
function passes(result) { assert.equal(result.status, 0, result.stdout + result.stderr); return result.stdout; }
function complete(dir, id = 'T-01') { passes(step(dir, 'verify', id)); passes(step(dir, 'done', id)); }
function git(dir, ...args) { return passes(run(dir, 'git', args)).trim(); }
function commit(dir, message) {
  git(dir, 'add', '.');
  git(dir, '-c', 'user.name=Pincer Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}

for (const kind of ['missing', 'draft', 'version mismatch', 'duplicate status', 'unclosed', 'invalid reference', 'missing target']) {
  const dir = tempDir();
  if (kind !== 'missing') createPrd(dir, 1, kind === 'draft' ? 'draft' : 'ticketed');
  const file = createTicket(dir, { prd: kind === 'invalid reference' ? '../outside.md' : kind === 'missing target' ? '.prd/prd-v2.md' : '.prd/prd-v1.md' });
  if (kind === 'version mismatch') write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('version: 1', 'version: 2'));
  if (kind === 'duplicate status') write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('status: ticketed', 'status: ticketed\nstatus: built'));
  if (kind === 'unclosed') write(dir, '.prd/prd-v1.md', '---\nversion: 1\nstatus: ticketed\n# missing close\n');
  const original = read(dir, file);
  for (const action of ['start', 'verify']) {
    const result = step(dir, action);
    assert.notEqual(result.status, 0, `${kind}: ${action} must refuse`);
    assert.match(result.stderr, /PRD|prd/, `${kind}: explain the association failure`);
    assert.equal(read(dir, file), original, `${kind}: refusal must preserve ticket`);
  }
}

// Explicit refs are retained, including when the selected PRD is not the newest.
const explicit = tempDir(); createPrd(explicit); createPrd(explicit, 2, 'draft');
const explicitFile = createTicket(explicit);
passes(step(explicit, 'start'));
assert.match(read(explicit, explicitFile), /^prd: \.prd\/prd-v1\.md$/m);
write(explicit, '.prd/prd-v1.md', read(explicit, '.prd/prd-v1.md').replace('ticketed', 'draft'));
for (const action of ['start', 'verify']) assert.notEqual(step(explicit, action).status, 0, 'resume cannot bypass changed PRD state');

const legacy = tempDir(); createPrd(legacy);
const legacyFile = createTicket(legacy);
write(legacy, legacyFile, read(legacy, legacyFile).replace(/^prd:.*\n/m, ''));
const unbound = read(legacy, legacyFile);
status(legacy);
assert.equal(read(legacy, legacyFile), unbound, 'status is read-only');
passes(step(legacy, 'start'));
assert.match(read(legacy, legacyFile), /^prd: \.prd\/prd-v1\.md$/m, 'unambiguous legacy start records association');

const ambiguous = tempDir(); createPrd(ambiguous); createPrd(ambiguous, 2);
const ambiguousFile = createTicket(ambiguous);
write(ambiguous, ambiguousFile, read(ambiguous, ambiguousFile).replace(/^prd:.*\n/m, ''));
assert.notEqual(step(ambiguous, 'start').status, 0);
assert.match(status(ambiguous).stdout, /ambiguous|bind/i);
passes(run(ambiguous, 'bash', [ticketScript, 'bind', 'T-01', '.prd/prd-v1.md']));
passes(step(ambiguous, 'start'));
assert.notEqual(run(ambiguous, 'bash', [ticketScript, 'bind', 'T-01', '.prd/prd-v2.md']).status, 0, 'bind cannot silently reassign an existing ticket');

const crossPrd = tempDir(); createPrd(crossPrd); createPrd(crossPrd, 2);
createTicket(crossPrd); complete(crossPrd);
createTicket(crossPrd, { id: 'T-02', deps: 'T-01', prd: '.prd/prd-v2.md' });
assert.match(status(crossPrd).stdout, /T-02 +open +S +blocked by T-01/, 'cross-PRD dependency is not advertised as ready');
assert.doesNotMatch(next(crossPrd), /next ready ticket: T-02/);
assert.match(step(crossPrd, 'start', 'T-02').stderr, /dependency T-01 references/, 'dependencies cannot silently cross PRDs');

const revision = tempDir(); createPrd(revision); createTicket(revision); complete(revision);
write(revision, 'NOTES.md', '# Old evaluation\n');
createPrd(revision, 2, 'draft');
assert.match(next(revision), /pincer-narrow/);
assert.doesNotMatch(next(revision), /pincer-release/);
createPrd(revision, 9, 'draft'); createPrd(revision, 10, 'draft');
assert.match(status(revision).stdout, /PRD +\.prd\/prd-v10\.md/);
write(revision, '.prd/prd-v10.md', read(revision, '.prd/prd-v10.md').replace('status: draft', 'status: nonsense'));
assert.doesNotMatch(next(revision), /pincer-release/);
assert.match(status(revision).stdout, /invalid|unsupported|repair/i, 'malformed newest PRD cannot fall back');

// A real candidate and a NOTES-only descendant are both valid evaluation identities.
const evaluated = tempDir(); git(evaluated, 'init', '-q');
write(evaluated, 'base.txt', 'original\n');
const base = commit(evaluated, 'base');
createPrd(evaluated); const evaluatedFile = createTicket(evaluated, { command: 'test "$(cat source.txt)" = good' });
write(evaluated, 'source.txt', 'good'); complete(evaluated);
write(evaluated, '.prd/prd-v1.md', read(evaluated, '.prd/prd-v1.md').replace('ticketed', 'built'));
const candidate = commit(evaluated, 'candidate');
const evidence = writeEvidence(evaluated, { base, candidate });
const notes = `---\nprd: .prd/prd-v1.md\nbase: ${base}\ncandidate: ${candidate}\nevidence: ${evidence.manifest}\n---\n# Evaluation\nReviewed candidate.\n`;
assert.match(next(evaluated), /pincer-evaluate/);
const legacyNotes = notes.replace(/^evidence:.*\n/m, '');
for (const invalidNotes of ['# legacy notes\n', legacyNotes, notes.replace('prd-v1', 'prd-v2'), notes.replace(candidate, '0'.repeat(40)), notes.replace(candidate, base)]) {
  write(evaluated, 'NOTES.md', invalidNotes);
  assert.match(next(evaluated), /pincer-evaluate/, 'unbound/legacy/wrong/stale notes must be reevaluated');
}
write(evaluated, 'NOTES.md', notes);
assert.match(next(evaluated), /pincer-evaluate/, 'evidence must be tracked before the candidate is release-ready');
commit(evaluated, 'evaluation notes and evidence');
assert.match(next(evaluated), /pincer-release/, 'committing NOTES with its listed evidence must not invalidate itself');
const beforeStatus = read(evaluated, evaluatedFile);
status(evaluated);
assert.equal(read(evaluated, evaluatedFile), beforeStatus);
write(evaluated, evaluatedFile, beforeStatus.replace(/^last_check:.*\n/m, ''));
assert.match(next(evaluated), /verify|recheck/i, 'done ticket without a latest check cannot be release-ready');
write(evaluated, evaluatedFile, beforeStatus.replace('- [x]', '- [ ]'));
assert.match(next(evaluated), /verify|recheck|acceptance/i, 'unchecked done ticket cannot be release-ready');
write(evaluated, evaluatedFile, beforeStatus.replace('test "$(cat source.txt)" = good', 'true'));
assert.match(next(evaluated), /verify|recheck/i, 'changed check invalidates the receipt in status');
write(evaluated, evaluatedFile, beforeStatus);

write(evaluated, 'new-source.txt', 'untracked\n');
assert.match(next(evaluated), /pincer-evaluate/, 'untracked source invalidates evaluation');
fs.unlinkSync(path.join(evaluated, 'new-source.txt'));
write(evaluated, 'source.txt', 'bad');
assert.match(next(evaluated), /pincer-evaluate/, 'dirty source invalidates evaluation');
git(evaluated, 'add', 'source.txt');
assert.match(next(evaluated), /pincer-evaluate/, 'staged source invalidates evaluation');
assert.notEqual(step(evaluated, 'verify').status, 0);
assert.match(next(evaluated), /verify|recheck/i, 'failed completed-ticket check outranks notes');
assert.doesNotMatch(next(evaluated), /pincer-release/);
write(evaluated, 'source.txt', 'good'); complete(evaluated);
commit(evaluated, 'new candidate');
assert.match(next(evaluated), /pincer-evaluate/, 'new source/ticket commit invalidates old candidate');

const noGit = tempDir(); createPrd(noGit, 1, 'built'); createTicket(noGit); complete(noGit);
write(noGit, 'NOTES.md', notes);
assert.doesNotMatch(next(noGit), /pincer-release/, 'unresolvable candidate cannot be release-ready');

// R-06: each readiness problem is reported once, distinct problems are all kept,
// and the wall-clock elapsed line appears only for active work or an explicit budget.
{
  const dir = tempDir(); createPrd(dir);
  createTicket(dir); complete(dir);
  createTicket(dir, { id: 'T-02' }); complete(dir, 'T-02');
  write(dir, 'tickets/T-01-example.md', read(dir, 'tickets/T-01-example.md').replace(/^last_check: (\S+) passed/m, 'last_check: $1 failed'));
  write(dir, 'tickets/T-02-example.md', read(dir, 'tickets/T-02-example.md').replace(/^verified:.*\n/m, ''));
  const out = status(dir).stdout;
  const warnings = out.split('\n').filter(l => /WARN/.test(l));
  assert.equal(warnings.length, 2, `one warning per distinct problem\n${out}`);
  assert.match(warnings[0], /T-01 latest verification: .* failed .* re-run verify/);
  assert.match(warnings[1], /T-02 done without a verification receipt/);
  assert.doesNotMatch(out, /^Build /m, 'finished work shows no elapsed line');
  const budgeted = run(dir, 'bash', [statusScript], { env: { ...process.env, CLAUDE_PROJECT_DIR: dir, PINCER_BUILD_BUDGET_MIN: '90' } }).stdout;
  assert.match(budgeted, /^Build +wall-clock elapsed \d+m .*budget 90m/m, 'explicit budget shows elapsed against it');
  createTicket(dir, { id: 'T-03' }); passes(step(dir, 'start', 'T-03'));
  assert.match(status(dir).stdout, /^Build +wall-clock elapsed \d+m since the first ticket started \(not active execution time\)/m);
}

// Raw ticket restores stay blocked after a failed recheck: restoring HEAD would
// erase the recorded failure and revive the old passing receipt.
{
  const dir = tempDir(); git(dir, 'init', '-q'); createPrd(dir);
  const file = createTicket(dir, { command: 'test "$(cat source.txt)" = good' });
  write(dir, 'source.txt', 'good'); complete(dir); commit(dir, 'T-01 done');
  write(dir, 'source.txt', 'bad');
  const failed = step(dir, 'verify');
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /failure recorded in last_check/);
  assert.match(failed.stderr, /prior successful receipt was revoked/);
  assert.match(read(dir, file), /^last_check: .* failed /m);
  const guard = path.join(repo, 'template/.claude/hooks/ticket-guard.sh');
  const payload = command => run(dir, 'bash', [guard], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }) });
  for (const command of [
    `git checkout -- ${file}`, `git checkout HEAD ${file}`, `git restore ${file}`, `git restore --source=HEAD ${file}`, `git checkout -- tickets/T-01-example.md source.txt`,
    'git checkout -- .', 'git checkout .', 'git restore .', 'git restore --source=HEAD :/', 'git checkout main -- tickets/', 'git restore --staged --worktree tickets',
    'git reset --hard', 'git reset --hard HEAD~1', 'git reset --merge', 'git stash', 'git stash push', 'git stash pop', 'git clean -fd',
  ]) {
    const result = payload(command);
    assert.equal(result.status, 2, `guard blocks ticket restore: ${command}`);
    assert.match(result.stderr, /pincer-ticket\.sh/, 'block names the lifecycle script');
  }
  for (const command of ['git checkout main', 'git checkout -b fix/thing', 'git restore source.txt', 'git reset --soft HEAD~1', 'git stash list', 'git stash show -p', 'git clean -n', 'git clean -f build/']) {
    assert.equal(payload(command).status, 0, `guard allows: ${command}`);
  }
  assert.match(read(dir, file), /^last_check: .* failed /m, 'failed attempt preserved');
  assert.match(status(dir).stdout, /WARN T-01 latest verification: .* failed .* re-run verify/);
  assert.doesNotMatch(next(dir), /pincer-release/);
}
console.log('PRD recovery tests passed');
