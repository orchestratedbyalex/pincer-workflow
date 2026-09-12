#!/usr/bin/env node
'use strict';
// One non-interactive Claude Code session for the live benchmark (T-77):
//   node session.cjs <workspace> <model> <prompt-file> <out.json> <err.log> <wall-clock-ms> <max-turns>
// Runs `claude -p` in the workspace with CLAUDECODE unset (this driver itself runs
// inside a Claude Code session), stdin from /dev/null, JSON output saved verbatim.
// Exit: claude's exit status; 124 when the wall-clock cap killed it.
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const [ws, model, promptFile, outFile, errFile, wallMs, maxTurns] = process.argv.slice(2);
const prompt = fs.readFileSync(promptFile, 'utf8');
const env = { ...process.env };
delete env.CLAUDECODE; delete env.CLAUDE_CODE_ENTRYPOINT;
const out = fs.openSync(outFile, 'w'), err = fs.openSync(errFile, 'w');
const child = spawn('claude', ['-p', '--model', model, '--permission-mode', 'bypassPermissions', '--max-turns', String(maxTurns), '--output-format', 'json', prompt], { cwd: ws, env, stdio: ['ignore', out, err] });
let timedOut = false;
const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 10000).unref(); }, Number(wallMs));
child.on('exit', (code, signal) => { clearTimeout(timer); fs.closeSync(out); fs.closeSync(err); process.exit(timedOut ? 124 : code === null ? 128 : code); });
child.on('error', e => { fs.writeSync(err, `spawn failed: ${e.message}\n`); process.exit(127); });
