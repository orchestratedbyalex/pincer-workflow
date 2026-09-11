'use strict';
// PINCER runtime — agreements (docs/runtime-contracts.md, "Agreements and
// authorization"). An agreement is the reviewed content a user authorized: the
// change, the PRD's authored revision, the breakdown (every ticket of the PRD,
// normalized as in "Content revisions") and the resolved consequential
// decisions. Its digest is SHA-256 over the projection text below, version 1.
// Agreement entries carry a tracked snapshot of the normalized inputs so an old
// agreement stays reviewable and its digest recomputable from the file alone;
// the structural difference between two agreements is computed here too. Nothing
// here judges semantics or grants approval.
const fs = require('node:fs');
const path = require('node:path');
const parse = require('./parse.cjs');
const transaction = require('./transaction.cjs');
const { readJson } = require('./fsutil.cjs');

const PROJECTION_VERSION = 1;
const SNAPSHOT_SCHEMA = 1;
const SNAPSHOT_KEYS = ['schema', 'change', 'agreement', 'digest', 'projection', 'prd', 'tickets', 'decisions', 'recorded'];
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const ticketNumber = id => Number(id.slice(2));

const decisionDigest = d => parse.sha256(`${d.id}\n${d.summary}\n${d.reference}\n${d.excerpt}\n`);

// The exact projection text (each line terminated by \n).
function projectionText({ change, prd, tickets, decisions }) {
  const lines = [`pincer agreement ${PROJECTION_VERSION}`, `change ${change}`, `prd ${prd.path} ${prd.revision}`];
  for (const id of Object.keys(tickets).sort((a, b) => ticketNumber(a) - ticketNumber(b))) lines.push(`ticket ${id} ${tickets[id].digest}`);
  for (const id of Object.keys(decisions).sort()) lines.push(`decision ${id} ${decisionDigest({ id, ...decisions[id] })}`);
  return `${lines.join('\n')}\n`;
}
const breakdownDigest = tickets => parse.sha256(Object.keys(tickets).sort((a, b) => ticketNumber(a) - ticketNumber(b)).map(id => `ticket ${id} ${tickets[id].digest}\n`).join(''));

// Compute the current agreement of a record from the files on disk. Returns
// { digest, projection, prd, tickets, decisions, breakdown } or { code, problem }.
function compute(root, record) {
  const prdResult = parse.validatePrd(root, record.prd);
  if (!prdResult.ok) return { code: 'INPUT_INVALID', problem: `${record.prd}: ${prdResult.problems[0]}` };
  const set = parse.validateTicketSet(root);
  if (!set.ok) return { code: 'INPUT_INVALID', problem: `pincer-ticket: ${set.file ? `${set.file}: ` : ''}${set.problems[0]}` };
  const statusModule = require('./status.cjs');
  const tickets = {};
  for (const file of set.files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const v = parse.validateTicket(file, text);
    const assoc = statusModule.ticketPrd(root, file, v.fields);
    if (assoc.problem) return { code: 'INPUT_INVALID', problem: assoc.problem };
    if (assoc.prd !== record.prd) continue;
    tickets[v.fields.ticket] = { file, digest: parse.ticketDigest(text), text: parse.normalizeTicket(text) };
  }
  const decisions = {};
  for (const d of record.decisions) if (d.status === 'resolved') decisions[d.id] = { summary: d.summary, reference: d.reference, excerpt: d.excerpt };
  const prd = { path: record.prd, revision: parse.prdDigest(prdResult.text), text: parse.normalizePrd(prdResult.text) };
  const inputs = { change: record.change, prd, tickets, decisions };
  const projection = projectionText(inputs);
  return { ...inputs, projection, digest: parse.sha256(projection), breakdown: breakdownDigest(tickets) };
}

// --- Snapshots -----------------------------------------------------------------------
function snapshotDoc(record, agreementId, computed, recorded) {
  return { schema: SNAPSHOT_SCHEMA, change: record.change, agreement: agreementId, digest: computed.digest, projection: computed.projection, prd: computed.prd, tickets: computed.tickets, decisions: computed.decisions, recorded };
}
// Read and verify one agreement's snapshot: the file exists, has the documented
// shape, its projection recomputes from its own inputs, and the digest is the
// SHA-256 of that projection and equals the entry's. Returns { snapshot } or
// { code: 'HISTORY_INVALID', problem }.
function readSnapshot(root, record, agreement) {
  const rel = agreement.snapshot;
  const invalid = p => ({ code: 'HISTORY_INVALID', problem: `${rel}: ${p} — the agreement ${agreement.id} of change "${record.change}" cannot be reviewed from a digest alone` });
  const read = readJson(path.join(root, rel));
  if (read.error === 'missing') return invalid('snapshot missing');
  if (read.error) return invalid(read.error);
  const s = read.data;
  if (!isObject(s) || s.schema !== SNAPSHOT_SCHEMA || Object.keys(s).some(k => !SNAPSHOT_KEYS.includes(k)) || !SNAPSHOT_KEYS.every(k => k in s)) return invalid('not a schema 1 agreement snapshot');
  if (s.change !== record.change || s.agreement !== agreement.id) return invalid(`snapshot belongs to ${s.change}/${s.agreement}`);
  if (!isObject(s.prd) || typeof s.prd.path !== 'string' || typeof s.prd.revision !== 'string' || typeof s.prd.text !== 'string') return invalid('snapshot prd must be { path, revision, text }');
  if (!isObject(s.tickets) || !Object.values(s.tickets).every(t => isObject(t) && typeof t.file === 'string' && typeof t.digest === 'string' && typeof t.text === 'string')) return invalid('snapshot tickets must map IDs to { file, digest, text }');
  if (!isObject(s.decisions)) return invalid('snapshot decisions must be an object');
  if (parse.sha256(s.prd.text) !== s.prd.revision) return invalid('the snapshot PRD text does not hash to its recorded revision');
  for (const [id, t] of Object.entries(s.tickets)) if (parse.sha256(t.text) !== t.digest) return invalid(`the snapshot text of ${id} does not hash to its recorded digest`);
  const recomputed = projectionText({ change: s.change, prd: s.prd, tickets: s.tickets, decisions: s.decisions });
  if (recomputed !== s.projection) return invalid('the snapshot projection does not recompute from its inputs');
  if (parse.sha256(s.projection) !== s.digest || s.digest !== agreement.digest) return invalid('the snapshot digest does not match the projection or the record entry');
  return { snapshot: s };
}

// --- Structural difference ------------------------------------------------------------
// Which parts of two normalized ticket texts differ: frontmatter, acceptance,
// verification, other. Never a semantic judgment.
function ticketParts(a, b) {
  const sa = parse.ticketSections(a), sb = parse.ticketSections(b);
  return ['frontmatter', 'acceptance', 'verification', 'other'].filter(k => sa[k] !== sb[k]);
}
// difference(from, to): `from` is a snapshot (or computed inputs) and `to` the
// current computed inputs.
function difference(from, to) {
  const before = new Set(Object.keys(from.tickets)), after = new Set(Object.keys(to.tickets));
  const byNumber = (a, b) => ticketNumber(a) - ticketNumber(b);
  const added = [...after].filter(id => !before.has(id)).sort(byNumber);
  const removed = [...before].filter(id => !after.has(id)).sort(byNumber);
  const changed = [...after].filter(id => before.has(id) && from.tickets[id].digest !== to.tickets[id].digest).sort(byNumber).map(id => ({ id, parts: ticketParts(from.tickets[id].text, to.tickets[id].text) }));
  const decisionsBefore = Object.keys(from.decisions), decisionsAfter = Object.keys(to.decisions);
  return {
    same: from.digest === to.digest,
    prd_changed: from.prd.revision !== to.prd.revision,
    tickets_added: added, tickets_removed: removed, tickets_changed: changed,
    decisions_added: decisionsAfter.filter(id => !decisionsBefore.includes(id)).sort(),
    decisions_removed: decisionsBefore.filter(id => !decisionsAfter.includes(id)).sort(),
  };
}
function renderDifference(d) {
  if (d.same) return 'unchanged';
  const bits = [];
  if (d.prd_changed) bits.push('PRD body changed');
  if (d.tickets_added.length) bits.push(`tickets added: ${d.tickets_added.join(', ')}`);
  if (d.tickets_removed.length) bits.push(`tickets removed: ${d.tickets_removed.join(', ')}`);
  if (d.tickets_changed.length) bits.push(`tickets changed: ${d.tickets_changed.map(t => `${t.id} (${t.parts.join(', ') || 'content'})`).join(', ')}`);
  if (d.decisions_added.length) bits.push(`decisions resolved: ${d.decisions_added.join(', ')}`);
  if (d.decisions_removed.length) bits.push(`decisions no longer recorded: ${d.decisions_removed.join(', ')}`);
  return bits.join('; ') || 'digest differs';
}

// The latest recorded agreement entry, and whether it matches the current digest.
const latestEntry = record => (record.agreements.length ? record.agreements[record.agreements.length - 1] : null);
const entryFor = (record, digest) => record.agreements.find(g => g.digest === digest) || null;

// --- change revise ---------------------------------------------------------------------
// Record the current agreement as G-NN with its snapshot when it differs from the
// latest recorded one; a no-op otherwise. Authorizes nothing. `expect` is the
// record sequence the caller prepared against. Returns { action: 'recorded' |
// 'unchanged', agreement, record, difference } or { code, problem }.
function revise(root, id, { expect = null, hooks = null } = {}) {
  const changes = require('./changes.cjs');
  try {
    const out = transaction.run(root, { command: `change revise ${id}`, hooks }, ctx => {
      const resolved = changes.resolveSelected(root, { change: id });
      if (resolved.code) ctx.refuse(resolved.code, resolved.problem);
      if (expect !== null) ctx.expect(resolved.file, 'sequence', expect);
      const record = resolved.record;
      if (changes.TERMINAL.includes(record.lifecycle.state)) ctx.refuse('LIFECYCLE_BLOCKED', `change ${id} is ${record.lifecycle.state}; its agreements are history and cannot be revised — register a new change`);
      const computed = compute(root, record);
      if (computed.code) ctx.refuse(computed.code, computed.problem);
      const latest = latestEntry(record);
      if (latest && latest.digest === computed.digest) return { action: 'unchanged', agreement: latest, record, difference: null };
      const previous = latest ? readSnapshot(root, record, latest) : null;
      if (previous && previous.code) ctx.refuse(previous.code, previous.problem);
      return appendAgreement(ctx, changes, record, resolved.file, computed, { previous: previous ? previous.snapshot : null });
    });
    return out.result;
  } catch (error) {
    if (error.refusal) return { code: error.code, problem: error.message };
    if (error.code === 'STATE_BUSY') return { code: 'STATE_BUSY', problem: error.message };
    throw error;
  }
}
// Stage a new agreement entry, its snapshot and the `agreement` event on an
// in-memory record; shared with `change authorize` (which records the agreement
// it binds when it is not recorded yet). Mutates `record`; the caller must stage
// the record write when it adds more.
function appendAgreement(ctx, changes, record, file, computed, { previous = null, stage = true } = {}) {
  const gid = `G-${String(record.agreements.length + 1).padStart(2, '0')}`;
  const snapshotRel = changes.snapshotFile(record.change, gid);
  const entry = { id: gid, digest: computed.digest, prd_revision: computed.prd.revision, breakdown: computed.breakdown, tickets: Object.keys(computed.tickets).sort((a, b) => ticketNumber(a) - ticketNumber(b)), decisions: Object.keys(computed.decisions).sort(), snapshot: snapshotRel, recorded: ctx.now };
  record.agreements.push(entry);
  const sequence = record.sequence + 1;
  record.events.push({ sequence, kind: 'agreement', from: record.lifecycle.state, to: record.lifecycle.state, at: ctx.now, reason: null, agreement: gid, authorization: null, decision: null, replacement: null, note: null });
  record.sequence = sequence;
  ctx.write(snapshotRel, snapshotDoc(record, gid, computed, ctx.now));
  if (stage) ctx.write(file, record);
  return { action: 'recorded', agreement: entry, record, difference: previous ? difference(previous, computed) : null };
}

module.exports = { PROJECTION_VERSION, SNAPSHOT_SCHEMA, projectionText, decisionDigest, breakdownDigest, compute, snapshotDoc, readSnapshot, difference, renderDifference, latestEntry, entryFor, revise, appendAgreement };
