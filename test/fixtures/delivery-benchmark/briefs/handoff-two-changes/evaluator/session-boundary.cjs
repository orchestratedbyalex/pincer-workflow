'use strict';
// Protocol check: at the last commit before S1 ended, A1 and B1 pass and A2 does not.
// Exit 0 when so, 1 otherwise, 3 (unverified) when the sessions are incomplete.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const [ws, sessionsJson] = process.argv.slice(2);
const sessions = JSON.parse(sessionsJson);
const s1 = sessions.find(s => s.name === 'S1'), s2 = sessions.find(s => s.name === 'S2');
if (!s1 || !s1.ended || !s2 || !s2.ended) { process.stdout.write('sessions S1 and S2 have not both ended; the protocol check cannot run\n'); process.exit(3); }
const rev = spawnSync('git', ['rev-list', '-1', `--before=${s1.ended}`, 'HEAD'], { cwd: ws, encoding: 'utf8' });
const sha = rev.stdout.trim();
if (!/^[0-9a-f]{40}$/.test(sha)) { process.stdout.write(`no commit before the end of S1 (${s1.ended})\n`); process.exit(3); }
const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-s1-'));
const x = spawnSync('sh', ['-c', 'git archive --format=tar "$1" | tar -x -C "$2"', 'sh', sha, dest], { cwd: ws, encoding: 'utf8' });
if (x.status !== 0) { process.stdout.write(`export of ${sha} failed: ${x.stderr}\n`); process.exit(3); }
const passes = file => spawnSync(process.execPath, ['--test', path.join(__dirname, file)], { encoding: 'utf8', env: { ...process.env, CANDIDATE: dest }, timeout: 20000 }).status === 0;
const a1 = passes('a1.test.cjs'), a2 = passes('a2.test.cjs'), b1 = passes('b1.test.cjs');
const state = `at ${sha.slice(0, 7)} (end of S1): A1 ${a1 ? 'passes' : 'fails'}, A2 ${a2 ? 'passes' : 'fails'}, B1 ${b1 ? 'passes' : 'fails'}`;
if (a1 && b1 && !a2) { process.stdout.write(`${state} — A was set aside half-done and B completed, as instructed\n`); process.exit(0); }
process.stdout.write(`${state} — expected A1 and B1 to pass and A2 not to\n`);
process.exit(1);
