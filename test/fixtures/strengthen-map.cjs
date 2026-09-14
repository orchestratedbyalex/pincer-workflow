#!/usr/bin/env node
'use strict';
// Edits the coverage map of a strict change and records a delegated authorization
// of the resulting agreement, for race injection between a check's pre-launch
// guard and its lock (attempt-race.cjs --script). Usage:
//   node test/fixtures/strengthen-map.cjs <root> <change> <from> <to> <basis A-NN>
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const [root, change, from, to, basis] = process.argv.slice(2);
const entry = process.env.PINCER_RUNTIME || path.join(__dirname, '..', '..', 'template', 'scripts', 'pincer-runtime.cjs');
const file = path.join(root, '.prd', 'coverage', `${change}.json`);
const text = fs.readFileSync(file, 'utf8');
if (!text.includes(from)) { process.stderr.write(`map does not contain ${from}\n`); process.exit(1); }
fs.writeFileSync(file, text.replace(from, to));
const rt = args => spawnSync(process.execPath, [entry, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
const shown = rt(['change', 'show', change, '--json']);
if (shown.status !== 0) { process.stderr.write(shown.stderr); process.exit(shown.status); }
const digest = JSON.parse(shown.stdout).agreement.current;
const auth = rt(['change', 'authorize', change, '--agreement', digest, '--delegated', '--basis', basis, '--explanation', 'strengthened between the guard and the lock']);
process.stdout.write(auth.stdout); process.stderr.write(auth.stderr);
process.exit(auth.status);
