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

const USAGE = `usage: node scripts/pincer/cli.cjs [--root <dir>] <command> ...
  ticket <start|verify|done|accept> <T-NN> [--by "<name>" --words "<what they said>"]
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

async function main(argv = process.argv.slice(2), io = { out: util.out, err: util.err }) {
  const resolved = resolveRoot(argv);
  if (resolved.problem) { io.err(`pincer: ${resolved.problem}\n${USAGE}`); return 2; }
  const { root, args } = resolved;
  const [command, ...rest] = args;
  try {
    if (command === 'ticket') return await ticketCommand(root, rest, io);
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

module.exports = { main, resolveRoot, flags, USAGE, TICKET_USAGE };
