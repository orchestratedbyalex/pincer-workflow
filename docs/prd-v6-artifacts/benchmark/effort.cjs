#!/usr/bin/env node
'use strict';
// Fills the effort fields of a live run from its record and the usage JSON that
// `claude -p` printed per session:  node effort.cjs <runs-root> <run-id>
// setup = prepare → first session start; active = sum of session durations; elapsed =
// first start → last end; tokens = input + cache creation + cache read, output; cost =
// the tool's total_cost_usd summed over sessions. Missing usage → null with a reason.
// review_minutes stays null: the driver evaluates without an operator review pass.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const [runs, run] = process.argv.slice(2);
const dir = path.join(runs, ...run.split('/'));
const rec = JSON.parse(fs.readFileSync(path.join(dir, 'record.json'), 'utf8'));
let tin = 0, tout = 0, cost = 0; const missing = [];
for (const s of rec.sessions) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, 'logs', `${s.name}.json`), 'utf8'));
    const u = j.usage || {};
    tin += (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
    tout += u.output_tokens || 0;
    if (typeof j.total_cost_usd === 'number') cost += j.total_cost_usd; else missing.push(s.name);
  } catch { missing.push(s.name); }
}
const min = (a, b) => (Date.parse(b) - Date.parse(a)) / 60000;
const started = rec.sessions.map(s => s.started).filter(Boolean), ended = rec.sessions.map(s => s.ended).filter(Boolean);
const sets = [];
if (started.length) sets.push(`setup_minutes=${min(rec.created, started[0]).toFixed(2)}`);
sets.push(`active_minutes=${rec.sessions.reduce((n, s) => n + (s.started && s.ended ? min(s.started, s.ended) : 0), 0).toFixed(2)}`);
if (started.length && ended.length) sets.push(`elapsed_minutes=${min(started[0], ended[ended.length - 1]).toFixed(2)}`);
if (missing.length) sets.push(`unavailable.tokens=claude -p produced no usage JSON for ${missing.join(', ')}`, `unavailable.cost_usd=claude -p produced no cost for ${missing.join(', ')}`);
else sets.push(`tokens.input=${tin}`, `tokens.output=${tout}`, `cost_usd=${cost.toFixed(4)}`);
const bm = path.join(__dirname, '..', '..', '..', 'scripts', 'delivery-benchmark', 'benchmark.cjs');
const r = spawnSync(process.execPath, [bm, 'effort', '--runs', runs, '--run', run, ...sets.flatMap(s => ['--set', s])], { encoding: 'utf8' });
process.stdout.write(r.stdout + r.stderr);
process.exit(r.status);
