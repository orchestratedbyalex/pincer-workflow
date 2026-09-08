#!/usr/bin/env node
'use strict';
// PINCER evidence — read-only validator for candidate evidence manifests
// (evidence schema 1). Dependency-free; runs under `node` on any platform.
//
//   node scripts/pincer-evidence.cjs validate .prd/evidence/prd-vN/<candidate>/manifest.json \
//        [--candidate <sha>] [--base <sha>] [--prd .prd/prd-vN.md] [--files]
//   node scripts/pincer-evidence.cjs digest <file>...
//
// `validate` exits 0 and prints `ok <candidate>` when the manifest is
// consistent; with --files it also lists the manifest and every artifact path
// (repository-relative, one per line). Otherwise it prints one
// `evidence: <manifest>: <reason>` line per problem to stderr and exits 1.
// Usage errors exit 2. Nothing is ever written.
//
// What validation establishes: that the locally authored record is internally
// consistent — schema, references, candidate association, required results,
// artifact existence and digests, repository containment. It is NOT independent
// attestation that the recorded commands ran or that images depict the stated
// application; that judgment stays with the reviewer.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const SCHEMA = 1;
const HEX40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const PRD_REF = /^\.prd\/prd-v([1-9][0-9]{0,8})\.md$/;
const MANIFEST_AT = /^\.prd\/evidence\/prd-v([1-9][0-9]{0,8})\/([0-9a-f]{40})\/manifest\.json$/;
// Requirement IDs are the PRD's own: R-01 from the template, or a supplied PRD's
// REQ-1 / AC-12 style, kept verbatim rather than renamed.
const REQ_ID = /^[A-Z][A-Z0-9]{0,7}-[0-9]{1,6}$/;
const TICKET_ID = /^T-[0-9]{2,6}$/;
const CHECK_ID = /^C-[0-9]{2,6}$/;
const IMAGE = /\.(png|jpe?g|webp)$/i;
const MAX_TEXT = 2000; // guard against pasted environment dumps
const TOP_KEYS = ['schema', 'prd', 'base', 'candidate', 'created', 'environment', 'coverage_review', 'requirements', 'checks', 'visual_review', 'artifacts'];
const ENV_KEYS = ['os', 'node', 'tools', 'limitations'];
const REQ_KEYS = ['id', 'disposition', 'tickets', 'checks', 'note', 'authorized_by'];
const CHECK_KEYS = ['id', 'kind', 'required', 'result', 'command', 'timestamp', 'artifacts', 'scenario', 'viewport', 'observed', 'note'];
const DISPOSITIONS = ['delivered', 'blocked', 'deferred'];
const KINDS = ['command', 'visual', 'review'];
const RESULTS = ['passed', 'failed', 'unverified'];

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const shortText = v => typeof v === 'string' && v.length <= MAX_TEXT;
const nonempty = v => shortText(v) && v.trim() !== '';
const toPosix = p => p.split(path.sep).join('/');

function repoRoot() {
  if (process.env.CLAUDE_PROJECT_DIR) return path.resolve(process.env.CLAUDE_PROJECT_DIR);
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return process.cwd();
  }
}

// Resolve through symlinks above the repository (macOS /var -> /private/var)
// without requiring the leaf to exist yet.
function realpathDeep(p) {
  try { return fs.realpathSync(p); } catch {
    const parent = path.dirname(p);
    return parent === p ? p : path.join(realpathDeep(parent), path.basename(p));
  }
}

function digestFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// Why a repository-relative path is unsafe, or null when it is acceptable.
function unsafePath(p) {
  if (p.startsWith('/')) return 'absolute paths are not allowed';
  if (/^[A-Za-z]:/.test(p)) return 'drive-letter paths are not allowed';
  if (p.includes('\\')) return 'backslashes are not allowed; use repository-relative POSIX paths';
  if (p.split('/').some(s => s === '' || s === '.' || s === '..')) return 'path must be normalized and repository-relative (no "..", "." or empty segments)';
  return null;
}

function validate(manifestArg, opts) {
  const root = realpathDeep(repoRoot());
  const abs = realpathDeep(path.resolve(manifestArg));
  const rel = toPosix(path.relative(root, abs));
  const at = rel.match(MANIFEST_AT);
  if (!at) return [`manifest must live at .prd/evidence/prd-vN/<candidate>/manifest.json inside the repository (got ${rel})`];
  const [, dirVersion, dirCandidate] = at;
  const dirRel = path.posix.dirname(rel);

  let raw;
  try { raw = fs.readFileSync(abs, 'utf8'); } catch { return ['missing — run /pincer-evaluate to write evidence for this candidate']; }
  let doc;
  try { doc = JSON.parse(raw); } catch (error) { return [`malformed JSON (${error.message})`]; }
  if (!isObject(doc)) return ['malformed: the manifest must be a JSON object'];
  if (doc.schema !== SCHEMA) return [`unknown evidence schema ${JSON.stringify(doc.schema)} — this runtime validates schema ${SCHEMA}`];

  const problems = [];
  const problem = message => problems.push(message);
  for (const key of Object.keys(doc)) if (!TOP_KEYS.includes(key)) problem(`unknown top-level key "${key}"`);
  for (const key of TOP_KEYS) if (!(key in doc)) problem(`missing "${key}"`);

  const prd = typeof doc.prd === 'string' ? doc.prd.match(PRD_REF) : null;
  if (!prd) problem('prd must be a reference of the form .prd/prd-vN.md');
  else if (prd[1] !== dirVersion) problem(`wrong PRD: manifest names ${doc.prd} but lives under prd-v${dirVersion}`);
  if (opts.prd && doc.prd !== opts.prd) problem(`wrong PRD: manifest is for ${doc.prd}, expected ${opts.prd}`);

  for (const key of ['base', 'candidate']) {
    if (typeof doc[key] !== 'string' || !HEX40.test(doc[key])) problem(`${key} must be a full 40-hex commit ID`);
  }
  if (typeof doc.candidate === 'string' && HEX40.test(doc.candidate) && doc.candidate !== dirCandidate) {
    problem(`wrong candidate: manifest names ${doc.candidate} but lives under ${dirCandidate}`);
  }
  if (opts.candidate && doc.candidate !== opts.candidate) problem(`wrong candidate: manifest is for ${doc.candidate}, expected ${opts.candidate}`);
  if (opts.base && doc.base !== opts.base) problem(`wrong base: manifest records ${doc.base}, expected ${opts.base}`);
  if (typeof doc.created !== 'string' || !ISO_UTC.test(doc.created)) problem('created must be an ISO-8601 UTC timestamp (YYYY-MM-DDTHH:MM:SSZ)');

  const env = doc.environment;
  if (!isObject(env)) problem('environment must be an object with os, node, tools and limitations');
  else {
    for (const key of ['os', 'node']) if (!nonempty(env[key])) problem(`environment.${key} must be a short nonempty string (redacted summary, not a dump)`);
    for (const key of ['tools', 'limitations']) {
      if (!Array.isArray(env[key]) || !env[key].every(nonempty)) problem(`environment.${key} must be an array of short strings`);
    }
    for (const key of Object.keys(env)) if (!ENV_KEYS.includes(key)) problem(`environment.${key} is not allowed — persist redacted summaries only`);
  }
  if (!nonempty(doc.coverage_review)) problem('coverage_review must be a nonempty string recording the reviewer judgment on requirement coverage');

  // Artifacts: repository-contained regular files with matching digests.
  const artifacts = new Map();
  if (!Array.isArray(doc.artifacts)) problem('artifacts must be an array of {path, sha256}');
  else doc.artifacts.forEach((entry, index) => {
    const label = `artifacts[${index}]`;
    if (!isObject(entry)) { problem(`${label} must be an object {path, sha256}`); return; }
    for (const key of Object.keys(entry)) if (!['path', 'sha256'].includes(key)) problem(`${label}.${key} is not allowed`);
    const p = entry.path;
    if (typeof p !== 'string' || p === '') { problem(`${label}.path must be a nonempty string`); return; }
    if (artifacts.has(p)) problem(`duplicate artifact path ${p}`);
    artifacts.set(p, false);
    const why = unsafePath(p);
    if (why) { problem(`artifact ${p}: ${why}`); return; }
    if (!p.startsWith(`${dirRel}/`)) { problem(`artifact ${p}: outside the evidence directory ${dirRel}/`); return; }
    const digestOk = typeof entry.sha256 === 'string' && SHA256.test(entry.sha256);
    if (!digestOk) problem(`artifact ${p}: sha256 must be a full 64-hex digest`);
    const segments = p.split('/');
    let current = root;
    for (let i = 0; i < segments.length; i++) {
      current = path.join(current, segments[i]);
      let stat;
      try { stat = fs.lstatSync(current); } catch { problem(`artifact ${p}: missing`); return; }
      const last = i === segments.length - 1;
      if (stat.isSymbolicLink()) {
        problem(last ? `artifact ${p}: is a symlink (only regular files inside the repository are accepted)` : `artifact ${p}: path component ${segments.slice(0, i + 1).join('/')} is a symlink`);
        return;
      }
      if (!last && !stat.isDirectory()) { problem(`artifact ${p}: ${segments.slice(0, i + 1).join('/')} is not a directory`); return; }
      if (last && !stat.isFile()) { problem(`artifact ${p}: not a regular file`); return; }
    }
    if (digestOk && digestFile(current) !== entry.sha256) problem(`artifact ${p}: digest mismatch — the file changed after the evidence was recorded`);
  });

  // Checks: what was run or judged, with results and artifact references.
  const checks = new Map();
  let visualChecks = 0;
  if (!Array.isArray(doc.checks)) problem('checks must be an array');
  else doc.checks.forEach((check, index) => {
    const label = `checks[${index}]`;
    if (!isObject(check)) { problem(`${label} must be an object`); return; }
    const id = typeof check.id === 'string' && CHECK_ID.test(check.id) ? check.id : null;
    if (!id) problem(`${label}.id must be a check ID such as C-01`);
    else if (checks.has(id)) problem(`duplicate check ID ${id}`);
    else checks.set(id, check);
    const name = id || label;
    for (const key of Object.keys(check)) if (!CHECK_KEYS.includes(key)) problem(`check ${name}: unknown key "${key}"`);
    if (!KINDS.includes(check.kind)) problem(`check ${name}: kind must be one of ${KINDS.join(', ')}`);
    if (typeof check.required !== 'boolean') problem(`check ${name}: required must be true or false`);
    if (!RESULTS.includes(check.result)) problem(`check ${name}: result must be one of ${RESULTS.join(', ')}`);
    if (typeof check.timestamp !== 'string' || !ISO_UTC.test(check.timestamp)) problem(`check ${name}: timestamp must be an ISO-8601 UTC timestamp`);
    if (check.kind === 'command' && !nonempty(check.command)) problem(`check ${name}: command kind requires the command that was run`);
    for (const key of ['command', 'scenario', 'viewport', 'observed', 'note']) {
      if (key in check && !shortText(check[key])) problem(`check ${name}: ${key} must be a short string`);
    }
    let images = 0;
    if (!Array.isArray(check.artifacts)) problem(`check ${name}: artifacts must be an array of repository-relative paths`);
    else for (const p of check.artifacts) {
      if (typeof p !== 'string') { problem(`check ${name}: artifact reference must be a string`); continue; }
      if (!artifacts.has(p)) problem(`check ${name}: references unlisted artifact ${p} (dangling reference)`);
      else artifacts.set(p, true);
      if (IMAGE.test(p)) images++;
    }
    if (check.kind === 'visual') {
      visualChecks++;
      for (const key of ['scenario', 'viewport', 'observed']) if (!nonempty(check[key])) problem(`check ${name}: visual check requires ${key}`);
      // A passed visual check must show its image; an unverified one (tool
      // unavailable) is recorded honestly without one and, when required, blocks.
      if (check.result === 'passed' && images === 0) problem(`check ${name}: a passed visual check requires a saved image artifact (.png, .jpg or .webp)`);
    }
    if (check.required === true && check.result !== 'passed') {
      problem(`required check ${name} is ${check.result} — readiness is blocked until it passes on a new candidate or the requirement is deferred with authorization`);
    }
  });
  for (const [p, referenced] of artifacts) if (!referenced) problem(`artifact ${p}: not referenced by any check`);

  // Requirements: every ID dispositioned; deferrals authorized; checks resolve.
  const requirements = new Set();
  if (!Array.isArray(doc.requirements) || doc.requirements.length === 0) problem('requirements must be a nonempty array — every PRD requirement needs a disposition');
  else doc.requirements.forEach((req, index) => {
    const label = `requirements[${index}]`;
    if (!isObject(req)) { problem(`${label} must be an object`); return; }
    const id = typeof req.id === 'string' && REQ_ID.test(req.id) ? req.id : null;
    if (!id) problem(`${label}.id must be a requirement ID such as R-01 or the PRD's own REQ-1 (uppercase prefix, dash, digits)`);
    else if (requirements.has(id)) problem(`duplicate requirement ID ${id}`);
    else requirements.add(id);
    const name = id || label;
    for (const key of Object.keys(req)) if (!REQ_KEYS.includes(key)) problem(`requirement ${name}: unknown key "${key}"`);
    if (!DISPOSITIONS.includes(req.disposition)) problem(`requirement ${name}: disposition must be one of ${DISPOSITIONS.join(', ')}`);
    if (!Array.isArray(req.tickets) || !req.tickets.every(t => typeof t === 'string' && TICKET_ID.test(t))) problem(`requirement ${name}: tickets must be an array of ticket IDs such as T-01`);
    if (!Array.isArray(req.checks)) problem(`requirement ${name}: checks must be an array of check IDs`);
    else for (const c of req.checks) {
      if (typeof c !== 'string' || !checks.has(c)) problem(`requirement ${name}: references unknown check ${JSON.stringify(c)} (dangling reference)`);
    }
    for (const key of ['note', 'authorized_by']) if (key in req && !shortText(req[key])) problem(`requirement ${name}: ${key} must be a short string`);
    if (req.disposition === 'deferred' && !nonempty(req.authorized_by)) problem(`requirement ${name}: deferred requires authorized_by naming the explicit user authorization`);
    if (req.disposition === 'delivered' && Array.isArray(req.checks) && req.checks.length === 0) problem(`requirement ${name}: delivered requires at least one check`);
    if (req.disposition === 'blocked') problem(`requirement ${name} is blocked — readiness is blocked until it is delivered on a new candidate or deferred with authorization`);
  });

  const visual = doc.visual_review;
  if (!isObject(visual) || typeof visual.applicable !== 'boolean') problem('visual_review must be {applicable: boolean, reason?: string}');
  else {
    for (const key of Object.keys(visual)) if (!['applicable', 'reason'].includes(key)) problem(`visual_review.${key} is not allowed`);
    if (visual.applicable === false && !nonempty(visual.reason)) problem('visual_review.reason is required when visual review is not applicable (say why)');
    if (visual.applicable === true && visualChecks === 0) problem('visual_review.applicable is true but no visual check is recorded');
    if ('reason' in visual && !shortText(visual.reason)) problem('visual_review.reason must be a short string');
  }

  if (problems.length === 0 && opts.files) {
    opts.list = [rel, ...doc.artifacts.map(a => a.path)];
  }
  return problems;
}

function usage(message) {
  if (message) process.stderr.write(`pincer-evidence: ${message}\n`);
  process.stderr.write('usage: pincer-evidence.cjs validate <manifest> [--candidate <sha>] [--base <sha>] [--prd .prd/prd-vN.md] [--files]\n       pincer-evidence.cjs digest <file>...\n');
  process.exit(2);
}

function main(argv) {
  const [command, ...rest] = argv;
  if (command === 'validate') {
    const opts = { files: false };
    let manifest = null;
    for (let i = 0; i < rest.length; i++) {
      const arg = rest[i];
      if (arg === '--files') opts.files = true;
      else if (arg === '--candidate' || arg === '--base' || arg === '--prd') {
        const value = rest[++i];
        if (value === undefined) usage(`${arg} requires a value`);
        opts[arg.slice(2)] = value;
      } else if (arg.startsWith('--')) usage(`unknown option ${arg}`);
      else if (manifest === null) manifest = arg;
      else usage('validate takes exactly one manifest path');
    }
    if (manifest === null) usage('validate requires a manifest path');
    if (opts.candidate !== undefined && !HEX40.test(opts.candidate)) usage('--candidate must be a full 40-hex commit ID');
    if (opts.base !== undefined && !HEX40.test(opts.base)) usage('--base must be a full 40-hex commit ID');
    if (opts.prd !== undefined && !PRD_REF.test(opts.prd)) usage('--prd must be of the form .prd/prd-vN.md');
    const problems = validate(manifest, opts);
    if (problems.length > 0) {
      for (const p of problems) process.stderr.write(`evidence: ${manifest}: ${p}\n`);
      process.exit(1);
    }
    const doc = JSON.parse(fs.readFileSync(path.resolve(manifest), 'utf8'));
    process.stdout.write(`ok ${doc.candidate}\n`);
    if (opts.files) for (const p of opts.list) process.stdout.write(`${p}\n`);
    return;
  }
  if (command === 'digest') {
    if (rest.length === 0) usage('digest requires at least one file');
    for (const file of rest) {
      let digest;
      try { digest = digestFile(file); } catch (error) { process.stderr.write(`pincer-evidence: ${file}: ${error.code === 'ENOENT' ? 'missing' : error.message}\n`); process.exit(1); }
      process.stdout.write(`${digest}  ${file}\n`);
    }
    return;
  }
  usage(command ? `unknown command ${command}` : undefined);
}

main(process.argv.slice(2));
