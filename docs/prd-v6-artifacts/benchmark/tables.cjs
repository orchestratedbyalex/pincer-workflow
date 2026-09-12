#!/usr/bin/env node
'use strict';
// Renders the per-run table and the S-27 changed-scope table of docs/trial-prd-v6.md
// from the sanitized records under runs/ (paste the output into the trial record):
//   node docs/prd-v6-artifacts/benchmark/tables.cjs
const fs = require('node:fs');
const path = require('node:path');
const repo = path.resolve(__dirname, '..', '..', '..');
const lib = require(path.join(repo, 'scripts/delivery-benchmark/lib.cjs'));
const runs = path.join(__dirname, 'runs');
const rec = id => { const f = path.join(runs, ...id.split('/'), 'record.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
// Every recorded run: the scheduled slots in order, then the reruns beside their brief and arm.
const scheduled = lib.schedule().map(s => s.run);
const all = lib.walk(runs).filter(r => r.endsWith('/record.json')).map(r => path.dirname(r));
const ordered = [...scheduled, ...all.filter(r => !scheduled.includes(r)).sort()];
const turnsOf = id => { const r = rec(id); return !r ? 0 : r.sessions.reduce((n, x) => { try { return n + (JSON.parse(fs.readFileSync(path.join(runs, ...id.split('/'), 'logs', x.name + '.json'), 'utf8')).num_turns || 0); } catch { return n; } }, 0); };
const num = (v, digits) => (v === null || v === undefined ? 'n/a' : v.toFixed(digits));
const out = [];
out.push('| # | Run | Status | Outcome | Cost USD | Active min | Turns | Interventions |');
out.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const id of ordered) {
  const r = rec(id);
  if (!r) { out.push(`| ${lib.schedule().find(s => s.run === id).order} | ${id} | outstanding | — | n/a | n/a | n/a | 0 |`); continue; }
  out.push(`| ${r.order === null ? 'rerun' : r.order} | ${id} | ${r.status} | ${r.evaluation ? r.evaluation.outcome : '—'} | ${num(r.effort.cost_usd, 2)} | ${num(r.effort.active_minutes, 1)} | ${turnsOf(id)} | ${r.interventions.filter(i => i.type !== 'operator').length} |`);
}
out.push('');
out.push('| Run | `change authorize` in S2 | scope-approval | R-03 delivered | S2 result (first line) |');
out.push('| --- | --- | --- | --- | --- |');
for (const id of ordered.filter(x => x.startsWith('scope-revision/'))) {
  const r = rec(id); if (!r || r.status !== 'valid') continue;
  const dir = path.join(runs, ...id.split('/'), 'logs');
  const cmds = fs.existsSync(path.join(dir, 'S2.commands.txt')) ? fs.readFileSync(path.join(dir, 'S2.commands.txt'), 'utf8') : '';
  const authorized = (cmds.match(/change authorize/g) || []).length;
  const check = r.evaluation && r.evaluation.checks.find(c => c.id === 'scope-approval');
  const r03 = r.evaluation && r.evaluation.checks.find(c => c.id === 'r03-list-json');
  let first = '';
  try { first = (JSON.parse(fs.readFileSync(path.join(dir, 'S2.json'), 'utf8')).result || '').split('\n').find(l => l.trim()) || ''; } catch {}
  out.push(`| ${id} | ${authorized} | ${check ? check.result : '—'} | ${r03 ? r03.result : '—'} | ${first.replace(/\|/g, '\\|').slice(0, 140)} |`);
}
process.stdout.write(`${out.join('\n')}\n`);
