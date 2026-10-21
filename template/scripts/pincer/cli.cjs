#!/usr/bin/env node
'use strict';
// PINCER engine — argv dispatch for the entry points (docs/engine.md,
// "Commands and exit codes"). Exit codes: 0 ok, 1 refused, 2 usage,
// 3 no agreement or stage off, 130 interrupted.
const fs = require('node:fs');
const path = require('node:path');
const util = require('./util.cjs');
const harness = require('./harness.cjs');
const ticket = require('./ticket.cjs');
const status = require('./status.cjs');
const evidence = require('./evidence.cjs');
const recon = require('./recon.cjs');

const USAGE = `usage: node scripts/pincer/cli.cjs [--root <dir>] <command> ...
  ticket <start|verify|done|accept> <T-NN> [--by "<name>" --words "<what they said>"]
  status [--json] [--stage <name>]
  evidence validate <manifest> [--candidate <sha>] | digest <file>...
  recon [--json] [--network]
`;
const BLUEPRINT_USAGE = `usage: scripts/pincer-blueprint.cjs recon [--json] [--network]
`;
const BLUEPRINT_VERBS = ['recon'];
const EVIDENCE_USAGE = `usage: scripts/pincer-evidence.cjs validate <manifest> [--candidate <sha>]
       scripts/pincer-evidence.cjs digest <file>...
`;
const STATUS_USAGE = `usage: scripts/pincer-status.sh [--json] [--stage <name>]
`;
const TICKET_USAGE = `usage: scripts/pincer-ticket.sh <verb> <T-NN>
  start  T-NN                                     open -> in_progress
  verify T-NN                                     run the Verification block, stamp the receipt
  done   T-NN                                     close on a current passing check, all criteria ticked
  accept T-NN --by "<name>" --words "<their words>"   record the person's acceptance
`;
const TICKET_VERBS = ['start', 'verify', 'done', 'accept'];

// The project root: --root, else the nearest directory from the working
// directory up that holds harness.json, else the working directory.
function resolveRoot(argv) {
  const args = [];
  let root = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') { root = argv[++i]; if (root === undefined) return { problem: '--root needs a directory' }; }
    else if (argv[i].startsWith('--root=')) root = argv[i].slice('--root='.length);
    else args.push(argv[i]);
  }
  if (root !== null) return { root: path.resolve(root), args };
  let dir = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(dir, harness.HARNESS_FILE))) return { root: dir, args };
    const parent = path.dirname(dir);
    if (parent === dir) return { root: process.cwd(), args };
    dir = parent;
  }
}

// --name value pairs; unknown flags and bare words are usage problems.
function flags(rest, allowed) {
  const out = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (!arg.startsWith('--') || !allowed.includes(name)) return { problem: `unexpected argument ${arg}` };
    const value = eq === -1 ? rest[++i] : arg.slice(eq + 1);
    if (value === undefined) return { problem: `--${name} needs a value` };
    out[name] = value;
  }
  return out;
}

async function ticketCommand(root, args, io) {
  const [verb, id, ...rest] = args;
  if (!TICKET_VERBS.includes(verb) || !id) { io.err(TICKET_USAGE); return ticket.EXIT.USAGE; }
  const options = flags(rest, verb === 'accept' ? ['by', 'words'] : []);
  if (options.problem) { io.err(`pincer-ticket: ${options.problem}\n${TICKET_USAGE}`); return ticket.EXIT.USAGE; }
  if (verb === 'accept' && (!('by' in options) || !('words' in options))) { io.err(`pincer-ticket: accept needs --by and --words\n${TICKET_USAGE}`); return ticket.EXIT.USAGE; }
  if (verb === 'start') { const r = ticket.start(root, id); io.out(r.out); return r.exit; }
  if (verb === 'accept') { const r = ticket.accept(root, id, options); io.out(r.out); return r.exit; }
  return (await ticket[verb](root, id, io)).exit;
}

function statusCommand(root, args, io) {
  let json = false, stage = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') json = true;
    else if (arg === '--stage') { stage = args[++i]; if (stage === undefined) { io.err(STATUS_USAGE); return 2; } }
    else if (arg.startsWith('--stage=')) stage = arg.slice('--stage='.length);
    else { io.err(`pincer-status: unexpected argument ${arg}\n${STATUS_USAGE}`); return 2; }
  }
  if (stage !== null) {
    const gate = status.stageGate(root, stage);
    (gate.exit === 0 ? io.out : io.err)(`${gate.message}\n`);
    return gate.exit;
  }
  const report = status.gather(root);
  io.out(json ? `${JSON.stringify(report, null, 2)}\n` : status.render(report));
  if (report.harnessProblem) { io.err(`${harness.HARNESS_FILE}: ${report.harnessProblem}\n`); return 3; }
  return 0;
}

// Paths typed on the command line resolve against the working directory.
const fromCwd = (file) => (path.isAbsolute(file) ? file : path.resolve(process.cwd(), file));

function evidenceCommand(root, args, io) {
  const [verb, ...rest] = args;
  if (verb === 'validate' && rest.length) {
    const [file, ...more] = rest;
    const options = flags(more, ['candidate']);
    if (options.problem) { io.err(`pincer-evidence: ${options.problem}\n${EVIDENCE_USAGE}`); return 2; }
    const abs = fromCwd(file);
    const problems = evidence.validate(root, abs, { candidate: options.candidate });
    if (problems.length) { for (const p of problems) io.err(`evidence: ${file}: ${p}\n`); return 1; }
    io.out(`ok ${util.readJson(abs).candidate}\n`);
    return 0;
  }
  if (verb === 'digest' && rest.length) {
    let failed = false;
    for (const file of rest) {
      try { io.out(`${evidence.digestFile(fromCwd(file))}  ${file}\n`); } catch (error) { io.err(`evidence: ${file}: ${error.message}\n`); failed = true; }
    }
    return failed ? 1 : 0;
  }
  io.err(EVIDENCE_USAGE);
  return 2;
}

function reconCommand(root, args, io) {
  let json = false, network = false;
  for (const arg of args) {
    if (arg === '--json') json = true;
    else if (arg === '--network') network = true;
    else { io.err(`pincer-blueprint: unexpected argument ${arg}\n${BLUEPRINT_USAGE}`); return 2; }
  }
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) { io.err(`pincer-blueprint: ${root} is not a directory\n`); return 1; }
  const result = recon.recon(root, { network });
  io.out(json ? `${JSON.stringify(result, null, 2)}\n` : recon.render(result));
  return 0;
}

// scripts/pincer-blueprint.cjs: the blueprint verbs only, same root rules.
async function blueprint(argv = process.argv.slice(2), io = { out: util.out, err: util.err }) {
  const resolved = resolveRoot(argv);
  if (resolved.problem || !BLUEPRINT_VERBS.includes(resolved.args[0])) { io.err(BLUEPRINT_USAGE); return 2; }
  return main(argv, io);
}

async function main(argv = process.argv.slice(2), io = { out: util.out, err: util.err }) {
  const resolved = resolveRoot(argv);
  if (resolved.problem) { io.err(`pincer: ${resolved.problem}\n${USAGE}`); return 2; }
  const { root, args } = resolved;
  const [command, ...rest] = args;
  try {
    if (command === 'ticket') return await ticketCommand(root, rest, io);
    if (command === 'status') return statusCommand(root, rest, io);
    if (command === 'evidence') return evidenceCommand(root, rest, io);
    if (command === 'recon') return reconCommand(root, rest, io);
    io.err(USAGE);
    return 2;
  } catch (error) {
    if (error instanceof ticket.Refusal) { io.err(`${error.prefix ? `${error.prefix}: ` : ''}${error.message}\n`); return error.exit; }
    io.err(`pincer: ${error.message}\n`);
    if (process.env.PINCER_DEBUG) io.err(`${error.stack}\n`);
    return 1;
  }
}

if (require.main === module) main().then((code) => { process.exitCode = code; });

module.exports = { main, blueprint, resolveRoot, flags, USAGE, TICKET_USAGE, STATUS_USAGE, EVIDENCE_USAGE, BLUEPRINT_USAGE };
