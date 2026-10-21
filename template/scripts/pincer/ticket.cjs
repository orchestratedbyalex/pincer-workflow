'use strict';
// PINCER engine — the ticket lifecycle (docs/engine.md, "Ticket fields and
// receipts"): start, verify, done, accept. The only writer of a ticket's
// lifecycle fields. `verify` runs the Verification block and stamps a receipt
// only on exit 0; `done` re-runs the check and refuses on unticked criteria or
// a stale receipt; `accept` records a named person's words on a done ticket.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const parse = require('./parse.cjs');
const harnessModule = require('./harness.cjs');
const { nowIso, atomicWrite } = require('./util.cjs');

const EXIT = { OK: 0, REFUSED: 1, USAGE: 2, HARNESS: 3, INTERRUPTED: 130 };
const GRACE_MS = 5000;
const SCRIPT = 'scripts/pincer-ticket.sh';

class Refusal extends Error {
  constructor(message, { exit = EXIT.REFUSED, prefix = 'pincer-ticket' } = {}) { super(message); this.exit = exit; this.prefix = prefix; }
}
const refuse = (message, options) => { throw new Refusal(message, options); };

// --- The agreement ---------------------------------------------------------
// Every verb needs an agreement with the code stage on; tickets live in its home.
function agreement(root) {
  const loaded = harnessModule.load(root);
  if (!loaded.ok) refuse(`${harnessModule.HARNESS_FILE}: ${loaded.message}`, { exit: EXIT.HARNESS, prefix: '' });
  if (!harnessModule.stageOn(loaded.harness, 'code')) refuse(`stage code is off in ${harnessModule.HARNESS_FILE}`, { exit: EXIT.HARNESS, prefix: '' });
  return { harness: loaded.harness, tickets: harnessModule.homes(loaded.harness).tickets };
}

// --- Tickets ---------------------------------------------------------------
const readTicket = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
const writeTicket = (root, file, text) => atomicWrite(path.join(root, file), text);

function loadTicket(root, file, id) {
  const text = readTicket(root, file);
  const v = parse.validateTicket(file, text);
  if (!v.ok) refuse(v.problems.map((p) => `${file}: ${p}`).join('\n'));
  return { id: id || v.fields.ticket, file, text, fields: v.fields, timeout: v.timeout };
}
function resolve(root, ticketsDir, input) {
  const tf = parse.ticketFile(root, ticketsDir, input);
  if (tf.problem) refuse(tf.problem);
  return loadTicket(root, tf.file, tf.id);
}

// Why a ticket's receipt is not current, or null when it is: a receipt exists,
// its hash matches the Verification block as it stands, and the latest check
// of that block passed.
function receiptProblem(text, fields) {
  const receipt = fields.verified || '';
  if (!receipt) return 'no verification receipt';
  const hash = parse.blockHash(text);
  const receiptHash = receipt.split(/\s+/).pop();
  if (receiptHash !== hash) return `receipt hash ${receiptHash} does not match the current Verification block (${hash})`;
  const last = (fields.last_check || '').split(/\s+/);
  if (last.length === 3 && last[2] === hash && last[1] !== 'passed') return `last check ${last[1]}`;
  return null;
}

// --- start -----------------------------------------------------------------
function startLoaded(root, ticketsDir, t) {
  if (t.fields.status === 'in_progress') return { exit: EXIT.OK, out: `${t.id} already in progress (started ${t.fields.started || ''})\n` };
  if (t.fields.status === 'done') refuse(`${t.id} is already done`);
  for (const dep of parse.dependencies(t.fields)) {
    const df = parse.ticketFile(root, ticketsDir, dep);
    if (df.problem) refuse(`${t.id} depends on ${dep}: ${df.problem}`);
    const d = loadTicket(root, df.file, dep);
    if (d.fields.status !== 'done') refuse(`${t.id} depends on ${dep}, which is '${d.fields.status}' — finish ${dep} first (or fix depends_on in ${t.file})`);
    const problem = receiptProblem(d.text, d.fields);
    if (problem) refuse(`${t.id} depends on ${dep}: ${problem} — run '${SCRIPT} verify ${dep}' again`);
  }
  let text = parse.fmSet(t.text, 'status', 'in_progress');
  if (!t.fields.started) text = parse.fmSet(text, 'started', nowIso());
  writeTicket(root, t.file, text);
  return { exit: EXIT.OK, out: `▶ ${t.id} started ${parse.frontmatterField(text, 'started')} — ${t.file}\n` };
}
function start(root, input) {
  const { tickets } = agreement(root);
  return startLoaded(root, tickets, resolve(root, tickets, input));
}

// --- verify ----------------------------------------------------------------
// The block runs under bash with inherited stdio in its own process group;
// SIGINT/SIGTERM to the engine terminate it and are reported as interrupted, and
// so is the ticket's timeout (seconds) when the block outlives it.
function execute(root, block, timeoutSeconds) {
  return new Promise((done) => {
    const child = spawn('bash', ['-eo', 'pipefail', '-c', block], { cwd: root, detached: true, stdio: 'inherit', env: process.env });
    let interrupted = null, timedOut = false;
    const terminate = () => {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch { /* gone */ } }
      setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } }, GRACE_MS).unref();
    };
    const onSignal = (signal) => { interrupted = signal; terminate(); };
    const timer = timeoutSeconds > 0 ? setTimeout(() => { timedOut = true; terminate(); }, timeoutSeconds * 1000) : null;
    const release = () => { process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal); if (timer) clearTimeout(timer); };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);
    child.on('error', (error) => { release(); done({ code: 127, signal: null, interrupted, timedOut, error: error.message }); });
    child.on('exit', (code, signal) => { release(); done({ code, signal, interrupted, timedOut }); });
  });
}

async function runCheck(root, t, io) {
  const { id, file } = t;
  if (t.fields.status === 'done') io.out(`${id} is done — re-running its check and updating the latest outcome\n`);
  const commands = parse.verificationCommands(t.text);
  const block = parse.blockText(t.text);
  const hash = parse.blockHash(t.text);
  let text = parse.fmUnset(t.text, 'verified');
  text = parse.fmSet(text, 'last_check', `${nowIso()} running ${hash}`);
  writeTicket(root, file, text);
  if (!commands.some((c) => !/^[ \t]*(#.*)?$/.test(c))) refuse(`no runnable command in the Verification block of ${file}`);
  io.out(`── ${id} verification ──\n`);
  for (const c of commands) io.out(`  $ ${c}\n`);
  const timeout = parse.effectiveTimeout(t.fields);
  const result = await execute(root, block, timeout);
  const stamp = (outcome) => writeTicket(root, file, parse.fmSet(readTicket(root, file), 'last_check', `${nowIso()} ${outcome} ${hash}`));
  if (result.timedOut) {
    stamp('interrupted');
    io.err(`✗ ${id} verification TIMED OUT after ${timeout}s — recorded as interrupted in last_check of ${file}. Raise timeout: in the frontmatter or fix the check, then re-run verify.\n`);
    return { exit: EXIT.INTERRUPTED };
  }
  if (result.interrupted) { stamp('interrupted'); return { exit: EXIT.INTERRUPTED }; }
  const rc = result.code === null ? 1 : result.code;
  if (rc !== 0) {
    stamp('failed');
    io.err(`✗ ${id} verification FAILED (exit ${rc}) — failure recorded in last_check of ${file}; any prior successful receipt was revoked. Fix, then re-run verify.\n`);
    return { exit: EXIT.REFUSED };
  }
  const after = readTicket(root, file);
  if (parse.blockHash(after) !== hash) { stamp('failed'); refuse('Verification block changed during execution — re-run verify'); }
  if (!parse.validateTicket(file, after).ok) { stamp('failed'); refuse('ticket became invalid during verification — fix it and re-run verify'); }
  let passed = parse.fmSet(after, 'last_check', `${nowIso()} passed ${hash}`);
  passed = parse.fmSet(passed, 'verified', `${nowIso()} ${hash}`);
  writeTicket(root, file, passed);
  io.out(`✓ ${id} verified — receipt: ${parse.frontmatterField(passed, 'verified')}\n`);
  return { exit: EXIT.OK };
}

const defaultIo = () => ({ out: (text) => process.stdout.write(text), err: (text) => process.stderr.write(text) });

async function verify(root, input, io = defaultIo()) {
  const { tickets } = agreement(root);
  const t0 = resolve(root, tickets, input);
  if (t0.fields.status === 'open') io.out(startLoaded(root, tickets, t0).out);
  return runCheck(root, loadTicket(root, t0.file, t0.id), io);
}

// --- done ------------------------------------------------------------------
const slugWords = (file) => path.basename(file, '.md').replace(/^T-[0-9]+-/, '').replace(/-/g, ' ');

async function done(root, input, io = defaultIo()) {
  const { tickets } = agreement(root);
  const t = resolve(root, tickets, input);
  const { id, file } = t;
  const status = t.fields.status;
  if (status !== 'in_progress' && status !== 'done') refuse(`${id} is '${status}' — run '${SCRIPT} verify ${id}' first`);
  const receipt = t.fields.verified || '';
  if (!receipt) refuse(`no verification receipt on ${id} — run '${SCRIPT} verify ${id}' and get a green check first`);
  const current = parse.blockHash(t.text);
  const receiptHash = receipt.split(/\s+/).pop();
  if (receiptHash !== current) refuse(`receipt hash ${receiptHash} does not match the current Verification block (${current}): the check changed after it passed — run '${SCRIPT} verify ${id}' again`);
  const unticked = parse.unticked(t.text);
  if (unticked.length) refuse(`unticked acceptance criteria on ${id}:\n${unticked.join('\n')}\nTick each verified criterion; a criterion that was cut is a scope change to record in the spec, not a box to skip.`);
  const result = await runCheck(root, t, io);
  if (result.exit !== EXIT.OK) return result;
  const after = loadTicket(root, file, id);
  const still = parse.unticked(after.text);
  if (still.length) refuse(`unticked acceptance criteria on ${id} after verification:\n${still.join('\n')}`);
  if (status === 'done') { io.out(`${id} already done — current check passed\n`); return { exit: EXIT.OK }; }
  let text = parse.fmSet(after.text, 'status', 'done');
  text = parse.fmSet(text, 'finished', nowIso());
  writeTicket(root, file, text);
  io.out(`✓ ${id} done. Inspect staged work, stage only this ticket's paths, review git diff --cached, then commit: ${id}: ${slugWords(file)}\n`);
  return { exit: EXIT.OK };
}

// --- accept ----------------------------------------------------------------
// The floor's second half: a named person, from the agreement's acceptors,
// and their words, on one line. Run only after the person said so.
function accept(root, input, { by, words } = {}) {
  const { harness, tickets } = agreement(root);
  const t = resolve(root, tickets, input);
  if (t.fields.status !== 'done') refuse(`${t.id} is '${t.fields.status}' — acceptance is recorded on a done ticket; run verify and done first`);
  const stale = receiptProblem(t.text, t.fields);
  if (stale) refuse(`${t.id}: ${stale} — run '${SCRIPT} verify ${t.id}' and get a green check before recording acceptance`);
  const people = harnessModule.acceptors(harness);
  const name = String(by || '').trim();
  if (!people.includes(name)) refuse(`${name ? `'${name}'` : 'nobody'} is not an acceptor in ${harnessModule.HARNESS_FILE} — the people who accept are: ${people.join(', ')}`);
  const said = String(words || '').replace(/\s*\r?\n\s*/g, ' ').trim();
  if (!said) refuse(`${t.id}: --words must quote what ${name} said when accepting`);
  const previous = t.fields.accepted ? `${t.id} already accepted by ${t.fields.accepted_by} at ${t.fields.accepted} — overwriting\n` : '';
  let text = parse.fmSet(t.text, 'accepted', nowIso());
  text = parse.fmSet(text, 'accepted_by', name);
  text = parse.fmSet(text, 'accepted_words', said);
  writeTicket(root, t.file, text);
  return { exit: EXIT.OK, out: `${previous}✓ ${t.id} accepted by ${name}: ${said}\n` };
}

module.exports = { EXIT, Refusal, receiptProblem, start, verify, done, accept };
