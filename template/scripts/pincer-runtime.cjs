#!/usr/bin/env node
'use strict';
// PINCER runtime — the local command entry point (docs/runtime-contracts.md).
//
//   node scripts/pincer-runtime.cjs validate <file>... [--digests]
//   node scripts/pincer-runtime.cjs register --prd .prd/prd-vN.md [--change <id>] [--authorization <text>] [--replace] [--rebind]
//   node scripts/pincer-runtime.cjs snapshot [--json] [--store]
//   node scripts/pincer-runtime.cjs recover
//   node scripts/pincer-runtime.cjs status [--json] [--change <id>]
//   node scripts/pincer-runtime.cjs ready [T-NN]
//   node scripts/pincer-runtime.cjs start|verify|done T-NN · bind T-NN .prd/prd-vN.md
//   node scripts/pincer-runtime.cjs migrate --preview|--apply --prd .prd/prd-vN.md [--change <id>] [--authorization <text>]
//   node scripts/pincer-runtime.cjs check C-NN --candidate <sha> [--timeout <seconds>] -- <command...>
//   node scripts/pincer-runtime.cjs evidence export --candidate <sha> --base <sha> --prd .prd/prd-vN.md --draft <file>
//   node scripts/pincer-runtime.cjs change list [--json] · change show <id> [--json] · change select <id>
//
// Exit codes: 0 ok · 1 failed/not ready/refused · 2 usage · 3 state busy ·
// 4 invalid input or state · 124 timed out · 130 interrupted.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const parse = require('./pincer-runtime/parse.cjs');
const identity = require('./pincer-runtime/identity.cjs');
const source = require('./pincer-runtime/source.cjs');
const state = require('./pincer-runtime/state.cjs');
const status = require('./pincer-runtime/status.cjs');
const runner = require('./pincer-runtime/runner.cjs');
const sanitize = require('./pincer-runtime/sanitize.cjs');
const lifecycle = require('./pincer-runtime/lifecycle.cjs');
const migrate = require('./pincer-runtime/migrate.cjs');
const evidence = require('./pincer-runtime/evidence.cjs');
const changes = require('./pincer-runtime/changes.cjs');
const { atomicWrite, nowIso, tryGit } = require('./pincer-runtime/fsutil.cjs');
const EXIT = { OK: 0, FAILED: 1, USAGE: 2, BUSY: 3, INVALID: 4, TIMED_OUT: 124, INTERRUPTED: 130 };

function repoRoot() {
  if (process.env.CLAUDE_PROJECT_DIR) return path.resolve(process.env.CLAUDE_PROJECT_DIR);
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return process.cwd();
  }
}

function usage(message) {
  if (message) process.stderr.write(`pincer: ${message}\n`);
  process.stderr.write('usage: pincer-runtime.cjs validate <file>... [--digests]\n' +
    '       pincer-runtime.cjs register --prd .prd/prd-vN.md [--change <id>] [--authorization <text>] [--replace] [--rebind]\n' +
    '       pincer-runtime.cjs snapshot [--json] [--store]\n' +
    '       pincer-runtime.cjs recover\n' +
    '       pincer-runtime.cjs status [--json] [--change <id>]\n' +
    '       pincer-runtime.cjs ready [T-NN]\n' +
    '       pincer-runtime.cjs start|verify|done T-NN\n' +
    '       pincer-runtime.cjs bind T-NN .prd/prd-vN.md\n' +
    '       pincer-runtime.cjs migrate --preview|--apply --prd .prd/prd-vN.md [--change <id>] [--authorization <text>]\n' +
    '       pincer-runtime.cjs check C-NN --candidate <sha> [--timeout <seconds>] -- <command...>\n' +
    '       pincer-runtime.cjs evidence export --candidate <sha> --base <sha> --prd .prd/prd-vN.md --draft <file>\n' +
    '       pincer-runtime.cjs change list [--json] · change show <id> [--json] · change select <id>\n');
  process.exit(EXIT.USAGE);
}

// The clean-view precondition for candidate checks and exports: HEAD is the
// candidate and nothing is dirty outside NOTES.md and the candidate's evidence
// directory. Never stashes, resets or commits.
function requireCandidateView(root, candidate, prd) {
  const head = identity.head(root);
  if (!head) fail('pincer', 'not a git repository with commits', EXIT.INVALID);
  const version = prd.match(parse.PRD_REF)[1];
  const allowed = p => p === 'NOTES.md' || p.startsWith(`.prd/evidence/prd-v${version}/${candidate}/`);
  if (head !== candidate) {
    // A descendant that only adds NOTES.md and the candidate's evidence (the
    // evaluate commit) is still a clean view of the candidate's source.
    const ancestor = tryGit(root, ['merge-base', '--is-ancestor', candidate, 'HEAD']);
    const diff = ancestor.error ? { error: 'not an ancestor' } : tryGit(root, ['diff', '--name-only', candidate, 'HEAD']);
    const differing = diff.error ? null : diff.out.split('\n').filter(Boolean).filter(p => !allowed(p));
    if (!differing || differing.length) {
      fail('pincer', `HEAD is ${head.slice(0, 7)}, not the candidate ${candidate.slice(0, 7)}${differing ? ` and differs from it in: ${differing.slice(0, 5).join(', ')}` : ' (the candidate is not an ancestor of HEAD)'}; check out the committed candidate first (no stash, reset or commit is made for you)`, EXIT.FAILED);
    }
  }
  const dirty = tryGit(root, ['status', '--porcelain', '--untracked-files=all']);
  if (dirty.error) fail('pincer', `git status failed: ${dirty.error}`, EXIT.INVALID);
  const offending = dirty.out.split('\n').filter(Boolean).map(l => l.slice(3).replace(/^"(.*)"$/, '$1')).filter(p => !allowed(p));
  if (offending.length) fail('pincer', `the working tree is not a clean view of the candidate: ${offending.slice(0, 5).join(', ')}${offending.length > 5 ? ` (+${offending.length - 5})` : ''}; only NOTES.md and .prd/evidence/prd-v${version}/${candidate}/ may differ`, EXIT.FAILED);
}

async function cmdCheck(root, args) {
  const o = parseOptions(args, { valued: ['--candidate', '--timeout'] });
  const [checkId, ...command] = o.positional;
  if (!checkId || !evidence.CHECK_ID.test(checkId)) usage('check requires a check ID such as C-01');
  if (!o.candidate || !parse.HEX40.test(o.candidate)) usage('check requires --candidate <full 40-hex commit ID>');
  if (!command.length) usage('check requires the command after --');
  const timeout = o.timeout === undefined ? parse.DEFAULT_TIMEOUT : Number(o.timeout);
  if (!Number.isInteger(timeout) || timeout <= 0) usage('--timeout must be a positive integer number of seconds');
  const bind = identity.loadBinding(root);
  if (bind.code) fail('pincer', `${bind.code}: ${bind.problem}`, EXIT.INVALID);
  const b = bind.binding;
  requireCandidateView(root, o.candidate, b.prd);
  const line = command.join(' ');
  const secretLine = sanitize.inlineSecretLine([line]);
  if (secretLine) fail('pincer', 'the check command assigns a secret-like literal; reference it from the environment instead', EXIT.INVALID);
  process.stdout.write(`── ${checkId} candidate ${o.candidate.slice(0, 7)} ──\n  $ ${sanitize.sanitizeText(line).text}\n`);
  const context = { kind: 'candidate', change: b.change, prd: b.prd, prd_revision: b.prd_revision, base: b.base, candidate: o.candidate, check: checkId };
  const result = await runner.runAttempt({ root, context, commands: [line], timeoutSeconds: timeout, command: `check ${checkId}` });
  if (result.code) fail('pincer', `${result.code}: ${result.problem}`, problemExit(result.code));
  const a = result.attempt;
  const logs = `${state.RUNTIME_DIR}/attempts/${a.id}/`;
  if (a.outcome === 'passed') process.stdout.write(`✓ ${checkId} passed — attempt ${a.id} (source ${a.source.after.slice(0, 12)}, logs ${logs})\n`);
  else process.stderr.write(`✗ ${checkId} ${a.outcome}${a.exit_code !== null ? ` (exit ${a.exit_code})` : ''}${a.error ? `: ${a.error}` : ''} — attempt ${a.id} (logs ${logs})\n`);
  process.exit(runner.exitFor(a));
}

function cmdEvidence(root, args) {
  const [sub, ...rest] = args;
  if (sub !== 'export') usage('evidence supports: export');
  const o = parseOptions(rest, { valued: ['--candidate', '--base', '--prd', '--draft'] });
  if (o.positional.length) usage(`unexpected argument ${o.positional[0]}`);
  for (const key of ['candidate', 'base']) if (!o[key] || !parse.HEX40.test(o[key])) usage(`evidence export requires --${key} <full 40-hex commit ID>`);
  if (!o.prd || !parse.PRD_REF.test(o.prd)) usage('evidence export requires --prd .prd/prd-vN.md');
  if (!o.draft) usage('evidence export requires --draft <file>');
  const bind = identity.loadBinding(root, { prd: o.prd });
  if (bind.code) fail('pincer', `${bind.code}: ${bind.problem}`, EXIT.INVALID);
  requireCandidateView(root, o.candidate, o.prd);
  let draft;
  try { draft = JSON.parse(fs.readFileSync(path.resolve(root, o.draft), 'utf8')); } catch (error) { fail('pincer', `cannot read draft ${o.draft}: ${error.message}`, EXIT.INVALID); }
  const indexRead = state.exists(root) ? state.readIndex(root) : { index: null };
  if (indexRead.error) fail('pincer', indexRead.error, EXIT.INVALID);
  const attemptsFor = checkId => {
    if (!indexRead.index) return { attempt: null, pointed: null };
    const key = state.contextKey({ kind: 'candidate', candidate: o.candidate, check: checkId });
    return { attempt: state.latestAttempt(root, key, indexRead.index), pointed: indexRead.index.current[key] || null };
  };
  const os = require('node:os');
  const result = evidence.exportEvidence(root, {
    candidate: o.candidate, base: o.base, prd: o.prd, draft, binding: bind.binding, attemptsFor,
    environment: { os: `${os.platform()} ${os.release()}`, node: process.version }, now: nowIso(), atomicWrite,
  });
  if (result.problems.length) {
    for (const p of result.problems) process.stderr.write(`evidence: ${result.manifest || o.draft}: ${p}\n`);
    process.exit(EXIT.FAILED);
  }
  process.stdout.write(`exported ${result.manifest} (schema 2) — validate: node scripts/pincer-evidence.cjs validate ${result.manifest} --candidate ${o.candidate} --prd ${o.prd}\n`);
  process.exit(EXIT.OK);
}

function cmdMigrate(root, args) {
  const o = parseOptions(args, { valued: ['--prd', '--change', '--authorization'], switches: ['--preview', '--apply'] });
  if (o.positional.length) usage(`unexpected argument ${o.positional[0]}`);
  if (!o.prd) usage('migrate requires --prd .prd/prd-vN.md');
  if (Boolean(o.preview) === Boolean(o.apply)) usage('migrate requires exactly one of --preview or --apply');
  const options = { prd: o.prd, change: o.change, authorization: o.authorization ?? null };
  if (o.preview) {
    const p = migrate.plan(root, options);
    process.stdout.write(migrate.renderPlan(p));
    process.exit(p.conflicts.length ? EXIT.FAILED : EXIT.OK);
  }
  const result = migrate.apply(root, options);
  if (result.plan.conflicts.length) { process.stdout.write(migrate.renderPlan(result.plan)); process.exit(EXIT.FAILED); }
  if (result.already) { process.stdout.write(`already migrated: ${o.prd} is bound as change ${result.plan.change}; nothing changed\n`); process.exit(EXIT.OK); }
  if (result.error) { process.stderr.write(`pincer: migration stopped before the binding was written: ${result.error}\n`); process.exit(EXIT.INVALID); }
  const b = result.binding;
  process.stdout.write(`migrated ${o.prd} → change ${b.change} (revision ${b.prd_revision.slice(0, 12)}, base ${b.base.slice(0, 7)}, ${Object.keys(result.plan.tickets.length ? b.legacy_receipts : {}).length || result.plan.tickets.length} ticket(s) rewritten)\n`);
  if (result.backupDir) process.stdout.write(`backups: ${result.backupDir} (${result.backups.length} file(s)); rollback per docs/runtime-contracts.md\n`);
  if (!o.authorization) process.stderr.write('pincer: note: no --authorization recorded; migration does not prove human approval\n');
  process.exit(EXIT.OK);
}

const fail = (prefix, message, code = EXIT.INVALID) => { process.stderr.write(`${prefix}: ${message}\n`); process.exit(code); };

// start | verify | done | bind — both modes; refusals carry their prefix and exit code.
async function cmdLifecycle(root, command, args) {
  const usageLine = { start: 'start T-NN', verify: 'verify T-NN', done: 'done T-NN', bind: 'bind T-NN .prd/prd-vN.md' }[command];
  const expected = command === 'bind' ? 2 : 1;
  const o = parseOptions(args, {});
  if (o.positional.length !== expected) usage(`usage: pincer-runtime.cjs ${usageLine}`);
  try {
    const result = command === 'bind' ? lifecycle.bind(root, o.positional[0], o.positional[1])
      : command === 'start' ? lifecycle.start(root, o.positional[0])
        : command === 'verify' ? await lifecycle.verify(root, o.positional[0])
          : await lifecycle.done(root, o.positional[0]);
    if (result.out) process.stdout.write(result.out);
    process.exit(result.exit ?? EXIT.OK);
  } catch (error) {
    if (error instanceof lifecycle.Refusal) fail(error.prefix, error.message, error.exit);
    throw error;
  }
}

function cmdStatus(root, args) {
  const o = parseOptions(args, { switches: ['--json'], valued: ['--change'] });
  if (o.positional.length) usage(`unexpected argument ${o.positional[0]}`);
  const budget = process.env.PINCER_BUILD_BUDGET_MIN || '';
  const result = status.render(root, { budget, change: o.change || null });
  if (o.json) process.stdout.write(`${JSON.stringify(result.json, null, 2)}\n`);
  else process.stdout.write(result.text);
  process.exit(result.exit);
}

// Read-only readiness gate: a ticket, or the candidate when no ticket is named.
function cmdReady(root, args) {
  const o = parseOptions(args, { valued: ['--change'] });
  if (o.positional.length > 1) usage('ready takes at most one ticket ID');
  const result = status.render(root, { change: o.change || null });
  if (result.exit !== 0) { process.stderr.write(result.text); process.exit(result.exit); }
  const j = result.json;
  if (o.positional.length === 1) {
    const id = parse.normalizeId(o.positional[0]);
    const ticket = id && j.tickets.find(t => t.id === id);
    if (!ticket) { process.stderr.write(`pincer: no ticket ${o.positional[0]} is associated with the selected PRD\n`); process.exit(EXIT.INVALID); }
    if (ticket.readiness.ready) { process.stdout.write(`ready ${id}\n`); process.exit(EXIT.OK); }
    for (const r of ticket.readiness.reasons) process.stdout.write(`not ready ${id}: ${r.code} ${r.detail}\n`);
    process.stdout.write(`next: ${ticket.readiness.next}\n`);
    process.exit(EXIT.FAILED);
  }
  const blockers = [];
  const localUnavailable = j.candidate && j.candidate.local_attempts === 'unavailable';
  for (const t of j.tickets) {
    if (t.status !== 'done') blockers.push({ code: 'EVIDENCE_MISSING', detail: `${t.id} is ${t.status}, not done` });
    else for (const r of t.readiness.reasons) {
      // A fresh clone validates the saved candidate record only; missing local attempts are its stated limit, not a blocker.
      if (localUnavailable && r.code === 'EVIDENCE_MISSING') continue;
      blockers.push({ code: r.code, detail: `${t.id}: ${r.detail}` });
    }
  }
  if (!j.prd) blockers.push({ code: 'INPUT_INVALID', detail: 'no PRD' });
  else if (j.prd.status !== 'built') blockers.push({ code: 'CANDIDATE_STALE', detail: `PRD status is '${j.prd.status}', expected 'built'` });
  if (j.candidate) blockers.push(...j.candidate.reasons);
  if (!blockers.length) { process.stdout.write(`ready candidate ${j.candidate.candidate}\n`); process.exit(EXIT.OK); }
  for (const b of blockers) process.stdout.write(`not ready: ${b.code} ${b.detail}\n`);
  process.stdout.write(`next: ${j.next}\n`);
  process.exit(EXIT.FAILED);
}

// Run a state operation, mapping the contracted failures to exit codes.
function guarded(fn) {
  try { return fn(); } catch (error) {
    if (error && error.code === 'STATE_BUSY') { process.stderr.write(`pincer: STATE_BUSY: ${error.message}\n`); process.exit(EXIT.BUSY); }
    if (error && error.code === 'INVALID') { process.stderr.write(`pincer: ${error.message}\n`); process.exit(EXIT.INVALID); }
    throw error;
  }
}

function cmdRecover(root, args) {
  const o = parseOptions(args, {});
  if (o.positional.length) usage(`unexpected argument ${o.positional[0]}`);
  if (!state.exists(root)) { process.stdout.write('nothing to recover: no local runtime state\n'); process.exit(EXIT.OK); }
  const report = guarded(() => state.recover(root));
  for (const t of report.transactions.completed) process.stdout.write(`completed transaction ${t.id} (${t.command}): ${t.targets.join(', ')}\n`);
  for (const t of report.transactions.discarded) process.stdout.write(`discarded uncommitted staging ${t.id}\n`);
  for (const t of report.transactions.unreadable) process.stdout.write(`left transaction ${t.id} in place: ${t.problem} (inspect ${state.RUNTIME_DIR}/journal/${t.id}/manifest.json by hand)\n`);
  for (const id of report.finalized) process.stdout.write(`finalized ${id} as interrupted (owner no longer running)\n`);
  for (const { id, owner } of report.live) process.stdout.write(`still running ${id} (pid ${owner.pid} is alive)\n`);
  for (const { id, owner } of report.foreign) process.stdout.write(`still running ${id} (owned by ${owner.host}; not reclaimed from another host)\n`);
  for (const id of report.missing) process.stdout.write(`dropped ${id} from running: record missing\n`);
  for (const file of report.journal) process.stdout.write(`removed stray journal file ${file}\n`);
  const { transactions, ...lists } = report;
  if (!Object.values(lists).some(list => list.length) && !Object.values(transactions).some(list => list.length)) process.stdout.write('nothing to recover\n');
  process.exit(EXIT.OK);
}

// `--flag value` and `--switch` options; positional arguments keep their order.
function parseOptions(args, { valued = [], switches = [] } = {}) {
  const options = { positional: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') { options.positional.push(...args.slice(i + 1)); break; }
    if (valued.includes(arg)) {
      const value = args[++i];
      if (value === undefined) usage(`${arg} requires a value`);
      options[arg.slice(2)] = value;
    } else if (switches.includes(arg)) options[arg.slice(2)] = true;
    else if (arg.startsWith('--')) usage(`unknown option ${arg}`);
    else options.positional.push(arg);
  }
  return options;
}
const problemExit = code => (code === 'STATE_BUSY' ? EXIT.BUSY : EXIT.INVALID);
// Contracted exit codes for the change commands: 3 busy, 4 invalid input or
// unreadable state, 1 for every refusal (docs/runtime-contracts.md, "Exit codes").
const INVALID_CODES = ['INPUT_INVALID', 'MALFORMED', 'UNSUPPORTED_SCHEMA', 'HISTORY_INVALID', 'STATE_INCOMPLETE', 'UNSUPPORTED_INPUT', 'CHANGES_MODE', 'AMBIGUOUS', 'INVALID'];
const exitForCode = code => (code === 'STATE_BUSY' ? EXIT.BUSY : INVALID_CODES.includes(code) ? EXIT.INVALID : EXIT.FAILED);

function cmdRegister(root, args) {
  const o = parseOptions(args, { valued: ['--prd', '--change', '--authorization'], switches: ['--replace', '--rebind'] });
  if (!o.prd) usage('register requires --prd .prd/prd-vN.md');
  if (o.positional.length) usage(`unexpected argument ${o.positional[0]}`);
  const mode = changes.scan(root).mode;
  if (mode === 'migrated') {
    // v0.5.0 binding: the released semantics, except that a second PRD or
    // --replace now needs the migration to change records.
    const result = identity.register(root, { prd: o.prd, change: o.change, authorization: o.authorization ?? null, replace: Boolean(o.replace), rebind: Boolean(o.rebind) });
    if (result.code) { process.stderr.write(`pincer: ${result.code === 'MIGRATION_REQUIRED' ? 'MIGRATION_REQUIRED: ' : ''}${result.problem}\n`); process.exit(result.code === 'MIGRATION_REQUIRED' ? EXIT.FAILED : problemExit(result.code)); }
    for (const note of result.notes) process.stderr.write(`pincer: note: ${note}\n`);
    const b = result.binding;
    process.stdout.write(`${result.action} change ${b.change} → ${b.prd} revision ${b.prd_revision.slice(0, 12)} base ${b.base.slice(0, 7)} (${result.file})\n`);
    process.exit(EXIT.OK);
  }
  // Legacy or changes mode: a schema 2 record. The v0.5.0 flags are refused
  // with the command that replaces them; nothing is inferred from them.
  if (o.replace) fail('pincer', 'LIFECYCLE_BLOCKED: --replace is not supported for change records (they are retained); work on another change with `change select <id>`, retire one with `change supersede <id> --with <replacement> --decision D-NN` or `change cancel <id> --decision D-NN --reason <text>`', EXIT.FAILED);
  if (o.rebind) fail('pincer', 'AGREEMENT_CHANGED: --rebind is not supported for change records; record the revised agreement with `change revise <id>` and its disposition with `change authorize`', EXIT.FAILED);
  if (o.authorization !== undefined) fail('pincer', 'AUTHORIZATION_REQUIRED: --authorization is not recorded on change records (free text cannot become approval); record the user\'s instruction with `change authorize <id> --agreement <digest> --reference <text> --excerpt <text>` after registration', EXIT.FAILED);
  const result = changes.register(root, { prd: o.prd, change: o.change });
  if (result.code) { process.stderr.write(`pincer: ${result.code}: ${result.problem}\n`); process.exit(exitForCode(result.code)); }
  const r = result.record;
  process.stdout.write(`${result.action} change ${r.change} → ${r.prd} base ${r.base.slice(0, 7)} · ${r.lifecycle.state} (${result.file})\n`);
  if (result.action === 'registered') process.stderr.write('pincer: note: registration grants no authorization; record the user\'s instruction with `change authorize` and select the change with `change select`\n');
  process.exit(EXIT.OK);
}

// change list | show — read-only inspection of the retained records.
function cmdChange(root, args) {
  const [sub, ...rest] = args;
  if (sub === 'list') {
    const o = parseOptions(rest, { switches: ['--json'] });
    if (o.positional.length) usage(`unexpected argument ${o.positional[0]}`);
    const result = changes.list(root);
    const sel = changes.readSelection(root);
    const selection = sel.code ? { change: null, problem: { code: sel.code, detail: sel.problem } } : { change: sel.change, problem: null };
    result.changes.forEach(c => { c.selected = Boolean(sel.change) && sel.change === c.id; });
    if (o.json) process.stdout.write(`${JSON.stringify({ schema: 1, runtime: changes.RUNTIME, generated: nowIso(), root, mode: result.mode, selection, changes: result.changes, problems: result.problems }, null, 2)}\n`);
    else process.stdout.write(changes.renderList(result, { selection: sel.code ? null : sel }));
    process.exit(result.problems.length ? EXIT.INVALID : EXIT.OK);
  }
  if (sub === 'select') {
    const o = parseOptions(rest, {});
    if (o.positional.length !== 1) usage('change select requires exactly one change ID');
    const result = changes.select(root, o.positional[0]);
    if (result.code) fail('pincer', `${result.code}: ${result.problem}`, exitForCode(result.code));
    process.stdout.write(`${result.action === 'unchanged' ? 'already selected' : 'selected'} change ${o.positional[0]} → ${result.record.prd} · ${result.record.lifecycle.state} (${changes.SELECTION_FILE}, local to this worktree${result.previous ? `; previously ${result.previous}` : ''})\n`);
    if (result.action === 'selected') process.stderr.write('pincer: note: selection is metadata only — no checkout, stash, reset or commit was made, and selecting grants no authorization\n');
    process.exit(EXIT.OK);
  }
  if (sub === 'show') {
    const o = parseOptions(rest, { switches: ['--json'] });
    if (o.positional.length !== 1) usage('change show requires exactly one change ID');
    const result = changes.loadRecord(root, o.positional[0]);
    if (result.code) fail('pincer', `${result.code}: ${result.problem}`, exitForCode(result.code));
    const sel = changes.readSelection(root);
    if (o.json) process.stdout.write(`${JSON.stringify({ schema: 1, runtime: changes.RUNTIME, generated: nowIso(), root, file: result.file, selected: !sel.code && sel.change === o.positional[0], record: result.record, evaluations: [] }, null, 2)}\n`);
    else process.stdout.write(changes.renderShow(o.positional[0], result));
    process.exit(EXIT.OK);
  }
  usage(sub ? `change ${sub} is not available in this build (change supports: list, show, select)` : 'change requires a subcommand: list, show, select');
}

function cmdSnapshot(root, args) {
  const o = parseOptions(args, { switches: ['--json', '--store'] });
  if (o.positional.length) usage(`unexpected argument ${o.positional[0]}`);
  const manifest = source.snapshot(root);
  for (const problem of manifest.problems) process.stderr.write(`pincer: ${problem.code}: ${problem.detail}\n`);
  if (manifest.problems.length) process.exit(EXIT.INVALID);
  if (o.store) source.storeManifest(root, manifest);
  if (o.json) process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  else {
    process.stdout.write(`digest ${manifest.digest}\nfiles ${manifest.files.length}\nexcluded ${manifest.excluded.length}\n`);
    for (const l of manifest.limitations) process.stderr.write(`pincer: limitation: ${l}\n`);
  }
  process.exit(EXIT.OK);
}

function cmdValidate(root, args) {
  const digests = args.includes('--digests');
  const files = args.filter(arg => arg !== '--digests');
  if (files.some(arg => arg.startsWith('--'))) usage(`unknown option ${files.find(arg => arg.startsWith('--'))}`);
  if (files.length === 0) usage('validate requires at least one file');
  let invalid = false;
  const report = (prefix, file, problems) => { for (const p of problems) process.stderr.write(`${prefix}: ${file}: ${p}\n`); invalid ||= problems.length > 0; };
  for (const file of files) {
    const relative = path.isAbsolute(file) ? path.relative(root, file) : file;
    const base = path.basename(relative);
    if (/^T-[0-9]+.*\.md$/.test(base)) {
      let text;
      try { text = fs.readFileSync(path.resolve(root, relative), 'utf8'); } catch { report('pincer-ticket', relative, ['no such file']); continue; }
      const result = parse.validateTicket(relative, text);
      report('pincer-ticket', relative, result.problems);
      if (result.ok && digests) {
        process.stdout.write(`ticket ${parse.ticketDigest(text)}\n`);
        process.stdout.write(`check ${parse.checkDigest(text, result.timeout)}\n`);
      }
    } else if (parse.PRD_REF.test(relative)) {
      const result = parse.validatePrd(root, relative);
      report('pincer', relative, result.problems);
      if (result.ok && digests) process.stdout.write(`prd ${parse.prdDigest(result.text)}\n`);
    } else {
      let text;
      try { text = fs.readFileSync(path.resolve(root, relative), 'utf8'); } catch { report('pincer', relative, ['no such file']); continue; }
      report('pincer', relative, parse.validateMetadata(text).problems);
    }
  }
  process.exit(invalid ? EXIT.INVALID : EXIT.OK);
}

function main(argv) {
  const [command, ...rest] = argv;
  const root = repoRoot();
  if (command === 'validate') return cmdValidate(root, rest);
  if (command === 'register') return cmdRegister(root, rest);
  if (command === 'snapshot') return cmdSnapshot(root, rest);
  if (command === 'recover') return cmdRecover(root, rest);
  if (command === 'status') return cmdStatus(root, rest);
  if (command === 'ready') return cmdReady(root, rest);
  if (['start', 'verify', 'done', 'bind'].includes(command)) return cmdLifecycle(root, command, rest);
  if (command === 'migrate') return cmdMigrate(root, rest);
  if (command === 'check') return cmdCheck(root, rest);
  if (command === 'evidence') return cmdEvidence(root, rest);
  if (command === 'change') return cmdChange(root, rest);
  usage(command ? `unknown command ${command}` : undefined);
}

Promise.resolve(main(process.argv.slice(2))).catch(error => {
  process.stderr.write(`pincer: unexpected error: ${error && error.stack ? error.stack : error}\n`);
  process.exit(EXIT.INVALID);
});
