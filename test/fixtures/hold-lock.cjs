#!/usr/bin/env node
'use strict';
// Holds the runtime lock of <root> for <ms> milliseconds, printing `held` once
// acquired. Used to observe a second writer receiving a bounded busy result.
// Usage: node test/fixtures/hold-lock.cjs <root> <ms>
const path = require('node:path');
const state = require(path.join(__dirname, '..', '..', 'template', 'scripts', 'pincer-runtime', 'state.cjs'));
const [root, ms] = process.argv.slice(2);
const release = state.acquireLock(root, { command: 'hold-lock fixture', waitMs: 1000 });
process.stdout.write('held\n');
setTimeout(() => { release(); process.exit(0); }, Number(ms || 2000));
