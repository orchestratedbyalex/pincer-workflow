'use strict';
// PINCER runtime — migration (docs/runtime-contracts.md, "Migration and
// rollback"). Preview is read-only; apply backs up every authored file it
// changes, strips legacy receipts into the binding's legacy_receipts (history,
// never runtime evidence), ignores .pincer/, and writes the binding last.
// Conflicts fail closed before the first write; repeated apply is a no-op.
const fs = require('node:fs');
const path = require('node:path');
const parse = require('./parse.cjs');
const identity = require('./identity.cjs');
const statusModule = require('./status.cjs');
const { fmUnset } = require('./lifecycle.cjs');
const { nowIso, atomicWrite } = require('./fsutil.cjs');

const IGNORE_LINE = '.pincer/';

function gitignoreHas(root) {
  const file = path.join(root, '.gitignore');
  if (!fs.existsSync(file)) return false;
  return fs.readFileSync(file, 'utf8').split('\n').map(l => l.trim()).some(l => l === IGNORE_LINE || l === '/.pincer/' || l === '.pincer');
}

// Compute the plan. Returns { prd, change, conflicts: [{code, detail}], binding:
// { file, exists, action }, tickets: [{file, id, verified, last_check}],
// gitignore: boolean (needs the line), alreadyMigrated }.
function plan(root, { prd, change, authorization = null } = {}) {
  const conflicts = [];
  const conflict = (code, detail) => conflicts.push({ code, detail });
  const prdResult = parse.validatePrd(root, prd);
  if (!prdResult.ok) { conflict('INPUT_INVALID', `${prdResult.file || prd}: ${prdResult.problems[0]}`); return { prd, conflicts }; }
  const id = change || `prd-v${prd.match(parse.PRD_REF)[1]}`;
  if (!identity.CHANGE_ID.test(id)) conflict('INPUT_INVALID', `change ID must match [a-z0-9][a-z0-9-]{0,63}: ${id}`);
  if (!identity.head(root)) conflict('UNSUPPORTED_INPUT', 'migration needs a git repository with at least one commit');
  const bindings = identity.listBindings(root);
  let existing = null;
  if (bindings.length > 1) conflict('AMBIGUOUS', `several change bindings under .prd/changes/ (${bindings.map(b => path.basename(b)).join(', ')}); keep exactly one`);
  else if (bindings.length === 1) {
    const loaded = identity.loadBinding(root, { prd });
    if (loaded.code && loaded.code !== 'REVISION_CHANGED' && !loaded.other) conflict(loaded.code === 'UNSUPPORTED_SCHEMA' ? 'UNSUPPORTED_SCHEMA' : 'INPUT_INVALID', loaded.problem);
    else if (loaded.other) conflict('AMBIGUOUS', `${loaded.file} binds ${loaded.binding.prd}, not ${prd}; one change per worktree — register --replace or remove it first`);
    else if (loaded.binding && loaded.binding.change !== id) conflict('AMBIGUOUS', `${loaded.file} already binds ${prd} as change "${loaded.binding.change}"; pass --change ${loaded.binding.change}`);
    else existing = loaded.binding || null;
  }
  const set = parse.validateTicketSet(root);
  if (!set.ok) conflict('INPUT_INVALID', `pincer-ticket: ${set.file ? `${set.file}: ` : ''}${set.problems[0]}`);
  const tickets = [];
  if (set.ok) {
    for (const file of set.files) {
      const text = fs.readFileSync(path.join(root, file), 'utf8');
      const fields = parse.validateTicket(file, text).fields;
      const assoc = statusModule.ticketPrd(root, file, fields);
      if (assoc.problem) { conflict('INPUT_INVALID', `pincer: ${assoc.problem}`); continue; }
      if (assoc.prd !== prd) continue;
      if (fields.verified || fields.last_check) tickets.push({ file, id: fields.ticket, verified: fields.verified || null, last_check: fields.last_check || null, text });
    }
  }
  const gitignore = !gitignoreHas(root);
  const alreadyMigrated = Boolean(existing) && tickets.length === 0 && !gitignore;
  const partial = Boolean(existing) && tickets.length > 0;
  return { prd, change: id, authorization, conflicts, binding: { file: `.prd/changes/${id}.json`, exists: Boolean(existing), existing, action: existing ? (partial ? 'complete' : 'keep') : 'register' }, tickets, gitignore, alreadyMigrated, partial };
}

function renderPlan(p) {
  const lines = [];
  if (p.conflicts.length) {
    for (const c of p.conflicts) lines.push(`conflict  ${c.code}: ${c.detail}`);
    lines.push('migration refused: resolve the conflicts above; nothing was written');
    return lines.join('\n') + '\n';
  }
  lines.push(`migration plan for ${p.prd} (change ${p.change})`);
  if (p.alreadyMigrated) { lines.push('  already migrated: binding present, no legacy receipts remain, .pincer/ ignored'); return lines.join('\n') + '\n'; }
  if (p.partial) lines.push('  note      an earlier migration was partially applied (binding present, receipts remain); apply completes it');
  lines.push(`  binding   ${p.binding.file} (${p.binding.exists ? 'present, legacy_receipts extended' : 'new; base = HEAD'})`);
  for (const t of p.tickets) lines.push(`  ticket    ${t.file}: remove ${[t.verified ? 'verified' : null, t.last_check ? 'last_check' : null].filter(Boolean).join(', ')} → legacy_receipts[${t.id}] (history, not runtime evidence)`);
  if (!p.tickets.length) lines.push('  tickets   no legacy receipts to import');
  lines.push(p.gitignore ? `  gitignore add \`${IGNORE_LINE}\`` : '  gitignore already ignores .pincer/');
  lines.push(`  backups   .pincer/backups/<timestamp>/ for every changed authored file`);
  if (!p.authorization) lines.push('  note      no --authorization given; registration does not prove human approval');
  lines.push(`apply with: node scripts/pincer-runtime.cjs migrate --apply --prd ${p.prd}${p.change !== `prd-v${p.prd.match(parse.PRD_REF)[1]}` ? ` --change ${p.change}` : ''}`);
  return lines.join('\n') + '\n';
}

// Apply the plan: backups, tickets, .gitignore, then the binding last.
function apply(root, options) {
  const p = plan(root, options);
  if (p.conflicts.length) return { plan: p, applied: false };
  if (p.alreadyMigrated) return { plan: p, applied: false, already: true };
  const stamp = nowIso().replace(/[-:]/g, '');
  const backupDir = path.join(root, '.pincer', 'backups', stamp);
  const backups = [];
  const backup = rel => {
    const src = path.join(root, rel);
    if (!fs.existsSync(src)) return;
    const dest = path.join(backupDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    backups.push(`.pincer/backups/${stamp}/${rel}`);
  };
  const receipts = {};
  for (const t of p.tickets) {
    backup(t.file);
    receipts[t.id] = { verified: t.verified, last_check: t.last_check };
    let text = fmUnset(t.text, 'verified');
    text = fmUnset(text, 'last_check');
    atomicWrite(path.join(root, t.file), text);
  }
  if (p.gitignore) {
    backup('.gitignore');
    const file = path.join(root, '.gitignore');
    const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const lead = existing && !existing.endsWith('\n') ? '\n' : '';
    fs.appendFileSync(file, `${lead}${existing ? '\n' : ''}# pincer runtime state (added by migrate)\n${IGNORE_LINE}\n`);
  }
  let binding;
  if (p.binding.existing) {
    binding = { ...p.binding.existing, legacy_receipts: { ...p.binding.existing.legacy_receipts, ...receipts } };
    if (options.authorization) binding.authorization = options.authorization;
  } else {
    const registered = identity.register(root, { prd: p.prd, change: p.change, authorization: options.authorization || null });
    if (registered.code) return { plan: p, applied: false, error: registered.problem, backups };
    binding = { ...registered.binding, legacy_receipts: receipts };
  }
  identity.writeBinding(root, binding);
  return { plan: p, applied: true, binding, backups, backupDir: backups.length ? `.pincer/backups/${stamp}/` : null };
}

module.exports = { plan, renderPlan, apply, IGNORE_LINE, gitignoreHas };
