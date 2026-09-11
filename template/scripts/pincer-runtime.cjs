#!/usr/bin/env node
'use strict';
// PINCER runtime — the local command entry point (docs/runtime-contracts.md).
//
//   node scripts/pincer-runtime.cjs validate <file>... [--digests]
//   node scripts/pincer-runtime.cjs register --prd .prd/prd-vN.md [--change <id>] [--authorization <text>] [--replace] [--rebind]
//   node scripts/pincer-runtime.cjs snapshot [--json] [--store]
//   node scripts/pincer-runtime.cjs recover
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
    '       pincer-runtime.cjs recover\n');
  process.exit(EXIT.USAGE);
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
  for (const id of report.finalized) process.stdout.write(`finalized ${id} as interrupted (owner no longer running)\n`);
  for (const { id, owner } of report.live) process.stdout.write(`still running ${id} (pid ${owner.pid} is alive)\n`);
  for (const { id, owner } of report.foreign) process.stdout.write(`still running ${id} (owned by ${owner.host}; not reclaimed from another host)\n`);
  for (const id of report.missing) process.stdout.write(`dropped ${id} from running: record missing\n`);
  for (const file of report.journal) process.stdout.write(`removed stray journal file ${file}\n`);
  if (!Object.values(report).some(list => list.length)) process.stdout.write('nothing to recover\n');
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

function cmdRegister(root, args) {
  const o = parseOptions(args, { valued: ['--prd', '--change', '--authorization'], switches: ['--replace', '--rebind'] });
  if (!o.prd) usage('register requires --prd .prd/prd-vN.md');
  if (o.positional.length) usage(`unexpected argument ${o.positional[0]}`);
  const result = identity.register(root, { prd: o.prd, change: o.change, authorization: o.authorization ?? null, replace: Boolean(o.replace), rebind: Boolean(o.rebind) });
  if (result.code) { process.stderr.write(`pincer: ${result.problem}\n`); process.exit(problemExit(result.code)); }
  for (const note of result.notes) process.stderr.write(`pincer: note: ${note}\n`);
  const b = result.binding;
  process.stdout.write(`${result.action} change ${b.change} → ${b.prd} revision ${b.prd_revision.slice(0, 12)} base ${b.base.slice(0, 7)} (${result.file})\n`);
  process.exit(EXIT.OK);
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
  usage(command ? `unknown command ${command}` : undefined);
}

main(process.argv.slice(2));
