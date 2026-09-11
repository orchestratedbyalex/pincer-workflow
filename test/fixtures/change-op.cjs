#!/usr/bin/env node
'use strict';
// Runs one change operation through the real modules, for races and crash
// injection. Usage:
//   node test/fixtures/change-op.cjs <root> <op> <id> [--reason t] [--note t] [--decision D-NN] [--with id] [--prd p]
//                                    [--agreement d --reference t --excerpt t] [--crash <point>] [--hold <ms>] [--select]
// op: activate | pause | resume | complete | reopen | cancel | supersede | authorize | select | migrate (id: change or -)
// --select: select <id> first (through the same lock discipline, as a separate transaction).
// --crash: SIGKILL itself at 'validated' | 'staged' | 'manifest' | 'rename:0' | 'cleanup'.
// --hold: sleep inside the critical section after validation (widens the race window).
const path = require('node:path');
const base = path.join(__dirname, '..', '..', 'template', 'scripts', 'pincer-runtime');
const transitions = require(path.join(base, 'transitions.cjs'));
const authorization = require(path.join(base, 'authorization.cjs'));
const changes = require(path.join(base, 'changes.cjs'));
const migrate = require(path.join(base, 'migrate.cjs'));

const [root, op, id, ...rest] = process.argv.slice(2);
const opt = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--select') opt.select = true;
  else opt[rest[i].slice(2)] = rest[++i];
}
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const hooks = point => {
  if (point === 'validated' && opt.hold) sleep(Number(opt.hold));
  if (opt.crash === point) process.kill(process.pid, 'SIGKILL');
};
function report(result) {
  if (result.code) { process.stdout.write(`refused ${result.code}: ${result.problem}\n`); process.exit(result.code === 'STATE_BUSY' ? 3 : 1); }
  process.stdout.write(`${result.action}${result.to ? ` ${result.from} → ${result.to}` : ''}${result.authorization ? ` ${result.authorization.id}` : ''}\n`);
}
if (opt.select) report(changes.select(root, id));
if (op === 'select') process.exit(0);
if (op === 'migrate') {
  const r = migrate.apply(root, { prd: opt.prd, change: id === '-' ? undefined : id, authorization: opt.authorization || null, hooks });
  if (r.plan.conflicts.length || r.error) { process.stdout.write(`refused ${r.code || r.plan.conflicts[0].code}: ${r.error || r.plan.conflicts[0].detail}\n`); process.exit(1); }
  process.stdout.write(`${r.already ? 'already' : 'migrated'} ${r.plan.change}\n`); process.exit(0);
}
if (op === 'authorize') report(authorization.authorize(root, id, { agreement: opt.agreement, reference: opt.reference, excerpt: opt.excerpt, hooks }));
else report(transitions.transition(root, id, op, { reason: opt.reason, note: opt.note, decision: opt.decision, with: opt.with, hooks }));
