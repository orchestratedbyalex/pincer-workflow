#!/usr/bin/env node
'use strict';
// A competing transaction writer for the change-transaction tests. Appends one
// event to <root>/.prd/changes/<id>.json (creating a minimal record when absent)
// and writes the selection, through transaction.run. Options:
//   --hold <ms>       sleep inside the critical section (widens the race window)
//   --crash <point>   SIGKILL itself at 'validated' | 'staged' | 'manifest' | 'rename:0' | 'rename:1' | 'cleanup'
//   --expect <n>      refuse STATE_CHANGED unless the record's sequence is n at commit
//   --idle            refuse ATTEMPT_RUNNING when an attempt of the change is running
//   --label <text>    stored in the event's note, to tell writers apart
// Usage: node test/fixtures/txn-writer.cjs <root> <change id> [options]
const path = require('node:path');
const txn = require(path.join(__dirname, '..', '..', 'template', 'scripts', 'pincer-runtime', 'transaction.cjs'));

const [root, id, ...rest] = process.argv.slice(2);
const opt = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--idle') opt.idle = true;
  else opt[rest[i].slice(2)] = rest[++i];
}
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const rel = `.prd/changes/${id}.json`;
try {
  const out = txn.run(root, {
    command: `txn-writer ${opt.label || process.pid}`,
    hooks: point => { if (opt.crash === point) process.kill(process.pid, 'SIGKILL'); },
  }, ctx => {
    if (opt.idle) ctx.idle(id);
    const record = ctx.read(rel) || { schema: 2, change: id, sequence: 0, lifecycle: { state: 'planned' }, events: [] };
    if (opt.expect !== undefined) ctx.expect(rel, 'sequence', Number(opt.expect));
    if (opt.hold) sleep(Number(opt.hold));
    const sequence = record.sequence + 1;
    record.events.push({ sequence, kind: 'note', at: ctx.now, note: opt.label || String(process.pid) });
    record.sequence = sequence;
    ctx.write(rel, record);
    ctx.write('.pincer/runtime/selection.json', { schema: 1, change: id, selected: ctx.now, by: opt.label || String(process.pid) });
    return sequence;
  });
  process.stdout.write(`committed ${out.result} ${out.id}\n`);
} catch (error) {
  if (error.refusal) { process.stdout.write(`refused ${error.code}: ${error.message}\n`); process.exit(1); }
  if (error.code === 'STATE_BUSY') { process.stdout.write(`busy: ${error.message}\n`); process.exit(3); }
  throw error;
}
