// Selection (PRD v5 R-02; T-50): the selected change is a worktree-local pointer
// written only by `change select`; selecting preserves HEAD, the index, tracked
// and untracked edits byte for byte; a fresh clone or a dangling pointer never
// falls back to another record; --change inspects without selecting; linked
// worktrees keep independent selections and attempt stores; an incompatible
// repository view is diagnosed with HEAD, base, branch and dirty paths.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, createTicket, createPrd, write, read, run, bindV050, statusScript } from './helpers.js';

const require = createRequire(import.meta.url);
const changes = require(path.join(repo, 'template/scripts/pincer-runtime/changes.cjs'));
const state = require(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args]);
function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function refuses(result, status, pattern, label = '') { assert.equal(result.status, status, `${label}: exit ${status}\n${result.stdout}${result.stderr}`); assert.match(result.stdout + result.stderr, pattern, label); return result; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message) {
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=Pincer Test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '--allow-empty', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}
const SELECTION = '.pincer/runtime/selection.json';
const selectionOf = dir => JSON.parse(read(dir, SELECTION));
const statusJson = (dir, ...args) => { const r = rt(dir, 'status', '--json', ...args); return { status: r.status, json: JSON.parse(r.stdout), stderr: r.stderr }; };
// Everything git and the working tree know, apart from the ignored .pincer/ state.
function gitView(dir) {
  return {
    head: git(dir, 'rev-parse', 'HEAD'),
    status: git(dir, 'status', '--porcelain', '--untracked-files=all'),
    staged: git(dir, 'diff', '--cached'),
    unstaged: git(dir, 'diff'),
    files: fs.readdirSync(dir, { recursive: true }).filter(f => !f.startsWith('.git') && !f.startsWith('.pincer')).sort().map(f => [f, fs.statSync(path.join(dir, f)).isFile() ? fs.readFileSync(path.join(dir, f), 'utf8') : null]),
  };
}
function fixture() {
  const dir = tempDir(); git(dir, 'init', '-q');
  createPrd(dir, 1); createPrd(dir, 2);
  createTicket(dir, { id: 'T-01', prd: '.prd/prd-v1.md' }); createTicket(dir, { id: 'T-02', prd: '.prd/prd-v2.md' });
  write(dir, 'src/app.js', 'module.exports = 1;\n'); write(dir, 'README.md', '# app\n');
  commit(dir, 'base');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'), 'register A');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v2.md', '--change', 'feature-b'), 'register B');
  commit(dir, 'register A and B');
  return dir;
}

// S-04: selecting with staged, unstaged and untracked edits changes only the local pointer.
{
  const dir = fixture();
  write(dir, 'src/app.js', 'module.exports = 2;\n'); git(dir, 'add', 'src/app.js');
  write(dir, 'src/app.js', 'module.exports = 3;\n');
  write(dir, 'README.md', '# app\nunstaged edit\n');
  write(dir, 'notes.txt', 'untracked scratch\n');
  write(dir, 'tickets/T-02-example.md', read(dir, 'tickets/T-02-example.md').replace('## Objective\nExample', '## Objective\nExample — edited while B is not selected'));
  const before = gitView(dir);
  assert.match(before.status, /^MM src\/app\.js$/m); assert.match(before.status, /^\?\? notes\.txt$/m);
  const out = rt(dir, 'change', 'select', 'prd-v1');
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^selected change prd-v1 → \.prd\/prd-v1\.md · planned \(\.pincer\/runtime\/selection\.json, local to this worktree\)$/m);
  assert.match(out.stderr, /selection is metadata only — no checkout, stash, reset or commit was made, and selecting grants no authorization/);
  assert.deepEqual(gitView(dir), before, 'HEAD, index, tracked and untracked files are byte for byte unchanged');
  const sel = selectionOf(dir);
  assert.deepEqual(Object.keys(sel), ['schema', 'change', 'selected']); assert.equal(sel.change, 'prd-v1');
  assert.equal(git(dir, 'status', '--porcelain', '--untracked-files=all', '--ignored=no').split('\n').filter(l => /\.pincer/.test(l)).length, 0, 'the pointer is ignored, not an untracked change');
  // Idempotent: selecting the selected change writes nothing.
  const text = read(dir, SELECTION);
  const again = rt(dir, 'change', 'select', 'prd-v1');
  assert.equal(again.status, 0); assert.match(again.stdout, /^already selected change prd-v1/);
  assert.equal(read(dir, SELECTION), text, 'no rewrite');
  // Status now reports A: its PRD, its tickets; B's ticket is history; planned routes to activate.
  const s = statusJson(dir);
  assert.equal(s.status, 0);
  assert.equal(s.json.schema, 2); assert.equal(s.json.mode, 'changes');
  assert.deepEqual(s.json.selection, { change: 'prd-v1', problem: null });
  assert.equal(s.json.change.id, 'prd-v1'); assert.equal(s.json.change.lifecycle.state, 'planned');
  assert.equal(s.json.change.view.head, before.head); assert.equal(s.json.change.view.base_is_ancestor, true);
  assert.deepEqual(s.json.change.view.dirty.sort(), ['README.md', 'notes.txt', 'src/app.js', 'tickets/T-02-example.md']);
  assert.deepEqual(s.json.tickets.map(t => t.id), ['T-01']); assert.equal(s.json.history, 1);
  assert.deepEqual(s.json.changes.map(c => [c.id, c.selected]), [['feature-b', false], ['prd-v1', true]]);
  assert.match(s.json.next, /^node scripts\/pincer-runtime\.cjs change activate prd-v1 — activate the change before executing tickets/);
  const human = passes(run(dir, 'bash', [statusScript]));
  assert.match(human, /^Runtime  changes · selected prd-v1 · planned · base [0-9a-f]{7}$/m);
  assert.match(human, /^Changes  2 retained: feature-b \(planned\), prd-v1 \(planned, selected\)$/m);
  const viewLine = human.split('\n').find(l => l.startsWith('View     '));
  assert.match(viewLine, /^View     HEAD [0-9a-f]{7} · branch (main|master) · base is an ancestor · dirty 4 path\(s\): /);
  for (const p of ['README.md', 'notes.txt', 'src/app.js', 'tickets/T-02-example.md']) assert.ok(viewLine.includes(p), `${p} listed as dirty`);
  assert.match(human, /^History  1 ticket\(s\) associated with other PRDs$/m);
  assert.match(human, /^  T-01  open         S  ready$/m);
  // Inspecting B explicitly changes nothing about the selection.
  const b = statusJson(dir, '--change', 'feature-b');
  assert.equal(b.status, 0);
  assert.equal(b.json.change.id, 'feature-b'); assert.deepEqual(b.json.tickets.map(t => t.id), ['T-02']);
  assert.deepEqual(b.json.selection, { change: 'prd-v1', problem: null }, 'the selection still names A');
  assert.equal(selectionOf(dir).change, 'prd-v1');
  assert.match(passes(rt(dir, 'status', '--change', 'feature-b')), /^Runtime  changes · inspecting feature-b · planned/m);
  assert.match(passes(rt(dir, 'change', 'list')), /^\* prd-v1 {11}planned/m);
  assert.equal(JSON.parse(passes(rt(dir, 'change', 'show', 'prd-v1', '--json'))).selected, true);
  assert.equal(JSON.parse(passes(rt(dir, 'change', 'show', 'feature-b', '--json'))).selected, false);
  refuses(rt(dir, 'status', '--change', 'nope'), 4, /change record \.prd\/changes\/nope\.json does not exist \(retained: feature-b, prd-v1\)/);
  assert.deepEqual(gitView(dir), before, 'inspection changed nothing either');
  // Switching the selection to B replaces the pointer and reports the previous one.
  assert.match(passes(rt(dir, 'change', 'select', 'feature-b')), /previously prd-v1\)/);
  assert.equal(selectionOf(dir).change, 'feature-b');
  assert.deepEqual(gitView(dir), before);
  // Ticket ownership resolves through the PRD, for the gates that T-54 wires.
  const loaded = changes.loadRecords(dir);
  const t1 = changes.ticketOwner(dir, loaded, 'tickets/T-01-example.md', { ticket: 'T-01', prd: '.prd/prd-v1.md' });
  assert.equal(t1.id, 'prd-v1');
  assert.equal(changes.ticketOwner(dir, loaded, 'tickets/T-02-example.md', { ticket: 'T-02', prd: '.prd/prd-v2.md' }).id, 'feature-b');
  createPrd(dir, 3);
  assert.match(changes.ticketOwner(dir, loaded, 'tickets/T-03-x.md', { ticket: 'T-03', prd: '.prd/prd-v3.md' }).problem, /no change record owns — register it with/);
}

// S-05: a fresh clone requests selection even with a single record; a missing or
// deleted selected record is diagnosed without fallback; a corrupt pointer is
// malformed; select refuses unknown records; --change on other modes is refused.
{
  const dir = tempDir(); git(dir, 'init', '-q');
  createPrd(dir, 1); createTicket(dir); write(dir, 'src/app.js', '1\n'); commit(dir, 'base');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md')); commit(dir, 'register');
  passes(rt(dir, 'change', 'select', 'prd-v1'));
  const clone = tempDir();
  passes(run(dir, 'git', ['clone', '-q', dir, clone]), 'clone');
  assert.ok(!fs.existsSync(path.join(clone, '.pincer')), 'local state is not cloned');
  const fresh = statusJson(clone);
  assert.equal(fresh.status, 0);
  assert.equal(fresh.json.change, null); assert.deepEqual(fresh.json.tickets, []);
  assert.equal(fresh.json.selection.problem.code, 'SELECTION_REQUIRED');
  assert.match(fresh.json.selection.problem.detail, /\(retained: prd-v1\)/, 'the only record is named, never chosen');
  assert.match(fresh.json.next, /^node scripts\/pincer-runtime\.cjs change select <id> — select the change to work on \(retained: prd-v1\)$/);
  assert.equal(rt(clone, 'ready', 'T-01').status, 4, 'no ticket is associated with a selected change');
  refuses(rt(clone, 'change', 'select', 'other'), 4, /INPUT_INVALID: no change record \.prd\/changes\/other\.json \(retained: prd-v1\)/);
  assert.ok(!fs.existsSync(path.join(clone, SELECTION)), 'a refused select writes no pointer');
  passes(rt(clone, 'change', 'select', 'prd-v1'));
  assert.equal(statusJson(clone).json.change.id, 'prd-v1');
  // The selected record disappears (removed by hand or by a branch switch): no fallback.
  passes(rt(clone, 'register', '--prd', '.prd/prd-v1.md', '--change', 'other-change').status === 0 ? { status: 1, stdout: '', stderr: 'unexpected' } : { status: 0 }, 'a second record for the same PRD is refused');
  createPrd(clone, 2); passes(rt(clone, 'register', '--prd', '.prd/prd-v2.md', '--change', 'second'));
  fs.unlinkSync(path.join(clone, '.prd/changes/prd-v1.json'));
  const dangling = statusJson(clone);
  assert.equal(dangling.status, 0, 'inspection succeeds and reports');
  assert.equal(dangling.json.change, null, 'no fallback to the remaining record');
  assert.equal(dangling.json.selection.problem.code, 'SELECTION_INVALID');
  assert.match(dangling.json.selection.problem.detail, /the selected change "prd-v1" does not exist \(retained: second\); select another with/);
  assert.match(passes(run(clone, 'bash', [statusScript])), /^Runtime  changes · SELECTION_INVALID: the selected change "prd-v1" does not exist/m);
  assert.equal(rt(clone, 'ready', 'T-01').status, 4);
  // An unreadable selected record is SELECTION_INVALID with the underlying problem.
  write(clone, '.prd/changes/prd-v1.json', '{"schema": 2, "change": "prd-v1", ');
  const unreadable = statusJson(clone);
  assert.equal(unreadable.status, 4, 'an unreadable record is invalid state');
  assert.match(unreadable.json.reasons[0].detail, /prd-v1\.json: malformed JSON/);
  git(clone, 'checkout', '--', '.prd/changes/prd-v1.json');
  assert.equal(statusJson(clone).json.change.id, 'prd-v1', 'restored record resolves again');
  // A corrupt pointer is malformed (exit 4), never reinterpreted.
  write(clone, SELECTION, '{"schema": 1, "change": "prd-v1"');
  const corrupt = statusJson(clone);
  assert.equal(corrupt.status, 4); assert.equal(corrupt.json.reasons[0].code, 'MALFORMED');
  assert.match(corrupt.json.reasons[0].detail, /selection\.json: malformed JSON[^;]*; select again with/);
  write(clone, SELECTION, JSON.stringify({ schema: 1, change: 'Nope!', selected: 'x' }));
  assert.match(statusJson(clone).json.reasons[0].detail, /not a schema 1 selection/);
  assert.equal(changes.readSelection(clone).code, 'MALFORMED');
  passes(rt(clone, 'change', 'select', 'second'));
  assert.equal(statusJson(clone).json.change.id, 'second');
  // --change is meaningful only for change records.
  const legacy = tempDir(); git(legacy, 'init', '-q'); createPrd(legacy); createTicket(legacy); commit(legacy, 'base');
  refuses(rt(legacy, 'status', '--change', 'prd-v1'), 4, /--change applies to change records only/);
  bindV050(legacy);
  refuses(rt(legacy, 'status', '--change', 'prd-v1'), 4, /--change applies to change records only/);
  refuses(rt(legacy, 'change', 'select', 'prd-v1'), 1, /MIGRATION_REQUIRED: \.prd\/changes\/ holds a v0\.5\.0 binding/);
  assert.ok(!fs.existsSync(path.join(legacy, SELECTION)));
}

// S-06: linked worktrees retain independent selections and attempt stores;
// selecting in one changes nothing in the other; an incompatible view (the
// recorded base is not an ancestor of HEAD) is diagnosed, never repaired.
{
  const dir = fixture();
  const wt2 = path.join(tempDir(), 'wt2');
  passes(run(dir, 'git', ['worktree', 'add', '-q', '-b', 'second-worktree', wt2]), 'worktree add');
  passes(rt(dir, 'change', 'select', 'prd-v1'));
  const wt2Before = gitView(wt2);
  assert.ok(!fs.existsSync(path.join(wt2, SELECTION)), 'selection is not shared with the linked worktree');
  assert.equal(statusJson(wt2).json.selection.problem.code, 'SELECTION_REQUIRED');
  passes(rt(wt2, 'change', 'select', 'feature-b'));
  assert.equal(selectionOf(dir).change, 'prd-v1'); assert.equal(selectionOf(wt2).change, 'feature-b');
  assert.deepEqual(gitView(wt2), wt2Before, 'selecting in the second worktree changed none of its files');
  assert.equal(statusJson(dir).json.change.id, 'prd-v1'); assert.equal(statusJson(wt2).json.change.id, 'feature-b');
  // Attempt stores are per worktree.
  state.writeAttempt(dir, { schema: 2, runtime: 2, id: '000001-20260911T000000Z-aaaaaa', sequence: 1, context: { kind: 'ticket', change: 'prd-v1', ticket: 'T-01' }, outcome: 'failed', owner: { pid: 1, host: os.hostname() }, started: '2026-09-11T00:00:00Z', finished: '2026-09-11T00:00:01Z', limitations: [] });
  state.writeIndex(dir, { schema: 1, sequence: 1, current: { 'ticket:prd-v1:T-01': '000001-20260911T000000Z-aaaaaa' }, running: [] });
  assert.equal(state.listAttempts(wt2, 'ticket:prd-v1:T-01').length, 0, 'attempts recorded in one worktree are unavailable in the other');
  assert.deepEqual(state.readIndex(wt2).index.current, {}, 'the other worktree has its own (empty) index');
  // An incompatible view: an orphan branch whose history does not contain the base.
  passes(run(wt2, 'git', ['checkout', '-q', '--orphan', 'unrelated']));
  commit(wt2, 'unrelated root');
  write(wt2, 'scratch.txt', 'dirty\n');
  const mismatch = statusJson(wt2);
  assert.equal(mismatch.status, 0);
  assert.equal(mismatch.json.change.view.base_is_ancestor, false);
  assert.equal(mismatch.json.change.view.branch, 'unrelated');
  assert.equal(mismatch.json.reasons[0].code, 'BASE_MISMATCH');
  assert.match(mismatch.json.reasons[0].detail, new RegExp(`the recorded base [0-9a-f]{7} of change "feature-b" is not an ancestor of HEAD ${mismatch.json.change.view.head.slice(0, 7)} \\(branch unrelated\\); dirty: scratch\\.txt — check out the branch that carries the change; the branch name is a hint, not proof`));
  assert.match(mismatch.json.next, /^BASE_MISMATCH: the recorded base/);
  assert.match(passes(run(wt2, 'bash', [statusScript])), /^View     HEAD [0-9a-f]{7} · branch unrelated · base is NOT an ancestor · dirty 1 path\(s\): scratch\.txt$/m);
  assert.equal(read(wt2, 'scratch.txt'), 'dirty\n', 'nothing was restored or discarded');
  assert.equal(selectionOf(wt2).change, 'feature-b', 'the selection stays; it is metadata');
  assert.equal(statusJson(dir).json.reasons.some(r => r.code === 'BASE_MISMATCH'), false, 'the first worktree is unaffected');
}
console.log('change selection tests passed');
