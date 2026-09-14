'use strict';
// Aggregates run records into the local review artifact: per brief and arm, acceptance
// with its denominator, escaped regressions, interventions by type, effort and time,
// tokens and cost when available, variation, invalid and unavailable runs, outstanding
// slots. It states what is not available and makes no parity or superiority claim.
const fs = require('node:fs');
const path = require('node:path');
const lib = require('./lib.cjs');
const record = require('./record.cjs');

function loadRecords(runsRoot) {
  const out = [];
  if (!fs.existsSync(runsRoot)) return out;
  for (const rel of lib.walk(runsRoot)) if (rel.endsWith('/record.json')) {
    const file = path.join(runsRoot, rel);
    try { out.push({ file: rel, record: lib.readJson(file) }); } catch (e) { out.push({ file: rel, record: null, error: e.message }); }
  }
  return out;
}

const stats = values => {
  const v = values.filter(x => typeof x === 'number').sort((a, b) => a - b);
  if (!v.length) return { n: 0, min: null, median: null, max: null };
  const mid = Math.floor(v.length / 2);
  return { n: v.length, min: v[0], median: v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2, max: v[v.length - 1] };
};

function compute(runsRoot, { frozen } = {}) {
  const ids = frozen ? Object.keys(frozen.briefs).sort() : lib.briefIds();
  const plan = lib.schedule(ids);
  const loaded = loadRecords(runsRoot);
  const byRun = new Map();
  const malformed = [];
  for (const { file, record: r, error } of loaded) {
    if (!r) { malformed.push({ file, problems: [{ code: 'RECORD_INVALID', detail: error }] }); continue; }
    const p = record.problems(r, { frozen });
    if (p.length) malformed.push({ file, run: r.run, problems: p });
    if (typeof r.run === 'string') byRun.set(r.run, { file, record: r, problems: p });
  }
  const briefs = {};
  for (const id of ids) {
    briefs[id] = {};
    for (const arm of lib.ARMS) {
      const slots = plan.filter(s => s.brief === id && s.arm === arm);
      const runs = slots.map(s => ({ slot: s, entry: byRun.get(s.run) || null }));
      for (const [run, entry] of byRun) if (entry.record.brief === id && entry.record.arm === arm && !slots.some(s => s.run === run)) runs.push({ slot: { run, order: null, brief: id, arm, pair: entry.record.pair }, entry });
      const valid = runs.filter(x => x.entry && !x.entry.problems.length && x.entry.record.status === 'valid');
      const evaluated = valid.map(x => x.entry.record.evaluation);
      const count = o => evaluated.filter(e => e.outcome === o).length;
      const status = st => runs.filter(x => x.entry && x.entry.record.status === st).length;
      const interventions = {};
      for (const t of lib.INTERVENTIONS) interventions[t] = { total: valid.reduce((n, x) => n + x.entry.record.interventions.filter(i => i.type === t).length, 0), per_run: valid.map(x => x.entry.record.interventions.filter(i => i.type === t).length) };
      const effort = {};
      for (const k of ['setup_minutes', 'review_minutes', 'active_minutes', 'elapsed_minutes']) effort[k] = stats(valid.map(x => x.entry.record.effort[k]));
      const tokens = valid.map(x => x.entry.record.effort.tokens).filter(Boolean);
      const cost = valid.map(x => x.entry.record.effort.cost_usd).filter(x => typeof x === 'number');
      briefs[id][arm] = {
        slots: slots.length,
        recorded: runs.filter(x => x.entry).length,
        valid: valid.length,
        invalid: status('invalid'), unavailable: status('unavailable'), pending: status('pending'), malformed: runs.filter(x => x.entry && x.entry.problems.length).length,
        outstanding: slots.length - valid.length,
        acceptance: { accepted: count('accepted'), denominator: valid.length, rate: valid.length ? count('accepted') / valid.length : null },
        rejected: count('rejected'), unverified: count('unverified'), error: count('error'),
        regressions: { total: evaluated.reduce((n, e) => n + e.regressions, 0), per_run: evaluated.map(e => e.regressions) },
        interventions, effort,
        tokens: { available: tokens.length, of: valid.length, input: stats(tokens.map(t => t.input)), output: stats(tokens.map(t => t.output)), unavailable: valid.filter(x => !x.entry.record.effort.tokens).map(x => x.entry.record.effort.unavailable.tokens) },
        cost_usd: { available: cost.length, of: valid.length, ...stats(cost), unavailable: valid.filter(x => x.entry.record.effort.cost_usd === null).map(x => x.entry.record.effort.unavailable.cost_usd) },
        runs: runs.map(x => ({ run: x.slot.run, order: x.slot.order, status: x.entry ? x.entry.record.status : 'outstanding', outcome: x.entry && x.entry.record.evaluation ? x.entry.record.evaluation.outcome : null, problems: x.entry ? x.entry.problems.map(p => p.code) : [], reason: x.entry ? x.entry.record.reason : null, candidate: x.entry ? x.entry.record.workspace.candidate : null, kit: x.entry && x.entry.record.environment.kit ? x.entry.record.environment.kit.digest : null }))
      };
    }
  }
  const total = { slots: plan.length, valid: 0, accepted: 0, outstanding: 0, invalid: 0, unavailable: 0 };
  for (const id of ids) for (const arm of lib.ARMS) { const b = briefs[id][arm]; total.valid += b.valid; total.accepted += b.acceptance.accepted; total.outstanding += b.outstanding; total.invalid += b.invalid; total.unavailable += b.unavailable; }
  const orderBalance = { pincer_first: plan.filter(s => s.arm === 'pincer' && s.order % 2 === 1).length, plain_first: plan.filter(s => s.arm === 'plain' && s.order % 2 === 1).length };
  const environments = [...new Set([...byRun.values()].map(x => JSON.stringify({ model: x.record.environment.model, tool: x.record.environment.tool, tool_version: x.record.environment.tool_version, node: x.record.environment.node, os: x.record.environment.os })))].map(s => JSON.parse(s));
  return { schema: 1, generated: lib.nowIso(), frozen: frozen ? { frozen: frozen.frozen, protocol: frozen.protocol } : null, briefs, total, order_balance: orderBalance, environments, malformed, claim: 'This report makes no parity or superiority claim. Acceptance is the independent evaluator\'s judgment on each run; denominators are the valid runs of each brief and arm; outstanding, invalid and unavailable runs are listed, never counted as passed; unavailable values are null with a reason.' };
}

const pct = r => r.rate === null ? 'n/a' : `${r.accepted}/${r.denominator}`;
const fmt = s => s.n ? `${s.median} (min ${s.min}, max ${s.max}, n=${s.n})` : 'n/a (n=0)';
function render(rep) {
  const L = [];
  L.push(`# Delivery benchmark report (${rep.generated})`);
  L.push(rep.frozen ? `Protocol frozen ${rep.frozen.frozen} (${rep.frozen.protocol.slice(0, 12)}).` : 'Protocol: not frozen — results are not comparable.');
  L.push(`Slots ${rep.total.slots} · valid ${rep.total.valid} · accepted ${rep.total.accepted}/${rep.total.valid} · outstanding ${rep.total.outstanding} · invalid ${rep.total.invalid} · unavailable ${rep.total.unavailable}`);
  L.push(`Order balance: ${rep.order_balance.pincer_first} pairs pincer-first, ${rep.order_balance.plain_first} pairs plain-first.`);
  L.push('');
  L.push('| Brief | Arm | Accepted / valid | Rejected | Unverified · error | Outstanding · invalid · unavailable | Regressions | Clarif. · reappr. · repair · operator | Active min | Elapsed min | Setup · review min | Tokens · cost |');
  L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const [id, arms] of Object.entries(rep.briefs)) for (const arm of lib.ARMS) {
    const b = arms[arm]; const i = b.interventions;
    L.push(`| ${id} | ${arm} | ${pct(b.acceptance)} | ${b.rejected} | ${b.unverified} · ${b.error} | ${b.outstanding} · ${b.invalid} · ${b.unavailable} | ${b.regressions.total} | ${i.clarification.total} · ${i.reapproval.total} · ${i.repair.total} · ${i.operator.total} | ${fmt(b.effort.active_minutes)} | ${fmt(b.effort.elapsed_minutes)} | ${fmt(b.effort.setup_minutes)} · ${fmt(b.effort.review_minutes)} | ${b.tokens.available}/${b.tokens.of} · ${b.cost_usd.available}/${b.cost_usd.of} |`);
  }
  L.push('');
  L.push('Per run:');
  for (const [id, arms] of Object.entries(rep.briefs)) for (const arm of lib.ARMS) for (const r of arms[arm].runs) L.push(`- #${r.order} ${r.run}: ${r.status}${r.outcome ? ` · ${r.outcome}` : ''}${r.candidate ? ` · candidate ${r.candidate.slice(0, 7)}` : ''}${r.kit ? ` · kit ${r.kit.slice(0, 12)}` : ''}${r.reason ? ` · ${r.reason}` : ''}${r.problems.length ? ` · problems ${r.problems.join(', ')}` : ''}`);
  if (rep.malformed.length) { L.push(''); L.push('Malformed records (excluded from every denominator):'); for (const m of rep.malformed) L.push(`- ${m.file}: ${m.problems.map(p => `${p.code} ${p.detail}`).join('; ')}`); }
  L.push('');
  L.push(`Environments: ${rep.environments.length ? rep.environments.map(e => `${e.tool || '?'} ${e.tool_version || '?'} · model ${e.model || '?'} · node ${e.node || '?'} · ${e.os || '?'}`).join(' | ') : 'none recorded'}`);
  L.push('');
  L.push(rep.claim);
  return `${L.join('\n')}\n`;
}

module.exports = { compute, render, loadRecords, stats };
