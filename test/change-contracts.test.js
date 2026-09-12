// PRD v5 T-47: the change lifecycle contract is a static contract. Every section,
// command, reason code, transition, authorization precondition, schema example and
// digest projection must be present and internally consistent, and the released
// v0.5.0 fixtures must keep their recorded format and provenance. This pins the
// agreement, not runtime behavior: downstream tickets implement it.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, write } from './helpers.js';

const require = createRequire(import.meta.url);
const state = require(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const parse = require(path.join(repo, 'template/scripts/pincer-runtime/parse.cjs'));
const evidence = require(path.join(repo, 'template/scripts/pincer-runtime/evidence.cjs'));
const read = relative => fs.readFileSync(path.join(repo, relative), 'utf8');
const doc = read('template/docs/runtime-contracts.md');
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rowsOf = (first, second) => doc.split('\n').filter(line => line.startsWith(`| ${first} |`) && (second === undefined || line.includes(`| ${second} |`)));
const has = (pattern, label) => assert.match(doc, pattern, label);

// --- Sections -----------------------------------------------------------------
for (const heading of ['## Modes', '## Change binding', '## Change records', '## Selection', '## Lifecycle', '## Agreements and authorization', '## Command gates', '## Transactions and recovery', '## Evaluation locator', '## Resume report', '## Migration and rollback', '## Worktrees']) {
  has(new RegExp(`^${escape(heading)}$`, 'm'), `section ${heading}`);
}
assert.doesNotMatch(doc, /\b(TBD|TODO|unsettled|to be decided|open question)\b/i, 'no unsettled decision is left in the contract');

// --- Modes: three modes, each with a recognition rule and a status line ---------
const modesHeader = doc.split('\n').find(line => line.startsWith('| | Legacy (no record) |'));
assert.ok(modesHeader && modesHeader.includes('Migrated (one schema 1 binding)') && modesHeader.includes('Changes (schema 2 records)'), 'three modes');
for (const row of ['How recognized', 'Selected PRD for status', 'Readiness authority', 'Candidate locator', 'Status line']) assert.equal(rowsOf(row).length, 1, `mode row ${row}`);
has(/mixes schema 1 and schema 2\nfiles[\s\S]*?`INPUT_INVALID`/, 'mixed schemas are invalid');
has(/an unreadable\nschema 2 record never makes the project legacy or migrated/, 'no legacy fallback');

// --- Commands: every v5 command has a row with arguments and a writes column ----
const commands = ['register', 'status', 'ready', 'recover', 'migrate', 'check', 'evidence export', 'change list', 'change show', 'change select', 'change activate', 'change pause', 'change resume', 'change complete', 'change reopen', 'change cancel', 'change supersede', 'change revise', 'change authorize', 'change decide', 'resume'];
for (const command of commands) assert.ok(rowsOf(`\`${command}\``).length >= 1, `command row ${command}`);
assert.equal(rowsOf('`change authorize`').length, 2, 'both authorization dispositions have a command row');
assert.equal(rowsOf('`change decide`').length, 2, 'raise and resolve have a command row');
has(/`change select` \| `<id>` \| `\.pincer\/runtime\/selection\.json` \| local pointer only/, 'select writes the local pointer only');
has(/`resume` \| `\[--change <id>\] \[--json\]` \| nothing \|/, 'resume report is read-only');
has(/`change resume` \| `<id>` \| the record \(event\) \| `paused` → `active`; the lifecycle operation, distinct from the `resume` report/, 'resume vs change resume are distinguished');
for (const [code, meaning] of [['0', /inspection succeeded even when work is not ready/], ['1', /refused/], ['2', /usage/], ['3', /busy/], ['4', /incomplete transaction/], ['124', /timed out/], ['130', /interrupted/]]) {
  const row = doc.split('\n').find(line => line.startsWith(`| ${code} |`));
  assert.ok(row, `exit code ${code}`); assert.match(row, meaning, `exit code ${code} meaning`);
}
has(/at most 2000 characters that is stored verbatim/, 'argument texts are bounded');

// --- Reason codes -------------------------------------------------------------
const codes = ['CHANGE_REQUIRED', 'MIGRATION_REQUIRED', 'REVISION_CHANGED', 'CHECK_CHANGED', 'SOURCE_CHANGED', 'CHECK_FAILED', 'ATTEMPT_RUNNING', 'ATTEMPT_INTERRUPTED', 'ATTEMPT_TIMED_OUT', 'ATTEMPT_ERROR', 'EVIDENCE_MISSING', 'LEGACY_RECEIPT', 'HISTORICAL_EVIDENCE', 'CRITERIA_UNTICKED', 'DEPENDENCY_BLOCKED', 'INPUT_INVALID', 'MALFORMED', 'UNSUPPORTED_SCHEMA', 'HISTORY_INVALID', 'STATE_INCOMPLETE', 'STATE_CHANGED', 'SELECTION_REQUIRED', 'SELECTION_INVALID', 'WRONG_CHANGE', 'LIFECYCLE_BLOCKED', 'BASE_MISMATCH', 'AUTHORIZATION_REQUIRED', 'AGREEMENT_CHANGED', 'DECISION_REQUIRED', 'CANDIDATE_STALE', 'STATE_BUSY', 'SECRET_PATH', 'UNSUPPORTED_INPUT'];
const reasonSection = doc.slice(doc.indexOf('## Readiness and reason codes'), doc.indexOf('## Evidence schema 2'));
for (const code of codes) {
  const row = reasonSection.split('\n').find(line => line.startsWith(`| \`${code}\` |`));
  assert.ok(row, `reason code row ${code}`);
  assert.equal(row.split('|').length, 5, `reason code ${code} has meaning and next action`);
}

// --- Change record schema 2: field owners, invariants, examples ----------------
const RECORD_KEYS = ['schema', 'runtime', 'change', 'prd', 'base', 'registered', 'sequence', 'lifecycle', 'agreements', 'authorizations', 'decisions', 'events', 'evaluations', 'legacy'];
for (const key of RECORD_KEYS) assert.ok(rowsOf(`\`${key}\``).length >= 1 || rowsOf(`\`${key}\`, \`runtime\``).length >= 1, `record field ${key} has an owner row`);
const fieldTable = doc.slice(doc.indexOf('## Change records'), doc.indexOf('## Selection'));
assert.match(fieldTable, /\| Field \| Owner \| Value \|/, 'every persistent field has one owner column');
has(/`sequence` equals `events\.length`/, 'record revision is the event count');
has(/kind` is one of `register`, `activate`, `pause`, `resume`,\n`complete`, `reopen`, `cancel`, `supersede`, `agreement`, `authorize`, `decide`,\n`resolve`, `migrate`/, 'event kinds are enumerated');
has(/never\nby last-writer-wins/, 'merge conflicts are explicit invalid state');

const LIFECYCLE = { register: [null, 'planned'], activate: ['planned', 'active'], pause: ['active', 'paused'], resume: ['paused', 'active'], complete: ['active', 'completed'], reopen: ['completed', 'active'], cancel: [['planned', 'active', 'paused'], 'cancelled'], supersede: [['planned', 'active', 'paused', 'completed'], 'superseded'] };
function replay(events) {
  let stateNow = null;
  for (const [i, e] of events.entries()) {
    if (e.sequence !== i + 1) return { error: `event ${i} has sequence ${e.sequence}` };
    const rule = LIFECYCLE[e.kind];
    if (rule) {
      const from = Array.isArray(rule[0]) ? rule[0] : [rule[0]];
      if (!from.includes(stateNow) || e.from !== stateNow || e.to !== rule[1]) return { error: `event ${e.sequence} ${e.kind} from ${stateNow}` };
      stateNow = rule[1];
    } else if (e.from !== stateNow || e.to !== stateNow) return { error: `event ${e.sequence} ${e.kind} changes state` };
  }
  return { state: stateNow };
}
const fences = [...doc.matchAll(/```json\n([\s\S]*?)```/g)].map(m => JSON.parse(m[1]));
assert.ok(fences.length >= 8, `json examples parse (${fences.length})`);
const records = fences.filter(d => d.schema === 2 && 'events' in d && 'lifecycle' in d);
assert.equal(records.length, 3, 'a valid, an inconsistent and a conflicting record example');
const [valid, inconsistent, conflicting] = records;
for (const r of records) assert.deepEqual(Object.keys(r), RECORD_KEYS, 'record examples carry exactly the documented keys in order');
assert.equal(valid.sequence, valid.events.length);
assert.equal(replay(valid.events).state, valid.lifecycle.state, 'the valid example projection matches its history');
assert.equal(valid.lifecycle.state, 'paused'); assert.equal(valid.events.at(-1).note, valid.lifecycle.note, 'the handoff note is the pause event note');
assert.equal(valid.authorizations[0].digest, valid.agreements[0].digest); assert.equal(valid.authorizations[0].agreement, 'G-01');
assert.notEqual(inconsistent.sequence, inconsistent.events.length, 'the inconsistent example breaks the sequence rule');
assert.notEqual(replay(inconsistent.events).state, inconsistent.lifecycle.state, 'the inconsistent example breaks the projection rule');
assert.equal(conflicting.prd, valid.prd); assert.notEqual(conflicting.change, valid.change, 'the conflicting example claims the same PRD under another id');
assert.ok(fences.some(d => d.schema === 3), 'an unknown-schema example');
has(/```text\n\{ "schema": 2, "change": "prd-v2", "prd": "\.prd\/prd-v2\.md", "sequence": \n```\n\nis `MALFORMED`/, 'a malformed example');
for (const [state_, ops] of [['planned', 'activate'], ['active', 'pause'], ['paused', 'resume'], ['active', 'complete'], ['completed', 'reopen']]) assert.ok(rowsOf(`\`${state_}\``).some(r => r.includes(`\`change ${ops}`)), `transition row ${state_} → ${ops}`);
has(/\| `planned`, `active`, `paused` \| `change cancel --decision D-NN --reason` \| `cancelled` \|/, 'cancel row');
has(/\| `planned`, `active`, `paused`, `completed` \| `change supersede --with <id> --decision D-NN` \| `superseded` \|/, 'supersede row');
has(/\| `cancelled`, `superseded` \| any execution, `activate`, `resume`, `reopen`, `revise`, `authorize`, `decide` \| refused \|/, 'terminal row');
has(/At most\none record among the records in the tree may be `active` at a time/, 'one active change');
has(/writes no event\. Every other pair not in the table is\n`LIFECYCLE_BLOCKED`/, 'idempotence and refusal');
has(/`completed` means implementation complete and ready for evaluation\. It is not\nevaluated, release-ready, merged or published/, 'completed is not released');
has(/the resulting commit is the candidate/, 'completion precedes the candidate');

// --- Selection ----------------------------------------------------------------
const selection = fences.find(d => d.schema === 1 && 'selected' in d);
assert.deepEqual(Object.keys(selection), ['schema', 'change', 'selected']);
has(/no file → `SELECTION_REQUIRED` even when only one\nrecord exists/, 'fresh clone selects explicitly');
has(/`SELECTION_INVALID` \(no fallback to another record, the\nhighest PRD or the newest record\)/, 'no fallback');
has(/never checks\nout, stashes, resets, commits or creates a worktree/, 'selection changes no source');
has(/The branch name is a\nhint printed for the developer; it is never identity, authorization or proof/, 'branch names are hints');

// --- Agreements: exact projection, digest inputs and exclusions, verdicts ------
const projection = doc.match(/```\npincer agreement 1\n([\s\S]*?)```/);
assert.ok(projection, 'the agreement projection is an exact text');
assert.match(projection[1], /^change <change id>\nprd <\.prd\/prd-vN\.md> <prd_revision>\nticket <T-NN> <ticket_digest>/m);
assert.match(projection[1], /^decision <D-NN> <decision digest>/m);
has(/open decisions are not agreement inputs/, 'open decisions gate rather than hash');
has(/Authorizations, lifecycle events, evaluations, attempts,\nthe selection and the change record itself are never inputs/, 'exclusions enumerated');
has(/ticking a criterion,\nstarting or closing a ticket, recording an attempt or editing implementation source\nnever changes the agreement/, 'stable inputs');
const snapshot = fences.find(d => d.schema === 1 && 'projection' in d);
assert.deepEqual(Object.keys(snapshot), ['schema', 'change', 'agreement', 'digest', 'projection', 'prd', 'tickets', 'decisions', 'recorded'], 'snapshot keys');
has(/recomputed digest differs is `HISTORY_INVALID`/, 'digest-only history is refused');
for (const verdict of ['current', 'AUTHORIZATION_REQUIRED', 'AGREEMENT_CHANGED', 'DECISION_REQUIRED']) assert.ok(rowsOf(`\`${verdict}\``).length >= 1, `verdict ${verdict}`);
has(/cannot be created by\n  the runtime from a PRD status, a ticket status, a passing check, a registration or\n  the v0\.5\.0 free text/, 'no inferred approval');
has(/`--basis A-NN` names an earlier authorization of the same record/, 'delegation chain');
has(/idempotent: a\nsecond identical record[\s\S]*?writes nothing and exits 0/, 'authorization is idempotent');
has(/`AGREEMENT_CHANGED` when a prepared digest no longer\nmatches/, 'stale prepared decision refuses');

// --- Gates and precedence -------------------------------------------------------
has(/\| `start`, `done` \| selected change owns the ticket; state `active`; view compatible; authorization `current` \|/, 'start/done gate');
has(/\| `verify` \| selected change owns the ticket; state `active` or `completed`/, 'verify gate');
has(/\| `check`, `evidence export` \| selected change owns the PRD; state `completed`/, 'candidate gate');
has(/Refused executions print nothing on stdout, launch nothing and leave\nevery ticket, record, index and selection file unchanged/, 'refusal before side effects');
has(/`SELECTION_REQUIRED`\/`SELECTION_INVALID` → `WRONG_CHANGE` → `LIFECYCLE_BLOCKED` →\n`BASE_MISMATCH` → `DECISION_REQUIRED` → `AUTHORIZATION_REQUIRED`\/`AGREEMENT_CHANGED`/, 'gate order');
has(/For `verify` and `check` the guard runs twice: once before anything is prepared, and\nagain under the worktree lock immediately before the `running` attempt record is\nwritten\. The second evaluation is the one that counts/, 'gates are evaluated again under the attempt lock (review finding 1, T-63)');
has(/a transition\ncommitted before the check's lock refuses the check/, 'contention order names the second evaluation');
const precedence = doc.slice(doc.indexOf('Next-action precedence'), doc.indexOf('## Migration and rollback'));
for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) assert.match(precedence, new RegExp(`^${n}\\. `, 'm'), `precedence rule ${n}`);
assert.match(precedence, /1\. invalid or missing state[\s\S]*2\. an unresolved `running` attempt[\s\S]*3\. lifecycle or repository mismatch[\s\S]*4\. agreement or decision gap[\s\S]*5\. failed or stale verification or unfinished work[\s\S]*6\. .*`change complete`[\s\S]*7\. .*`\/pincer-evaluate`[\s\S]*8\. .*`\/pincer-release`/, 'precedence order as the PRD states');
has(/`handoff` is the authored pause or reopen reason and note, labeled `authored: true`; it\nis displayed and never used as an input/, 'notes cannot override computed state');

// --- Transactions, locator, attempts, worktrees, migration --------------------
const txn = fences.find(d => d.schema === 1 && 'writes' in d);
assert.deepEqual(Object.keys(txn), ['schema', 'id', 'command', 'started', 'writes']);
has(/The manifest is the commit point/, 'commit point');
has(/a projection without its event cannot be observed/, 'atomicity claim');
has(/refuse with\n`ATTEMPT_RUNNING` naming the attempt when one belongs to the change\. They never\nterminate it/, 'running attempts block, never killed');
has(/No lock is held across user interaction/, 'no lock across interaction');
const locator = fences.find(d => d.schema === 1 && 'evaluations' in d && !('events' in d));
assert.deepEqual(Object.keys(locator.evaluations[0]), ['candidate', 'base', 'prd', 'prd_revision', 'agreement', 'manifest', 'recorded']);
has(/is not listed in any manifest \(so no digest refers to\nitself\)/, 'no self-referential digest');
has(/`ticket:<change>:<T-NN>` and `candidate:<change>:<40 hex>:<C-NN>` in changes\nmode/, 'candidate keys are change-scoped');
has(/`ticket:<change>:<T-NN>` and `candidate:<40 hex>:<C-NN>` in migrated\nmode/, 'migrated keys unchanged');
has(/plus `context\.agreement`\)/, 'attempt schema 2 adds the agreement');
has(/`schema: 1` \(recorded before migration\) is\n`HISTORICAL_EVIDENCE`/, 'old attempts are historical');
has(/Local state \(`\.pincer\/runtime\/`,\nincluding the selection, attempts and the lock\) belongs to one worktree and is never\nshared or copied/, 'worktree independence');
has(/does not\nclaim to prevent two developers from working on the same change independently/, 'no distributed ownership');
has(/`legacy\.authorization_text`[\s\S]*unvalidated/, 'old free text is unvalidated');
has(/`migrate --apply` is one transaction/, 'migration is atomic');
has(/Rollback: restore the files from the backup directory/, 'rollback documented');
has(/`register --replace` \(delete the other PRD's binding\)\nis refused in migrated mode with `MIGRATION_REQUIRED`/, 'destructive replace refused');

// --- Released v0.5.0 fixtures: provenance and format ---------------------------
const fx = 'test/fixtures/prd-v5';
const readme = read(`${fx}/README.md`);
assert.match(readme, /git tag `v0\.5\.0`, commit\n`2d244eb4197638f4f9344912baacc2e2cff3a770`/, 'fixture provenance names the released commit');
assert.match(readme, /never regenerated by the new runtime/);
const binding = JSON.parse(read(`${fx}/v0.5.0/changes/prd-v1.json`));
assert.deepEqual(Object.keys(binding), ['schema', 'change', 'prd', 'prd_revision', 'base', 'registered', 'authorization', 'runtime', 'legacy_receipts'], 'schema 1 binding keys as released');
assert.equal(binding.schema, 1); assert.equal(binding.runtime, 1); assert.equal(binding.change, 'prd-v1');
assert.equal(typeof binding.authorization, 'string', 'the released free-text authorization is present to be imported as unvalidated text');
assert.deepEqual(Object.keys(binding.legacy_receipts), ['T-01']);
assert.match(binding.legacy_receipts['T-01'].verified, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z [0-9a-f]{12}$/);
assert.equal(binding.prd_revision, parse.prdDigest(read(`${fx}/v0.5.0/prd/prd-v1.md`)), 'the binding revision is the fixture PRD digest');
const index = JSON.parse(read(`${fx}/v0.5.0/runtime/index.json`));
assert.equal(index.schema, 1); assert.equal(index.sequence, 3); assert.deepEqual(index.running, []);
assert.deepEqual(Object.keys(index.current), ['ticket:prd-v1:T-01', 'ticket:prd-v1:T-02', 'candidate:e8e55a7fdd4f359eff1cb3b9ba143edfe96af861:C-01'], 'released context keys (candidate key without change)');
for (const [key, id] of Object.entries(index.current)) {
  const record = JSON.parse(read(`${fx}/v0.5.0/runtime/attempts/${id}.json`));
  assert.equal(record.schema, 1); assert.equal(record.runtime, 1);
  assert.equal(state.validateAttempt(record, key, id), null, `released attempt ${id} validates as schema 1 for ${key}`);
  assert.ok(!('agreement' in record.context), 'schema 1 records carry no agreement');
  assert.equal(record.outcome, 'passed');
  for (const stream of ['stdout', 'stderr']) {
    const data = fs.readFileSync(path.join(repo, fx, 'v0.5.0/runtime', `attempts/${id}/${stream}.log`));
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), record.artifacts[stream].sha256, `${stream} log digest of ${id}`);
  }
  assert.equal(record.owner.host, 'fixture-host.example', 'host name replaced for privacy only');
}
const manifests = fs.readdirSync(path.join(repo, fx, 'v0.5.0/runtime/manifests'));
assert.equal(manifests.length, 1, 'one stored source manifest');
const stored = JSON.parse(read(`${fx}/v0.5.0/runtime/manifests/${manifests[0]}`));
assert.equal(stored.schema, 1); assert.equal(`${stored.digest}.json`, manifests[0]);
// The released evidence manifest validates in a scratch project (artifacts present, digests intact).
{
  const dir = tempDir();
  const candidate = 'e8e55a7fdd4f359eff1cb3b9ba143edfe96af861';
  const src = path.join(repo, fx, 'v0.5.0/evidence');
  fs.cpSync(src, path.join(dir, '.prd/evidence'), { recursive: true });
  write(dir, '.prd/prd-v1.md', read(`${fx}/v0.5.0/prd/prd-v1.md`));
  const manifest = path.join(dir, `.prd/evidence/prd-v1/${candidate}/manifest.json`);
  assert.deepEqual(evidence.validate(manifest, { candidate, prd: '.prd/prd-v1.md', base: '5d3ec528a1baac4a1bb095069f94aad18a06cb4d' }, dir), [], 'released schema 2 evidence validates');
  const m = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  assert.equal(m.schema, 2); assert.deepEqual(m.change, { id: 'prd-v1', prd_revision: binding.prd_revision, base: binding.base });
  assert.equal(m.checks.find(c => c.id === 'C-01').attempt.id, index.current[`candidate:${candidate}:C-01`], 'exported attempt is the pointed-at candidate attempt');
}
for (const file of ['legacy/tickets/T-01-example.md', 'legacy/tickets/T-02-example.md', 'v0.5.0/tickets/T-01-example.md', 'v0.5.0/tickets/T-02-example.md', 'v0.5.0/backups/20260911T202504Z/tickets/T-01-example.md']) {
  const text = read(`${fx}/${file}`);
  assert.ok(parse.validateTicket(path.basename(file), text).ok, `${file} validates`);
}
const legacyDone = parse.validateTicket('T-01-example.md', read(`${fx}/legacy/tickets/T-01-example.md`)).fields;
assert.equal(legacyDone.status, 'done'); assert.ok(legacyDone.verified && legacyDone.last_check, 'legacy receipts in the ticket');
assert.equal(read(`${fx}/legacy/tickets/T-01-example.md`), read(`${fx}/v0.5.0/backups/20260911T202504Z/tickets/T-01-example.md`), 'the migration backup is the byte-identical legacy original');
const migratedDone = parse.validateTicket('T-01-example.md', read(`${fx}/v0.5.0/tickets/T-01-example.md`)).fields;
assert.ok(!migratedDone.verified && !migratedDone.last_check, 'migrated ticket carries no receipts');
assert.match(read(`${fx}/v0.5.0/outputs/migrate-preview.txt`), /legacy_receipts\[T-01\] \(history, not runtime evidence\)/);
assert.match(read(`${fx}/v0.5.0/outputs/status.txt`), /^Runtime  change prd-v1 · revision [0-9a-f]{12} · base [0-9a-f]{7}$/m, 'released migrated-mode status line');
const statusJson = JSON.parse(read(`${fx}/v0.5.0/outputs/status.json`));
assert.equal(statusJson.schema, 1); assert.equal(statusJson.mode, 'migrated'); assert.equal(statusJson.candidate.notes, 'current');
assert.equal(read(`${fx}/v0.5.0/gitignore`), '.pincer/\n');
assert.doesNotMatch(read(`${fx}/v0.5.0/NOTES.md`), /evidence:\s*$/m);

// The contract ships in the plugin like the rest of the document (pinned by contracts.test.js as well).
assert.equal(read('plugin/docs/runtime-contracts.md').replaceAll('${CLAUDE_PLUGIN_ROOT}/', '').replaceAll('/pincer:', '/pincer-'), doc, 'plugin copy is current');
console.log('change contract tests passed');
