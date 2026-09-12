#!/usr/bin/env node
'use strict';
// Runs one runtime command with a second runtime command injected between the
// pre-launch gate evaluation and the runner's lock: runner.runAttempt is wrapped
// so the injected command executes in its own process (through the real lock,
// as a separate transaction) immediately before the attempt is registered.
// Usage:
//   node test/fixtures/attempt-race.cjs <root> <injected runtime args...> -- <runtime args...>
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const scripts = path.join(__dirname, '..', '..', 'template', 'scripts');
const entry = path.join(scripts, 'pincer-runtime.cjs');
const runner = require(path.join(scripts, 'pincer-runtime', 'runner.cjs'));

const argv = process.argv.slice(2);
const root = path.resolve(argv[0]);
const sep = argv.indexOf('--');
const injected = argv.slice(1, sep), command = argv.slice(sep + 1);
const original = runner.runAttempt;
runner.runAttempt = options => {
  const r = spawnSync(process.execPath, [entry, ...injected], { cwd: root, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  process.stderr.write(`[race] injected "${injected.join(' ')}" exited ${r.status}: ${`${r.stdout}${r.stderr}`.trim().split('\n')[0]}\n`);
  return original(options);
};
process.chdir(root);
process.env.CLAUDE_PROJECT_DIR = root;
process.argv = [process.argv[0], entry, ...command];
require(entry);
