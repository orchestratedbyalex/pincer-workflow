'use strict';
// T-121: exclusive custody of the shared study login directory (native-tool contracts §2.4).
//
// The user signs in once with `claude auth login` inside `<study root>/host/claude-config`.
// Every study invocation that probes, inspects or plants a canary in that directory holds one
// lock keyed by its canonical path, journals each intended and completed write durably in a
// control area OUTSIDE the credential directory, deletes only files whose owner, identity and
// digest still match the journal, and never reads a credential or cleans the directory
// recursively. A dead or unknown owner is a recovery decision, never a retry signal.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const claims = require('./run-claims.cjs');
const effective = require('./effective.cjs');

const LOGIN_DIR = 'host/claude-config';
const CONTROL_DIR = 'host/.login-custody';
// Entry names the pinned CLI is expected to own inside its configuration directory. Names
// only: the launcher never opens, sizes or hashes these files.
const ALLOWED_ENTRIES = Object.freeze(['.credentials.json', '.claude.json', '.claude.json.backup', 'statsig', 'todos', 'projects', 'debug', 'shell-snapshots', 'session-env', 'history.jsonl', 'cache', 'ide', 'file-history', 'paste-cache', 'plans', 'sessions', 'telemetry', 'downloads', 'backups']);
// Names that would change what a session loads. Any of these, or any name not listed above,
// is a specific blocker: the login directory holds configuration, not only a login.
const DIRTY_ENTRIES = Object.freeze(['settings.json', 'settings.local.json', 'CLAUDE.md', 'hooks', 'commands', 'agents', 'skills', 'plugins', '.mcp.json']);
const CANARY_FILES = Object.freeze(['settings.json', 'CLAUDE.md']);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = (code, detail) => { throw Object.assign(new Error(detail), { code }); };
const iso = () => new Date().toISOString();

function processStart(pid) {
  if (!['linux', 'darwin'].includes(process.platform)) return null;
  try { return execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', timeout: 5000 }).trim() || null; }
  catch { return null; }
}
// The canonical login directory: a fixed relative location under the study root, no symbolic
// link at any segment, an existing directory, and never inside the operator's home.
function loginDirectory(inputRoot) {
  let full;
  try { full = effective.contained(inputRoot, LOGIN_DIR); }
  catch (error) { fail('LOGIN_DIR_INVALID', /symbolic/.test(error.message) ? 'the study login directory path contains a symbolic link' : 'the study login directory does not exist; create <study root>/host/claude-config and sign in there with the pinned CLI'); }
  let stat;
  try { stat = fs.lstatSync(full); } catch { fail('LOGIN_DIR_INVALID', 'the study login directory does not exist; create <study root>/host/claude-config and sign in there with the pinned CLI'); }
  if (stat.isSymbolicLink()) fail('LOGIN_DIR_INVALID', 'the study login directory must not be a symbolic link');
  if (!stat.isDirectory()) fail('LOGIN_DIR_INVALID', 'the study login directory is not a directory');
  const canonical = fs.realpathSync(full);
  const home = fs.realpathSync(os.homedir());
  const relative = path.relative(home, canonical);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) fail('LOGIN_DIR_INVALID', 'the study login directory must lie outside the operator home directory; the operator configuration is never used');
  return { path: canonical, digest: sha256(canonical), relative: LOGIN_DIR };
}
function controlArea(inputRoot) {
  const root = fs.realpathSync(inputRoot);
  const control = path.join(root, ...CONTROL_DIR.split('/'));
  for (const part of [path.join(root, 'host'), control]) {
    if (fs.existsSync(part)) { if (fs.lstatSync(part).isSymbolicLink()) fail('LOGIN_DIR_INVALID', 'the login custody control area must not be a symbolic link'); }
    else fs.mkdirSync(part, { mode: 0o700 });
  }
  return control;
}
const lockKey = login => `login.${login.digest.slice(0, 32)}`;
const markerPath = control => path.join(control, 'recovery-required.json');
const journalPath = (control, token) => path.join(control, 'journal', `${token}.json`);
// Names only, through directory entries: no stat of a credential file, no content read.
function inspectEntries(loginDir) {
  const entries = fs.readdirSync(loginDir, { withFileTypes: true });
  const names = entries.map(entry => entry.name).sort();
  const dirty = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) dirty.push(`${entry.name} (symbolic link)`);
    else if (DIRTY_ENTRIES.includes(entry.name) || !ALLOWED_ENTRIES.includes(entry.name)) dirty.push(entry.name);
  }
  return { entries: names, dirty: dirty.sort() };
}
function requireClean(loginDir, ownedCanaries = []) {
  const { entries, dirty } = inspectEntries(loginDir);
  const unexpected = dirty.filter(name => !(CANARY_FILES.includes(name) && ownedCanaries.includes(name)));
  if (unexpected.length) fail('PROFILE_HOST_DIRTY', `the study login directory holds configuration the session would load: ${unexpected.join(', ')}; remove it (or sign in to a fresh directory) before launching`);
  return entries;
}
function writeJournal(handle) {
  fs.mkdirSync(path.dirname(handle.journalPath), { recursive: true, mode: 0o700 });
  claims.atomicWrite(handle.journalPath, `${JSON.stringify(handle.journal, null, 2)}\n`);
}
function readJournal(control, token) {
  if (!/^[a-f0-9]{32}$/.test(token || '')) fail('LOGIN_DIR_RECOVERY_REFUSED', 'a journal token is required');
  let journal;
  try { journal = JSON.parse(fs.readFileSync(journalPath(control, token), 'utf8')); }
  catch { fail('LOGIN_DIR_RECOVERY_REFUSED', 'the custody journal for that token is missing or unreadable; preserve the directory for manual review'); }
  if (journal.schema !== 1 || journal.kind !== 'login-directory-custody' || journal.owner?.token !== token) fail('LOGIN_DIR_RECOVERY_REFUSED', 'the custody journal does not describe that owner');
  return journal;
}
function writeMarker(control, value) { claims.atomicWrite(markerPath(control), `${JSON.stringify(value, null, 2)}\n`); }
function readMarker(control) {
  if (!fs.existsSync(markerPath(control))) return null;
  try { return JSON.parse(fs.readFileSync(markerPath(control), 'utf8')); }
  catch { return { schema: 1, unreadable: true, reason: 'the recovery marker is unreadable' }; }
}
// Acquire exclusive custody. Aliases of the same directory share the lock because the key is
// the digest of the canonical path and the control area lives under the canonical study root.
function acquire(inputRoot, ids = {}) {
  const login = loginDirectory(inputRoot);
  const control = controlArea(inputRoot);
  const marker = readMarker(control);
  if (marker) fail('LOGIN_DIR_RECOVERY_REQUIRED', `a previous session left the login directory in an uncertain state (${marker.reason || 'unreadable recovery marker'}); record an explicit recovery decision before any launch`);
  const key = lockKey(login);
  let claim;
  try { claim = claims.acquire(control, key, 'login directory custody'); }
  catch (error) {
    if (error.code === 'RUN_RECOVERY_REQUIRED') fail('LOGIN_DIR_RECOVERY_REQUIRED', 'the previous custody owner is gone without a release receipt; record an explicit recovery decision before any launch');
    if (error.code === 'RUN_BUSY') fail('LOGIN_DIR_BUSY', 'another study invocation holds the login directory; no task was launched');
    throw error;
  }
  const token = claim.owner.token;
  const handle = {
    inputRoot: fs.realpathSync(inputRoot), loginDir: login.path, control, key, claim, token, journalPath: journalPath(control, token),
    journal: {
      schema: 1, kind: 'login-directory-custody', login_dir: login.path, login_dir_digest: login.digest,
      owner: { pid: process.pid, host: os.hostname(), token, process_start: new Date(Date.now() - process.uptime() * 1000).toISOString(), process_start_ps: processStart(process.pid) },
      ids: { ...ids }, created: iso(), state: 'held', canaries: [], receipts: [],
    },
  };
  try { writeJournal(handle); }
  catch (error) { try { claims.release(claim); } catch {} throw error; }
  return handle;
}
function annotate(handle, ids) { handle.journal.ids = { ...handle.journal.ids, ...ids }; writeJournal(handle); }
// A second process (the session supervisor) verifies that its parent holds custody. It never
// acquires, steals or releases the lock.
function verifyHeld(inputRoot, custody, { ownerPid = process.pid } = {}) {
  const login = loginDirectory(inputRoot);
  const control = controlArea(inputRoot);
  if (!custody || custody.key !== lockKey(login) || !/^[a-f0-9]{32}$/.test(custody.token || '')) fail('LOGIN_DIR_CUSTODY_INVALID', 'a matching login directory custody handle is required');
  const current = claims.inspect(control, custody.key);
  if (!current?.owner || current.owner.token !== custody.token || current.owner.pid !== ownerPid || current.state !== 'alive') fail('LOGIN_DIR_CUSTODY_INVALID', 'login directory custody is not held by the launching process');
  if (readMarker(control)) fail('LOGIN_DIR_RECOVERY_REQUIRED', 'the login directory requires an explicit recovery decision');
  return { loginDir: login.path, key: custody.key, token: custody.token, journal: readJournal(control, custody.token) };
}
function identity(file) {
  const stat = fs.lstatSync(file);
  return { dev: stat.dev, ino: stat.ino, symlink: stat.isSymbolicLink(), file: stat.isFile() };
}
// Plant owned synthetic files with exclusive creation only. Intent precedes every write; the
// receipt (identity and digest) follows it. `io.afterWrite` exists so a suite can interrupt
// between the write and its receipt and prove the file is then preserved, not deleted.
function plant(handle, files, io = {}) {
  const planted = [];
  for (const [name, content] of Object.entries(files)) {
    if (!CANARY_FILES.includes(name)) fail('LOGIN_DIR_CANARY_INVALID', 'only the declared canary file names may be planted');
    const target = path.join(handle.loginDir, name);
    if (fs.existsSync(target) || (() => { try { fs.lstatSync(target); return true; } catch { return false; } })()) return preserveAndStop(handle, name, target, 'an entry with the canary name appeared after the directory inspection');
    const entry = { name, path: target, state: 'intended', digest: sha256(content), dev: null, ino: null, at: iso() };
    handle.journal.canaries.push(entry);
    writeJournal(handle);
    try { (io.writeFileSync || fs.writeFileSync)(target, content, { flag: 'wx', mode: 0o600 }); }
    catch (error) { return preserveAndStop(handle, name, target, error.code === 'EEXIST' ? 'exclusive creation found an existing file' : 'the canary could not be written'); }
    if (typeof io.afterWrite === 'function') io.afterWrite(name, target);
    const id = identity(target);
    entry.state = 'created'; entry.dev = id.dev; entry.ino = id.ino; entry.at = iso();
    writeJournal(handle);
    planted.push(name);
  }
  return planted;
}
function preserveAndStop(handle, name, target, detail) {
  const entry = handle.journal.canaries.find(c => c.name === name) || { name, path: target, state: 'intended', digest: null, dev: null, ino: null };
  if (!handle.journal.canaries.includes(entry)) handle.journal.canaries.push(entry);
  entry.state = 'preserved'; entry.detail = detail; entry.at = iso();
  handle.journal.state = 'recovery-required';
  writeJournal(handle);
  writeMarker(handle.control, { schema: 1, token: handle.token, reason: `${name}: ${detail}`, at: iso() });
  fail('LOGIN_DIR_RECOVERY_REQUIRED', `${name}: ${detail}; the file is preserved and the allocation must stop until an explicit recovery decision`);
}
// Delete only what still matches the journal, one file at a time, with a custody-safe check
// of identity and content. Anything else stays where it is and stops the allocation.
function verifiedOwned(entry, io = {}) {
  let id;
  try { id = identity(entry.path); } catch (error) { return { ok: false, detail: error.code === 'ENOENT' ? 'the owned canary is missing' : 'the owned canary cannot be inspected' }; }
  if (id.symlink) return { ok: false, detail: 'the owned canary was replaced by a symbolic link' };
  if (!id.file) return { ok: false, detail: 'the owned canary is no longer a regular file' };
  if (id.dev !== entry.dev || id.ino !== entry.ino) return { ok: false, detail: 'the owned canary was replaced by another file' };
  let digest;
  try { digest = sha256((io.readFileSync || fs.readFileSync)(entry.path)); } catch { return { ok: false, detail: 'the owned canary cannot be read' }; }
  if (digest !== entry.digest) return { ok: false, detail: 'the owned canary content changed' };
  return { ok: true };
}
// Never unlink a mutable login-directory pathname. Move it atomically into a private,
// journaled quarantine, then verify the moved object. Even verified canaries are retained:
// there is no later check/unlink race. A replacement is preserved and restored without
// overwriting any newer destination. Quarantine is outside the CLI configuration tree.
function retireOwned(handle, entry, io = {}) {
  if (!entry.quarantine) {
    const dir = fs.mkdtempSync(path.join(handle.control, 'canary-'));
    entry.quarantine = path.join(dir, entry.name);
    writeJournal(handle); // intent precedes rename; interruption is recoverable
  }
  const exists = file => { try { fs.lstatSync(file); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };
  if (!exists(entry.quarantine)) {
    // Inspect before moving too: known replacements stay at their original path.
    const before = verifiedOwned(entry, io);
    if (!before.ok) return before;
    try { (io.renameSync || fs.renameSync)(entry.path, entry.quarantine); }
    catch { return { ok: false, detail: 'the owned canary could not be quarantined' }; }
  }
  const verdict = verifiedOwned({ ...entry, path: entry.quarantine }, io);
  if (!verdict.ok) {
    // link is exclusive; unlike rename it cannot overwrite a new destination.
    try { fs.linkSync(entry.quarantine, entry.path); } catch {}
    return { ok: false, detail: `${verdict.detail}; retained at ${entry.quarantine}` };
  }
  if (exists(entry.path)) return { ok: false, detail: 'a new entry appeared after quarantine; both entries preserved' };
  return { ok: true };
}
function remove(handle, io = {}) {
  const removed = [], preserved = [];
  for (const entry of handle.journal.canaries) {
    if (entry.state === 'removed') continue;
    if (entry.state !== 'created') { preserved.push({ name: entry.name, detail: entry.detail || 'ownership of this file is uncertain' }); continue; }
    const verdict = retireOwned(handle, entry, io);
    if (verdict.ok) { entry.state = 'removed'; entry.at = iso(); removed.push(entry.name); }
    else { entry.state = 'preserved'; entry.detail = verdict.detail; entry.at = iso(); preserved.push({ name: entry.name, detail: verdict.detail }); }
    writeJournal(handle);
  }
  writeJournal(handle);
  const recovery = preserved.length > 0;
  if (recovery) {
    handle.journal.state = 'recovery-required';
    writeJournal(handle);
    writeMarker(handle.control, { schema: 1, token: handle.token, reason: preserved.map(p => `${p.name}: ${p.detail}`).join('; '), at: iso() });
  }
  return { removed, preserved, recovery_required: recovery };
}
function registerGroup(handle, group) { claims.registerGroup(handle.claim, group); }
// Custody is released only after a durable receipt. A recovery-required outcome keeps the
// marker (written before release), so the next acquisition is refused until a decision.
function release(handle, outcome = {}) {
  const receipt = { at: iso(), outcome: outcome.recovery_required ? 'recovery-required' : 'released', ...(outcome.detail ? { detail: String(outcome.detail).slice(0, 200) } : {}) };
  handle.journal.receipts.push(receipt);
  if (outcome.recovery_required && !readMarker(handle.control)) writeMarker(handle.control, { schema: 1, token: handle.token, reason: receipt.detail || 'cleanup did not complete', at: receipt.at });
  handle.journal.state = readMarker(handle.control) ? 'recovery-required' : 'released';
  writeJournal(handle);
  claims.release(handle.claim);
  return receipt;
}
// Read-only view for the launcher record and the operator.
function status(inputRoot) {
  const login = loginDirectory(inputRoot);
  const control = controlArea(inputRoot);
  const owner = claims.inspect(control, lockKey(login));
  const marker = readMarker(control);
  return { login_dir: login.path, key: lockKey(login), held: Boolean(owner?.owner), owner_state: owner?.state || null, recovery_required: Boolean(marker), recovery_reason: marker?.reason || null };
}
function ownerState(control, key, journal) {
  const current = claims.inspect(control, key);
  if (!current) return { state: 'released' };
  if (current.state === 'alive' && journal?.owner?.process_start_ps && current.owner?.pid) {
    const now = processStart(current.owner.pid);
    if (now && now !== journal.owner.process_start_ps) return { ...current, state: 'unknown', reason: 'the owner PID was reused by another process; custody cannot be established' };
  }
  return current;
}
// Explicit recovery: requires the owner proven gone (or released), a recorded reason and the
// owner token. It removes only verified unchanged owned canaries, preserves everything else,
// reads no credential, and leaves a durable receipt. Preserved files keep the directory dirty
// until a person removes them; recovery never does that.
function recover(inputRoot, { token, reason } = {}) {
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) fail('LOGIN_DIR_RECOVERY_REFUSED', 'explicit recovery requires a bounded operator reason');
  const login = loginDirectory(inputRoot);
  const control = controlArea(inputRoot);
  const key = lockKey(login);
  const journal = readJournal(control, token);
  if (journal.login_dir !== login.path) fail('LOGIN_DIR_RECOVERY_REFUSED', 'the journal describes a different login directory');
  const owner = ownerState(control, key, journal);
  if (owner.state === 'alive' || owner.state === 'unknown') fail('LOGIN_DIR_RECOVERY_REFUSED', `custody owner ${owner.state}: ${owner.reason || 'termination is not proven'}; recovery is blocked`);
  const marker = readMarker(control);
  if (marker && marker.token !== token) fail('LOGIN_DIR_RECOVERY_REFUSED', 'the recovery marker belongs to another journal');
  const cleanup = () => {
    const currentMarker = readMarker(control);
    if (currentMarker && currentMarker.token !== token) fail('LOGIN_DIR_RECOVERY_REFUSED', 'recovery marker changed');
    writeMarker(control, { schema: 1, token, reason: 'explicit recovery in progress', at: iso() });
    const handle = { inputRoot: fs.realpathSync(inputRoot), loginDir: login.path, control, key, token, journalPath: journalPath(control, token), journal };
    const removed = [], preserved = [];
    for (const entry of journal.canaries) {
      if (entry.state === 'removed') continue;
      // Created, or preserved after a cleanup fault with its receipt intact: re-verify identity
      // and digest now; only an unchanged owned file may go.
      if (entry.state === 'created' || (entry.state === 'preserved' && entry.dev !== null && entry.digest)) {
        const verdict = retireOwned(handle, entry);
        if (verdict.ok) { entry.state = 'removed'; entry.at = iso(); removed.push(entry.name); continue; }
        entry.state = 'preserved'; entry.detail = verdict.detail;
      } else if (entry.state === 'intended') {
        // Create-before-receipt crash: a file may or may not be ours. Never delete it.
        entry.state = 'preserved'; entry.detail = fs.existsSync(entry.path) ? 'written without a receipt; ownership uncertain, preserved for manual review' : 'never written';
        if (entry.detail === 'never written') { entry.state = 'removed'; continue; }
      }
      entry.at = iso();
      preserved.push({ name: entry.name, detail: entry.detail });
    }
    journal.state = 'recovered';
    journal.recovery = { at: iso(), reason, by: { pid: process.pid, host: os.hostname() }, removed, preserved };
    writeJournal(handle);
    fs.rmSync(markerPath(control), { force: true });
    return { recovered: true, removed, preserved, next: preserved.length ? 'Preserved files stay in the login directory; the next launch is refused as PROFILE_HOST_DIRTY until a person reviews and removes them. Recovery launches nothing.' : 'The login directory holds no owned canary; the next launch may proceed after its own inspection. Recovery launches nothing.' };
  };
  let result;
  if (owner.state === 'dead') {
    if (owner.owner.token !== token) fail('LOGIN_DIR_RECOVERY_REFUSED', 'the lock belongs to another journal');
    claims.recover(control, key, { token, reason, beforeRelease: () => { result = cleanup(); } });
  } else {
    // A released claim still needs a recovery guard. Normal acquire checks this guard
    // both before and after publishing its claim, closing the acquisition race.
    const guard = claims.acquire(control, `recovery.${key}`, 'login directory recovery');
    try {
      if (claims.inspect(control, key)) fail('LOGIN_DIR_RECOVERY_REFUSED', 'custody changed before recovery');
      result = cleanup();
    } finally { claims.release(guard); }
  }
  return result;
}
module.exports = { LOGIN_DIR, CONTROL_DIR, ALLOWED_ENTRIES, DIRTY_ENTRIES, CANARY_FILES, loginDirectory, controlArea, inspectEntries, requireClean, acquire, annotate, registerGroup, verifyHeld, plant, remove, release, status, recover, readJournal };
