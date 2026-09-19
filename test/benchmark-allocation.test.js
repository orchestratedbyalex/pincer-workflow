import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const original = path.resolve('scripts/delivery-benchmark-v7');
const roots = [];
const root = () => { const value = fs.mkdtempSync(path.join(os.tmpdir(), 'pincer-allocation-')); roots.push(value); return value; };
function fixture() {
  const home = root(), moduleRoot = path.join(home, 'scripts/delivery-benchmark-v7');
  fs.mkdirSync(path.dirname(moduleRoot), { recursive: true });
  fs.cpSync(original, moduleRoot, { recursive: true });
  fs.mkdirSync(path.join(home, 'tickets'));
  const receipt = '2026-09-19T00:00:00Z';
  const command = 'node --version\n';
  const blockHash = crypto.createHash('sha256').update(command).digest('hex').slice(0, 12);
  for (const name of fs.readdirSync(path.join(original, '../../tickets')).filter(name => /^T-10[1-9]-/.test(name))) {
    fs.writeFileSync(path.join(home, 'tickets', name), `---\nstatus: done\nlast_check: ${receipt} passed ${blockHash}\nverified: ${receipt} ${blockHash}\nfinished: ${receipt}\n---\n\n## Verification\n` + '```bash\n' + command + '```\n');
  }
  // This copied inspector grants only a controlled fixture allocation. No native
  // launch path is invoked; the worker exercises the actual reservation functions.
  fs.writeFileSync(path.join(moduleRoot, 'readiness.cjs'), "exports.inspectStudy=o=>{const grant=JSON.parse(require('fs').readFileSync(o.manifestPath));return Date.parse(grant.allocation.expires_at)<=Date.now()?{launchGrant:null,settlementGrant:{...grant,settlementOnly:true}}:{launchGrant:grant};};");
  const runs = path.join(home, 'runs'); fs.mkdirSync(runs);
  const sessions = ['plain', 'pincer'].map(arm => ({ id: arm, run: `fixture/rep-1/${arm}`, arm, name: 'S1', purpose: 'measured', prompt_digest: 'b'.repeat(64), effective_digest: 'c'.repeat(64) }));
  const grant = { schema: 1, manifestDigest: 'a'.repeat(64), purpose: 'measured', inputRoot: home,
    allocation: { id: 'fixture-allocation', root: runs, limit_usd: 1, session_cap_usd: 1, session_wall_minutes: 1, max_elapsed_minutes: 60,
      expires_at: new Date(Date.now() + 3600000).toISOString(), decision: { ref: 'decision.json', digest: 'd'.repeat(64) } }, sessions };
  const manifestPath = path.join(home, 'grant.json'); fs.writeFileSync(manifestPath, JSON.stringify(grant));
  for (const session of sessions) {
    const at = path.join(runs, session.run); fs.mkdirSync(at, { recursive: true });
    const effort = require(path.join(moduleRoot, 'effort.cjs'));
    fs.writeFileSync(path.join(at, 'record.json'), JSON.stringify(effort.empty({ run: session.run, cohort: 'c'.repeat(64), brief: 'fixture', arm: session.arm, repetition: 1, order: 1 })));
  }
  return { home, moduleRoot, grant, manifestPath, runs, api: require(path.join(moduleRoot, 'allocation.cjs')), claims: require(path.join(moduleRoot, 'run-claims.cjs')) };
}
function session(arm = 'plain') {
  return { id: 'attempt-000001:S1', run: `fixture/rep-1/${arm}`, attempt: 'attempt-000001', name: 'S1', payload: `fixture/rep-1/${arm}/attempts/attempt-000001/logs/S1.json` };
}
function options(f, extra = {}) { return { manifestPath: f.manifestPath, purpose: 'measured', nextSessionId: 'plain', ...extra }; }
function intent(f, current) {
  const effort = require(path.join(f.moduleRoot, 'effort.cjs'));
  const attempts = require(path.join(f.moduleRoot, 'attempts.cjs'));
  const home = path.join(f.runs, current.run);
  const file = path.join(home, 'record.json');
  const record = JSON.parse(fs.readFileSync(file));
  const attempt = attempts.begin(home, record, {});
  attempt.base = record.provenance.base = 'a'.repeat(40);
  attempts.intent(record, attempt, current.name, 'Synthetic allocation test');
  assert.deepEqual(effort.problems(record), []);
  fs.writeFileSync(file, JSON.stringify(record));
}

function payload(f, current, cost = 0.4) {
  const file = path.join(f.runs, current.payload); fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ type: 'result', subtype: 'success', total_cost_usd: cost, duration_api_ms: 10,
    modelUsage: { fixture: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } } }));
}
async function consume(f, claim, handle) {
  const worker = path.join(f.home, 'consume.cjs');
  fs.writeFileSync(worker, `const a=require(${JSON.stringify(path.join(f.moduleRoot, 'allocation.cjs'))}); process.stdin.once('data',()=>{try {a.consume(${JSON.stringify(options(f, { handle }))}); process.stdout.write('consumed'); try {a.consume(${JSON.stringify(options(f, { handle }))});process.exitCode=8;}catch(e){process.stdout.write(' replay-refused');}}catch(e){process.stderr.write(e.code+':'+e.message);process.exitCode=7;}});`);
  const child = spawn(process.execPath, [worker], { detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', value => { stdout += value; }); child.stderr.on('data', value => { stderr += value; });
  const done = new Promise(resolve => child.on('close', code => resolve(code)));
  f.claims.registerGroup(claim, { pid: child.pid, pgid: child.pid });
  child.stdin.end('go');
  assert.equal(await done, 0, stderr);
  assert.equal(stdout, 'consumed replay-refused');
}
// Pure admission mutations precede controlled supervisor tests; no provider executes.
function stateFile(f) { return path.join(f.runs, '.allocation/state.json'); }
function mutateRecord(f, run, mutation) {
  const file = path.join(f.runs, run, 'record.json');
  const record = JSON.parse(fs.readFileSync(file)); mutation(record);
  fs.writeFileSync(file, JSON.stringify(record));
}
try {
  {
    const pinned = require(path.resolve('template/scripts/pincer-runtime/parse.cjs'));
    const local = require(path.join(original, 'allocation.cjs')).verificationHash;
    for (const name of fs.readdirSync(path.resolve('tickets')).filter(name => /^T-10[1-9]-/.test(name))) {
      const text = fs.readFileSync(path.resolve('tickets', name), 'utf8');
      assert.equal(local(text), pinned.legacyBlockHash(text), `${name}: verification hash matches runtime parser`);
    }
    const f = fixture(), claim = f.claims.acquire(f.runs, 'cell.fixture.1.plain');
    try {
      const file = path.join(f.home, 'tickets/T-105-account-for-partial-study-usage.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('node --version', 'node --help'));
      assert.throws(() => f.api.reserve(options(f, { session: session(), cellClaim: claim })), /runtime verification/);
    } finally { f.claims.release(claim); }
  }
  for (const mutation of [
    r => { r.events.push({ kind: 'session', id: 'orphan', started: new Date().toISOString(), ended: null }); },
    r => { r.attempts[0].sessions[0].payload = '../elsewhere'; },
    r => { r.attempts[0].sessions = []; },
  ]) {
    const f = fixture(); intent(f, session()); payload(f, session());
    mutateRecord(f, session().run, mutation);
    assert.equal(f.api.inspect({ grant: f.grant }).reasons.some(r => r.code === 'ALLOCATION_RECORD_INVALID'), true);
  }
  {
    const f = fixture(); intent(f, session()); payload(f, session());
    payload(f, { ...session(), payload: session().payload.replace('S1.json', 'S2.json') });
    assert.equal(f.api.inspect({ grant: f.grant }).reasons.some(r => r.code === 'ALLOCATION_COST_UNKNOWN'), true, 'orphan payload inside recorded attempt is refused');
  }
  {
    const f = fixture(); intent(f, session()); payload(f, session());
    fs.rmSync(path.join(f.runs, session().run, 'record.json'));
    assert.ok(f.api.inspect({ grant: f.grant }).reasons.some(reason => reason.code === 'ALLOCATION_COST_UNKNOWN'), 'removed ledger with retained artifacts cannot become unspent');
  }
  for (const change of ['prior-cost', 'prior-ledger', 'missing-payload', 'prior-record', 'new-unknown-intent', 'allocation-cap']) {
    const f = fixture();
    // The prior cell has valid retained accounting before the next cell reserves.
    intent(f, session('pincer')); payload(f, session('pincer'), 0.4);
    f.grant.allocation.limit_usd = 2;
    fs.writeFileSync(f.manifestPath, JSON.stringify(f.grant));
    const claim = f.claims.acquire(f.runs, 'cell.fixture.1.plain');
    try {
      const handle = f.api.reserve(options(f, { session: session(), cellClaim: claim }));
      intent(f, session());
      assert.ok(f.api.verifyLaunch(options(f, { handle }), { requireReservation: true }));
      if (change === 'prior-cost') payload(f, session('pincer'), 0.1);
      if (change === 'missing-payload') fs.rmSync(path.join(f.runs, session('pincer').payload));
      if (change === 'prior-ledger') mutateRecord(f, session('pincer').run, r => { r.attempts[0].sessions = []; r.events = []; });
      if (change === 'prior-record') fs.rmSync(path.join(f.runs, session('pincer').run, 'record.json'));
      if (change === 'new-unknown-intent') mutateRecord(f, session().run, r => {
        const attempts = require(path.join(f.moduleRoot, 'attempts.cjs')); attempts.intent(r, r.attempts[0], 'S2', 'unreserved');
      });
      if (change === 'allocation-cap') {
        // Stable manifest binding in this inspector fixture deliberately lets us
        // prove the admission arithmetic independently of manifest hashing.
        f.grant.allocation.limit_usd = 1.2; fs.writeFileSync(f.manifestPath, JSON.stringify(f.grant));
      }
      assert.throws(() => f.api.verifyLaunch(options(f, { handle }), { requireReservation: true }), undefined, change);
    } finally { f.claims.release(claim); }
  }
  for (const kind of ['nonempty', 'directory', 'hardlink', 'symlink']) {
    const f = fixture(), claim = f.claims.acquire(f.runs, 'cell.fixture.1.plain');
    try {
      const handle = f.api.reserve(options(f, { session: session(), cellClaim: claim })); intent(f, session());
      const capture = path.join(f.runs, session().payload); fs.mkdirSync(path.dirname(capture), { recursive: true });
      if (kind === 'nonempty') fs.writeFileSync(capture, 'already running');
      if (kind === 'directory') fs.mkdirSync(capture);
      if (kind === 'hardlink' || kind === 'symlink') {
        const original = path.join(f.home, 'capture'); fs.writeFileSync(original, '');
        fs[kind === 'hardlink' ? 'linkSync' : 'symlinkSync'](original, capture);
      }
      assert.throws(() => f.api.verifyLaunch(options(f, { handle })), undefined, kind);
    } finally { f.claims.release(claim); }
  }
  for (const mutation of [
    item => { item.session.payload = '.env'; }, item => { item.session.id = 'attempt-000001:S9'; },
    item => { item.capUSD = 0.01; }, item => { item.logicalId = 'pincer'; },
    item => { item.cellKey = 'cell.fixture.1.pincer'; }, item => { item.cellToken = 'broken'; },
    item => { item.created = 'invalid'; }, item => { item.priorAccountingDigest = 'invalid'; },
    item => { item.actualUSD = 0; }, item => { item.pgid = 123; },
    item => { item.extra = true; }, item => { item.session.extra = true; },
  ]) {
    const f = fixture(), claim = f.claims.acquire(f.runs, 'cell.fixture.1.plain');
    try {
      f.api.reserve(options(f, { session: session(), cellClaim: claim }));
      const state = JSON.parse(fs.readFileSync(stateFile(f))); mutation(state.reservations[0]);
      fs.writeFileSync(stateFile(f), JSON.stringify(state));
      assert.ok(f.api.inspect({ grant: f.grant }).reasons.some(reason => reason.code === 'ALLOCATION_STATE_INVALID'));
    } finally { f.claims.release(claim); }
  }
  // Smoke still needs every offline prerequisite done and T102's verification;
  // measured additionally requires native T102 and readiness T109 completion.
  for (const [purpose, ticket, field] of [
    ...['101','103','104','105','106','107','108'].map(id => ['operational-smoke', id, 'status']),
    ['operational-smoke','102','verified'], ['measured','102','status'], ['measured','109','status'],
  ]) {
    const f = fixture(), claim = f.claims.acquire(f.runs, 'cell.fixture.1.plain');
    try {
      f.grant.purpose = purpose; fs.writeFileSync(f.manifestPath, JSON.stringify(f.grant));
      const name = fs.readdirSync(path.join(f.home, 'tickets')).find(name => name.startsWith(`T-${ticket}-`));
      const file = path.join(f.home, 'tickets', name);
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(new RegExp(`^${field}:.*$`, 'm'), `${field}: in_progress`));
      assert.throws(() => f.api.reserve(options(f, { purpose, session: session(), cellClaim: claim })), /runtime verification/);
    } finally { f.claims.release(claim); }
  }
  {
    const f = fixture(), claim = f.claims.acquire(f.runs, 'cell.fixture.1.plain');
    const before = fs.readdirSync(f.runs);
    assert.equal(f.api.inspect({ grant: f.grant }).ready, true);
    assert.deepEqual(fs.readdirSync(f.runs), before, 'inspection creates no ledger');
    const current = session();
    const handle = f.api.reserve(options(f, { session: current, cellClaim: claim }));
    assert.equal(f.api.inspect({ grant: f.grant }).ready, false);
    assert.throws(() => f.api.consume(options(f, { handle })), /registered session supervisor/);
    intent(f, current);
    fs.mkdirSync(path.dirname(path.join(f.runs, current.payload)), { recursive: true });
    fs.writeFileSync(path.join(f.runs, current.payload), '', { flag: 'wx' });
    await consume(f, claim, handle);
    const unknown = f.api.reconcile(options(f, { handle, cellClaim: claim, result: { cleanup_complete: true } }));
    assert.equal(unknown.code, 'ALLOCATION_COST_UNKNOWN');
    payload(f, current);
    assert.equal(f.api.reconcile(options(f, { handle, cellClaim: claim, result: { cleanup_complete: true } })).settled, true);
    assert.equal(f.api.inspect({ grant: f.grant }).status, 'stopped', 'later captured cost never silently clears a prior stop');
    assert.equal(f.api.inspect({ grant: f.grant }).knownSpendUSD, 0.4);
    f.claims.release(claim);
  }
  // Clock changes only after the real controlled supervisor has exited. Expiry
  // permits settlement of incurred cost, never another admission or resume.
  {
    const f = fixture(), claim = f.claims.acquire(f.runs, 'cell.fixture.1.plain'), current = session();
    const handle = f.api.reserve(options(f, { session: current, cellClaim: claim }));
    intent(f, current); await consume(f, claim, handle); payload(f, current);
    const originalNow = Date.now;
    try {
      Date.now = () => Date.parse(f.grant.allocation.expires_at) + 1000;
      const result = f.api.reconcile(options(f, { handle, cellClaim: claim, result: { cleanup_complete: true } }));
      assert.equal(result.settled, true); assert.equal(result.stopped, true); assert.equal(result.actualUSD, 0.4);
      assert.equal(result.code, 'ALLOCATION_EXPIRED');
      const state = JSON.parse(fs.readFileSync(stateFile(f)));
      assert.equal(state.reservations[0].status, 'settled'); assert.equal(state.reservations[0].actualUSD, 0.4);
      assert.equal(f.api.inspect({ grant: f.grant }).ready, false);
      assert.throws(() => f.api.reserve(options(f, { session: current, cellClaim: claim, settlementOnly: true })));
      assert.throws(() => f.api.consume(options(f, { handle, settlementOnly: true })));
      assert.throws(() => f.api.verifyLaunch(options(f, { handle, settlementOnly: true })));
      assert.throws(() => f.api.reconcile(options(f, { handle, cellClaim: claim, decision: { ref: 'ignored' } })), /Expired authority/);
      assert.equal(JSON.parse(fs.readFileSync(stateFile(f))).stopped.code, 'ALLOCATION_EXPIRED');
      assert.equal(f.api.reconcile(options(f, { handle, cellClaim: claim })).settled, true);
      payload(f, current, 0.3);
      assert.equal(f.api.reconcile(options(f, { handle, cellClaim: claim })).code, 'ALLOCATION_COST_UNKNOWN');
    } finally { Date.now = originalNow; f.claims.release(claim); }
  }
  for (const scenario of ['quota', 'overcap', 'cleanup']) {
    const f = fixture(), claim = f.claims.acquire(f.runs, 'cell.fixture.1.plain'), current = session();
    const handle = f.api.reserve(options(f, { session: current, cellClaim: claim })); intent(f, current);
    await consume(f, claim, handle); payload(f, current, scenario === 'overcap' ? 1.1 : 0.4);
    const outcome = f.api.reconcile(options(f, { handle, cellClaim: claim, result: { limit: scenario === 'quota', cleanup_complete: scenario !== 'cleanup' } }));
    assert.equal(outcome.stopped, true);
    assert.equal(f.api.inspect({ grant: f.grant }).status, 'stopped');
    f.claims.release(claim);
  }
  {
    const f = fixture();
    const worker = path.join(f.home, 'reserve.cjs');
    fs.writeFileSync(worker, `const c=require(${JSON.stringify(path.join(f.moduleRoot, 'run-claims.cjs'))}),a=require(${JSON.stringify(path.join(f.moduleRoot, 'allocation.cjs'))});const arm=process.argv[2],claim=c.acquire(${JSON.stringify(f.runs)},'cell.fixture.1.'+arm);try{a.reserve({manifestPath:${JSON.stringify(f.manifestPath)},purpose:'measured',nextSessionId:arm,cellClaim:claim,session:{id:'attempt-000001:S1',run:'fixture/rep-1/'+arm,attempt:'attempt-000001',name:'S1',payload:'fixture/rep-1/'+arm+'/attempts/attempt-000001/logs/S1.json'}});process.stdout.write('reserved');}catch(e){process.stdout.write('refused');}finally{c.release(claim);}`);
    const results = await Promise.all(['plain', 'pincer'].map(arm => new Promise(resolve => {
      const child = spawn(process.execPath, [worker, arm], { detached: true }); let out = '';
      child.stdout.on('data', data => { out += data; }); child.on('close', () => resolve(out));
    })));
    assert.deepEqual(results.sort(), ['refused', 'reserved'], 'distinct cells cannot each spend the same allocation');
    assert.equal(f.api.inspect({ grant: f.grant }).status, 'unresolved', 'dead reserving owner never automatically refunds');
  }
  {
    const f = fixture(), claim = f.claims.acquire(f.runs, 'cell.fixture.1.plain');
    const invalid = { ...session(), payload: '.env' };
    assert.throws(() => f.api.reserve(options(f, { session: invalid, cellClaim: claim })), /match the next/);
    fs.writeFileSync(path.join(f.home, 'tickets/T-109-gate-study-execution-readiness.md'), '---\nstatus: in_progress\n---\n');
    assert.throws(() => f.api.reserve(options(f, { session: session(), cellClaim: claim })), /runtime verification/);
    f.claims.release(claim);
  }
  console.log('benchmark allocation tests passed (controlled workers only; no provider launches)');
} finally { for (const directory of roots) fs.rmSync(directory, { recursive: true, force: true }); }
