'use strict';
// PINCER engine — the evidence manifest, schema 1 (docs/engine.md, "Evidence
// manifest schema 1"): which checks ran for a candidate, with their logs, and
// the digests that prove the logs are the ones recorded. Validation reads the
// manifest's directory and the spec it names; it never runs a check.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SCHEMA = 1;
const HEX40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const CHECK_ID = /^C-[0-9]{2,6}$/;
const TOP_KEYS = ['schema', 'candidate', 'base', 'created', 'spec', 'environment', 'checks', 'visual_review', 'artifacts'];
const ENV_KEYS = ['tools', 'limitations'];
const CHECK_KEYS = ['id', 'kind', 'required', 'result', 'command', 'log', 'note'];
const VISUAL_KEYS = ['applicable', 'reason'];
const KINDS = ['command', 'review', 'visual'];
const RESULTS = ['passed', 'failed', 'unverified'];
const MAX_TEXT = 2000; // guard against pasted environment dumps

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const shortText = (v) => typeof v === 'string' && v.length <= MAX_TEXT;
const nonempty = (v) => shortText(v) && v.trim() !== '';

const digestFile = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// Why a relative POSIX path is unsafe, or null when it is acceptable.
function unsafePath(p) {
  if (p.startsWith('/')) return 'absolute paths are not allowed';
  if (/^[A-Za-z]:/.test(p)) return 'drive-letter paths are not allowed';
  if (p.includes('\\')) return 'backslashes are not allowed; use relative POSIX paths';
  if (p.split('/').some((s) => s === '' || s === '.' || s === '..')) return 'path must be normalized and relative (no "..", "." or empty segments)';
  return null;
}
// Is `p`, relative to `dir`, inside `dir`?
function inside(dir, p) {
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) return false;
  const target = path.resolve(dir, p);
  return target.startsWith(dir + path.sep);
}

// Every problem with the manifest at manifestPath (absolute, or relative to
// root); [] when it is valid. `candidate`, when given, must equal the
// manifest's.
function validate(root, manifestPath, { candidate } = {}) {
  const abs = path.isAbsolute(manifestPath) ? manifestPath : path.join(root, manifestPath);
  const dir = path.dirname(abs);
  let raw;
  try { raw = fs.readFileSync(abs, 'utf8'); } catch (error) {
    return [error.code === 'ENOENT' ? 'manifest does not exist — run /pincer-evaluate to write evidence for this candidate' : `cannot read the manifest (${error.message})`];
  }
  let doc;
  try { doc = JSON.parse(raw); } catch (error) { return [`malformed JSON (${error.message})`]; }
  if (!isObject(doc)) return ['the manifest must be a JSON object'];
  if (doc.schema !== SCHEMA) return [`unknown evidence schema ${JSON.stringify(doc.schema)} — this engine validates schema ${SCHEMA}`];

  const problems = [];
  const problem = (message) => problems.push(message);
  for (const key of Object.keys(doc)) if (!TOP_KEYS.includes(key)) problem(`unknown top-level key "${key}"`);
  for (const key of TOP_KEYS) if (!(key in doc)) problem(`missing "${key}"`);

  // The candidate: a commit, the directory the manifest sits in, and the one asked for.
  const candidateOk = typeof doc.candidate === 'string' && HEX40.test(doc.candidate);
  if (!candidateOk) problem('candidate must be a full 40-hex commit ID');
  else if (path.basename(dir) !== doc.candidate) problem(`candidate ${doc.candidate} is not the manifest's directory name (${path.basename(dir)}) — the manifest lives at <evidence home>/<candidate>/manifest.json`);
  if (candidateOk && candidate && doc.candidate !== candidate) problem(`candidate ${doc.candidate} is not the expected candidate ${candidate}`);
  if (typeof doc.base !== 'string' || !HEX40.test(doc.base)) problem('base must be a full 40-hex commit ID');
  if (typeof doc.created !== 'string' || !ISO_UTC.test(doc.created)) problem('created must be an ISO UTC timestamp (YYYY-MM-DDTHH:MM:SSZ)');

  // The spec, when the agreement has one.
  if (doc.spec !== null && doc.spec !== undefined) {
    if (!nonempty(doc.spec)) problem('spec must be a repository-relative path or null');
    else {
      const why = unsafePath(doc.spec);
      if (why) problem(`spec ${doc.spec}: ${why}`);
      else if (!fs.existsSync(path.join(root, doc.spec))) problem(`spec ${doc.spec} does not exist`);
    }
  }

  if (!isObject(doc.environment)) problem('environment must be an object {tools, limitations}');
  else {
    for (const key of ENV_KEYS) if (!Array.isArray(doc.environment[key]) || !doc.environment[key].every(shortText)) problem(`environment.${key} must be a list of strings`);
    for (const key of Object.keys(doc.environment)) if (!ENV_KEYS.includes(key)) problem(`environment.${key} is not allowed`);
  }

  // Artifacts: regular files inside the manifest's directory with matching digests.
  const artifacts = new Set();
  if (!isObject(doc.artifacts)) problem('artifacts must be an object {<path>: <sha256>} of files inside the evidence directory');
  else {
    for (const [p, digest] of Object.entries(doc.artifacts)) {
      if (!inside(dir, p)) { problem(`artifact ${p}: outside the evidence directory ${path.basename(dir)}/`); continue; }
      const why = unsafePath(p);
      if (why) { problem(`artifact ${p}: ${why}`); continue; }
      if (p === 'manifest.json') { problem('artifact manifest.json: the manifest cannot list itself'); continue; }
      artifacts.add(p);
      if (typeof digest !== 'string' || !SHA256.test(digest)) { problem(`artifact ${p}: sha256 must be a full 64-hex digest`); continue; }
      const target = path.join(dir, p);
      let stat;
      try { stat = fs.statSync(target); } catch { problem(`artifact ${p}: missing — no such file under the evidence directory`); continue; }
      if (!stat.isFile()) { problem(`artifact ${p}: not a regular file`); continue; }
      if (digestFile(target) !== digest) problem(`artifact ${p}: digest mismatch — the file changed after the evidence was recorded`);
    }
  }

  // Checks: C-NN ids, a kind, a result, a command for command checks, a listed log; required ones passed.
  if (!Array.isArray(doc.checks) || doc.checks.length === 0) problem('checks must be a non-empty array');
  else {
    const ids = new Set();
    doc.checks.forEach((check, index) => {
      const name = isObject(check) && typeof check.id === 'string' ? check.id : `#${index + 1}`;
      if (!isObject(check)) { problem(`check ${name}: must be an object`); return; }
      for (const key of Object.keys(check)) if (!CHECK_KEYS.includes(key)) problem(`check ${name}: key "${key}" is not allowed`);
      if (typeof check.id !== 'string' || !CHECK_ID.test(check.id)) problem(`check ${name}: id must be C-NN`);
      else if (ids.has(check.id)) problem(`duplicate check id ${check.id}`);
      else ids.add(check.id);
      if (!KINDS.includes(check.kind)) problem(`check ${name}: kind must be ${KINDS.join(', ')}`);
      if (typeof check.required !== 'boolean') problem(`check ${name}: required must be true or false`);
      if (!RESULTS.includes(check.result)) problem(`check ${name}: result must be ${RESULTS.join(', ')}`);
      if (check.kind === 'command') { if (!nonempty(check.command)) problem(`check ${name}: command must be the command line a command check ran`); }
      else if (!(check.command === null || check.command === undefined || shortText(check.command))) problem(`check ${name}: command must be a string or null`);
      if (check.log !== null && check.log !== undefined) {
        if (!nonempty(check.log)) problem(`check ${name}: log must be a path inside the evidence directory, or null`);
        else if (!artifacts.has(check.log)) problem(`check ${name}: log ${check.log} is not listed in artifacts`);
      }
      if ('note' in check && !shortText(check.note)) problem(`check ${name}: note must be a short string`);
      if (check.required === true && check.result !== 'passed') problem(`required check ${name} is ${check.result} — the candidate is not ready until it passes`);
    });
  }

  if (!isObject(doc.visual_review)) problem('visual_review must be an object {applicable, reason?}');
  else {
    const visual = doc.visual_review;
    for (const key of Object.keys(visual)) if (!VISUAL_KEYS.includes(key)) problem(`visual_review.${key} is not allowed`);
    if (typeof visual.applicable !== 'boolean') problem('visual_review.applicable must be true or false');
    else if (visual.applicable === false && !nonempty(visual.reason)) problem('visual_review.reason is required when visual review is not applicable (say why)');
  }
  return problems;
}

module.exports = { SCHEMA, validate, digestFile, unsafePath };
