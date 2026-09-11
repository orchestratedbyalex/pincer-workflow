// Authorization and decisions (PRD v5 R-04, R-05, R-09; T-52): an existing exact
// user instruction recorded once enables the agreement, a repeat writes no
// duplicate; missing, wrong-change and unmatched references stay blocked; a
// delegated check improvement records its basis against the new digest without a
// new user approval and still needs fresh verification; changed behavior and open
// consequential decisions cannot be silently approved or shown as delivered; the
// v0.5.0 free text alone never authorizes; duplicates, dangling references,
// invalid input and stale commits refuse without writing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, createTicket, createPrd, write, read, run, statusScript } from './helpers.js';

const require = createRequire(import.meta.url);
const changes = require(path.join(repo, 'template/scripts/pincer-runtime/changes.cjs'));
const agreement = require(path.join(repo, 'template/scripts/pincer-runtime/agreement.cjs'));
const authorization = require(path.join(repo, 'template/scripts/pincer-runtime/authorization.cjs'));
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
const digestOf = (dir, id = 'prd-v1') => agreement.compute(dir, record(dir, id)).digest;
const verdictOf = (dir, id = 'prd-v1') => authorization.verdict(dir, record(dir, id));
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
  createTicket(dir, { id: 'T-01', prd: '.prd/prd-v1.md', command: 'test -f value.txt' });
  createTicket(dir, { id: 'T-02', prd: '.prd/prd-v2.md' });
  write(dir, 'value.txt', 'good\n');
  commit(dir, 'base');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'));
  passes(rt(dir, 'register', '--prd', '.prd/prd-v2.md', '--change', 'feature-b'));
  passes(rt(dir, 'change', 'select', 'prd-v1'));
  commit(dir, 'registered');
  return dir;
}
const edit = (dir, file, from, to) => write(dir, file, read(dir, file).replace(from, to));
const REF = 'session 2026-09-11 10:02, user message after /pincer-narrow';
const EXCERPT = 'looks good, go ahead with both tickets as written';

// S-11: the exact earlier instruction, recorded once, makes the agreement current;
// repeating it writes no duplicate event; the agreement entry and snapshot are
// recorded with it when not recorded before.
{
  const dir = fixture();
  assert.equal(verdictOf(dir).verdict, 'AUTHORIZATION_REQUIRED');
  assert.match(passes(run(dir, 'bash', [statusScript])), /^Runtime  changes · selected prd-v1 · planned · agreement [0-9a-f]{12} \(not recorded\) · authorization AUTHORIZATION_REQUIRED · base/m);
  assert.match(JSON.parse(passes(rt(dir, 'status', '--json'))).next, /^AUTHORIZATION_REQUIRED: change prd-v1 has no authorization record; record the user's instruction with: node scripts\/pincer-runtime\.cjs change authorize prd-v1 --agreement [0-9a-f]{64} --reference <text> --excerpt <text>$/);
  const digest = digestOf(dir);
  const out = rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digest, '--reference', REF, '--excerpt', EXCERPT, '--constraints', 'no new dependencies');
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^recorded authorization A-01 \(user\) of agreement G-01 [0-9a-f]{12} for prd-v1$/m);
  assert.match(out.stderr, /records local provenance of the user's instruction, not authenticated identity/);
  let r = record(dir);
  assert.equal(changes.validateRecord(r, '.prd/changes/prd-v1.json'), null);
  assert.equal(r.sequence, 2, 'agreement and authorization are one transaction with one authorize event');
  assert.deepEqual(r.events.map(e => e.kind), ['register', 'authorize']);
  assert.deepEqual(r.events[1], { ...r.events[1], agreement: 'G-01', authorization: 'A-01', decision: null });
  assert.equal(r.agreements.length, 1); assert.ok(fs.existsSync(path.join(dir, '.prd/changes/prd-v1/agreements/G-01.json')), 'the reviewed inputs are snapshotted');
  assert.deepEqual(r.authorizations[0], { id: 'A-01', agreement: 'G-01', digest, disposition: 'user', reference: REF, excerpt: EXCERPT, constraints: 'no new dependencies', basis: null, explanation: null, decisions: [], recorded: r.authorizations[0].recorded });
  const v = verdictOf(dir);
  assert.equal(v.verdict, 'current'); assert.equal(v.authorized.id, 'A-01');
  assert.match(passes(run(dir, 'bash', [statusScript])), /^Runtime  changes · selected prd-v1 · planned · agreement [0-9a-f]{12} \(G-01\) · authorization current \(A-01\) · base/m);
  const sj = JSON.parse(passes(rt(dir, 'status', '--json')));
  assert.equal(sj.change.agreement.verdict, 'current'); assert.equal(sj.change.agreement.authorized.id, 'A-01');
  assert.equal(sj.changes.find(c => c.id === 'prd-v1').authorization, 'current'); assert.equal(sj.changes.find(c => c.id === 'feature-b').authorization, 'AUTHORIZATION_REQUIRED');
  assert.match(sj.next, /change activate prd-v1/, 'with authorization current, the next step is activation');
  assert.match(passes(rt(dir, 'change', 'show', 'prd-v1')), /^Authorization current — A-01 \(user\) covers the current agreement [0-9a-f]{12}$/m);
  assert.match(passes(rt(dir, 'change', 'list')), /^\* prd-v1 {11}planned .* · authorization current$/m);
  // Repeating the identical record is idempotent; routine lifecycle edits keep it current.
  const before = snapshotTree(dir);
  const again = rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digest, '--reference', REF, '--excerpt', EXCERPT, '--constraints', 'no new dependencies');
  assert.equal(again.status, 0); assert.match(again.stdout, /^unchanged: A-01 \(user\) already records this authorization/);
  assert.deepEqual(snapshotTree(dir), before, 'no duplicate event, no rewrite');
  edit(dir, 'tickets/T-01-example.md', 'status: open', 'status: in_progress\nstarted: 2026-09-11T00:00:00Z');
  edit(dir, 'tickets/T-01-example.md', '- [x] expected behavior', '- [ ] expected behavior');
  assert.equal(verdictOf(dir).verdict, 'current', 'starting a ticket and unticking a box do not invalidate authorization');
  // A different wording of the instruction is a second record, not a rewrite.
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digest, '--reference', REF, '--excerpt', 'go ahead'));
  r = record(dir); assert.equal(r.authorizations.length, 2); assert.equal(r.agreements.length, 1, 'the same agreement entry is reused');
  git(dir, 'checkout', '--', 'tickets');
}

// S-12: missing authorization, an authorization of another change, and an
// unmatched digest block; nothing is written on refusal.
{
  const dir = fixture();
  const a = digestOf(dir), b = digestOf(dir, 'feature-b');
  assert.notEqual(a, b);
  const before = snapshotTree(dir);
  // A's digest cannot authorize B (the digest belongs to A's agreement).
  refuses(rt(dir, 'change', 'authorize', 'feature-b', '--agreement', a, '--reference', REF, '--excerpt', EXCERPT), 1, /AGREEMENT_CHANGED: --agreement [0-9a-f]{12} is not the current agreement of feature-b \([0-9a-f]{12}\); the authored inputs changed since it was prepared/);
  refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', '0'.repeat(64), '--reference', REF, '--excerpt', EXCERPT), 1, /AGREEMENT_CHANGED/);
  refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', 'nothex', '--reference', REF, '--excerpt', EXCERPT), 4, /--agreement must be the 64-hex agreement digest/);
  refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', a, '--excerpt', EXCERPT), 4, /--reference is required/);
  refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', a, '--reference', REF, '--excerpt', '   '), 4, /--excerpt must be a nonempty string/);
  // (through the module API: some sandboxes kill a node process launched with a kilobyte-long argument)
  const tooLong = authorization.authorize(dir, 'prd-v1', { agreement: a, reference: REF, excerpt: 'x'.repeat(2001) });
  assert.equal(tooLong.code, 'INPUT_INVALID'); assert.match(tooLong.problem, /--excerpt is longer than 2000 characters; store a reference, not a transcript/);
  refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', a, '--reference', REF, '--excerpt', 'use TOKEN=abc123 for the call'), 4, /--excerpt assigns a secret-like literal/);
  refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', a, '--reference', REF, '--excerpt', EXCERPT, '--basis', 'A-01'), 4, /--basis and --explanation belong to --delegated authorizations/);
  refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', a, '--delegated', '--basis', 'A-01', '--explanation', 'x'), 4, /--basis A-01 is not an authorization of change prd-v1 \(recorded: none\)/);
  refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', a, '--reference', REF, '--excerpt', EXCERPT, '--decision', 'D-07'), 4, /--decision D-07 is not a decision of change prd-v1 \(recorded: none\)/);
  refuses(rt(dir, 'change', 'authorize', 'nope', '--agreement', a, '--reference', REF, '--excerpt', EXCERPT), 4, /does not exist/);
  refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--reference', REF, '--excerpt', EXCERPT), 2, /requires --agreement/);
  assert.deepEqual(snapshotTree(dir), before, 'every refusal writes nothing');
  assert.equal(verdictOf(dir).verdict, 'AUTHORIZATION_REQUIRED'); assert.equal(verdictOf(dir, 'feature-b').verdict, 'AUTHORIZATION_REQUIRED');
  // An unmatched agreement after an authorization: AGREEMENT_CHANGED names the difference.
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', a, '--reference', REF, '--excerpt', EXCERPT));
  write(dir, '.prd/prd-v1.md', `${read(dir, '.prd/prd-v1.md')}\nR-02: also export CSV.\n`);
  const changed = verdictOf(dir);
  assert.equal(changed.verdict, 'AGREEMENT_CHANGED');
  assert.match(changed.detail, /the latest authorization A-01 covers agreement G-01 [0-9a-f]{12}, the current agreement is [0-9a-f]{12} \(PRD body changed\); record the disposition with: node scripts\/pincer-runtime\.cjs change authorize prd-v1 --agreement [0-9a-f]{64} … \(user\) or --delegated --basis A-01 --explanation <text>/);
  const sj = JSON.parse(passes(rt(dir, 'status', '--json')));
  assert.equal(sj.change.agreement.verdict, 'AGREEMENT_CHANGED'); assert.equal(sj.reasons[0].code, 'AGREEMENT_CHANGED');
  assert.match(sj.next, /^AGREEMENT_CHANGED: /);
  assert.match(passes(run(dir, 'bash', [statusScript])), /· authorization AGREEMENT_CHANGED · base/);
  // A stale prepared digest (the old one) is refused at commit; the new digest authorizes.
  refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', a, '--reference', REF, '--excerpt', 'yes, add CSV'), 1, /AGREEMENT_CHANGED: --agreement/);
  assert.equal(record(dir).authorizations.length, 1);
  const stale = authorization.authorize(dir, 'prd-v1', { agreement: digestOf(dir), reference: REF, excerpt: 'yes, add CSV', expect: 1 });
  assert.equal(stale.code, 'STATE_CHANGED');
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', 'session 2026-09-11 11:40', '--excerpt', 'yes, add CSV export too'));
  assert.equal(verdictOf(dir).verdict, 'current'); assert.equal(record(dir).authorizations.length, 2); assert.equal(record(dir).agreements.length, 2);
  git(dir, 'checkout', '--', '.prd/prd-v1.md');
  assert.equal(verdictOf(dir).verdict, 'current', 'reverting the PRD makes the first authorization applicable again (exact prior authorization is reused)');
  assert.equal(verdictOf(dir).authorized.id, 'A-01');
}

// S-15: a delegated check improvement records its basis against the new digest
// with no new user approval, and the changed check still requires fresh verification.
{
  const dir = fixture();
  const a = digestOf(dir);
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', a, '--reference', REF, '--excerpt', 'approved; you may add regression checks for already-approved behavior', '--constraints', 'delegated: extra regression checks'));
  // A prior passing attempt for T-01 under the old check digest (a schema 2 record of this change).
  const ticketText = read(dir, 'tickets/T-01-example.md');
  const attempt = {
    schema: 2, runtime: 2, id: '000001-20260911T000000Z-aaaaaa', sequence: 1,
    context: { kind: 'ticket', change: 'prd-v1', prd: '.prd/prd-v1.md', prd_revision: parse.prdDigest(read(dir, '.prd/prd-v1.md')), base: record(dir).base, ticket: 'T-01', ticket_digest: parse.ticketDigest(ticketText), agreement: digestOf(dir) },
    check: { digest: parse.checkDigest(ticketText, 600), display: 'test -f value.txt\n', timeout_seconds: 600 },
    outcome: 'passed', exit_code: 0, signal: null, runner: { shell: '/bin/bash', args: ['-eo', 'pipefail', '-c'], version: 'x' }, cwd: '.', environment: { os: 'x', node: 'x', declared: {} },
    started: '2026-09-11T00:00:00Z', finished: '2026-09-11T00:00:01Z', source: { before: 'a'.repeat(64), after: 'a'.repeat(64), files: 1, limitations: [] },
    artifacts: { stdout: { path: '.pincer/runtime/attempts/000001-20260911T000000Z-aaaaaa/stdout.log', sha256: parse.sha256(''), bytes: 0, truncated: false, redactions: 0 }, stderr: { path: '.pincer/runtime/attempts/000001-20260911T000000Z-aaaaaa/stderr.log', sha256: parse.sha256(''), bytes: 0, truncated: false, redactions: 0 } },
    owner: { pid: 1, ppid: 1, host: os.hostname() }, child: null, limitations: [],
  };
  write(dir, attempt.artifacts.stdout.path, ''); write(dir, attempt.artifacts.stderr.path, '');
  state.writeAttempt(dir, attempt);
  state.writeIndex(dir, { schema: 1, sequence: 1, current: { 'ticket:prd-v1:T-01': attempt.id }, running: [] });
  edit(dir, 'tickets/T-01-example.md', 'test -f value.txt', 'test -f value.txt && test -s value.txt');
  assert.equal(verdictOf(dir).verdict, 'AGREEMENT_CHANGED');
  const out = rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--delegated', '--basis', 'A-01', '--explanation', 'adds a regression check that the file is non-empty; the user delegated extra regression checks for approved behavior');
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^recorded authorization A-02 \(delegated, basis A-01\) of agreement G-02 [0-9a-f]{12} for prd-v1$/m);
  assert.match(out.stderr, /records local provenance of a delegation judgment/);
  const r = record(dir);
  assert.deepEqual([r.authorizations[1].disposition, r.authorizations[1].basis, r.authorizations[1].reference, r.authorizations[1].excerpt], ['delegated', 'A-01', null, null]);
  assert.equal(verdictOf(dir).verdict, 'current'); assert.equal(verdictOf(dir).authorized.id, 'A-02');
  assert.match(passes(rt(dir, 'change', 'show', 'prd-v1')), /A-02 delegated for G-02 \([0-9a-f]{12}\) recorded .* — basis A-01: adds a regression check/);
  // Authorization is current, but the changed check needs fresh verification.
  const sj = JSON.parse(passes(rt(dir, 'status', '--json')));
  assert.equal(sj.change.agreement.verdict, 'current');
  assert.equal(sj.tickets[0].readiness.reasons[0].code, 'CHECK_CHANGED', 'the prior pass no longer counts for the changed check');
  assert.match(sj.tickets[0].readiness.next, /verify/);
  // Delegation needs a basis that exists and an explanation; a basis of another change is unknown here.
  refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--delegated', '--basis', 'A-09', '--explanation', 'x'), 4, /--basis A-09 is not an authorization of change prd-v1 \(recorded: A-01, A-02\)/);
  refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--delegated', '--basis', 'A-01'), 4, /--explanation is required/);
  refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--delegated', '--basis', 'A-01', '--explanation', 'x', '--reference', 'r'), 4, /a delegated authorization carries no --reference\/--excerpt/);
  refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--delegated', '--explanation', 'x'), 4, /--delegated requires --basis A-NN/);
  refuses(rt(dir, 'change', 'authorize', 'feature-b', '--agreement', digestOf(dir, 'feature-b'), '--delegated', '--basis', 'A-01', '--explanation', 'borrowing A\'s basis'), 4, /--basis A-01 is not an authorization of change feature-b \(recorded: none\)/, 'a delegation cannot chain to another change');
}

// S-16, S-28: an open consequential decision blocks; resolving it changes the
// agreement, which needs an authorization naming the decision; a deferral is a
// decision, not delivery; the v0.5.0 free text alone never authorizes; decisions
// are never rewritten.
{
  const dir = fixture();
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', REF, '--excerpt', EXCERPT));
  const raised = rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'Should the export also cover archived items? The PRD does not say.');
  assert.equal(raised.status, 0, raised.stderr);
  assert.match(raised.stdout, /^raised decision D-01 on prd-v1: Should the export also cover archived items\?/);
  assert.match(raised.stderr, /execution of prd-v1 is blocked \(DECISION_REQUIRED\) until the user's decision is recorded with: node scripts\/pincer-runtime\.cjs change decide prd-v1 --resolve D-01/);
  let r = record(dir);
  assert.equal(r.decisions[0].status, 'open'); assert.equal(r.events.at(-1).kind, 'decide'); assert.equal(r.sequence, 3);
  const digestBefore = digestOf(dir);
  const v = verdictOf(dir);
  assert.equal(v.verdict, 'DECISION_REQUIRED'); assert.deepEqual(v.open, ['D-01']);
  assert.match(v.detail, /decision D-01 is open \(Should the export/);
  assert.equal(v.authorized.id, 'A-01', 'the authorization still matches; the open decision gates on top of it');
  const sj = JSON.parse(passes(rt(dir, 'status', '--json')));
  assert.equal(sj.change.agreement.verdict, 'DECISION_REQUIRED'); assert.deepEqual(sj.change.agreement.open_decisions, ['D-01']);
  assert.match(sj.next, /^DECISION_REQUIRED: decision D-01 is open/);
  assert.match(passes(run(dir, 'bash', [statusScript])), /· authorization DECISION_REQUIRED \(A-01\) · base/);
  // Repeating the same open question is a no-op; a conflicting record under the same id refuses.
  assert.match(passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'Should the export also cover archived items? The PRD does not say.')), /^unchanged: D-01 is already open/);
  refuses(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'Another question', '--id', 'D-01'), 4, /D-01 already exists on change prd-v1 \(open: Should the export/);
  refuses(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'Another question', '--id', 'D-05'), 4, /the next decision of change prd-v1 is D-02, not D-05/);
  assert.equal(record(dir).decisions.length, 1);
  // Authorizing while the decision is open cannot clear it; naming it before it is resolved refuses.
  refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestBefore, '--reference', REF, '--excerpt', 'fine', '--decision', 'D-01'), 1, /DECISION_REQUIRED: decision D-01 is still open; resolve it first/);
  assert.equal(verdictOf(dir).verdict, 'DECISION_REQUIRED');
  // The user's decision (a deferral) resolves it: the agreement digest changes and needs authorization naming D-01.
  const resolved = rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', 'session 2026-09-11 12:10, user reply', '--excerpt', 'skip archived items for now; do that in a later PRD');
  assert.equal(resolved.status, 0, resolved.stderr);
  assert.match(resolved.stdout, /^resolved decision D-01 on prd-v1: "skip archived items for now; do that in a later PRD" \(session 2026-09-11 12:10, user reply\)$/m);
  assert.match(resolved.stderr, /the agreement is now [0-9a-f]{12} and needs authorization: node scripts\/pincer-runtime\.cjs change authorize prd-v1 --agreement [0-9a-f]{64} --decision D-01/);
  r = record(dir);
  assert.equal(r.decisions[0].status, 'resolved'); assert.equal(r.events.at(-1).kind, 'resolve'); assert.equal(r.sequence, 4);
  assert.notEqual(digestOf(dir), digestBefore, 'a resolved decision is an agreement input');
  const afterResolve = verdictOf(dir);
  assert.equal(afterResolve.verdict, 'AGREEMENT_CHANGED'); assert.deepEqual(afterResolve.open, []);
  assert.match(afterResolve.detail, /\(decisions resolved: D-01\)/);
  assert.match(passes(rt(dir, 'change', 'show', 'prd-v1')), /^Decisions  D-01 resolved: Should the export also cover archived items\? The PRD does not say\. — "skip archived items for now; do that in a later PRD" \(session 2026-09-11 12:10, user reply\)$/m, 'a deferral is shown as a decision, never as delivery');
  assert.match(passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', 'session 2026-09-11 12:10, user reply', '--excerpt', 'skip archived items for now; do that in a later PRD', '--decision', 'D-01')), /^recorded authorization A-02 \(user\) of agreement G-02 [0-9a-f]{12} for prd-v1 · decisions D-01$/m);
  assert.equal(verdictOf(dir).verdict, 'current');
  assert.deepEqual(record(dir).agreements[1].decisions, ['D-01']); assert.equal(record(dir).events.at(-1).decision, 'D-01');
  // Resolving again with the same words is idempotent; different words refuse (decisions are never rewritten).
  assert.match(passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', 'session 2026-09-11 12:10, user reply', '--excerpt', 'skip archived items for now; do that in a later PRD')), /^unchanged: D-01 is already resolved/);
  refuses(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', 'later', '--excerpt', 'include them'), 4, /D-01 is already resolved \("skip archived items for now; do that in a later PRD", session 2026-09-11 12:10, user reply\); a different decision needs a new decision record/);
  refuses(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-09', '--reference', 'r', '--excerpt', 'e'), 4, /no decision D-09 on change prd-v1 \(recorded: D-01\)/);
  refuses(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', 'r'), 4, /--excerpt is required/);
  refuses(rt(dir, 'change', 'decide', 'prd-v1'), 2, /requires --summary/);
  assert.equal(record(dir).sequence, 5);
  // S-28: the v0.5.0 free text is history only; a genuine prior instruction is recorded without a new prompt.
  const legacyRecord = record(dir, 'feature-b');
  legacyRecord.legacy = { receipts: {}, authorization_text: 'user approved the breakdown in the planning session on 2026-09-05', migrated_from: 'binding', migrated: '2026-09-11T00:00:00Z' };
  write(dir, '.prd/changes/feature-b.json', `${JSON.stringify(legacyRecord, null, 2)}\n`);
  assert.equal(changes.validateRecord(record(dir, 'feature-b'), '.prd/changes/feature-b.json'), null);
  const lv = verdictOf(dir, 'feature-b');
  assert.equal(lv.verdict, 'AUTHORIZATION_REQUIRED');
  assert.match(lv.detail, /\(the v0\.5\.0 free text is retained as history only\)/);
  assert.match(passes(rt(dir, 'change', 'show', 'feature-b')), /^Legacy     migrated from binding at .*; v0\.5\.0 authorization text \(unvalidated\): "user approved the breakdown in the planning session on 2026-09-05"$/m);
  passes(rt(dir, 'change', 'authorize', 'feature-b', '--agreement', digestOf(dir, 'feature-b'), '--reference', 'planning session 2026-09-05 (the instruction the v0.5.0 text summarized)', '--excerpt', 'approved the breakdown'));
  assert.equal(verdictOf(dir, 'feature-b').verdict, 'current');
  // Terminal records take no authorizations or decisions.
  const cancelled = record(dir, 'feature-b');
  cancelled.decisions.push({ id: 'D-01', status: 'resolved', summary: 'drop', reference: 'r', excerpt: 'drop it', raised: cancelled.registered, resolved: cancelled.registered });
  cancelled.events.push({ sequence: cancelled.sequence + 1, kind: 'decide', from: 'planned', to: 'planned', at: cancelled.registered, reason: null, agreement: null, authorization: null, decision: 'D-01', replacement: null, note: null });
  cancelled.events.push({ sequence: cancelled.sequence + 2, kind: 'cancel', from: 'planned', to: 'cancelled', at: cancelled.registered, reason: 'dropped', agreement: null, authorization: null, decision: 'D-01', replacement: null, note: null });
  cancelled.sequence += 2; cancelled.lifecycle = { ...cancelled.lifecycle, state: 'cancelled', reason: 'dropped' };
  write(dir, '.prd/changes/feature-b.json', `${JSON.stringify(cancelled, null, 2)}\n`);
  refuses(rt(dir, 'change', 'decide', 'feature-b', '--summary', 'x'), 1, /LIFECYCLE_BLOCKED: change feature-b is cancelled; decisions belong to a new change/);
  refuses(rt(dir, 'change', 'authorize', 'feature-b', '--agreement', digestOf(dir, 'feature-b'), '--reference', 'r', '--excerpt', 'e'), 1, /LIFECYCLE_BLOCKED: change feature-b is cancelled; it cannot be authorized/);
}
console.log('change authorization tests passed');
