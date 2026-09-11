#!/usr/bin/env node
'use strict';
// PINCER runtime — the local command entry point (docs/runtime-contracts.md).
//
//   node scripts/pincer-runtime.cjs validate <file>... [--digests]
//
// Exit codes: 0 ok · 1 failed/not ready/refused · 2 usage · 3 state busy ·
// 4 invalid input or state · 124 timed out · 130 interrupted.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const parse = require('./pincer-runtime/parse.cjs');
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
  process.stderr.write('usage: pincer-runtime.cjs validate <file>... [--digests]\n');
  process.exit(EXIT.USAGE);
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
  usage(command ? `unknown command ${command}` : undefined);
}

main(process.argv.slice(2));
