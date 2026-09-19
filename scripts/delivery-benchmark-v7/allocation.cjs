'use strict';
// A conservative admission ledger: only one unresolved paid session per allocation.
// Reservation caps are client estimates, not a provider billing guarantee.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const claims = require('./run-claims.cjs');
const usage = require('./usage.cjs');
const effort = require('./effort.cjs');
const freeze = require('./freeze.cjs');
const canonical = value => require('./effective.cjs').canonical(value);
const RUN = /^[a-z0-9][a-z0-9-]*\/rep-[1-9][0-9]*\/(plain|pincer|strict)$/;
const fail = (code, detail) => { throw Object.assign(new Error(detail), { code }); };
function safe(root, relative) {
  if (typeof relative !== 'string' || freeze.secretIn(relative) || /(?:^|\/)(?:\.env(?:\.[^/]*)?|\.ssh|\.aws|credentials(?:\.json)?|auth\.json|\.credentials\.json|\.netrc|\.npmrc)(?:\/|$)/i.test(relative)) fail('ALLOCATION_PATH_INVALID', 'Protected allocation artifact path.');
  return claims.contained(root, relative);
}
function read(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); }
  catch { fail('ALLOCATION_METADATA_INVALID', 'Allocation metadata cannot be read.'); }
  if (freeze.secretIn(text)) fail('ALLOCATION_SECRET', 'Allocation metadata contains secret material.');
  try { return JSON.parse(text); }
  catch { fail('ALLOCATION_METADATA_INVALID', 'Allocation metadata is not valid JSON.'); }
}

function shape(grant, settlement = false) {
  const a = grant?.allocation;
  if (!grant || grant.schema !== 1 || !/^[a-f0-9]{64}$/.test(grant.manifestDigest || '') || !a || !path.isAbsolute(a.root || '') ||
      !Number.isFinite(a.limit_usd) || a.limit_usd <= 0 || !Number.isFinite(a.session_cap_usd) || a.session_cap_usd <= 0 ||
      !Number.isFinite(a.session_wall_minutes) || a.session_wall_minutes <= 0 || !Number.isFinite(a.max_elapsed_minutes) || a.max_elapsed_minutes <= 0 || !Array.isArray(grant.sessions) ||
      typeof a.id !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(a.id) || !a.decision?.ref || !/^[a-f0-9]{64}$/.test(a.decision?.digest || '')) fail('ALLOCATION_GRANT_INVALID', 'A checked numeric allocation grant is required.');
  if (!Number.isFinite(Date.parse(a.expires_at)) || (!settlement && (grant.settlementOnly === true || Date.parse(a.expires_at) <= Date.now()))) fail('ALLOCATION_EXPIRED', 'The approved allocation has expired.');
  if (grant.sessions.some(session => !RUN.test(session.run))) fail('ALLOCATION_PATH_INVALID', 'Unsupported scheduled run path.');
  return a;
}
function binding(grant) {
  return { manifest: grant.manifestDigest, allocation: grant.allocation.id, decision: grant.allocation.decision };
}
function stateFor(grant) {
  const file = safe(grant.allocation.root, '.allocation/state.json');
  if (!fs.existsSync(file)) return { schema: 1, binding: binding(grant), reservations: [], stopped: null };
  const state = read(file);
  if (Object.keys(state).sort().join(',') !== 'binding,reservations,schema,stopped' || state.schema !== 1 || canonical(state.binding) !== canonical(binding(grant)) || !Array.isArray(state.reservations) || !(state.stopped === null || typeof state.stopped === 'object')) fail('ALLOCATION_CHANGED', 'Allocation identity or retained ledger changed; explicit investigation required.');
  const ids = new Set(), sessions = new Set();
  const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  if (state.stopped !== null && (!state.stopped || Array.isArray(state.stopped) ||
      Object.keys(state.stopped).sort().join(',') !== 'at,code,reason' || !/^[A-Z_]+$/.test(state.stopped.code || '') || typeof state.stopped.reason !== 'string' ||
      !state.stopped.reason || state.stopped.reason.length > 500 || !timestamp(state.stopped.at))) fail('ALLOCATION_STATE_INVALID', 'Invalid retained stop decision.');
  for (const item of state.reservations) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(key => !['id','status','logicalId','session','capUSD','cellKey','cellToken','created','pgid','actualUSD','payloadDigest','priorAccountingDigest','consumed','settled','recoveryDecision'].includes(key))) fail('ALLOCATION_STATE_INVALID', 'Unexpected retained reservation fields.');
    const logical = grant.sessions.find(session => session.id === item.logicalId);
    const session = item.session;
    const key = session && `${session.run}/${session.id}`;
    if (!/^[a-f0-9]{32}$/.test(item.id || '') || ids.has(item.id) || sessions.has(key) ||
        !['reserved', 'consumed', 'settled', 'cancelled'].includes(item.status) ||
        item.capUSD !== grant.allocation.session_cap_usd || !logical || !session || Object.keys(session).sort().join(',') !== 'attempt,id,name,payload,run' || session.run !== logical.run ||
        !/^attempt-[0-9]{6}$/.test(session.attempt || '') || !/^S[1-9][0-9]*$/.test(session.name || '') ||
        session.id !== `${session.attempt}:${session.name}` || (logical.name && session.name !== logical.name) ||
        session.payload !== `${session.run}/attempts/${session.attempt}/logs/${session.name}.json` ||
        item.cellKey !== `cell.${session.run.split('/')[0]}.${Number(session.run.split('/')[1]?.slice(4))}.${session.run.split('/')[2]}` ||
        !/^[a-f0-9]{32}$/.test(item.cellToken || '') || !timestamp(item.created) ||
        !/^[a-f0-9]{64}$/.test(item.priorAccountingDigest || '')) fail('ALLOCATION_STATE_INVALID', 'Retained reservation metadata is invalid.');
    safe(grant.allocation.root, session.payload);
    if (['consumed', 'settled'].includes(item.status)) {
      if (!Number.isSafeInteger(item.pgid) || item.pgid <= 0 || !timestamp(item.consumed) || Date.parse(item.consumed) < Date.parse(item.created)) fail('ALLOCATION_STATE_INVALID', 'Invalid retained consumption metadata.');
    } else if (item.pgid !== null || item.consumed !== undefined) fail('ALLOCATION_STATE_INVALID', 'Unconsumed reservation cannot carry process custody.');
    if (item.status === 'settled') {
      if (!Number.isFinite(item.actualUSD) || item.actualUSD < 0 || !/^[a-f0-9]{64}$/.test(item.payloadDigest || '') || !timestamp(item.settled) || Date.parse(item.settled) < Date.parse(item.consumed)) fail('ALLOCATION_STATE_INVALID', 'Invalid retained settlement metadata.');
    } else if (item.actualUSD !== null || item.payloadDigest !== null || item.settled !== undefined) fail('ALLOCATION_STATE_INVALID', 'Unsettled reservation cannot claim actual cost.');
    if (item.recoveryDecision !== undefined && (!item.recoveryDecision || Object.keys(item.recoveryDecision).sort().join(',') !== 'action,digest,ref' || !['cancel', 'resume'].includes(item.recoveryDecision.action) ||
        !/^[a-f0-9]{64}$/.test(item.recoveryDecision.digest || ''))) fail('ALLOCATION_STATE_INVALID', 'Invalid retained recovery decision.');
    if (item.recoveryDecision) safe(grant.inputRoot, item.recoveryDecision.ref);
    ids.add(item.id); sessions.add(key);
  }
  return state;
}
function save(grant, state) {
  const file = safe(grant.allocation.root, '.allocation/state.json');
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  claims.atomicWrite(file, `${JSON.stringify(state, null, 2)}\n`);
}
function accounting(grant, state, excludeIntent = null) {
  const root = grant.allocation.root;
  const runs = new Set(grant.sessions.map(session => session.run));
  let spent = 0;
  const rows = new Map();
  // Inspect only the run-directory levels, never recursively read candidate/private files.
  if (fs.existsSync(root)) {
    for (const brief of fs.readdirSync(root, { withFileTypes: true })) {
      if (brief.name.startsWith('.')) continue;
      const briefPath = safe(root, brief.name);
      if (!brief.isDirectory()) continue;
      for (const rep of fs.readdirSync(briefPath, { withFileTypes: true })) {
        if (!rep.isDirectory() || !/^rep-[1-9][0-9]*$/.test(rep.name)) continue;
        for (const arm of ['plain', 'pincer', 'strict']) {
          const run = `${brief.name}/${rep.name}/${arm}`;
          const recordFile = safe(root, `${run}/record.json`);
          if (fs.existsSync(recordFile) && !runs.has(run)) fail('ALLOCATION_UNLISTED_RUN', 'Allocation contains a run outside its approved schedule.');
        }
      }
    }
  }
  for (const run of runs) {
    const file = safe(root, `${run}/record.json`);
    if (!fs.existsSync(file)) {
      const home = safe(root, run);
      if (fs.existsSync(home) && fs.readdirSync(home).length) fail('ALLOCATION_COST_UNKNOWN', 'Run artifacts without their accounting record require review.');
      continue;
    }
    const record = read(file);
    if (effort.problems(record).length) fail('ALLOCATION_RECORD_INVALID', 'Retained effort record does not validate.');
    if (record.run !== run) fail('ALLOCATION_RECORD_INVALID', 'Run identity differs from its accounting location.');
    const home = safe(root, run);
    if (fs.readdirSync(home).some(name => /^logs(?:$|[-_])/.test(name))) fail('ALLOCATION_COST_UNKNOWN', 'Unledgered historical logs require review.');
    if (record.schema === 7 && record.status === 'pending' && Array.isArray(record.events) && record.events.length === 0) {
      if (fs.readdirSync(home).some(name => name !== 'record.json')) fail('ALLOCATION_COST_UNKNOWN', 'Unlaunched legacy record has unexplained artifacts.');
      continue;
    }
    if (record.schema !== 8 || !Array.isArray(record.attempts) || record.attempts.some(attempt => attempt.origin === 'legacy')) fail('ALLOCATION_COST_UNKNOWN', 'Historical attempt coverage is unknown.');
    const attemptsPath = safe(root, `${run}/attempts`);
    if (fs.existsSync(attemptsPath)) {
      const expected = new Set(record.attempts.map(attempt => attempt.id));
      if (fs.readdirSync(attemptsPath).some(name => !expected.has(name))) fail('ALLOCATION_COST_UNKNOWN', 'Unledgered attempt artifacts require review.');
    }
    for (const attempt of record.attempts) {
      const logPath = safe(root, `${run}/${attempt.directory}/logs`);
      const expectedPayloads = new Set(attempt.sessions.map(session => session.payload));
      if (fs.existsSync(logPath)) for (const name of fs.readdirSync(logPath)) {
        if (/^S.*\.json$/.test(name) && !expectedPayloads.has(`${attempt.directory}/logs/${name}`)) fail('ALLOCATION_COST_UNKNOWN', 'Unledgered session payload requires review.');
        safe(root, `${run}/${attempt.directory}/logs/${name}`);
      }
    }
    const counted = structuredClone(record);
    if (excludeIntent?.run === run) {
      for (const attempt of counted.attempts) {
        attempt.sessions = attempt.sessions.filter(session => {
          if (session.id !== excludeIntent.id) return true;
          if (session.status !== 'intent' || `${run}/${session.payload}` !== excludeIntent.payload) fail('ALLOCATION_INTENT_CHANGED', 'Only the current empty launch intent may be excluded from prior accounting.');
          const capture = safe(root, excludeIntent.payload);
          if (fs.existsSync(capture)) {
            const stat = fs.lstatSync(capture);
            if (!stat.isFile() || stat.size !== 0 || stat.nlink !== 1) fail('ALLOCATION_INTENT_CHANGED', 'Current prelaunch capture must be an empty unaliased regular file.');
          }
          return false;
        });
      }
    }
    const collected = usage.collect(safe(root, run), counted);
    for (const row of collected.measurement.sessions) {
      if (row.metrics.cost_usd.value === null) fail('ALLOCATION_COST_UNKNOWN', 'At least one intended session has incomplete cost accounting.');
      spent += row.metrics.cost_usd.value;
      rows.set(`${run}/${row.id}`, { cost: row.metrics.cost_usd.value, digest: row.sha256, payload: `${run}/${row.payload}` });
    }
  }
  for (const item of state.reservations.filter(item => item.status === 'settled')) {
    const row = rows.get(`${item.session.run}/${item.session.id}`);
    if (!row || row.cost !== item.actualUSD || row.digest !== item.payloadDigest || row.payload !== item.session.payload) fail('ALLOCATION_ACCOUNTING_CHANGED', 'Settled session accounting is missing or changed.');
  }
  if (!Number.isFinite(spent)) fail('ALLOCATION_COST_UNKNOWN', 'Accumulated cost exceeds the numeric range.');
  return { spent, rows };
}
const accountingDigest = result => freeze.sha256(canonical([...result.rows.entries()].sort(([a], [b]) => a.localeCompare(b))));
function inspect({ grant }) {
  try {
    const a = shape(grant);
    const state = stateFor(grant);
    const unresolved = state.reservations.find(item => ['reserved', 'consumed'].includes(item.status));
    const reasons = [];
    if (state.stopped) reasons.push({ code: 'ALLOCATION_STOPPED', detail: state.stopped.reason });
    if (unresolved) reasons.push({ code: 'ALLOCATION_UNRESOLVED', detail: 'A reserved or consumed session requires reconciliation.' });
    let knownSpendUSD = null;
    try { knownSpendUSD = accounting(grant, state).spent; }
    catch (error) { reasons.push({ code: error.code || 'ALLOCATION_COST_UNKNOWN', detail: error.message }); }
    const first = state.reservations[0]?.created;
    const elapsedMinutes = first ? (Date.now() - Date.parse(first)) / 60000 : 0;
    const remainingMinutes = a.max_elapsed_minutes - elapsedMinutes;
    if (!Number.isFinite(remainingMinutes) || elapsedMinutes < 0 || remainingMinutes < a.session_wall_minutes) reasons.push({ code: 'ALLOCATION_TIME_EXHAUSTED', detail: 'Remaining elapsed-time allocation cannot cover the next session.' });
    const remainingUSD = knownSpendUSD === null ? null : a.limit_usd - knownSpendUSD;
    if (remainingUSD !== null && remainingUSD < a.session_cap_usd) reasons.push({ code: 'ALLOCATION_EXHAUSTED', detail: 'Remaining allocation cannot cover the approved next session cap.' });
    return { ready: reasons.length === 0, knownSpendUSD, remainingUSD, remainingMinutes, reservation: unresolved ? { status: unresolved.status, session: unresolved.session.id } : null, status: state.stopped ? 'stopped' : unresolved ? 'unresolved' : 'available', reasons };
  } catch (error) {
    return { ready: false, knownSpendUSD: null, remainingUSD: null, reservation: null, status: 'unknown', reasons: [{ code: error.code || 'ALLOCATION_INVALID', detail: 'Allocation cannot be safely inspected.' }] };
  }
}
// Match the pinned legacy runtime's verificationCommands/blockText grammar exactly.
// Empty/missing blocks are refused rather than treated as a meaningful receipt.
function verificationHash(text) {
  const lines = String(text).split('\n');
  if (lines.length && lines.at(-1) === '') lines.pop();
  const out = []; let inBlock = false, otherFence = false, inVerify = false;
  for (const line of lines) {
    if (inBlock) { if (/^[ \t]*```[ \t]*$/.test(line)) break; out.push(line); continue; }
    if (otherFence) { if (/^[ \t]*```/.test(line)) otherFence = false; continue; }
    if (/^## Verification[ \t]*$/.test(line)) { inVerify = true; continue; }
    if (inVerify && /^[ \t]*```bash[ \t]*$/.test(line)) { inBlock = true; continue; }
    if (inVerify && /^## /.test(line)) break;
    if (/^[ \t]*```/.test(line)) otherFence = true;
  }
  return out.length ? freeze.sha256(`${out.join('\n')}\n`).slice(0, 12) : null;
}
function lifecycle(purpose) {
  const root = path.resolve(__dirname, '../..');
  const prerequisites = ['T-101-bind-effective-study-inputs.md', 'T-103-claim-study-runs-exclusively.md',
    'T-104-preserve-study-attempts-on-restart.md', 'T-105-account-for-partial-study-usage.md',
    'T-106-finalize-all-study-outcomes.md', 'T-107-supply-real-browser-evaluation.md',
    'T-108-prepare-release-before-candidate-selection.md'];
  const tickets = [...prerequisites, 'T-102-isolate-study-agent-configuration.md',
    ...(purpose === 'measured' ? ['T-109-gate-study-execution-readiness.md'] : [])];
  for (const name of tickets) {
    let header, text;
    try { text = fs.readFileSync(path.join(root, 'tickets', name), 'utf8'); header = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1]; }
    catch { fail('ALLOCATION_LIFECYCLE_PENDING', 'Required current ticket verification is unavailable.'); }
    const field = key => {
      const matches = [...(header || '').matchAll(new RegExp(`^${key}: (.+)$`, 'gm'))];
      return matches.length === 1 ? matches[0][1].trim() : null;
    };
    const verified = field('verified');
    const check = field('last_check');
    if (!verificationHash(text) || verified?.split(' ')[1] !== verificationHash(text) || !verified || !/^\S+ [a-f0-9]{12}$/.test(verified) || !Number.isFinite(Date.parse(verified.split(' ')[0])) || check !== verified.replace(' ', ' passed ') ||
        ((purpose === 'measured' || prerequisites.includes(name)) && (field('status') !== 'done' || !Number.isFinite(Date.parse(field('finished')))))) {
      fail('ALLOCATION_LIFECYCLE_PENDING', 'Current runtime verification/completion receipts are required before this launch phase.');
    }
  }
}
function checked(options) {
  const result = require('./readiness.cjs').inspectStudy({ manifestPath: options.manifestPath, inputRoot: options.inputRoot, purpose: options.purpose, nextSessionId: options.nextSessionId });
  if (!result.launchGrant) fail('ALLOCATION_NOT_AUTHORIZED', 'Study decisions and execution prerequisites are not ready.');
  shape(result.launchGrant);
  lifecycle(result.launchGrant.purpose);
  return result.launchGrant;
}
// Private settlement path: no caller flag can make a launch grant ignore expiry.
// The inspector revalidates actual decisions and artifacts before offering this
// separate authority, and only reconciliation consumes it.
function checkedSettlement(options) {
  const result = require('./readiness.cjs').inspectStudy({ manifestPath: options.manifestPath, inputRoot: options.inputRoot, purpose: options.purpose, nextSessionId: options.nextSessionId });
  const grant = result.launchGrant || result.settlementGrant;
  if (!grant || (!result.launchGrant && grant.settlementOnly !== true)) fail('ALLOCATION_NOT_AUTHORIZED', 'Retained settlement decisions and artifacts do not validate.');
  shape(grant, true);
  lifecycle(grant.purpose);
  return grant;
}
function locked(grant, action) {
  const claim = claims.acquire(grant.allocation.root, 'allocation', 'allocation reservation mutation');
  try { return action(stateFor(grant)); }
  finally { claims.release(claim); }
}
function cellOwner(grant, claim, run) {
  const [brief, repetition, arm] = run.split('/');
  claims.assertOwner(claim, grant.allocation.root, `cell.${brief}.${Number(repetition.slice(4))}.${arm}`);
}
function selected(grant, id) {
  const selected = grant.sessions.find(session => session.id === id);
  if (!selected) fail('ALLOCATION_SESSION_INVALID', 'Session is absent from the approved schedule.');
  return selected;
}
function reserve(options) {
  const grant = checked(options);
  const logical = selected(grant, options.nextSessionId);
  const session = options.session;
  if (!session || session.run !== logical.run || !/^attempt-[0-9]{6}$/.test(session.attempt || '') || !/^S[1-9][0-9]*$/.test(session.name || '') ||
      session.id !== `${session.attempt}:${session.name}` || session.payload !== `${session.run}/attempts/${session.attempt}/logs/${session.name}.json` || (logical.name && logical.name !== session.name)) fail('ALLOCATION_SESSION_INVALID', 'Reservation must match the next durable attempt session.');
  cellOwner(grant, options.cellClaim, session.run);
  safe(grant.allocation.root, session.payload);
  return locked(grant, state => {
    const status = inspect({ grant });
    if (!status.ready) fail(status.reasons[0].code, status.reasons[0].detail);
    if (state.reservations.some(item => item.session.run === session.run && item.session.id === session.id)) fail('ALLOCATION_REPLAY', 'This attempt session already has a reservation.');
    const item = { id: crypto.randomBytes(16).toString('hex'), status: 'reserved', logicalId: logical.id, session,
      capUSD: grant.allocation.session_cap_usd, cellKey: options.cellClaim.key, cellToken: options.cellClaim.owner.token,
      priorAccountingDigest: accountingDigest(accounting(grant, state)),
      created: new Date().toISOString(), pgid: null, actualUSD: null, payloadDigest: null };
    state.reservations.push(item);
    save(grant, state);
    return { id: item.id, manifestDigest: grant.manifestDigest };
  });
}
function matching(grant, state, handle) {
  if (!handle || handle.manifestDigest !== grant.manifestDigest || !/^[a-f0-9]{32}$/.test(handle.id || '')) fail('ALLOCATION_HANDLE_INVALID', 'A matching protected reservation handle is required.');
  const item = state.reservations.find(item => item.id === handle.id);
  if (!item) fail('ALLOCATION_HANDLE_INVALID', 'Reservation does not exist.');
  return item;
}
function verifyLaunch(options, expected = {}) {
  const grant = checked(options);
  const logical = selected(grant, options.nextSessionId);
  if ((expected.effectiveDigest && logical.effective_digest !== expected.effectiveDigest) || (expected.arm && logical.arm !== expected.arm) ||
      (expected.caps && (expected.caps.spend_usd !== grant.allocation.session_cap_usd || expected.caps.wall_clock_minutes !== grant.allocation.session_wall_minutes)) ||
      (expected.prompt !== undefined && freeze.sha256(expected.prompt) !== logical.prompt_digest)) fail('ALLOCATION_EXECUTION_CHANGED', 'Actual execution differs from the approved session identity or caps.');
  if (options.handle) {
    const state = stateFor(grant);
    const item = matching(grant, state, options.handle);
    const first = Date.parse(state.reservations[0].created);
    if (!Number.isFinite(first) || first > Date.now() || (Date.now() - first) / 60000 + grant.allocation.session_wall_minutes > grant.allocation.max_elapsed_minutes) fail('ALLOCATION_TIME_EXHAUSTED', 'Insufficient approved elapsed time remains.');
    if (state.stopped || item.status !== 'reserved' || item.logicalId !== logical.id) fail('ALLOCATION_NOT_RESERVED', 'Reservation is stopped, consumed, or belongs to another session.');
    verifyAccounting(grant, state, item);
  } else {
    if (expected.requireReservation) fail('ALLOCATION_REQUIRED', 'Native launch requires an allocation reservation.');
    const status = inspect({ grant });
    if (!status.ready) fail(status.reasons[0].code, status.reasons[0].detail);
  }
  return grant;
}
function verifyAccounting(grant, state, item) {
  if (state.reservations.some(other => other.id !== item.id && ['reserved', 'consumed'].includes(other.status))) fail('ALLOCATION_UNRESOLVED', 'Another unresolved reservation prevents launch.');
  const prior = accounting(grant, state, item.session);
  if (accountingDigest(prior) !== item.priorAccountingDigest) fail('ALLOCATION_ACCOUNTING_CHANGED', 'Prior session accounting changed after reservation.');
  if (prior.spent + item.capUSD > grant.allocation.limit_usd) fail('ALLOCATION_EXHAUSTED', 'Prior spend plus reserved cap exceeds the approved allocation.');
}
function consume(options) {
  const grant = verifyLaunch(options, { requireReservation: true });
  return locked(grant, state => {
    const item = matching(grant, state, options.handle);
    if (state.stopped || item.status !== 'reserved') fail('ALLOCATION_REPLAY', 'Reservation cannot be consumed again.');
    verifyAccounting(grant, state, item);
    const owner = claims.inspect(grant.allocation.root, item.cellKey);
    if (owner?.state !== 'alive' || owner.owner.token !== item.cellToken || !owner.owner.groups.includes(process.pid)) fail('ALLOCATION_CUSTODY_INVALID', 'Only the registered session supervisor may consume a reservation.');
    const record = read(safe(grant.allocation.root, `${item.session.run}/record.json`));
    const session = record.attempts?.find(attempt => attempt.id === item.session.attempt)?.sessions.find(session => session.id === item.session.id);
    if (!session || session.status !== 'intent' || `${item.session.run}/${session.payload}` !== item.session.payload) fail('ALLOCATION_INTENT_MISSING', 'Durable matching launch intent is required before consumption.');
    item.status = 'consumed';
    item.pgid = process.pid;
    item.consumed = new Date().toISOString();
    save(grant, state);
    return { consumed: true };
  });
}
function groupGone(pgid) {
  if (!pgid) return true;
  try { process.kill(-pgid, 0); return false; }
  catch (error) { return error.code === 'ESRCH'; }
}
function reconcile(options) {
  const grant = checkedSettlement(options);
  const expired = Date.parse(grant.allocation.expires_at) <= Date.now();
  if (expired && options.decision) fail('ALLOCATION_EXPIRED', 'Expired authority permits cost settlement only, never cancellation or resume.');
  return locked(grant, state => {
    const item = matching(grant, state, options.handle);
    cellOwner(grant, options.cellClaim, item.session.run);
    if (options.decision) {
      const ref = options.decision;
      const file = safe(grant.inputRoot, ref.ref);
      let bytes;
      try { bytes = fs.readFileSync(file); }
      catch { fail('ALLOCATION_DECISION_INVALID', 'Recovery decision artifact cannot be read.'); }
      if (freeze.secretIn(bytes.toString()) || freeze.sha256(bytes) !== ref.digest) fail('ALLOCATION_DECISION_INVALID', 'Recovery decision artifact is missing, secret-bearing or changed.');
      let decision;
      try { decision = JSON.parse(bytes.toString()); }
      catch { fail('ALLOCATION_DECISION_INVALID', 'Recovery decision artifact is not valid JSON.'); }
      if (decision.schema !== 1 || decision.approved !== true || decision.allocation !== grant.allocation.id || decision.manifestDigest !== grant.manifestDigest || decision.reservation !== item.id || !['cancel', 'resume'].includes(decision.action)) fail('ALLOCATION_DECISION_INVALID', 'Recovery decision does not match this allocation and reservation.');
      const owner = claims.inspect(grant.allocation.root, item.cellKey);
      if (!owner?.owner || owner.owner.groups.some(group => !groupGone(group))) fail('ALLOCATION_CLEANUP_UNKNOWN', 'Recovery requires all registered session groups to be gone.');
      if (decision.action === 'cancel') {
        if (item.status !== 'reserved') fail('ALLOCATION_REFUND_REFUSED', 'Consumed reservations cannot be cancelled or refunded.');
        item.status = 'cancelled';
        // A durable cancelled intent is conservatively still unknown in accounting.
        // Cancellation permits no automatic zero-cost substitution for that intent.
      } else {
        if (item.status !== 'settled') fail('ALLOCATION_COST_UNKNOWN', 'Reconcile complete accounting before authorizing resume.');
        accounting(grant, state);
      }
      state.stopped = null;
      item.recoveryDecision = { ref: ref.ref, digest: ref.digest, action: decision.action };
      save(grant, state);
      return { reconciled: true, action: decision.action };
    }
    const stop = (code, reason) => {
      state.stopped = { code, reason, at: new Date().toISOString() };
      save(grant, state);
      return { settled: false, stopped: true, code, reason };
    };
    if (!groupGone(item.pgid) || options.result?.cleanup_complete === false) return stop('ALLOCATION_CLEANUP_UNKNOWN', 'Session process cleanup is unresolved; explicit review required.');
    // Evidence the record expects could not be retained where it belongs. Whatever was
    // recovered needs a reviewer before another paid session builds on this allocation.
    if (options.result?.evidence_retention_failed === true) return stop('ALLOCATION_EVIDENCE_UNRETAINED', 'Session evidence could not be retained; explicit review required before further execution.');
    const settled = () => {
      if (expired && !state.stopped) state.stopped = { code: 'ALLOCATION_EXPIRED', reason: 'Allocation expired; accounting is retained but further launch remains prohibited.', at: new Date().toISOString() };
      save(grant, state);
      return { settled: true, stopped: Boolean(state.stopped), actualUSD: item.actualUSD, ...(state.stopped ? { code: state.stopped.code } : {}) };
    };
    if (item.status === 'settled') {
      try { accounting(grant, state); } catch { return stop('ALLOCATION_COST_UNKNOWN', 'Settled accounting changed; retain the stop for investigation.'); }
      return settled();
    }
    if (item.status !== 'consumed') return stop('ALLOCATION_UNCONSUMED', 'Unconsumed reservation requires an explicit cancellation decision.');
    let row;
    try {
      const record = read(safe(grant.allocation.root, `${item.session.run}/record.json`));
      if (effort.problems(record).length) throw new Error('Invalid effort record');
      const actual = accounting(grant, state).rows.get(`${item.session.run}/${item.session.id}`);
      row = actual && { metrics: { cost_usd: { value: actual.cost } }, sha256: actual.digest };
    } catch { return stop('ALLOCATION_COST_UNKNOWN', 'Retained session accounting cannot be read safely.'); }
    if (!row || row.metrics.cost_usd.value === null) return stop('ALLOCATION_COST_UNKNOWN', 'Session cost is unknown; the reservation cannot be refunded.');
    item.actualUSD = row.metrics.cost_usd.value;
    item.payloadDigest = row.sha256;
    item.status = 'settled';
    item.settled = new Date().toISOString();
    if (options.result?.limit === true) return stop('ALLOCATION_ACCOUNT_LIMIT', 'Provider account or quota limit requires an explicit resume decision.');
    if (item.actualUSD > item.capUSD) return stop('ALLOCATION_CAP_EXCEEDED', 'Observed cost exceeded its reserved session cap.');
    return settled();
  });
}
module.exports = { inspect, reserve, consume, reconcile, verifyLaunch, verificationHash };
