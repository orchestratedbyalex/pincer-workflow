// Status through the runtime (PRD v4 R-08): the JSON form parses, carries no
// progress text or secret values, and agrees with the human report because both
// consume one readiness computation; every failure fixture yields a stable
// reason code and a concrete next action; exit codes follow the contract; the
// read-only gate `ready` exits 1 for non-ready work and creates nothing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { repo, tempDir, createTicket, createPrd, write, read, step, run, statusScript, ticketScript as ticketScriptPath, writeEvidence, writeNotes, bindV050 } from './helpers.js';

const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args]);
const human = dir => run(dir, 'bash', [statusScript]);
const json = dir => { const r = rt(dir, 'status', '--json'); assert.equal(r.status, 0, r.stderr); assert.equal(r.stderr, '', 'diagnostics never mix into JSON stdout'); return JSON.parse(r.stdout); };
const line = (out, key) => out.split('\n').find(l => l.startsWith(key)) || '';
function passes(result) { assert.equal(result.status, 0, result.stdout + result.stderr); return result.stdout; }
function git(dir, ...args) { return passes(run(dir, 'git', args)).trim(); }
function commit(dir, message, paths = ['.']) {
  git(dir, 'add', ...paths);
  git(dir, '-c', 'user.name=Pincer Test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}
const snapshot = dir => JSON.stringify(fs.readdirSync(dir, { recursive: true }).filter(f => !f.startsWith('.git')).sort().map(f => [f, fs.statSync(path.join(dir, f)).isFile() ? read(dir, f) : 'dir']));

// Human and JSON agree on a mixed legacy fixture; JSON has one object, no prose.
{
  const dir = tempDir(); createPrd(dir);
  createTicket(dir); passes(step(dir, 'verify')); passes(step(dir, 'done'));
  createTicket(dir, { id: 'T-02', deps: 'T-01' }); passes(step(dir, 'start', 'T-02'));
  createTicket(dir, { id: 'T-03', deps: 'T-02' });
  write(dir, 'tickets/T-01-example.md', read(dir, 'tickets/T-01-example.md').replace(/^last_check: (\S+) passed/m, 'last_check: $1 failed'));
  const before = snapshot(dir);
  const text = passes(human(dir));
  const j = json(dir);
  assert.equal(snapshot(dir), before, 'status writes nothing');
  assert.equal(j.schema, 1); assert.equal(j.mode, 'legacy'); assert.equal(j.change, null);
  assert.equal(j.prd.path, '.prd/prd-v1.md'); assert.equal(j.prd.status, 'ticketed');
  assert.match(text, /^Runtime  legacy · no change binding · migrate with node scripts\/pincer-runtime\.cjs migrate --preview --prd \.prd\/prd-v1\.md$/m);
  assert.equal(line(text, 'Next').replace(/^Next\s+/, ''), j.next, 'human Next equals JSON next');
  const t1 = j.tickets.find(t => t.id === 'T-01');
  assert.equal(t1.status, 'done'); assert.equal(t1.readiness.ready, false);
  assert.equal(t1.readiness.reasons[0].code, 'CHECK_FAILED');
  assert.match(text, /WARN T-01 latest verification: .* failed .* — re-run verify/);
  assert.equal(t1.readiness.next, 're-run verify');
  const t2 = j.tickets.find(t => t.id === 'T-02');
  assert.equal(t2.status, 'in_progress'); assert.match(t2.started, /Z$/);
  const t3 = j.tickets.find(t => t.id === 'T-03');
  assert.equal(t3.readiness.reasons[0].code, 'DEPENDENCY_BLOCKED');
  assert.match(text, /T-03 +open +S +blocked by T-02/);
  assert.equal(j.candidate.notes, 'missing'); assert.equal(j.candidate.reasons[0].code, 'EVIDENCE_MISSING');
  assert.equal(j.candidate.local_attempts, 'not applicable (legacy mode)');
  assert.ok(j.reasons.some(r => r.code === 'CHECK_FAILED' && /^T-01: /.test(r.detail)), 'aggregate reasons name the ticket');
  for (const value of JSON.stringify(j).match(/"[^"]*"/g)) assert.doesNotMatch(value, /PINCER status|wall-clock|Tickets  /, 'no progress text in JSON');
  assert.match(text, /^Build +wall-clock elapsed/m, 'human keeps the elapsed line while a ticket is in progress');
}

// Every failure fixture maps to a stable reason code and a concrete next action (S-25).
{
  const fixtures = [
    ['missing last_check', s => s.replace(/^last_check:.*\n/m, ''), 'EVIDENCE_MISSING', /re-run verify/],
    ['failed last_check', s => s.replace(/^last_check: (\S+) passed/m, 'last_check: $1 failed'), 'CHECK_FAILED', /re-run verify/],
    ['running last_check', s => s.replace(/^last_check: (\S+) passed/m, 'last_check: $1 running'), 'ATTEMPT_RUNNING', /re-run verify/],
    ['interrupted last_check', s => s.replace(/^last_check: (\S+) passed/m, 'last_check: $1 interrupted'), 'ATTEMPT_INTERRUPTED', /re-run verify/],
    ['changed check', s => s.replace('\ntrue\n', '\ntrue && true\n'), 'CHECK_CHANGED', /re-run verify/],
    ['missing receipt', s => s.replace(/^verified:.*\n/m, ''), 'EVIDENCE_MISSING', /re-run verify/],
    ['unticked criterion', s => s.replace('- [x]', '- [ ]'), 'CRITERIA_UNTICKED', /tick|re-run verify/],
  ];
  for (const [label, change, code, next] of fixtures) {
    const dir = tempDir(); createPrd(dir);
    const file = createTicket(dir); passes(step(dir, 'verify')); passes(step(dir, 'done'));
    write(dir, file, change(read(dir, file)));
    const j = json(dir);
    const t = j.tickets[0];
    assert.equal(t.readiness.ready, false, label);
    assert.equal(t.readiness.reasons[0].code, code, `${label}: reason code`);
    assert.match(t.readiness.next, next, `${label}: next action`);
    assert.match(j.next, /re-run verify/, `${label}: workflow next`);
    const gate = rt(dir, 'ready', 'T-01');
    assert.equal(gate.status, 1, `${label}: ready exits 1`);
    assert.match(gate.stdout, new RegExp(`^not ready T-01: ${code} `, 'm'));
    assert.match(gate.stdout, /^next: /m);
    assert.equal(rt(dir, 'ready').status, 1, `${label}: candidate gate not ready`);
    const before = snapshot(dir); rt(dir, 'ready'); rt(dir, 'ready', 'T-01');
    assert.equal(snapshot(dir), before, `${label}: ready writes nothing`);
  }
  // A current done ticket is ready.
  const dir = tempDir(); createPrd(dir); createTicket(dir); passes(step(dir, 'verify')); passes(step(dir, 'done'));
  assert.equal(rt(dir, 'ready', 'T-01').stdout, 'ready T-01\n');
  assert.equal(rt(dir, 'ready', '1').status, 0, 'shorthand id');
  assert.equal(rt(dir, 'ready', 'T-09').status, 4, 'unknown ticket is invalid input');
}

// Exit codes: inspection 0; invalid PRD, tickets, or unresolved association 4.
{
  const dir = tempDir(); createPrd(dir); createTicket(dir);
  assert.equal(human(dir).status, 0);
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('status: ticketed', 'status: nonsense'));
  const bad = human(dir);
  assert.equal(bad.status, 4); assert.match(bad.stdout, /WARN +invalid PRD: .*PRD status must be/); assert.match(bad.stdout, /Next +repair PRD input/);
  assert.equal(rt(dir, 'ready').status, 4, 'ready propagates invalid input');
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('status: nonsense', 'status: ticketed'));
  write(dir, 'tickets/T-01-example.md', read(dir, 'tickets/T-01-example.md').replace('size: S', 'size: XL'));
  const badTicket = human(dir);
  assert.equal(badTicket.status, 4); assert.match(badTicket.stdout, /WARN +invalid tickets: pincer-ticket: tickets\/T-01-example\.md: size must be S, M, or L/);
  write(dir, 'tickets/T-01-example.md', read(dir, 'tickets/T-01-example.md').replace('size: XL', 'size: S').replace(/^prd:.*\n/m, ''));
  createPrd(dir, 2);
  const unresolved = human(dir);
  assert.equal(unresolved.status, 4); assert.match(unresolved.stdout, /unresolved ticket PRD/);
  assert.match(unresolved.stdout, /Next +resolve PRD association/);
  assert.equal(rt(dir, 'status', '--nope').status, 2);
}

// Candidate readiness in JSON mirrors the Notes and Evidence lines; ready gates it.
{
  const dir = tempDir(); git(dir, 'init', '-q');
  write(dir, 'base.txt', 'original\n'); const base = commit(dir, 'base');
  createPrd(dir); createTicket(dir, { command: 'test -f source.txt' }); write(dir, 'source.txt', 'good');
  passes(step(dir, 'verify')); passes(step(dir, 'done'));
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('ticketed', 'built'));
  const candidate = commit(dir, 'candidate');
  const ev = writeEvidence(dir, { base, candidate });
  writeNotes(dir, { base, candidate, evidence: ev.manifest });
  commit(dir, 'evaluate', ['NOTES.md', ev.dir]);
  const j = json(dir);
  assert.equal(j.candidate.notes, 'current'); assert.equal(j.candidate.candidate, candidate); assert.equal(j.candidate.base, base);
  assert.deepEqual(j.candidate.evidence, { manifest: ev.manifest, schema: 1, provenance: 'legacy', verdict: 'ok' });
  assert.match(j.next, /pincer-release/);
  assert.equal(rt(dir, 'ready').stdout, `ready candidate ${candidate}\n`);
  write(dir, 'scratch.txt', 'wip');
  const stale = json(dir);
  assert.equal(stale.candidate.notes, 'stale');
  assert.equal(stale.candidate.reasons[0].code, 'CANDIDATE_STALE');
  assert.match(stale.candidate.reason, /working tree has changes outside NOTES\.md/);
  assert.equal(line(passes(human(dir)), 'Notes'), `Notes    NOTES.md: ${stale.candidate.reason}`);
  const gate = rt(dir, 'ready');
  assert.equal(gate.status, 1); assert.match(gate.stdout, /not ready: CANDIDATE_STALE stale: working tree/);
  fs.unlinkSync(path.join(dir, 'scratch.txt'));
  write(dir, ev.log, 'tampered'); commit(dir, 'tamper');
  const tampered = json(dir);
  assert.match(tampered.candidate.reason, /evidence invalid: .*digest mismatch/);
  assert.match(tampered.candidate.evidence.verdict, /digest mismatch/);
}

// A migrated project (binding present, no attempts yet) is recognizable and reports
// runtime readiness codes; legacy receipts are history.
{
  const dir = tempDir(); git(dir, 'init', '-q'); createPrd(dir);
  const file = createTicket(dir); passes(step(dir, 'verify')); passes(step(dir, 'done'));
  write(dir, '.gitignore', '.pincer/\n'); commit(dir, 'done');
  bindV050(dir);
  const text = passes(human(dir));
  assert.match(text, /^Runtime  change prd-v1 · revision [0-9a-f]{12} · base [0-9a-f]{7}$/m);
  const j = json(dir);
  assert.equal(j.mode, 'migrated'); assert.equal(j.change.id, 'prd-v1');
  assert.equal(j.tickets[0].readiness.reasons[0].code, 'LEGACY_RECEIPT');
  assert.match(text, /WARN T-01 LEGACY_RECEIPT: migrated legacy receipt .* — verify/);
  assert.equal(j.candidate.local_attempts, 'unavailable');
  assert.match(j.next, /re-run verify for T-01/);
  write(dir, file, read(dir, file).replace(/^verified:.*\n/m, '').replace(/^last_check:.*\n/m, ''));
  assert.equal(json(dir).tickets[0].readiness.reasons[0].code, 'EVIDENCE_MISSING', 'no receipt and no attempt');
  // PRD content change after registration: REVISION_CHANGED on the Runtime line and as the next action.
  write(dir, '.prd/prd-v1.md', `${read(dir, '.prd/prd-v1.md')}\nmore scope\n`);
  const changed = passes(human(dir));
  assert.match(changed, /^Runtime  change prd-v1 .* REVISION_CHANGED: PRD content is now [0-9a-f]{12}/m);
  assert.match(line(changed, 'Next'), /register --prd \.prd\/prd-v1\.md --rebind/);
  assert.ok(json(dir).reasons.some(r => r.code === 'REVISION_CHANGED'));
  git(dir, 'checkout', '--', '.prd/prd-v1.md');
  // A secret path in the source view blocks every ticket with SECRET_PATH and names only the path.
  write(dir, '.env', 'TOKEN=abc123secret\n'); git(dir, 'add', '-f', '.env');
  const secret = json(dir);
  assert.equal(secret.tickets[0].readiness.reasons[0].code, 'SECRET_PATH');
  assert.doesNotMatch(JSON.stringify(secret), /abc123secret/);
  assert.match(secret.next, /repair the source view: SECRET_PATH \.env/);
  git(dir, 'rm', '-q', '--cached', '.env'); fs.unlinkSync(path.join(dir, '.env'));
  // A malformed binding is invalid input.
  write(dir, '.prd/changes/prd-v1.json', '{');
  const broken = human(dir);
  assert.equal(broken.status, 4); assert.match(broken.stdout, /WARN +invalid change binding: .*malformed JSON/);
  assert.match(broken.stdout, /Next +repair \.prd\/changes\//);
}

// PRD v4 R-07/R-08 (T-39): candidate readiness with local attempt history.
// S-24: a newer same-context failure blocks release despite the exported pass;
// a failure on different source inputs is historical; a fresh clone reports the
// availability limit and still validates the saved record; release creates nothing.
{
  const state = (await import('node:module')).createRequire(import.meta.url)(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
  const dir = tempDir(); git(dir, 'init', '-q');
  write(dir, 'base.txt', 'original\n'); write(dir, '.gitignore', '.pincer/\n');
  const base = commit(dir, 'base');
  createPrd(dir); createTicket(dir, { command: 'test -f value.txt' }); write(dir, 'value.txt', 'good');
  commit(dir, 'prd and ticket');
  bindV050(dir); commit(dir, 'register');
  passes(run(dir, 'bash', [ticketScriptPath, 'start', 'T-01'])); passes(run(dir, 'bash', [ticketScriptPath, 'verify', 'T-01'])); passes(run(dir, 'bash', [ticketScriptPath, 'done', 'T-01']));
  commit(dir, 'T-01 done');
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('ticketed', 'built'));
  const candidate = commit(dir, 'PRD v1: built');
  passes(rt(dir, 'check', 'C-01', '--candidate', candidate, '--', 'test', '-f', 'value.txt'), 'check');
  const evidenceDir = `.prd/evidence/prd-v1/${candidate}`;
  write(dir, `${evidenceDir}/review/code-quality.md`, '# Review\nNo findings.\n');
  write(dir, '.pincer/drafts/c.json', JSON.stringify({
    environment: { tools: ['git'], limitations: [] }, coverage_review: 'R-01 → C-01, C-02.',
    requirements: [{ id: 'R-01', disposition: 'delivered', tickets: ['T-01'], checks: ['C-01', 'C-02'] }],
    checks: [{ id: 'C-01', kind: 'command', required: true }, { id: 'C-02', kind: 'review', required: true, result: 'passed', timestamp: '2026-09-11T12:00:00Z', artifacts: [`${evidenceDir}/review/code-quality.md`] }],
    visual_review: { applicable: false, reason: 'no UI' },
  }));
  passes(rt(dir, 'evidence', 'export', '--candidate', candidate, '--base', base, '--prd', '.prd/prd-v1.md', '--draft', '.pincer/drafts/c.json'), 'export');
  writeNotes(dir, { base, candidate, evidence: `${evidenceDir}/manifest.json` });
  commit(dir, 'evaluate', ['NOTES.md', evidenceDir]);
  const current = passes(human(dir));
  assert.match(line(current, 'Provenance'), /^Provenance runtime \(schema 2\) · local attempts consistent with the exported checks$/);
  assert.match(line(current, 'Next'), /pincer-release/);
  assert.equal(rt(dir, 'ready').status, 0);
  // Newer same-source failure.
  const failed = rt(dir, 'check', 'C-01', '--candidate', candidate, '--', 'false');
  assert.equal(failed.status, 1);
  const blocked = passes(human(dir));
  assert.match(line(blocked, 'Provenance'), /C-01 failed \(000\d+-\S+, same source: blocks until re-exported\)/);
  assert.match(line(blocked, 'Next'), /^Next +\/pincer-code — a newer local attempt is not passing for C-01; repair, re-run the check and \/pincer-evaluate before release/);
  const gate = rt(dir, 'ready');
  assert.equal(gate.status, 1); assert.match(gate.stdout, /not ready: CHECK_FAILED C-01: newer local attempt .* failed on the same source inputs/);
  const jb = json(dir);
  assert.equal(jb.candidate.reasons[0].code, 'CHECK_FAILED'); assert.equal(jb.candidate.newer_attempts[0].same_source, true);
  assert.equal(git(dir, 'status', '--porcelain'), '', 'status and ready create no tracked edits');
  // A later pass restores readiness; a failure on different source inputs is historical.
  passes(rt(dir, 'check', 'C-01', '--candidate', candidate, '--', 'true'));
  assert.equal(rt(dir, 'ready').status, 1, 'a newer pass does not re-validate the exported record; the older failure still outranks the exported sequence until re-exported');
  const latest = state.latestAttempt(dir, `candidate:${candidate}:C-01`);
  const historical = { ...latest, id: '000099-20260911T120000Z-abcdef', sequence: latest.sequence + 1, outcome: 'failed', exit_code: 1, source: { ...latest.source, before: 'f'.repeat(64), after: 'f'.repeat(64) } };
  state.withLock(dir, () => { const { index } = state.readIndex(dir); state.writeAttempt(dir, historical); index.sequence = historical.sequence; index.current[`candidate:${candidate}:C-01`] = historical.id; state.writeIndex(dir, index); });
  const hist = passes(human(dir));
  assert.match(line(hist, 'Provenance'), /C-01 failed \(000099-\S+, different source: historical\)/);
  assert.equal(json(dir).candidate.newer_attempts.find(a => a.attempt === historical.id).same_source, false);
  assert.ok(!json(dir).candidate.reasons.some(r => /000099/.test(r.detail)), 'a different-source failure does not block');
  // Fresh clone: saved record validated, local history unavailable, ready passes with the limit stated.
  const clone = path.join(tempDir(), 'repo');
  passes(run(dir, 'git', ['clone', '-q', dir, clone]));
  const fresh = passes(human(clone));
  assert.match(line(fresh, 'Provenance'), /^Provenance runtime \(schema 2\) · local verification history unavailable; saved candidate evidence validated only$/);
  assert.match(line(fresh, 'Evidence'), / · ok$/);
  assert.match(line(fresh, 'Next'), /pincer-release/);
  assert.match(line(fresh, 'Local'), /^Local +verification history unavailable: 1 done ticket\(s\) rely on the saved candidate evidence until verified here$/);
  assert.doesNotMatch(fresh, /WARN/);
  assert.equal(rt(clone, 'ready', 'T-01').status, 1, 'a single ticket is not locally verified in a clone');
  const jf = json(clone);
  assert.equal(jf.candidate.local_attempts, 'unavailable'); assert.equal(jf.candidate.evidence.provenance, 'runtime');
  assert.equal(rt(clone, 'ready').status, 0);
  assert.ok(!fs.existsSync(path.join(clone, '.pincer')), 'inspection created no local state');
}

// S-25 (migrated) and S-26: every migrated failure fixture maps to a stable reason
// code and next action, and status, JSON, done and ready agree; JSON never carries
// a secret marker from a fixture log.
{
  const state = (await import('node:module')).createRequire(import.meta.url)(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
  const fixture = () => {
    const dir = tempDir(); git(dir, 'init', '-q'); createPrd(dir);
    const file = createTicket(dir, { command: 'echo "API_KEY=fixture-secret-marker"; test -f value.txt', criteria: '- [x] ok' });
    write(dir, 'value.txt', 'good'); write(dir, 'src/app.js', '1\n'); write(dir, '.gitignore', '.pincer/\n'); commit(dir, 'base');
    bindV050(dir); commit(dir, 'register');
    passes(run(dir, 'bash', [ticketScriptPath, 'start', 'T-01'])); passes(run(dir, 'bash', [ticketScriptPath, 'verify', 'T-01'])); commit(dir, 'started');
    return { dir, file };
  };
  const cases = [
    ['SOURCE_CHANGED', ({ dir }) => write(dir, 'src/app.js', '2\n'), /verify/],
    ['CHECK_CHANGED', ({ dir, file }) => write(dir, file, read(dir, file).replace('test -f value.txt', 'test -f value.txt && true')), /verify/],
    ['CHECK_FAILED', ({ dir }) => { fs.unlinkSync(path.join(dir, 'value.txt')); run(dir, 'bash', [ticketScriptPath, 'verify', 'T-01']); write(dir, 'value.txt', 'good'); }, /fix, then verify/],
    ['CRITERIA_UNTICKED', ({ dir, file }) => write(dir, file, read(dir, file).replace('- [x] ok', '- [ ] ok')), /tick verified criteria/],
    ['EVIDENCE_MISSING', ({ dir }) => fs.rmSync(path.join(dir, '.pincer/runtime'), { recursive: true }), /verify/],
    ['ATTEMPT_INTERRUPTED', ({ dir }) => { const a = state.latestAttempt(dir, 'ticket:prd-v1:T-01'); a.outcome = 'interrupted'; state.writeAttempt(dir, a); }, /verify/],
    ['ATTEMPT_TIMED_OUT', ({ dir }) => { const a = state.latestAttempt(dir, 'ticket:prd-v1:T-01'); a.outcome = 'timed_out'; state.writeAttempt(dir, a); }, /timeout, then verify/],
    ['REVISION_CHANGED', ({ dir }) => write(dir, '.prd/prd-v1.md', `${read(dir, '.prd/prd-v1.md')}\nmore scope\n`), /rebind/],
  ];
  for (const [code, inject, next] of cases) {
    const f = fixture();
    assert.equal(rt(f.dir, 'ready', 'T-01').status, 0, `${code}: fixture starts ready`);
    inject(f);
    const j = json(f.dir);
    const codes = [...j.tickets[0].readiness.reasons.map(r => r.code), ...j.reasons.map(r => r.code)];
    assert.ok(codes.includes(code), `${code}: reason reported (${codes.join(',')})`);
    if (code !== 'REVISION_CHANGED') assert.match(j.tickets[0].readiness.next, next, `${code}: next action`);
    assert.match(j.next, code === 'REVISION_CHANGED' ? /--rebind/ : /pincer-code|verify/, `${code}: workflow next`);
    const gate = rt(f.dir, 'ready', 'T-01');
    assert.equal(gate.status, 1, `${code}: ready exits 1`);
    const done = run(f.dir, 'bash', [ticketScriptPath, 'done', 'T-01']);
    assert.notEqual(done.status, 0, `${code}: done refuses`);
    if (code !== 'REVISION_CHANGED') assert.match(done.stderr, new RegExp(code), `${code}: done names the same code`);
    const humanOut = human(f.dir).stdout;
    if (code === 'EVIDENCE_MISSING') assert.match(humanOut, /T-01 +in_progress .* no attempt yet/, 'in-progress without attempts is reported in the row');
    else if (!['REVISION_CHANGED', 'CRITERIA_UNTICKED'].includes(code)) assert.match(humanOut, new RegExp(`WARN T-01 ${code}`), `${code}: human WARN agrees`);
    assert.doesNotMatch(JSON.stringify(j) + gate.stdout + humanOut, /fixture-secret-marker/, `${code}: no secret marker from the log in any report`);
  }
}
console.log('runtime status tests passed');

// PRD v6 T-74: status JSON is schema 3 in changes mode with a coverage summary; the
// legacy and migrated forms stay schema 1 and label coverage unverified.
{
  const dir = tempDir(); git(dir, 'init', '-q'); createPrd(dir); createTicket(dir); write(dir, '.gitignore', '.pincer/\n'); commit(dir, 'base');
  const legacy = JSON.parse(passes(rt(dir, 'status', '--json')));
  assert.equal(legacy.schema, 1); assert.deepEqual(legacy.coverage, { strict: false, label: 'unverified', reason: 'legacy project (no change record); strict coverage needs change records' });
  assert.match(passes(human(dir)), /^Coverage unverified · legacy project/m);
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md')); passes(rt(dir, 'change', 'select', 'prd-v1'));
  const changesMode = JSON.parse(passes(rt(dir, 'status', '--json')));
  assert.equal(changesMode.schema, 3); assert.equal(changesMode.runtime, 3); assert.equal(changesMode.coverage.label, 'unverified');
}
console.log('runtime status tests passed (coverage summary)');
