'use strict';
// PINCER runtime — change identity (docs/runtime-contracts.md, "Change binding").
// A change binding under .prd/changes/<id>.json ties runtime verification to one
// explicitly selected PRD and its content revision. Written only here and by
// migration; never inferred from the highest PRD number.
const fs = require('node:fs');
const path = require('node:path');
const parse = require('./parse.cjs');
const { nowIso, atomicWrite, readJson, tryGit } = require('./fsutil.cjs');

const CHANGE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const RUNTIME = 1;
const BINDING_KEYS = ['schema', 'change', 'prd', 'prd_revision', 'base', 'registered', 'authorization', 'runtime', 'legacy_receipts'];

const bindingsDir = root => path.join(root, '.prd', 'changes');
function listBindings(root) {
  const dir = bindingsDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort().map(name => `.prd/changes/${name}`);
}

function validateBinding(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return 'binding must be a JSON object';
  if (doc.schema !== 1) return `unsupported binding schema ${JSON.stringify(doc.schema)} (this runtime reads schema 1)`;
  for (const key of Object.keys(doc)) if (!BINDING_KEYS.includes(key)) return `unknown binding key "${key}"`;
  for (const key of BINDING_KEYS) if (!(key in doc)) return `missing binding key "${key}"`;
  if (typeof doc.change !== 'string' || !CHANGE_ID.test(doc.change)) return 'change must match [a-z0-9][a-z0-9-]{0,63}';
  if (typeof doc.prd !== 'string' || !parse.PRD_REF.test(doc.prd)) return 'prd must be of the form .prd/prd-vN.md';
  if (typeof doc.prd_revision !== 'string' || !SHA256.test(doc.prd_revision)) return 'prd_revision must be a 64-hex SHA-256 digest';
  if (typeof doc.base !== 'string' || !parse.HEX40.test(doc.base)) return 'base must be a full 40-hex commit ID';
  if (typeof doc.registered !== 'string' || !parse.TIMESTAMP.test(doc.registered)) return 'registered must be an ISO UTC timestamp';
  if (doc.authorization !== null && (typeof doc.authorization !== 'string' || doc.authorization.length > 2000)) return 'authorization must be null or a short string';
  if (doc.runtime !== RUNTIME) return `unsupported runtime contract ${JSON.stringify(doc.runtime)}`;
  if (!doc.legacy_receipts || typeof doc.legacy_receipts !== 'object' || Array.isArray(doc.legacy_receipts)) return 'legacy_receipts must be an object';
  return null;
}

// Resolve the binding for this worktree. Returns { binding, file, prd } or
// { code, problem } with the contracted codes; `prd`, when given, is the PRD the
// caller needs — a binding for another PRD is CHANGE_REQUIRED with `other` set so
// callers can treat that PRD as legacy.
function loadBinding(root, { prd } = {}) {
  const files = listBindings(root);
  if (files.length === 0) {
    const hint = prd ? `register it with: node scripts/pincer-runtime.cjs register --prd ${prd}` : 'run register or migrate';
    return { code: 'CHANGE_REQUIRED', problem: `no change binding under .prd/changes/ — ${hint}` };
  }
  if (files.length > 1) return { code: 'AMBIGUOUS', problem: `several change bindings under .prd/changes/ (${files.map(f => path.basename(f)).join(', ')}) — keep exactly one` };
  const file = files[0];
  const read = readJson(path.join(root, file));
  if (read.error) return { code: 'MALFORMED', problem: `${file}: ${read.error}`, file };
  const invalid = validateBinding(read.data);
  if (invalid) return { code: /schema|runtime contract/.test(invalid) ? 'UNSUPPORTED_SCHEMA' : 'MALFORMED', problem: `${file}: ${invalid}`, file };
  const binding = read.data;
  if (path.basename(file, '.json') !== binding.change) return { code: 'MALFORMED', problem: `${file}: filename does not match change "${binding.change}"`, file };
  if (prd && binding.prd !== prd) return { code: 'CHANGE_REQUIRED', other: true, binding, file, problem: `${file} binds ${binding.prd}, not ${prd}` };
  const prdResult = parse.validatePrd(root, binding.prd);
  if (!prdResult.ok) return { code: 'INPUT_INVALID', problem: `${binding.prd}: ${prdResult.problems[0]}`, binding, file };
  const revision = parse.prdDigest(prdResult.text);
  if (revision !== binding.prd_revision) {
    return { code: 'REVISION_CHANGED', binding, file, revision, problem: `${binding.prd} content changed since registration (revision ${binding.prd_revision.slice(0, 12)} → ${revision.slice(0, 12)}) — rebind explicitly with: node scripts/pincer-runtime.cjs register --prd ${binding.prd} --rebind` };
  }
  return { binding, file, prd: prdResult };
}

function head(root) {
  const result = tryGit(root, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (result.error || !parse.HEX40.test(result.out.trim())) return null;
  return result.out.trim();
}

function writeBinding(root, binding) {
  const file = path.join(bindingsDir(root), `${binding.change}.json`);
  atomicWrite(file, `${JSON.stringify(binding, null, 2)}\n`);
  return `.prd/changes/${binding.change}.json`;
}

// Register (or rebind / replace) the selected PRD. Returns { binding, file,
// action: 'registered' | 'unchanged' | 'updated' | 'rebound' | 'replaced', notes }
// or { code, problem }.
function register(root, { prd, change, authorization = null, replace = false, rebind = false } = {}) {
  const prdResult = parse.validatePrd(root, prd);
  if (!prdResult.ok) return { code: 'INPUT_INVALID', problem: `${prdResult.file || prd}: ${prdResult.problems[0]}` };
  const version = prd.match(parse.PRD_REF)[1];
  const id = change || `prd-v${version}`;
  if (!CHANGE_ID.test(id)) return { code: 'INPUT_INVALID', problem: `change ID must match [a-z0-9][a-z0-9-]{0,63}: ${id}` };
  const base = head(root);
  if (!base) return { code: 'UNSUPPORTED_INPUT', problem: 'registration needs a git repository with at least one commit (base = HEAD)' };
  const revision = parse.prdDigest(prdResult.text);
  const notes = [];
  if (authorization === null) notes.push('no --authorization recorded; running registration does not prove human approval');
  const files = listBindings(root);
  if (files.length > 1) return { code: 'AMBIGUOUS', problem: `several change bindings under .prd/changes/ (${files.map(f => path.basename(f)).join(', ')}) — keep exactly one before registering` };
  let existing = null;
  if (files.length === 1) {
    const read = readJson(path.join(root, files[0]));
    const invalid = read.error || validateBinding(read.data);
    if (invalid) return { code: 'MALFORMED', problem: `${files[0]}: ${invalid} — repair or remove it before registering` };
    existing = { file: files[0], binding: read.data };
  }
  if (existing && (existing.binding.prd !== prd || existing.binding.change !== id)) {
    if (!replace) return { code: 'AMBIGUOUS', problem: `${existing.file} already binds ${existing.binding.prd} as change "${existing.binding.change}"; one change per worktree — pass --replace to replace it (its attempts stay in local history)` };
    fs.unlinkSync(path.join(root, existing.file));
    const binding = { schema: 1, change: id, prd, prd_revision: revision, base, registered: nowIso(), authorization, runtime: RUNTIME, legacy_receipts: {} };
    return { binding, file: writeBinding(root, binding), action: 'replaced', replaced: existing.file, notes };
  }
  if (existing) {
    const current = existing.binding;
    if (current.prd_revision === revision) {
      if (authorization !== null && authorization !== current.authorization) {
        const binding = { ...current, authorization };
        return { binding, file: writeBinding(root, binding), action: 'updated', notes };
      }
      return { binding: current, file: existing.file, action: 'unchanged', notes };
    }
    if (!rebind) {
      return { code: 'REVISION_CHANGED', problem: `${prd} content changed since registration (revision ${current.prd_revision.slice(0, 12)} → ${revision.slice(0, 12)}); pass --rebind to bind the new revision — readiness recorded for the old revision no longer applies` };
    }
    const binding = { ...current, prd_revision: revision, registered: nowIso(), authorization: authorization ?? current.authorization };
    notes.push(`rebound to revision ${revision.slice(0, 12)}; attempts recorded for ${current.prd_revision.slice(0, 12)} no longer establish readiness`);
    return { binding, file: writeBinding(root, binding), action: 'rebound', notes };
  }
  const binding = { schema: 1, change: id, prd, prd_revision: revision, base, registered: nowIso(), authorization, runtime: RUNTIME, legacy_receipts: {} };
  return { binding, file: writeBinding(root, binding), action: 'registered', notes };
}

module.exports = { CHANGE_ID, RUNTIME, BINDING_KEYS, listBindings, validateBinding, loadBinding, register, writeBinding, head };
