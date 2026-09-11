'use strict';
// PINCER runtime — status (docs/runtime-contracts.md, "Readiness and reason
// codes"). Gathers the artifacts on disk, computes readiness once, and renders
// the human report (line for line the v0.4.1 format plus a `Runtime` line) or
// the status JSON. Read-only: never executes a check, never writes.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const parse = require('./parse.cjs');
const identity = require('./identity.cjs');
const source = require('./source.cjs');
const state = require('./state.cjs');
const readiness = require('./readiness.cjs');
const evidence = require('./evidence.cjs');
const { tryGit } = require('./fsutil.cjs');

const RUNTIME = 1;
const pad = (s, n) => String(s).padEnd(n);
const toEpoch = iso => { const t = Date.parse(iso); return Number.isFinite(t) ? Math.floor(t / 1000) : 0; };
const mins = (a, b) => `${Math.floor((b - a) / 60)}m`;
const hhmm = iso => (iso ? iso.slice(11, 16) : '—');
const short = s => (typeof s === 'string' ? s.slice(0, 12) : '?');

// --- PRD selection -----------------------------------------------------------
function prdFiles(root) {
  const dir = path.join(root, '.prd');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(n => /^prd-v.*\.md$/.test(n)).map(n => `.prd/${n}`);
}
// Legacy: the highest-numbered PRD. Returns { prd } (prd may be null) or { problem }.
function latestPrd(root) {
  let latest = null, highest = 0;
  for (const ref of prdFiles(root)) {
    const m = ref.match(parse.PRD_REF);
    if (!m) return { problem: `invalid PRD filename: ${ref}` };
    if (Number(m[1]) > highest) { highest = Number(m[1]); latest = ref; }
  }
  if (!latest) return { prd: null };
  const result = parse.validatePrd(root, latest);
  if (!result.ok) return { problem: `${result.file ? `${result.file}: ` : ''}${result.problems[0]}` };
  return { prd: latest, prdResult: result };
}
// Ticket → PRD association without writing (legacy tickets with one PRD are inferred).
function ticketPrd(root, file, fields) {
  let ref = fields.prd || '';
  if (!ref) {
    const all = prdFiles(root);
    if (all.length !== 1) return { problem: `${file}: missing or ambiguous PRD association; use pincer-ticket.sh bind ${fields.ticket} .prd/prd-vN.md` };
    ref = all[0];
  }
  const result = parse.validatePrd(root, ref);
  if (!result.ok) return { problem: `${result.file ? `${result.file}: ` : ''}${result.problems[0]}` };
  return { prd: ref, prdResult: result };
}
const usablePrd = prdResult => ['ticketed', 'built'].includes(prdResult.fields.status);

// --- Candidate (NOTES.md + evidence) ------------------------------------------
// Port of notes_current: exact wording, same checks, one pass.
function notesCurrent(root, prd) {
  const notesPath = path.join(root, 'NOTES.md');
  if (!fs.existsSync(notesPath)) return { text: 'missing', state: 'missing' };
  const meta = parse.validateMetadata(fs.readFileSync(notesPath, 'utf8'));
  if (!meta.ok) return { text: 'stale: invalid or missing evaluation metadata', state: 'stale' };
  const f = meta.fields;
  if (f.prd !== prd) return { text: 'stale: evaluation PRD does not match', state: 'stale', fields: f };
  const candidate = f.candidate || '', base = f.base || '';
  if (!parse.HEX40.test(candidate) || !parse.HEX40.test(base)) return { text: 'stale: candidate and base must be full 40-hex commit IDs', state: 'stale', fields: f };
  const ok = args => !tryGit(root, args).error;
  if (!ok(['rev-parse', '--verify', `${candidate}^{commit}`]) || !ok(['rev-parse', '--verify', `${base}^{commit}`]) ||
      !ok(['merge-base', '--is-ancestor', base, candidate]) || !ok(['merge-base', '--is-ancestor', candidate, 'HEAD'])) {
    return { text: 'stale: evaluation commits or ancestry unavailable', state: 'stale', fields: f };
  }
  const manifest = f.evidence || '';
  if (!manifest) return { text: 'stale: legacy evaluation without evidence manifest — re-run /pincer-evaluate for evidence schema 1', state: 'stale', fields: f };
  const opts = { files: true, candidate, base, prd };
  const problems = evidence.validate(path.resolve(root, manifest), opts, root);
  if (problems.length) return { text: `stale: evidence invalid: ${problems[0]}`, state: 'stale', fields: f, manifest };
  const canonical = new Set();
  for (const file of opts.list) {
    const tracked = tryGit(root, ['ls-files', '--error-unmatch', '--', file]);
    if (tracked.error || !tracked.out.trim()) return { text: `stale: evidence not tracked: ${file}`, state: 'stale', fields: f, manifest };
    for (const line of tracked.out.split('\n')) if (line) canonical.add(line);
  }
  const diff = tryGit(root, ['diff', '--name-only', '--relative', candidate, 'HEAD', '--', '.', ':(exclude)NOTES.md']);
  if (diff.error) return { text: 'stale: evaluation commits or ancestry unavailable', state: 'stale', fields: f, manifest };
  const offending = diff.out.split('\n').filter(l => l && !canonical.has(l))[0];
  if (offending) return { text: `stale: candidate changed after evaluation: ${offending}`, state: 'stale', fields: f, manifest };
  const dirty = tryGit(root, ['status', '--porcelain', '--untracked-files=all', '--', '.', ':(exclude)NOTES.md']);
  if (dirty.error || dirty.out.trim()) return { text: 'stale: working tree has changes outside NOTES.md', state: 'stale', fields: f, manifest };
  return { text: `current (${candidate})`, state: 'current', fields: f, manifest, candidate, base };
}
// The Evidence line: the validator's verdict for the manifest NOTES names,
// independent of whether the candidate is still current.
function evidenceLine(root, prd) {
  const notesPath = path.join(root, 'NOTES.md');
  if (!fs.existsSync(notesPath)) return null;
  const meta = parse.validateMetadata(fs.readFileSync(notesPath, 'utf8'));
  if (!meta.ok || !meta.fields.evidence) return null;
  const f = meta.fields;
  const opts = {};
  if (parse.HEX40.test(f.candidate || '')) opts.candidate = f.candidate;
  if (parse.HEX40.test(f.base || '')) opts.base = f.base;
  if (parse.PRD_REF.test(prd || '')) opts.prd = prd;
  const problems = evidence.validate(path.resolve(root, f.evidence), opts, root);
  let schema = null;
  try { schema = JSON.parse(fs.readFileSync(path.resolve(root, f.evidence), 'utf8')).schema; } catch { schema = null; }
  return { manifest: f.evidence, ok: problems.length === 0, reason: problems[0] || null, schema };
}

// --- Gather ------------------------------------------------------------------
function gather(root, { budget } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const out = { lines: [], warnings: [], exit: 0, json: { schema: 1, runtime: RUNTIME, generated: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), root, mode: 'legacy', change: null, prd: null, tickets: [], history: 0, candidate: null, reasons: [], next: null } };
  const line = s => out.lines.push(s);
  const j = out.json;
  line(`PINCER status · ${new Date().toISOString().replace(/:\d{2}\.\d{3}Z$/, 'Z')} · ${root}`);

  // Mode and selected PRD.
  const bindingResult = identity.loadBinding(root);
  let mode = 'legacy', binding = null, prd = null, prdResult = null;
  if (bindingResult.binding && !bindingResult.code) {
    mode = 'migrated'; binding = bindingResult.binding; prd = binding.prd; prdResult = bindingResult.prd;
  } else if (bindingResult.code === 'REVISION_CHANGED' || bindingResult.code === 'INPUT_INVALID') {
    mode = 'migrated'; binding = bindingResult.binding; prd = binding.prd;
    const v = parse.validatePrd(root, prd);
    if (!v.ok) { line(`WARN     invalid PRD: ${v.file || prd}: ${v.problems[0]}`); line('Next     repair PRD input before continuing'); out.exit = 4; return out; }
    prdResult = v;
  } else if (['MALFORMED', 'AMBIGUOUS', 'UNSUPPORTED_SCHEMA'].includes(bindingResult.code)) {
    line(`WARN     invalid change binding: ${bindingResult.problem}`);
    line('Next     repair .prd/changes/ before continuing (remove or restore the binding; see docs/runtime-contracts.md)');
    j.reasons.push({ code: 'INPUT_INVALID', detail: bindingResult.problem });
    out.exit = 4; return out;
  } else {
    const latest = latestPrd(root);
    if (latest.problem) { line(`WARN     invalid PRD: ${latest.problem}`); line('Next     repair PRD input before continuing'); out.exit = 4; return out; }
    prd = latest.prd; prdResult = latest.prdResult;
  }
  j.mode = mode;
  const prdStatus = prdResult ? prdResult.fields.status : '';
  if (!prd) line('PRD      none');
  else {
    line(`PRD      ${prd} · status: ${prdStatus || '?'} · profile: ${prdResult.profile} · date: ${prdResult.fields.date || ''}`);
    j.prd = { path: prd, status: prdStatus, profile: prdResult.profile, date: prdResult.fields.date || null };
  }
  if (mode === 'migrated') {
    j.change = { id: binding.change, prd: binding.prd, prd_revision: binding.prd_revision, base: binding.base };
    let runtimeLine = `Runtime  change ${binding.change} · revision ${short(binding.prd_revision)} · base ${binding.base.slice(0, 7)}`;
    if (bindingResult.code === 'REVISION_CHANGED') { runtimeLine += ` · REVISION_CHANGED: PRD content is now ${short(bindingResult.revision)}`; j.reasons.push({ code: 'REVISION_CHANGED', detail: bindingResult.problem }); }
    const newer = prdFiles(root).filter(ref => { const m = ref.match(parse.PRD_REF); return m && Number(m[1]) > Number(prd.match(parse.PRD_REF)[1]); });
    if (newer.length) runtimeLine += ` · unregistered newer PRD: ${newer.join(', ')}`;
    line(runtimeLine);
  } else {
    line(`Runtime  legacy · no change binding${prd ? ` · migrate with node scripts/pincer-runtime.cjs migrate --preview --prd ${prd}` : ''}`);
  }

  // Tickets: reject malformed input instead of guessing.
  const set = parse.validateTicketSet(root);
  if (!set.ok) {
    const prefix = set.file ? `pincer-ticket: ${set.file}: ` : 'pincer-ticket: ';
    line(`WARN     invalid tickets: ${prefix}${set.problems[0]}`);
    line('Next     repair ticket input before continuing');
    j.reasons.push({ code: 'INPUT_INVALID', detail: `${prefix}${set.problems[0]}` });
    out.exit = 4; return out;
  }
  const tickets = [];
  let historical = 0, unresolved = 0;
  for (const file of set.files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const v = parse.validateTicket(file, text);
    const assoc = ticketPrd(root, file, v.fields);
    if (assoc.problem) { line(`WARN     unresolved ticket PRD: pincer: ${assoc.problem}`); unresolved++; continue; }
    if (assoc.prd === prd) tickets.push({ file, text, fields: v.fields, timeout: v.timeout, prdResult: assoc.prdResult });
    else historical++;
  }
  j.history = historical;
  if (historical) line(`History  ${historical} ticket(s) associated with other PRDs`);

  // Current inputs for migrated readiness (computed once; read-only).
  let current = {}, sourceProblems = [], manifestNow = null;
  if (mode === 'migrated') {
    manifestNow = source.snapshot(root);
    sourceProblems = manifestNow.problems;
    current = { prdRevision: binding.prd_revision, sourceDigest: manifestNow.digest };
  }
  const indexRead = mode === 'migrated' && state.exists(root) ? state.readIndex(root) : { index: null };
  if (indexRead.error) { line(`WARN     invalid runtime state: ${indexRead.error}`); line('Next     repair or remove .pincer/runtime (see docs/runtime-contracts.md); run recover for a diagnosis'); j.reasons.push({ code: 'INPUT_INVALID', detail: indexRead.error }); out.exit = 4; return out; }
  const byId = new Map(tickets.map(t => [t.fields.ticket, t]));
  const readinessOf = new Map();
  const computeReadiness = t => {
    if (readinessOf.has(t.file)) return readinessOf.get(t.file);
    let r;
    if (mode === 'legacy') r = readiness.legacyTicketReadiness(t.text, t.fields);
    else {
      const key = state.contextKey({ kind: 'ticket', change: binding.change, ticket: t.fields.ticket });
      const attempt = indexRead.index ? state.inspectArtifacts(root, state.latestAttempt(root, key, indexRead.index)) : null;
      let changedPaths = [];
      if (attempt && attempt.source && manifestNow && manifestNow.digest && attempt.source.after !== manifestNow.digest) {
        const before = source.readManifest(root, attempt.source.after);
        if (before) changedPaths = source.diffManifests(before, manifestNow);
      }
      const legacyReceipt = (binding.legacy_receipts && binding.legacy_receipts[t.fields.ticket]) || (t.fields.verified || t.fields.last_check ? { verified: t.fields.verified, last_check: t.fields.last_check } : null);
      r = readiness.migratedTicketReadiness({ text: t.text, fields: t.fields, timeout: t.timeout, attempt, legacyReceipt, current, sourceProblems, changedPaths, contextKey: key, pointedId: indexRead.index ? indexRead.index.current[key] || null : null });
      r.attempt = attempt;
    }
    readinessOf.set(t.file, r);
    return r;
  };

  let nOpen = 0, nProg = 0, nDone = 0, firstStart = null, localMissing = 0;
  // Without local runtime state (a fresh clone) done tickets rely on the saved
  // candidate evidence; they are not re-verify work until verified here.
  const localUnavailable = mode === 'migrated' && !state.exists(root);
  const inProg = [], reverify = [];
  let nextOpen = null;
  const rows = [];
  if (tickets.length === 0) line('Tickets  none');
  for (const t of tickets) {
    const f = t.fields;
    const id = f.ticket;
    const st = f.status || 'open';
    const r = computeReadiness(t);
    const entry = { id, file: t.file, status: st, size: f.size || null, depends_on: parse.dependencies(f), started: f.started || null, finished: f.finished || null, readiness: { ready: r.ready, reasons: r.reasons.map(({ code, detail }) => ({ code, detail })), next: r.reasons[0] ? r.reasons[0].next : null }, latest_attempt: r.attempt ? { id: r.attempt.id, sequence: r.attempt.sequence, outcome: r.attempt.outcome, started: r.attempt.started, finished: r.attempt.finished } : null, legacy_receipt: (f.verified || f.last_check) ? { verified: f.verified || null, last_check: f.last_check || null } : null };
    if (mode === 'legacy' && st !== 'done' && f.last_check && !/ passed /.test(` ${f.last_check} `)) {
      out.warnings.push(`  WARN ${id} latest verification: ${f.last_check} — re-run verify`);
    }
    if (mode === 'migrated' && st !== 'done' && r.attempt && !r.ready) {
      // Unticked criteria are expected while work is in progress; anything else
      // (a failed, stale or superseded attempt) is a warning here too.
      const blocking = r.reasons.find(x => x.code !== 'CRITERIA_UNTICKED');
      if (blocking) out.warnings.push(`  WARN ${id} ${blocking.code}: ${blocking.detail} — ${blocking.next}`);
    }
    if (f.started) { const se = toEpoch(f.started); if (firstStart === null || se < firstStart) firstStart = se; }
    let detail;
    if (st === 'done') {
      nDone++;
      detail = `started ${hhmm(f.started)} · finished ${hhmm(f.finished)}`;
      if (f.started && f.finished) detail += ` (${mins(toEpoch(f.started), toEpoch(f.finished))})`;
      if (!r.ready) {
        if (localUnavailable && r.reasons[0].code === 'EVIDENCE_MISSING') localMissing++;
        else {
          const message = mode === 'legacy' ? r.legacyMessage : `${r.reasons[0].code}: ${r.reasons[0].detail} — ${r.reasons[0].next}`;
          out.warnings.push(`  WARN ${id} ${message}`);
          reverify.push(id);
        }
      }
    } else if (st === 'in_progress') {
      nProg++; inProg.push(id);
      detail = `started ${hhmm(f.started)}`;
      if (f.started) detail += ` · elapsed ${mins(toEpoch(f.started), now)}`;
      if (mode === 'legacy') detail += f.verified ? ' · receipt ✓' : ' · no receipt yet';
      else detail += r.attempt ? ` · latest attempt ${r.attempt.outcome}` : ' · no attempt yet';
    } else {
      nOpen++;
      const blocked = [];
      for (const dep of parse.dependencies(f)) {
        const d = byId.get(dep);
        if (!d || d.fields.status !== 'done' || !usablePrd(d.prdResult) || !computeReadiness(d).ready) blocked.push(dep);
      }
      if (blocked.length) { detail = `blocked by ${blocked.join(' ')}`; entry.readiness = { ready: false, reasons: [{ code: 'DEPENDENCY_BLOCKED', detail: `blocked by ${blocked.join(' ')}` }], next: 'finish the dependency' }; }
      else { detail = 'ready'; if (!nextOpen) nextOpen = id; }
    }
    rows.push(`  ${pad(id, 5)} ${pad(st, 12)} ${pad(f.size || '?', 2)} ${detail}`);
    j.tickets.push(entry);
  }
  if (tickets.length) {
    line(`Tickets  ${nOpen + nProg + nDone} total · ${nDone} done · ${nProg} in progress · ${nOpen} open`);
    for (const r of rows) line(r);
    for (const w of out.warnings) line(w);
    if (localMissing) line(`Local    verification history unavailable: ${localMissing} done ticket(s) rely on the saved candidate evidence until verified here`);
    if (firstStart !== null && (nProg > 0 || budget)) {
      let build = `Build    wall-clock elapsed ${mins(firstStart, now)} since the first ticket started (not active execution time)`;
      if (budget) build += ` · budget ${budget}m`;
      line(build);
    }
  }

  // Candidate.
  const notes = prd ? notesCurrent(root, prd) : { text: 'missing', state: 'missing' };
  line(`Notes    NOTES.md: ${notes.text}`);
  const ev = evidenceLine(root, prd);
  if (ev) line(`Evidence ${ev.manifest} · ${ev.ok ? 'ok' : ev.reason}`);
  j.candidate = {
    notes: notes.state, reason: notes.state === 'current' ? null : notes.text,
    candidate: notes.candidate || (notes.fields && notes.fields.candidate) || null, base: notes.base || (notes.fields && notes.fields.base) || null,
    evidence: ev ? { manifest: ev.manifest, schema: ev.schema, provenance: ev.schema === 2 ? 'runtime' : ev.schema === 1 ? 'legacy' : null, verdict: ev.ok ? 'ok' : ev.reason } : null,
    local_attempts: mode === 'migrated' ? (state.exists(root) ? 'available' : 'unavailable') : 'not applicable (legacy mode)',
    newer_attempts: [],
    reasons: notes.state === 'current' ? [] : [{ code: notes.state === 'missing' ? 'EVIDENCE_MISSING' : 'CANDIDATE_STALE', detail: notes.text }],
  };
  // Provenance and newer local attempts (contract "Evidence schema 2"): a newer
  // nonpassing attempt for the same check and candidate on the same source inputs
  // blocks local readiness; on different inputs it is history; without local
  // state only the saved record can be validated.
  const newerBlockers = [];
  if (ev && ev.ok) {
    if (ev.schema !== 2) line('Provenance legacy (schema 1, authored command results)');
    else if (!state.exists(root)) {
      line('Provenance runtime (schema 2) · local verification history unavailable; saved candidate evidence validated only');
    } else {
      let manifestDoc = null;
      try { manifestDoc = JSON.parse(fs.readFileSync(path.resolve(root, ev.manifest), 'utf8')); } catch { manifestDoc = null; }
      const cand = manifestDoc && manifestDoc.candidate;
      const idx = indexRead.index || (state.readIndex(root).index || null);
      const details = [];
      for (const check of (manifestDoc && manifestDoc.checks) || []) {
        if (check.provenance !== 'runtime' || !check.attempt) continue;
        // Every attempt newer than the exported one counts: a same-source
        // nonpassing attempt blocks until the candidate is re-exported, even
        // when a later attempt passed again.
        const key = state.contextKey({ kind: 'candidate', candidate: cand, check: check.id });
        const newer = idx ? state.listAttempts(root, key).filter(a => a.sequence > check.attempt.sequence && a.outcome !== 'passed') : [];
        for (const latest of newer) {
          const sameSource = latest.source && latest.source.before === check.attempt.source_before;
          j.candidate.newer_attempts.push({ check: check.id, attempt: latest.id, outcome: latest.outcome, same_source: Boolean(sameSource) });
          if (sameSource) {
            const code = { failed: 'CHECK_FAILED', running: 'ATTEMPT_RUNNING', timed_out: 'ATTEMPT_TIMED_OUT', interrupted: 'ATTEMPT_INTERRUPTED', error: 'ATTEMPT_ERROR' }[latest.outcome] || 'ATTEMPT_ERROR';
            newerBlockers.push({ code, detail: `${check.id}: newer local attempt ${latest.id} ${latest.outcome} on the same source inputs as the exported pass` });
            details.push(`${check.id} ${latest.outcome} (${latest.id}, same source: blocks until re-exported)`);
          } else details.push(`${check.id} ${latest.outcome} (${latest.id}, different source: historical)`);
        }
      }
      line(`Provenance runtime (schema 2) · local attempts ${details.length ? details.join('; ') : 'consistent with the exported checks'}`);
      j.candidate.reasons.push(...newerBlockers);
    }
  }

  // Next action.
  let next;
  if (!prd) next = '/pincer-plan <brief> — no PRD yet';
  else if (unresolved > 0) next = 'resolve PRD association with pincer-ticket.sh bind T-NN .prd/prd-vN.md before continuing';
  else if (bindingResult.code === 'REVISION_CHANGED') next = `node scripts/pincer-runtime.cjs register --prd ${prd} --rebind — the PRD content changed since registration; readiness for the old revision no longer applies`;
  else if (sourceProblems.length) next = `repair the source view: ${sourceProblems[0].code} ${sourceProblems[0].detail}`;
  else if (prdStatus === 'draft') next = '/pincer-narrow — current PRD is draft; earlier tickets and notes do not complete it';
  else if (tickets.length === 0) next = '/pincer-narrow — PRD exists, no tickets yet';
  else if (inProg.length) next = `resume ${inProg.join(' ')}: /pincer-code ${inProg.join(' ')} (check git status for uncommitted work; then verify → done)`;
  else if (nOpen > 0) next = `/pincer-code — next ready ticket: ${nextOpen || 'none (all remaining are blocked — check depends_on)'}`;
  else if (reverify.length) next = `/pincer-code — re-run verify for ${reverify.join(' ')}; resolve readiness warnings before evaluation or release`;
  else if (notes.state !== 'current' || prdStatus !== 'built') {
    next = '/pincer-evaluate — all tickets done';
    if (prdStatus !== 'built') next += ` (PRD status is '${prdStatus || '?'}', expected 'built')`;
  } else if (newerBlockers.length) {
    next = `/pincer-code — a newer local attempt is not passing for ${newerBlockers.map(b => b.detail.split(':')[0]).join(', ')}; repair, re-run the check and /pincer-evaluate before release`;
  } else next = '/pincer-release — evaluation matches the current PRD and candidate; audit the artifacts';
  line(`Next     ${next}`);
  j.next = next;
  for (const t of j.tickets) for (const r of t.readiness.reasons) j.reasons.push({ code: r.code, detail: `${t.id}: ${r.detail}` });
  for (const r of j.candidate.reasons) j.reasons.push(r);
  if (unresolved > 0) out.exit = 4;
  out.gathered = { mode, binding, prd, prdResult, tickets, computeReadiness, notes, unresolved, inProg, nOpen, reverify };
  return out;
}

function render(root, options) {
  const result = gather(root, options);
  return { text: `${result.lines.join('\n')}\n`, json: result.json, exit: result.exit, gathered: result.gathered };
}

module.exports = { gather, render, notesCurrent, evidenceLine, latestPrd, ticketPrd, usablePrd, prdFiles };
