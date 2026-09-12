'use strict';
// PINCER runtime — phase-specific coverage (docs/runtime-contracts.md, "Strict
// coverage" → "Phase-specific coverage"). One pure computation over the validated
// graph, consumed by `coverage`, `change complete`, `evidence export`, `ready`,
// status and resume: `structure` (every obligation linked or authorized as not
// delivered, nothing missing from the baseline), `implementation` (structure plus
// every ticket done and ready under the v5 rules) and `candidate` (the evaluated
// candidate's reconciled evidence). The three are separate fields; none implies
// another, and a linked check, a done ticket or a passing syntax check never
// becomes a delivery or adequacy verdict. A change without the capability is
// labeled `unverified`. Nothing here writes, launches or judges semantics.
const changes = require('./changes.cjs');
const agreement = require('./agreement.cjs');
const authorization = require('./authorization.cjs');
const coverage = require('./coverage.cjs');
const dispositions = require('./dispositions.cjs');
const requirements = require('./requirements.cjs');

const STRUCTURE_ORDER = ['INPUT_INVALID', 'INVENTORY_INVALID', 'COVERAGE_INVALID', 'COVERAGE_INCOMPLETE', 'SCOPE_UNAUTHORIZED', 'OBLIGATION_MISSING'];
const byOrder = (a, b) => STRUCTURE_ORDER.indexOf(a.code) - STRUCTURE_ORDER.indexOf(b.code);

const unverified = reason => ({ strict: false, label: 'unverified', reason, inventory: null, map: null, graph: null, scope: [], structure: null, implementation: null, candidate: null, blockers: [] });

// compute(root, record, { gathered, verdict }) — `gathered` is status.render(...).gathered
// for the record (computed here when absent); `verdict` the authorization verdict.
function compute(root, record, { gathered = null, verdict = null } = {}) {
  if (!record) return unverified('no change record');
  if (!changes.isStrict(record)) return unverified(`strict coverage not adopted (node scripts/pincer-runtime.cjs coverage adopt --preview --change ${record.change})`);
  const out = { strict: true, label: 'strict', reason: null, inventory: null, map: null, graph: null, scope: [], structure: { complete: false, problems: [] }, implementation: { complete: false, scenarios: {}, problems: [] }, candidate: { evaluated: false, candidate: null, manifest: null, delivery: null, adequacy: null, scenarios: {}, problems: [] }, blockers: [] };
  const priorInventory = gid => agreement.inventoryOf(root, record, record.agreements.find(g => g.id === gid) || null);
  const cov = coverage.load(root, record, { priorInventory });
  out.inventory = cov.inventory ? { digest: cov.inventory.digest, requirements: Object.fromEntries(Object.entries(cov.inventory.requirements).map(([id, r]) => [id, { title: r.title, line: r.line, end: r.end, scenarios: r.scenarios }])), scenarios: Object.fromEntries(Object.entries(cov.inventory.scenarios).map(([id, s]) => [id, { requirement: s.requirement, line: s.line, end: s.end }])) } : null;
  out.map = cov.map ? { path: cov.map.file, digest: cov.map.digest, checks: Object.fromEntries(Object.entries(cov.map.map.checks).map(([id, c]) => [id, { kind: c.kind, required: c.required, declared: coverage.definitionDigest(c) }])) } : null;
  if (cov.code && cov.code !== 'COVERAGE_INCOMPLETE') {
    out.structure.problems = cov.problems.map(detail => ({ code: cov.code, detail, ids: [] }));
    out.blockers = out.structure.problems.map(p => ({ code: p.code, detail: p.detail }));
    return out;
  }
  out.graph = cov.graph;
  const v = verdict || authorization.verdict(root, record);
  const scope = dispositions.scopeProblems(record, cov.graph, v);
  out.scope = scope.resolved;
  const problems = [...cov.graph.problems, ...scope.problems, ...dispositions.obligationProblems(dispositions.baseline(root, record), cov.inventory, cov.map.map)].sort(byOrder);
  out.structure = { complete: problems.length === 0, problems };
  // Implementation: every in-scope scenario's tickets done and ready; every ticket of the change done and ready.
  const g = gathered || require('./status.cjs').render(root, { change: record.change }).gathered;
  const ticketState = id => {
    const t = g && g.tickets ? g.tickets.find(x => x.fields.ticket === id) : null;
    if (!t) return { id, status: null, ready: false, code: 'EVIDENCE_MISSING', detail: 'no ticket file' };
    const r = g.computeReadiness(t);
    return { id, status: t.fields.status, ready: r.ready, code: r.ready ? null : r.reasons[0].code, detail: r.ready ? null : `${r.reasons[0].detail} — ${r.reasons[0].next}` };
  };
  const implProblems = [];
  const seen = new Set();
  for (const id of requirements.sortIds(Object.keys(cov.graph.scenarios))) {
    const s = cov.graph.scenarios[id];
    const tickets = s.tickets.map(ticketState);
    const unfinished = tickets.find(t => t.status !== 'done');
    const unverifiedT = tickets.find(t => t.status === 'done' && !t.ready);
    const state = unfinished ? 'unfinished' : unverifiedT ? 'unverified' : 'complete';
    const detail = unfinished ? `${unfinished.id} is ${unfinished.status || 'missing'}, not done` : unverifiedT ? `${unverifiedT.id} ${unverifiedT.code}: ${unverifiedT.detail}` : null;
    out.implementation.scenarios[id] = { scope: 'in-scope', requirement: s.requirement, implementation: state, tickets, checks: s.checks, detail };
    if (state !== 'complete' && !seen.has(detail)) { seen.add(detail); implProblems.push({ code: unfinished ? 'LIFECYCLE_BLOCKED' : unverifiedT.code, detail: `${id}: ${detail}`, ids: [id, (unfinished || unverifiedT).id] }); }
  }
  for (const id of requirements.sortIds(Object.keys(cov.graph.scope))) {
    const s = cov.graph.scope[id];
    out.implementation.scenarios[id] = { scope: s.disposition, requirement: s.requirement, implementation: 'not applicable', tickets: [], checks: [], detail: `${s.disposition} by decision ${s.decision}` };
  }
  // Enabling tickets and any other ticket of the change must be done and ready too.
  for (const id of Object.keys(cov.tickets || {})) {
    const t = ticketState(id);
    if (t.status === 'done' && t.ready) continue;
    const detail = t.status !== 'done' ? `${id} is ${t.status}, not done` : `${id} ${t.code}: ${t.detail}`;
    if (!implProblems.some(p => p.ids.includes(id))) implProblems.push({ code: t.status !== 'done' ? 'LIFECYCLE_BLOCKED' : t.code, detail, ids: [id] });
  }
  out.implementation.problems = implProblems;
  out.implementation.complete = out.structure.complete && implProblems.length === 0;
  out.candidate.problems = [{ code: 'EVIDENCE_MISSING', detail: 'candidate: not evaluated', ids: [] }];
  out.candidate.adequacy = null;
  // A missing or stale evaluation blocks only a completed change: before completion no candidate is expected.
  out.blockers = [...out.structure.problems, ...implProblems, ...(record.lifecycle.state === 'completed' ? out.candidate.problems : [])].map(p => ({ code: p.code, detail: p.detail }));
  return out;
}

// The first blocking problem for a phase, in the contract's order, or null.
function firstBlocker(report, phase) {
  if (!report.strict) return null;
  if (report.structure.problems.length) return report.structure.problems[0];
  if (phase === 'structure') return null;
  if (report.implementation.problems.length) return report.implementation.problems[0];
  if (phase === 'implementation') return null;
  return report.candidate.problems[0] || null;
}

module.exports = { STRUCTURE_ORDER, compute, firstBlocker };
