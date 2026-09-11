// Agreements (PRD v5 R-04, R-05; T-51): the agreement digest is stable under
// lifecycle fields, checkbox marks, attempts, source edits and NOTES, and changes
// for every authored input (PRD body, acceptance text, dependencies, size,
// timeout, association, check definition, tickets added or removed, resolved
// decisions); `change revise` records agreements with reviewable snapshots whose
// digests recompute; old and current inputs stay inspectable with a structural
// difference; malformed input, missing history and stale writes refuse without
// losing earlier history.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, createTicket, createPrd, write, read, run } from './helpers.js';

const require = createRequire(import.meta.url);
const changes = require(path.join(repo, 'template/scripts/pincer-runtime/changes.cjs'));
const agreement = require(path.join(repo, 'template/scripts/pincer-runtime/agreement.cjs'));
const parse = require(path.join(repo, 'template/scripts/pincer-runtime/parse.cjs'));
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
const record = (dir, id = 'prd-v1') => JSON.parse(read(dir, `.prd/changes/${id}.json`));
const digestOf = dir => { const c = agreement.compute(dir, record(dir)); assert.equal(c.code, undefined, JSON.stringify(c)); return c.digest; };
const snapshotTree = dir => {
  const out = {};
  const walk = rel => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(next); else out[next] = fs.readFileSync(path.join(dir, next), 'utf8');
    }
  };
  walk('');
  return out;
};
function fixture() {
  const dir = tempDir(); git(dir, 'init', '-q');
  createPrd(dir, 1); createPrd(dir, 2);
  createTicket(dir, { id: 'T-01', prd: '.prd/prd-v1.md', criteria: '- [ ] expected behavior' });
  createTicket(dir, { id: 'T-02', prd: '.prd/prd-v1.md', deps: 'T-01', command: 'test -f value.txt' });
  createTicket(dir, { id: 'T-03', prd: '.prd/prd-v2.md' });
  write(dir, 'src/app.js', 'module.exports = 1;\n'); write(dir, 'value.txt', 'good\n');
  commit(dir, 'base');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'));
  passes(rt(dir, 'register', '--prd', '.prd/prd-v2.md', '--change', 'other'));
  commit(dir, 'registered');
  return dir;
}
const edit = (dir, file, from, to) => write(dir, file, read(dir, file).replace(from, to));

// S-13: the projection is the documented text; lifecycle fields, checkbox marks,
// attempts, source and NOTES keep the digest; every authored input changes it.
{
  const dir = fixture();
  const c = agreement.compute(dir, record(dir));
  assert.equal(c.projection, `pincer agreement 1\nchange prd-v1\nprd .prd/prd-v1.md ${parse.prdDigest(read(dir, '.prd/prd-v1.md'))}\nticket T-01 ${parse.ticketDigest(read(dir, 'tickets/T-01-example.md'))}\nticket T-02 ${parse.ticketDigest(read(dir, 'tickets/T-02-example.md'))}\n`, 'the exact projection: change, PRD revision, one line per ticket of the PRD, no T-03');
  assert.equal(c.digest, parse.sha256(c.projection));
  assert.deepEqual(Object.keys(c.tickets), ['T-01', 'T-02']);
  const base = c.digest;
  const stable = {
    'ticked box': () => edit(dir, 'tickets/T-01-example.md', '- [ ] expected behavior', '- [x] expected behavior'),
    'lifecycle fields': () => edit(dir, 'tickets/T-01-example.md', 'status: open', 'status: done\nstarted: 2026-09-11T00:00:00Z\nlast_check: 2026-09-11T00:01:00Z passed abcdef012345\nverified: 2026-09-11T00:01:00Z abcdef012345\nfinished: 2026-09-11T00:02:00Z'),
    'PRD status': () => edit(dir, '.prd/prd-v1.md', 'status: ticketed', 'status: built'),
    'source edit': () => write(dir, 'src/app.js', 'module.exports = 2;\n'),
    'new source file': () => write(dir, 'src/new.js', 'x\n'),
    'NOTES.md': () => write(dir, 'NOTES.md', '# notes\n'),
    'evidence artifact': () => write(dir, '.prd/evidence/prd-v1/x/manifest.json', '{}'),
    'an attempt record': () => { state.writeAttempt(dir, { schema: 2, id: '000001-x', sequence: 1, context: { kind: 'ticket', change: 'prd-v1', ticket: 'T-01' }, outcome: 'passed' }); },
    'another change\'s ticket': () => edit(dir, 'tickets/T-03-example.md', 'expected behavior', 'changed elsewhere'),
    'another PRD': () => write(dir, '.prd/prd-v2.md', `${read(dir, '.prd/prd-v2.md')}\nmore\n`),
    'an open decision': () => { const r = record(dir); r.decisions.push({ id: 'D-01', status: 'open', summary: 'which storage?', reference: null, excerpt: null, raised: '2026-09-11T00:00:00Z', resolved: null }); r.events.push({ sequence: 2, kind: 'decide', from: 'planned', to: 'planned', at: '2026-09-11T00:00:00Z', reason: null, agreement: null, authorization: null, decision: 'D-01', replacement: null, note: null }); r.sequence = 2; write(dir, '.prd/changes/prd-v1.json', JSON.stringify(r, null, 2)); },
  };
  for (const [label, apply] of Object.entries(stable)) {
    apply();
    assert.equal(digestOf(dir), base, `${label} keeps the agreement digest`);
    git(dir, 'checkout', '--', '.'); git(dir, 'clean', '-fdq'); fs.rmSync(path.join(dir, '.pincer'), { recursive: true, force: true });
  }
  const changing = {
    'PRD body edit under the same filename': () => write(dir, '.prd/prd-v1.md', `${read(dir, '.prd/prd-v1.md')}\nR-02 added.\n`),
    'acceptance text': () => edit(dir, 'tickets/T-01-example.md', 'expected behavior', 'expected behaviour'),
    'dependencies': () => edit(dir, 'tickets/T-02-example.md', 'depends_on: [T-01]', 'depends_on: []'),
    'size': () => edit(dir, 'tickets/T-01-example.md', 'size: S', 'size: M'),
    'timeout': () => edit(dir, 'tickets/T-01-example.md', 'size: S', 'size: S\ntimeout: 30'),
    'check definition': () => edit(dir, 'tickets/T-02-example.md', 'test -f value.txt', 'test -f value.txt && true'),
    'ticket added to the PRD': () => createTicket(dir, { id: 'T-04', prd: '.prd/prd-v1.md' }),
    'ticket removed from the PRD': () => fs.unlinkSync(path.join(dir, 'tickets/T-02-example.md')),
    'ticket moved to another PRD': () => edit(dir, 'tickets/T-02-example.md', 'prd: .prd/prd-v1.md', 'prd: .prd/prd-v2.md'),
    'a resolved decision': () => { const r = record(dir); r.decisions.push({ id: 'D-01', status: 'resolved', summary: 'which storage?', reference: 'session 2026-09-11', excerpt: 'use sqlite', raised: '2026-09-11T00:00:00Z', resolved: '2026-09-11T00:05:00Z' }); r.events.push({ sequence: 2, kind: 'decide', from: 'planned', to: 'planned', at: '2026-09-11T00:00:00Z', reason: null, agreement: null, authorization: null, decision: 'D-01', replacement: null, note: null }); r.sequence = 2; write(dir, '.prd/changes/prd-v1.json', JSON.stringify(r, null, 2)); },
  };
  const seen = new Set([base]);
  for (const [label, apply] of Object.entries(changing)) {
    apply();
    const d = digestOf(dir);
    assert.notEqual(d, base, `${label} changes the agreement digest`);
    // Moving a ticket to another PRD leaves the same breakdown as removing it: the same agreement.
    if (label !== 'ticket moved to another PRD') { assert.ok(!seen.has(d), `${label} yields a digest distinct from the other cases`); seen.add(d); }
    git(dir, 'checkout', '--', '.'); git(dir, 'clean', '-fdq');
  }
  assert.equal(digestOf(dir), base, 'reverting restores the digest');
  // The resolved-decision line is the documented digest.
  const r = record(dir);
  r.decisions.push({ id: 'D-01', status: 'resolved', summary: 'which storage?', reference: 'session 2026-09-11', excerpt: 'use sqlite', raised: '2026-09-11T00:00:00Z', resolved: '2026-09-11T00:05:00Z' });
  r.events.push({ sequence: 2, kind: 'decide', from: 'planned', to: 'planned', at: '2026-09-11T00:00:00Z', reason: null, agreement: null, authorization: null, decision: 'D-01', replacement: null, note: null }); r.sequence = 2;
  const withDecision = agreement.compute(dir, r);
  assert.match(withDecision.projection, new RegExp(`\\ndecision D-01 ${parse.sha256('D-01\nwhich storage?\nsession 2026-09-11\nuse sqlite\n')}\n$`));
}

// change revise records the agreement with a reviewable snapshot; a repeat is a
// no-op; a changed PRD under the same filename records a new agreement and the
// old one stays recoverable and inspectable with a structural difference.
{
  const dir = fixture();
  const first = rt(dir, 'change', 'revise', 'prd-v1');
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /^recorded agreement G-01 [0-9a-f]{12} for prd-v1 \(2 ticket\(s\), snapshot \.prd\/changes\/prd-v1\/agreements\/G-01\.json\)$/m);
  assert.match(first.stderr, /recording an agreement authorizes nothing/);
  let r = record(dir);
  assert.equal(r.sequence, 2); assert.equal(r.events[1].kind, 'agreement'); assert.equal(r.events[1].agreement, 'G-01');
  assert.equal(r.agreements[0].digest, digestOf(dir)); assert.deepEqual(r.agreements[0].tickets, ['T-01', 'T-02']);
  assert.equal(changes.validateRecord(r, '.prd/changes/prd-v1.json'), null);
  const snap = JSON.parse(read(dir, '.prd/changes/prd-v1/agreements/G-01.json'));
  assert.equal(snap.schema, 1); assert.equal(snap.agreement, 'G-01'); assert.equal(parse.sha256(snap.projection), snap.digest);
  assert.equal(snap.prd.text, parse.normalizePrd(read(dir, '.prd/prd-v1.md')), 'the snapshot holds the normalized PRD');
  assert.equal(snap.tickets['T-01'].text, parse.normalizeTicket(read(dir, 'tickets/T-01-example.md')));
  assert.equal(agreement.readSnapshot(dir, r, r.agreements[0]).code, undefined, 'the snapshot recomputes');
  assert.equal(git(dir, 'status', '--porcelain', '--untracked-files=all').split('\n').filter(l => /prd-v1\/agreements/.test(l)).length, 1, 'the snapshot is a tracked authored file');
  const unchanged = rt(dir, 'change', 'revise', 'prd-v1');
  assert.match(unchanged.stdout, /^unchanged: the current agreement of prd-v1 is G-01 [0-9a-f]{12}/); assert.equal(record(dir).sequence, 2, 'no event for a no-op');
  edit(dir, 'tickets/T-01-example.md', '- [ ] expected behavior', '- [x] expected behavior');
  edit(dir, 'tickets/T-01-example.md', 'status: open', 'status: in_progress\nstarted: 2026-09-11T00:00:00Z');
  assert.match(rt(dir, 'change', 'revise', 'prd-v1').stdout, /^unchanged/, 'lifecycle and checkbox edits keep the agreement');
  // Same-filename PRD revision plus a check change: G-02, with the old inputs still recoverable.
  write(dir, '.prd/prd-v1.md', `${read(dir, '.prd/prd-v1.md')}\nR-02: also handle empty input.\n`);
  edit(dir, 'tickets/T-02-example.md', 'test -f value.txt', 'test -f value.txt && test -s value.txt');
  edit(dir, 'tickets/T-01-example.md', 'expected behavior', 'expected behaviour');
  createTicket(dir, { id: 'T-04', prd: '.prd/prd-v1.md' });
  const status = JSON.parse(passes(rt(dir, 'status', '--json', '--change', 'prd-v1')));
  assert.equal(status.change.agreement.recorded, null); assert.equal(status.change.agreement.latest.id, 'G-01');
  assert.deepEqual(status.change.agreement.difference, { same: false, prd_changed: true, tickets_added: ['T-04'], tickets_removed: [], tickets_changed: [{ id: 'T-01', parts: ['acceptance'] }, { id: 'T-02', parts: ['verification'] }], decisions_added: [], decisions_removed: [] });
  assert.match(passes(rt(dir, 'status', '--change', 'prd-v1')), /^Runtime  changes · inspecting prd-v1 · planned · agreement [0-9a-f]{12} \(≠ G-01: PRD body changed; tickets added: T-04; tickets changed: T-01 \(acceptance\), T-02 \(verification\)\) · base/m);
  const show = passes(rt(dir, 'change', 'show', 'prd-v1'));
  assert.match(show, /^Agreement  now [0-9a-f]{12} ≠ latest recorded G-01 [0-9a-f]{12} \(PRD body changed; tickets added: T-04; tickets changed: T-01 \(acceptance\), T-02 \(verification\)\); record it with: node scripts\/pincer-runtime\.cjs change revise prd-v1$/m);
  const second = passes(rt(dir, 'change', 'revise', 'prd-v1'));
  assert.match(second, /^recorded agreement G-02 [0-9a-f]{12} for prd-v1 \(3 ticket\(s\), snapshot \.prd\/changes\/prd-v1\/agreements\/G-02\.json\) — differs from the previous agreement: PRD body changed; tickets added: T-04; tickets changed: T-01 \(acceptance\), T-02 \(verification\)$/m);
  r = record(dir);
  assert.equal(r.agreements.length, 2); assert.equal(r.sequence, 3);
  assert.equal(r.agreements[0].digest, snap.digest, 'G-01 is retained');
  const old = JSON.parse(read(dir, '.prd/changes/prd-v1/agreements/G-01.json'));
  assert.equal(old.prd.text, snap.prd.text, 'the old PRD text is still on disk');
  assert.ok(!old.prd.text.includes('R-02: also handle'), 'old snapshot has the old PRD'); assert.ok(JSON.parse(read(dir, '.prd/changes/prd-v1/agreements/G-02.json')).prd.text.includes('R-02: also handle'));
  const diff = agreement.difference(old, agreement.compute(dir, r));
  assert.equal(diff.prd_changed, true); assert.deepEqual(diff.tickets_added, ['T-04']);
  assert.match(passes(rt(dir, 'change', 'show', 'prd-v1')), /^Agreement  now [0-9a-f]{12} = G-02$/m);
  assert.match(passes(rt(dir, 'change', 'show', 'prd-v1', '--json')), /"recorded": "G-02"/);
  // A ticket moved to another PRD and a removed ticket are structural differences; frontmatter/other parts are named.
  edit(dir, 'tickets/T-04-example.md', 'size: S', 'size: L');
  edit(dir, 'tickets/T-02-example.md', '## Objective\nExample', '## Objective\nExample, reworded');
  const d3 = agreement.difference(JSON.parse(read(dir, '.prd/changes/prd-v1/agreements/G-02.json')), agreement.compute(dir, record(dir)));
  assert.deepEqual(d3.tickets_changed, [{ id: 'T-02', parts: ['other'] }, { id: 'T-04', parts: ['frontmatter'] }]);
  assert.equal(agreement.renderDifference(d3), 'tickets changed: T-02 (other), T-04 (frontmatter)');
}

// Refusals: malformed authored input, a missing or tampered snapshot, a terminal
// change, a stale expected revision and a busy lock refuse without losing history.
{
  const dir = fixture();
  passes(rt(dir, 'change', 'revise', 'prd-v1'));
  commit(dir, 'revised');
  const good = snapshotTree(dir);
  // Malformed ticket: nothing computed, nothing written.
  write(dir, 'tickets/T-02-example.md', read(dir, 'tickets/T-02-example.md').replace('## Verification', '## Verify'));
  refuses(rt(dir, 'change', 'revise', 'prd-v1'), 4, /INPUT_INVALID: pincer-ticket: tickets\/T-02-example\.md: Verification requires exactly one closed runnable bash fence/);
  assert.equal(agreement.compute(dir, record(dir)).code, 'INPUT_INVALID');
  const st = JSON.parse(rt(dir, 'status', '--json', '--change', 'prd-v1').stdout);
  assert.equal(st.change.agreement.current, null, 'no agreement digest for malformed input');
  git(dir, 'checkout', '--', 'tickets');
  assert.deepEqual(snapshotTree(dir), good, 'the record and snapshot are untouched');
  // A missing snapshot makes the history unreviewable: HISTORY_INVALID everywhere, nothing rewritten.
  fs.unlinkSync(path.join(dir, '.prd/changes/prd-v1/agreements/G-01.json'));
  const missing = /HISTORY_INVALID: \.prd\/changes\/prd-v1\/agreements\/G-01\.json: snapshot missing — the agreement G-01 of change "prd-v1" cannot be reviewed from a digest alone/;
  refuses(rt(dir, 'change', 'revise', 'prd-v1'), 4, missing);
  refuses(rt(dir, 'change', 'show', 'prd-v1'), 4, missing);
  refuses(rt(dir, 'status'), 4, missing);
  assert.equal(record(dir).sequence, 2, 'history intact');
  git(dir, 'checkout', '--', '.prd/changes/prd-v1/agreements/G-01.json');
  // A tampered snapshot (digest no longer recomputes) is HISTORY_INVALID too.
  const snapText = read(dir, '.prd/changes/prd-v1/agreements/G-01.json');
  write(dir, '.prd/changes/prd-v1/agreements/G-01.json', snapText.replace('# Example PRD', '# Example PRD (edited)'));
  refuses(rt(dir, 'change', 'revise', 'prd-v1'), 4, /HISTORY_INVALID: .*G-01\.json: the snapshot PRD text does not hash to its recorded revision/);
  write(dir, '.prd/changes/prd-v1/agreements/G-01.json', snapText.replace(/"digest": "[0-9a-f]{64}"/, '"digest": "0000000000000000000000000000000000000000000000000000000000000000"'));
  refuses(rt(dir, 'change', 'revise', 'prd-v1'), 4, /the snapshot digest does not match the projection or the record entry/);
  write(dir, '.prd/changes/prd-v1/agreements/G-01.json', snapText);
  passes(rt(dir, 'change', 'show', 'prd-v1'));
  // A stale expected revision refuses at commit and writes nothing (prepared-then-changed).
  const before = snapshotTree(dir);
  write(dir, '.prd/prd-v1.md', `${read(dir, '.prd/prd-v1.md')}\nchanged\n`);
  const stale = agreement.revise(dir, 'prd-v1', { expect: 1 });
  assert.equal(stale.code, 'STATE_CHANGED'); assert.match(stale.problem, /sequence is 2, expected 1/);
  assert.equal(record(dir).agreements.length, 1);
  assert.ok(!fs.existsSync(path.join(dir, '.prd/changes/prd-v1/agreements/G-02.json')));
  git(dir, 'checkout', '--', '.prd/prd-v1.md');
  assert.deepEqual(snapshotTree(dir), before);
  // Terminal records keep their agreements as history.
  const r = record(dir);
  r.decisions.push({ id: 'D-01', status: 'resolved', summary: 'drop it', reference: 'session', excerpt: 'drop it', raised: r.registered, resolved: r.registered });
  r.events.push({ sequence: 3, kind: 'decide', from: 'planned', to: 'planned', at: r.registered, reason: null, agreement: null, authorization: null, decision: 'D-01', replacement: null, note: null });
  r.events.push({ sequence: 4, kind: 'cancel', from: 'planned', to: 'cancelled', at: r.registered, reason: 'dropped', agreement: null, authorization: null, decision: 'D-01', replacement: null, note: null });
  r.sequence = 4; r.lifecycle = { ...r.lifecycle, state: 'cancelled', reason: 'dropped' };
  write(dir, '.prd/changes/prd-v1.json', `${JSON.stringify(r, null, 2)}\n`);
  refuses(rt(dir, 'change', 'revise', 'prd-v1'), 1, /LIFECYCLE_BLOCKED: change prd-v1 is cancelled; its agreements are history and cannot be revised/);
  assert.match(passes(rt(dir, 'change', 'show', 'prd-v1')), /^Agreements G-01 /m, 'history inspectable');
  // Unknown change and other modes.
  refuses(rt(dir, 'change', 'revise', 'nope'), 4, /change record \.prd\/changes\/nope\.json does not exist/);
  const legacy = tempDir(); git(legacy, 'init', '-q'); createPrd(legacy); createTicket(legacy); commit(legacy, 'base');
  refuses(rt(legacy, 'change', 'revise', 'prd-v1'), 1, /CHANGE_REQUIRED/);
}
console.log('change agreement tests passed');
