'use strict';
// Local study ownership. A dead owner is a recovery decision, never a retry signal.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
function error(code, message) { return Object.assign(new Error(message), { code }); }
function contained(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.split('/').some(x => !x || x === '..' || x === '.')) throw error('RUN_ID_INVALID', 'Invalid relative study path');
  let at = path.resolve(root);
  // Configured root may use the host's /tmp alias; nothing below it may be a symlink.
  for (const segment of relative.split('/')) {
    at = path.join(at, segment);
    try { if (fs.lstatSync(at).isSymbolicLink()) throw error('RUN_PATH_UNSAFE', `Symbolic link in study path: ${relative}`); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return at;
}
function locations(root, key) {
  if (typeof key !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,180}$/.test(key)) throw error('RUN_ID_INVALID', 'Invalid claim key');
  return { home: contained(root, '.claims'), file: contained(root, `.claims/${key}.json`), guard: contained(root, `.claims/recovery.${key}.json`) };
}
function processGroup() {
  if (!['linux', 'darwin'].includes(process.platform)) return null;
  try {
    const pgid = Number(execFileSync('ps', ['-o', 'pgid=', '-p', String(process.pid)], { encoding: 'utf8' }).trim());
    // Only an isolated group leader has recoverable child custody after owner death.
    return pgid === process.pid ? pgid : null;
  } catch { return null; }
}
function alive(pid) {
  try { process.kill(pid, 0); return 'alive'; }
  catch (e) { return e.code === 'ESRCH' ? 'dead' : 'unknown'; }
}
function inspect(root, key) {
  const { file } = locations(root, key);
  let owner;
  try { owner = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return null; return { state: 'unknown', reason: 'ownership metadata is unreadable; preserve it for manual investigation' }; }
  if (owner.schema !== 1 || owner.key !== key || !/^[a-f0-9]{32}$/.test(owner.token || '') || !Number.isSafeInteger(owner.pid) || owner.pid <= 0 || typeof owner.host !== 'string') return { state: 'unknown', reason: 'malformed ownership metadata' };
  if (owner.host !== os.hostname()) return { owner, state: 'unknown', reason: 'ownership belongs to another host' };
  const state = alive(owner.pid);
  if (state !== 'dead') return { owner, state, reason: state === 'alive' ? 'owner is still live (or PID reused)' : 'owner liveness cannot be established' };
  if (owner.group !== owner.pid) return { owner, state: 'unknown', reason: 'dead owner has no verified isolated process group; child custody is unknown' };
  if (!Array.isArray(owner.groups) || owner.groups.some(group => !Number.isSafeInteger(group) || group <= 0)) return { owner, state: 'unknown', reason: 'session process-group custody is malformed' };
  for (const group of owner.groups) if (alive(-group) !== 'dead') return { owner, state: 'unknown', reason: 'a registered session process group may still be live' };
  const groupState = alive(-owner.group);
  if (groupState !== 'dead') return { owner, state: 'unknown', reason: 'owner is dead but its process group may still contain a live child' };
  return { owner, state: 'dead', reason: 'owner and isolated process group are gone; explicit recovery required' };
}
function acquire(root, key, purpose = 'study mutation') {
  const loc = locations(root, key);
  if (fs.existsSync(loc.guard)) throw error('RUN_BUSY', `${key}: recovery is in progress; nothing launched`);
  if (fs.existsSync(loc.file)) {
    const existing = inspect(root, key);
    throw error(existing?.state === 'dead' ? 'RUN_RECOVERY_REQUIRED' : 'RUN_BUSY', `${key}: ${existing?.reason || 'already claimed'}; nothing launched`);
  }
  fs.mkdirSync(loc.home, { recursive: true });
  const owner = { schema: 1, key, token: crypto.randomBytes(16).toString('hex'), pid: process.pid, host: os.hostname(), group: processGroup(), groups: [], created: new Date().toISOString(), purpose };
  // Publish complete metadata with exclusive hard-link creation. A killed writer cannot
  // expose truncated ownership; abandoned unique staging files never confer ownership.
  const tmp = contained(root, `.claims/staging.${owner.token}.json`);
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(owner)}\n`, { flag: 'wx', mode: 0o600 });
    try { fs.linkSync(tmp, loc.file); }
    catch (e) { if (e.code === 'EEXIST') throw error('RUN_BUSY', `${key}: another process claimed it; nothing launched`); throw e; }
    if (fs.existsSync(loc.guard)) { fs.unlinkSync(loc.file); throw error('RUN_BUSY', `${key}: recovery started; nothing launched`); }
  } finally { fs.rmSync(tmp, { force: true }); }
  return { root: path.resolve(root), key, owner };
}
function assertOwner(claim, root, key) {
  if (!claim || claim.root !== path.resolve(root) || claim.key !== key || claim.owner.pid !== process.pid) throw error('RUN_NOT_OWNER', `${key}: current process does not own this operation`);
  const current = inspect(root, key);
  if (!current?.owner || current.owner.token !== claim.owner.token) throw error('RUN_NOT_OWNER', `${key}: ownership changed`);
}
function registerGroup(claim, { pid, pgid }) {
  assertOwner(claim, claim.root, claim.key);
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid !== pgid || !['linux', 'darwin'].includes(process.platform)) throw error('CUSTODY_INVALID', 'Session supervisor must lead a supported isolated process group');
  let actual;
  try { actual = Number(execFileSync('ps', ['-o', 'pgid=', '-p', String(pid)], { encoding: 'utf8' }).trim()); } catch { throw error('CUSTODY_INVALID', 'Session supervisor identity is unavailable'); }
  if (actual !== pgid || alive(pid) !== 'alive') throw error('CUSTODY_INVALID', 'Session supervisor is not a live process-group leader');
  const owner = { ...claim.owner, groups: [...new Set([...claim.owner.groups, pgid])] };
  atomicWrite(locations(claim.root, claim.key).file, `${JSON.stringify(owner)}\n`);
  claim.owner = owner;
}
function release(claim) {
  assertOwner(claim, claim.root, claim.key);
  if (claim.owner.groups.some(group => alive(-group) !== 'dead')) throw error('CUSTODY_BUSY', 'A registered session group may still be live; ownership retained for investigation');
  fs.unlinkSync(locations(claim.root, claim.key).file);
}
function recover(root, key, { token, reason, beforeRelease } = {}) {
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) throw error('RECOVERY_REASON_REQUIRED', 'Explicit recovery requires a bounded operator reason');
  const initial = inspect(root, key);
  if (!initial?.owner || initial.owner.token !== token || initial.state !== 'dead') throw error('RECOVERY_REFUSED', `${key}: ${initial?.reason || 'no matching abandoned claim'}`);
  const guard = acquire(root, `recovery.${key}`, 'explicit dead-owner recovery');
  try {
    const current = inspect(root, key);
    if (current?.state !== 'dead' || current.owner.token !== token) throw error('RECOVERY_REFUSED', 'Ownership/liveness changed during recovery');
    const archive = contained(root, `.claims/recovered/${key}.${token}.json`);
    fs.mkdirSync(path.dirname(archive), { recursive: true });
    // Archive before removing ownership. Repeating after a crash preserves the first
    // decision; recovery never changes a record, workspace, payload or terminal status.
    const receipt = { owner: current.owner, recovered: new Date().toISOString(), reason, recovered_by: { pid: process.pid, host: os.hostname() }, launches: 0 };
    const staging = `${archive}.${crypto.randomBytes(16).toString('hex')}.tmp`;
    try {
      fs.writeFileSync(staging, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
      try { fs.linkSync(staging, archive); }
      catch (e) {
        if (e.code !== 'EEXIST') throw e;
        let previous;
        try { previous = JSON.parse(fs.readFileSync(archive, 'utf8')); } catch { throw error('RECOVERY_REFUSED', 'Existing recovery receipt is incomplete; preserve ownership for investigation'); }
        if (previous.owner?.token !== token || previous.owner?.key !== key || previous.launches !== 0 || !previous.reason) throw error('RECOVERY_REFUSED', 'Existing recovery receipt does not describe this owner');
      }
    } finally { fs.rmSync(staging, { force: true }); }
    // Keep both the abandoned claim and recovery guard through caller cleanup.
    if (beforeRelease) beforeRelease();
    fs.unlinkSync(locations(root, key).file);
    return { recovered: true, archive, launches: 0, next: 'Inspect retained checkpoints and explicitly choose resume or disposition; recovery itself launches nothing.' };
  } finally { release(guard); }
}
function atomicWrite(file, value) {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(16).toString('hex')}.tmp`;
  let fd;
  try {
    fd = fs.openSync(tmp, 'wx', 0o600); fs.writeFileSync(fd, value); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    fs.renameSync(tmp, file);
  } finally { if (fd !== undefined) fs.closeSync(fd); fs.rmSync(tmp, { force: true }); }
}
module.exports = { contained, acquire, assertOwner, release, inspect, recover, registerGroup, atomicWrite };
