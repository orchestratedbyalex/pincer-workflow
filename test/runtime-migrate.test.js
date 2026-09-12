// Migration (PRD v4 R-09, R-06, R-01; PRD v5 R-09, T-58): preview is read-only and
// names every change and conflict; apply writes a schema 2 change record in one
// transaction with backups, migrates once, and re-apply is a no-op; legacy
// receipts become history, never runtime evidence; user files are preserved in
// every fixture; conflicts fail closed before the first write; the installer
// diagnoses but never migrates.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, createTicket, createPrd, write, read, run, ticketScript, statusScript, bindV050 } from './helpers.js';

const require = createRequire(import.meta.url);
const changes = require(path.join(repo, 'template/scripts/pincer-runtime/changes.cjs'));
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args], { timeout: 60000 });
const sh = (dir, ...args) => run(dir, 'bash', [ticketScript, ...args], { timeout: 60000 });
function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message) {
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=Pincer Test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '--allow-empty', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}
const snapshot = dir => {
  const out = {};
  const walk = rel => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(next); else out[next] = read(dir, next);
    }
  };
  walk('');
  return out;
};
const record = (dir, id = 'prd-v1') => JSON.parse(read(dir, `.prd/changes/${id}.json`));
const preview = dir => rt(dir, 'migrate', '--preview', '--prd', '.prd/prd-v1.md');
const applyIt = dir => rt(dir, 'migrate', '--apply', '--prd', '.prd/prd-v1.md');
const authorizeAndActivate = (dir, id = 'prd-v1') => {
  const shown = JSON.parse(passes(rt(dir, 'change', 'show', id, '--json')));
  passes(rt(dir, 'change', 'authorize', id, '--agreement', shown.agreement.current, '--reference', 'planning session', '--excerpt', 'approved'));
  passes(rt(dir, 'change', 'activate', id));
};

// Legacy fixture: two done tickets with receipts, one open, user edits in bodies and AGENTS.md.
function legacy() {
  const dir = tempDir(); git(dir, 'init', '-q'); createPrd(dir);
  createTicket(dir); passes(sh(dir, 'verify', 'T-01')); passes(sh(dir, 'done', 'T-01'));
  createTicket(dir, { id: 'T-02', deps: 'T-01' }); passes(sh(dir, 'verify', 'T-02')); passes(sh(dir, 'done', 'T-02'));
  createTicket(dir, { id: 'T-03', deps: 'T-02' });
  write(dir, 'tickets/T-02-example.md', read(dir, 'tickets/T-02-example.md').replace('## Objective\nExample', '## Objective\nExample — user note kept verbatim'));
  write(dir, 'AGENTS.md', '# team rules\n- keep this\n');
  write(dir, '.gitignore', '.env\n');
  commit(dir, 'legacy project');
  return dir;
}

// Legacy: preview is read-only and names each change; apply migrates once with backups.
{
  const dir = legacy();
  const before = snapshot(dir);
  const p = preview(dir);
  assert.equal(p.status, 0, p.stdout + p.stderr);
  assert.match(p.stdout, /^migration plan for \.prd\/prd-v1\.md \(change prd-v1\)$/m);
  assert.match(p.stdout, /record    \.prd\/changes\/prd-v1\.json \(new schema 2 record; base = HEAD; planned\)/);
  assert.match(p.stdout, /ticket    tickets\/T-01-example\.md: remove verified, last_check → legacy\.receipts\[T-01\] \(history, not runtime evidence\)/);
  assert.match(p.stdout, /ticket    tickets\/T-02-example\.md/);
  assert.doesNotMatch(p.stdout, /T-03-example/, 'an open ticket without receipts is untouched');
  assert.match(p.stdout, /gitignore add `\.pincer\/`/);
  assert.match(p.stdout, /history   0 existing attempt\(s\) and any saved evaluation stay history \(HISTORICAL_EVIDENCE\) until verified again; the change is planned with no authorization/);
  assert.match(p.stdout, /selection \.pincer\/runtime\/selection\.json → prd-v1 \(this worktree only; a fresh clone selects explicitly\)/);
  assert.match(p.stdout, /note      no --authorization given; migration grants no authorization/);
  assert.match(p.stdout, /apply with: node scripts\/pincer-runtime\.cjs migrate --apply --prd \.prd\/prd-v1\.md/);
  assert.deepEqual(snapshot(dir), before, 'preview writes nothing');
  assert.ok(!fs.existsSync(path.join(dir, '.pincer')));

  const a = applyIt(dir);
  assert.equal(a.status, 0, a.stdout + a.stderr);
  assert.match(a.stdout, /^migrated \.prd\/prd-v1\.md → change prd-v1 \(schema 2 record, planned; base [0-9a-f]{7}; 2 ticket\(s\) rewritten; 2 legacy receipt\(s\) as history\)$/m);
  assert.match(a.stdout, /backups: \.pincer\/backups\/\d{8}T\d{6}Z\/ \(3 file\(s\)\)/);
  assert.match(a.stdout, /^selected change prd-v1 in this worktree/m);
  assert.match(a.stderr, /the change is planned with no authorization/);
  const r = record(dir);
  assert.equal(changes.validateRecord(r, '.prd/changes/prd-v1.json'), null);
  assert.equal(r.schema, 2); assert.equal(r.prd, '.prd/prd-v1.md'); assert.equal(r.change, 'prd-v1'); assert.equal(r.base, git(dir, 'rev-parse', 'HEAD'));
  assert.equal(r.lifecycle.state, 'planned'); assert.equal(r.events[0].kind, 'migrate'); assert.deepEqual(r.authorizations, []);
  assert.deepEqual(Object.keys(r.legacy.receipts).sort(), ['T-01', 'T-02']); assert.equal(r.legacy.migrated_from, 'legacy'); assert.equal(r.legacy.authorization_text, null);
  assert.match(r.legacy.receipts['T-01'].verified, /^\d{4}-.*Z [0-9a-f]{12}$/);
  assert.equal(JSON.parse(read(dir, '.pincer/runtime/selection.json')).change, 'prd-v1');
  for (const t of ['T-01', 'T-02']) {
    assert.doesNotMatch(read(dir, `tickets/${t}-example.md`), /^(verified|last_check):/m, `${t} receipts removed`);
    assert.match(read(dir, `tickets/${t}-example.md`), /^status: done$/m, 'lifecycle projection kept');
    assert.match(read(dir, `tickets/${t}-example.md`), /^finished: /m, 'completion date kept');
  }
  assert.match(read(dir, 'tickets/T-02-example.md'), /user note kept verbatim/, 'user edit preserved');
  assert.equal(read(dir, 'AGENTS.md'), '# team rules\n- keep this\n', 'unrelated user file untouched');
  assert.match(read(dir, '.gitignore'), /^\.env\n\n# pincer runtime state \(added by migrate\)\n\.pincer\/\n$/);
  assert.equal(read(dir, 'tickets/T-03-example.md'), before['tickets/T-03-example.md'], 'open ticket untouched');
  // Backups restore the originals byte for byte.
  const backupDir = fs.readdirSync(path.join(dir, '.pincer/backups'))[0];
  for (const rel of ['tickets/T-01-example.md', 'tickets/T-02-example.md', '.gitignore']) {
    assert.equal(read(dir, `.pincer/backups/${backupDir}/${rel}`), before[rel], `${rel} backed up byte for byte`);
  }
  // Status: changes mode, legacy receipts are history, new verification starts unverified.
  const text = passes(run(dir, 'bash', [statusScript]));
  assert.match(text, /^Runtime  changes · selected prd-v1 · planned · agreement [0-9a-f]{12} \(not recorded\) · authorization AUTHORIZATION_REQUIRED/m);
  assert.match(text, /WARN T-01 LEGACY_RECEIPT: migrated legacy receipt .* — verify/);
  assert.match(text, /WARN T-02 LEGACY_RECEIPT/);
  const j = JSON.parse(passes(rt(dir, 'status', '--json')));
  assert.equal(j.mode, 'changes');
  assert.equal(j.tickets.find(t => t.id === 'T-01').readiness.reasons[0].code, 'LEGACY_RECEIPT');
  assert.equal(j.tickets.find(t => t.id === 'T-01').status, 'done');
  // Re-apply is a no-op; preview says already migrated.
  const afterApply = snapshot(dir);
  const again = applyIt(dir);
  assert.equal(again.status, 0); assert.match(again.stdout, /^already migrated: \.prd\/prd-v1\.md is change prd-v1 \(schema 2 record\); nothing changed$/m);
  assert.deepEqual(snapshot(dir), afterApply, 'repeated apply changes nothing');
  assert.match(preview(dir).stdout, /already migrated: change record present, no legacy receipts remain, \.pincer\/ ignored/);
  // A legacy receipt can never close a ticket after migration; a runtime pass can, once the change is authorized and active.
  commit(dir, 'migrated');
  assert.notEqual(sh(dir, 'done', 'T-01').status, 0);
  assert.match(sh(dir, 'done', 'T-01').stderr, /LIFECYCLE_BLOCKED/, 'a planned change executes nothing');
  authorizeAndActivate(dir);
  assert.match(sh(dir, 'done', 'T-01').stderr, /LEGACY_RECEIPT/);
  passes(sh(dir, 'verify', 'T-01')); passes(sh(dir, 'done', 'T-01'), 'runtime pass closes it');
  assert.equal(git(dir, 'status', '--porcelain').split('\n').filter(l => !/\.prd\/changes/.test(l)).join(''), '', 'closing an already-done ticket rewrites nothing outside the record');
}

// Clean: no tickets and no receipts — record, selection and ignore line only.
{
  const dir = tempDir(); git(dir, 'init', '-q'); createPrd(dir); commit(dir, 'clean');
  const p = preview(dir);
  assert.equal(p.status, 0); assert.match(p.stdout, /tickets   no legacy receipts to import/);
  const a = applyIt(dir);
  assert.equal(a.status, 0, a.stderr); assert.match(a.stdout, /0 ticket\(s\) rewritten; 0 legacy receipt\(s\)/);
  assert.doesNotMatch(a.stdout, /backups:/, 'no authored file changed except the new .gitignore');
  assert.ok(fs.existsSync(path.join(dir, '.prd/changes/prd-v1.json')));
  assert.match(read(dir, '.gitignore'), /\.pincer\//);
  assert.match(JSON.parse(passes(rt(dir, 'status', '--json'))).change.id, /prd-v1/);
}

// Ambiguous: two PRDs need --prd; a v0.5.0 binding for another PRD is a conflict that stops apply.
{
  const dir = legacy(); createPrd(dir, 2); commit(dir, 'second prd');
  assert.equal(rt(dir, 'migrate', '--preview').status, 2, '--prd is required');
  bindV050(dir, { prd: '.prd/prd-v2.md' });
  const before = snapshot(dir);
  const p = preview(dir);
  assert.equal(p.status, 1); assert.match(p.stdout, /conflict  AMBIGUOUS: \.prd\/changes\/prd-v2\.json binds \.prd\/prd-v2\.md, not \.prd\/prd-v1\.md; a v0\.5\.0 binding is converted first — migrate it with: node scripts\/pincer-runtime\.cjs migrate --preview --prd \.prd\/prd-v2\.md, then register \.prd\/prd-v1\.md/);
  assert.match(p.stdout, /migration refused: resolve the conflicts above; nothing was written/);
  const a = applyIt(dir);
  assert.equal(a.status, 1);
  assert.deepEqual(snapshot(dir), before, 'a conflicting apply writes nothing');
}

// Partly migrated: the record exists but a ticket carries receipts again (an older
// kit wrote them) — preview names it, apply imports them with a migrate event.
{
  const dir = legacy();
  passes(applyIt(dir));
  const seq = record(dir).sequence;
  write(dir, 'tickets/T-03-example.md', read(dir, 'tickets/T-03-example.md').replace('status: open', 'status: done\nstarted: 2026-09-11T00:00:00Z\nlast_check: 2026-09-11T00:01:00Z passed abcdef012345\nverified: 2026-09-11T00:01:00Z abcdef012345\nfinished: 2026-09-11T00:02:00Z'));
  const p = preview(dir);
  assert.equal(p.status, 0, p.stdout);
  assert.match(p.stdout, /note      an earlier migration was partially applied \(record present, receipts remain\); apply completes it/);
  assert.match(p.stdout, /record    \.prd\/changes\/prd-v1\.json \(present; 1 receipt\(s\) imported into legacy\.receipts by a migrate event\)/);
  const base = record(dir).base;
  const a = applyIt(dir);
  assert.equal(a.status, 0, a.stderr);
  assert.match(a.stdout, /receipts imported; base/);
  const r = record(dir);
  assert.equal(r.base, base, 'completing keeps the existing record identity');
  assert.deepEqual(Object.keys(r.legacy.receipts).sort(), ['T-01', 'T-02', 'T-03']);
  assert.equal(r.sequence, seq + 1); assert.equal(r.events.at(-1).kind, 'migrate'); assert.equal(r.events.at(-1).note, '1 legacy receipt(s) imported');
  assert.equal(changes.validateRecord(r, '.prd/changes/prd-v1.json'), null);
  assert.doesNotMatch(read(dir, 'tickets/T-03-example.md'), /^verified:/m);
}

// A malformed ticket makes apply fail before any write; --change and --authorization are recorded (as history only).
{
  const dir = legacy();
  write(dir, 'tickets/T-03-example.md', read(dir, 'tickets/T-03-example.md').replace('size: S', 'size: XL'));
  const before = snapshot(dir);
  const a = applyIt(dir);
  assert.equal(a.status, 1); assert.match(a.stdout, /conflict  INPUT_INVALID: pincer-ticket: tickets\/T-03-example\.md: size must be S, M, or L/);
  assert.deepEqual(snapshot(dir), before, 'nothing written on a malformed ticket');
  write(dir, 'tickets/T-03-example.md', read(dir, 'tickets/T-03-example.md').replace('size: XL', 'size: S'));
  const named = rt(dir, 'migrate', '--apply', '--prd', '.prd/prd-v1.md', '--change', 'notes-cli', '--authorization', 'user approved on 2026-09-11');
  assert.equal(named.status, 0, named.stderr);
  const b = record(dir, 'notes-cli');
  assert.equal(b.change, 'notes-cli'); assert.equal(b.legacy.authorization_text, 'user approved on 2026-09-11'); assert.deepEqual(b.authorizations, []);
  assert.match(named.stderr, /the v0\.5\.0 authorization text is history only/);
  assert.match(rt(dir, 'migrate', '--preview', '--prd', '.prd/prd-v1.md').stdout, /pass --change notes-cli/, 'a differently named record is reported');
  assert.equal(JSON.parse(passes(rt(dir, 'status', '--json'))).change.agreement.verdict, 'AUTHORIZATION_REQUIRED', 'the text never authorizes');
}

// Rollback from legacy, following the contract's steps literally (docs/runtime-contracts.md,
// "Migration and rollback"): restore the backed-up tickets and .gitignore, delete the
// schema 2 record and its snapshot directory if present, remove .pincer/; the project
// is legacy again with its receipts.
{
  const dir = legacy();
  const before = snapshot(dir);
  passes(applyIt(dir));
  authorizeAndActivate(dir);
  assert.ok(fs.existsSync(path.join(dir, '.prd/changes/prd-v1/agreements/G-01.json')), 'snapshot directory present after an authorization');
  const backupDir = fs.readdirSync(path.join(dir, '.pincer/backups'))[0];
  assert.deepEqual(fs.readdirSync(path.join(dir, `.pincer/backups/${backupDir}`)).sort(), ['.gitignore', 'tickets'], 'a legacy migration backs up tickets and .gitignore only');
  for (const rel of ['tickets/T-01-example.md', 'tickets/T-02-example.md', '.gitignore']) fs.copyFileSync(path.join(dir, `.pincer/backups/${backupDir}/${rel}`), path.join(dir, rel));
  fs.rmSync(path.join(dir, '.prd/changes/prd-v1.json'));
  fs.rmSync(path.join(dir, '.prd/changes/prd-v1'), { recursive: true, force: true });
  fs.rmSync(path.join(dir, '.pincer'), { recursive: true });
  assert.deepEqual(snapshot(dir), before, 'rollback restores the originals');
  assert.match(passes(run(dir, 'bash', [statusScript])), /^Runtime  legacy/m);
}

// Installer: init and update deploy the runtime; doctor reports migration availability and never migrates.
{
  const kit = tempDir();
  for (const file of ['bin', 'template', 'package.json']) fs.cpSync(path.join(repo, file), path.join(kit, file), { recursive: true });
  const cli = (dir, ...args) => run(dir, process.execPath, [path.join(kit, 'bin/pincer.js'), ...args]);
  const dir = legacy();
  passes(cli(dir, 'init', '--platform', 'claude'), 'init');
  const clearSidecars = () => { for (const name of fs.readdirSync(dir).filter(n => n.startsWith('AGENTS.md.new'))) fs.rmSync(path.join(dir, name)); }; // the fixture's own AGENTS.md conflicts, as expected
  clearSidecars();
  for (const rel of ['scripts/pincer-runtime.cjs', 'scripts/pincer-runtime/migrate.cjs', 'scripts/pincer-runtime/lifecycle.cjs', 'scripts/pincer-runtime/changes.cjs', 'scripts/pincer-runtime/transaction.cjs', 'docs/runtime-contracts.md']) assert.ok(fs.existsSync(path.join(dir, rel)), `deployed ${rel}`);
  const doctor = cli(dir, 'doctor');
  assert.match(doctor.stdout, /ok +runtime files present/);
  assert.match(doctor.stdout, /note  migration available: 2 ticket\(s\) carry legacy receipts and no change binding exists — preview with: node scripts\/pincer-runtime\.cjs migrate --preview --prd \.prd\/prd-v1\.md/);
  assert.ok(!fs.existsSync(path.join(dir, '.prd/changes')), 'doctor never migrates');
  assert.match(read(dir, 'tickets/T-01-example.md'), /^verified:/m, 'init never migrates');
  passes(cli(dir, 'update'), 'update'); clearSidecars();
  assert.match(read(dir, 'tickets/T-01-example.md'), /^verified:/m, 'update never migrates');
  fs.rmSync(path.join(dir, 'scripts/pincer-runtime/migrate.cjs'));
  const broken = cli(dir, 'doctor');
  assert.equal(broken.status, 1); assert.match(broken.stdout, /FAIL +runtime files present — missing: scripts\/pincer-runtime\/migrate\.cjs/);
  passes(cli(dir, 'update')); clearSidecars(); passes(cli(dir, 'doctor'), 'update restores the runtime file');
  passes(rt(dir, 'migrate', '--apply', '--prd', '.prd/prd-v1.md'));
  assert.doesNotMatch(cli(dir, 'doctor').stdout, /migration/, 'after migration the notes are gone');
  // A v0.5.0 binding is diagnosed as a conversion, never converted by the installer.
  const old = legacy(); bindV050(old); passes(cli(old, 'init', '--platform', 'claude'));
  const oldDoctor = cli(old, 'doctor');
  assert.match(oldDoctor.stdout, /note  migration to change records available: \.prd\/changes\/prd-v1\.json is a v0\.5\.0 binding \(schema 1\) — preview with: node scripts\/pincer-runtime\.cjs migrate --preview --prd \.prd\/prd-v1\.md/);
  assert.equal(JSON.parse(read(old, '.prd/changes/prd-v1.json')).schema, 1, 'doctor never converts');
}
console.log('runtime migration tests passed');
