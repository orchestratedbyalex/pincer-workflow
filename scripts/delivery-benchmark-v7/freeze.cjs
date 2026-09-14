'use strict';
// PRD v7 T-88 (R-02, S-06) / T-94 (R-08, S-24) — the execution freeze.
//
// The v6 study re-froze its harness between runs #7 and #8 and re-evaluated earlier
// runs under the new freeze. That is disclosed in docs/trial-prd-v6.md and it is the
// specific methodological hole v7 closes: here a changed input does not re-date the
// study, it **starts a new cohort**, and records already written keep the cohort they
// were run under. There is no re-freeze-and-re-evaluate path.
//
// A cohort identity is a digest over everything that determines what a session sees
// or how its result is judged: the protocol prose, the harness, each brief and its
// evaluator, the effort collector, the live driver, the caps and the configuration
// fingerprint. Mutating any one of them changes the identity, which is what makes
// "this run belongs to this cohort" a checkable claim rather than an assurance.
//
// Two things this deliberately does NOT do. It does not hash secret values — a
// configuration fingerprint is built from an allowlist of non-secret settings and
// records the *names* of environment variables, never their contents, because a hash
// of a secret is still an oracle for it. And it does not read anything outside the
// repository root: a frozen input that resolves through a symlink or out of the tree
// is rejected, not followed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SCHEMA = 1;
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

// The only configuration keys that may be captured. Anything else is dropped rather
// than recorded, so adding a field is a deliberate edit to this list.
const CONFIG_ALLOWLIST = [
  'model', 'tool', 'tool_version', 'node_version', 'os', 'platform_release',
  'cwd_kind', 'permission_mode', 'max_turns', 'wall_clock_minutes',
];
// Values that look like credentials never reach a record, redacted or hashed.
const SECRET_KEY = /(^|_)(secret|token|key|password|passwd|credential|auth|cookie|session)(_|$)/i;
const SECRET_VALUE = [
  /\bsk-[A-Za-z0-9_-]{16,}/,            // OpenAI-style
  /\bsk-ant-[A-Za-z0-9_-]{16,}/,        // Anthropic-style
  /\bgh[pousr]_[A-Za-z0-9]{16,}/,       // GitHub
  /\bAKIA[0-9A-Z]{16}\b/,               // AWS access key id
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

function secretIn(value) {
  if (typeof value !== 'string') return null;
  for (const re of SECRET_VALUE) if (re.test(value)) return `matches ${re.source}`;
  return null;
}

// --- Tree digests ----------------------------------------------------------------------
// Repository-relative, sorted, symlink-refusing. The digest is over
// "<rel>\n<sha256(content)>\n" lines so a rename changes it as surely as an edit.
function walk(root, rel, out) {
  const full = path.join(root, rel);
  const stat = fs.lstatSync(full);
  if (stat.isSymbolicLink()) throw new Error(`${rel}: is a symbolic link; frozen inputs are read from the tree, never followed out of it`);
  if (stat.isFile()) { out.push(rel); return out; }
  if (!stat.isDirectory()) throw new Error(`${rel}: not a regular file or directory`);
  for (const e of fs.readdirSync(full, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    walk(root, rel ? `${rel}/${e.name}` : e.name, out);
  }
  return out;
}
function unsafe(rel) {
  if (typeof rel !== 'string' || rel === '' || rel.startsWith('/')) return 'must be a nonempty repository-relative path';
  if (rel.includes('\\')) return 'backslashes are not allowed';
  if (rel.split('/').some(s => s === '' || s === '.' || s === '..')) return 'must be normalized (no "..", "." or empty segments)';
  return null;
}
// digestOf(root, rel) → { digest, files: { rel: sha256 } }
function digestOf(root, rel) {
  const problem = unsafe(rel);
  if (problem) throw new Error(`${rel}: ${problem}`);
  const files = walk(root, rel, []);
  const entries = files.map(f => [f, sha256(fs.readFileSync(path.join(root, f)))]);
  return { digest: sha256(entries.map(([f, d]) => `${f}\n${d}\n`).join('')), files: Object.fromEntries(entries) };
}

// --- Configuration fingerprint ----------------------------------------------------------
// Allowlisted values plus the NAMES of environment variables the driver sets. A key
// whose name looks secret, or whose value looks like a credential, is refused: a run
// whose configuration carries a secret is a collection bug to fix, not something to
// quietly redact and report anyway.
function fingerprint(config, { env = [] } = {}) {
  const kept = {};
  const rejected = [];
  for (const key of CONFIG_ALLOWLIST) {
    if (!(key in config)) continue;
    const value = config[key];
    if (value === null || value === undefined) continue;
    const why = secretIn(value);
    if (why) { rejected.push({ key, reason: `value ${why}` }); continue; }
    kept[key] = value;
  }
  for (const key of Object.keys(config)) {
    if (CONFIG_ALLOWLIST.includes(key)) continue;
    rejected.push({ key, reason: SECRET_KEY.test(key) ? 'name suggests a credential' : 'not in the configuration allowlist' });
  }
  // Environment variables contribute their names only, never their values. An entry
  // that is not a bare name is refused WITHOUT being echoed: the common way this goes
  // wrong is someone passing "NAME=value", and repeating that string in the rejection
  // would put the value into the record the rejection exists to keep it out of.
  const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const names = [...new Set(env)].sort();
  const safeNames = names.filter(n => typeof n === 'string' && NAME.test(n));
  const bad = names.length - safeNames.length;
  if (bad) rejected.push({ key: `(${bad} entr${bad === 1 ? 'y' : 'ies'} not reported)`, reason: 'not an environment variable name; the entry is not echoed in case it carries a value' });
  const canonical = `${JSON.stringify(kept, Object.keys(kept).sort())}\n${safeNames.join(',')}\n`;
  return { digest: sha256(canonical), configuration: kept, env_names: safeNames, rejected };
}

// --- The freeze -------------------------------------------------------------------------
// compute(root, { protocol, harness, briefs, collector, driver, caps, configuration })
// where each path is repository-relative. Returns the frozen manifest, whose `cohort`
// is the identity every record of the study must carry.
function compute(root, { protocol, harness, briefs, collector, driver, caps, configuration }) {
  const inputs = {};
  inputs.protocol = digestOf(root, protocol).digest;
  // `harness` may be one path or a list of them: the execution path is a set of modules,
  // not necessarily a directory, and naming them keeps unrelated neighbours out of the
  // identity. A list is digested in the order given, so reordering it is a change too.
  const harnessPaths = Array.isArray(harness) ? harness : [harness];
  inputs.harness = sha256(harnessPaths.map(rel => `${rel}\n${digestOf(root, rel).digest}\n`).join(''));
  inputs.collector = digestOf(root, collector).digest;
  inputs.driver = digestOf(root, driver).digest;
  const briefDigests = {};
  const root_ = path.join(root, briefs);
  const ids = fs.readdirSync(root_, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
  for (const id of ids) {
    const whole = digestOf(root, `${briefs}/${id}`);
    // The evaluator is digested separately as well: a change to a brief's prompt is a
    // different thing from a change to how it is judged, and reports must distinguish
    // "the task changed" from "the judgment changed".
    const evaluatorFiles = Object.entries(whole.files).filter(([rel]) => rel.startsWith(`${briefs}/${id}/evaluator/`));
    briefDigests[id] = {
      digest: whole.digest,
      evaluator: sha256(evaluatorFiles.map(([rel, d]) => `${rel}\n${d}\n`).join('')),
      files: whole.files,
    };
  }
  inputs.briefs = sha256(ids.map(id => `${id}\n${briefDigests[id].digest}\n`).join(''));
  inputs.evaluators = sha256(ids.map(id => `${id}\n${briefDigests[id].evaluator}\n`).join(''));
  // Caps are part of the execution path: the same task under a different turn limit is
  // a different experiment.
  inputs.caps = sha256(JSON.stringify(caps, Object.keys(caps).sort()));
  const config = fingerprint(configuration.values || {}, { env: configuration.env || [] });
  inputs.configuration = config.digest;
  const order = ['protocol', 'harness', 'briefs', 'evaluators', 'collector', 'driver', 'caps', 'configuration'];
  const cohort = sha256(order.map(k => `${k}\n${inputs[k]}\n`).join(''));
  return { schema: SCHEMA, cohort, inputs, order, briefs: briefDigests, caps, configuration: { ...config } };
}

// What changed between two freezes, and therefore why the cohort differs. Reported so a
// study can say "the evaluator changed" rather than only "the identity changed".
function difference(before, after) {
  if (!before || !after) return { same: false, changed: ['(missing manifest)'] };
  const changed = before.order.filter(k => before.inputs[k] !== after.inputs[k]);
  const briefs = [];
  for (const id of new Set([...Object.keys(before.briefs), ...Object.keys(after.briefs)])) {
    const b = before.briefs[id], a = after.briefs[id];
    if (!b) briefs.push({ id, change: 'added' });
    else if (!a) briefs.push({ id, change: 'removed' });
    else if (b.digest !== a.digest) briefs.push({ id, change: b.evaluator !== a.evaluator ? 'evaluator changed' : 'task changed' });
  }
  return { same: before.cohort === after.cohort && !changed.length, cohort_before: before.cohort, cohort_after: after.cohort, changed, briefs };
}

// A record may be reported under a freeze only if it names that cohort. A record from
// an earlier cohort is not re-evaluated; it is reported under its own.
function belongs(record, frozen) {
  if (!frozen || !record) return { ok: false, reason: 'no frozen manifest' };
  if (record.cohort !== frozen.cohort) return { ok: false, reason: `record cohort ${String(record.cohort).slice(0, 12)} is not this cohort ${frozen.cohort.slice(0, 12)}; it belongs to the study it was run under and is not re-evaluated here` };
  return { ok: true, reason: null };
}

module.exports = { SCHEMA, CONFIG_ALLOWLIST, SECRET_KEY, SECRET_VALUE, sha256, secretIn, unsafe, digestOf, fingerprint, compute, difference, belongs };
