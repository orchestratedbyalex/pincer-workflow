'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const candidate = process.env.CANDIDATE;
const bin = path.join(candidate, 'bin', 'notes.js');
const fresh = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'notes-eval-')), 'notes.json');
const run = (file, ...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', cwd: candidate, env: { ...process.env, NOTES_FILE: file }, timeout: 5000 });
module.exports = { fresh, run, fs, bin };
