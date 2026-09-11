'use strict';
// PINCER runtime — candidate evidence (docs/runtime-contracts.md, "Evidence
// schema 2"). Schema 1 validation lives here unchanged from v0.4.1 so status,
// release and the pincer-evidence.cjs entry point share one implementation.
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
const { validateAttempt, contextKey } = require('./state.cjs');

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
// Schema 2 (docs/runtime-contracts.md, "Evidence schema 2"): a change binding,
// provenance per check, and attempt provenance on runtime command checks.
const SCHEMAS = [1, 2];
const TOP_KEYS_2 = [...TOP_KEYS, 'change'];
const CHECK_KEYS_2 = [...CHECK_KEYS, 'provenance', 'attempt'];
const PROVENANCE = ['runtime', 'authored'];
const ATTEMPT_KEYS = ['id', 'sequence', 'outcome', 'exit_code', 'started', 'finished', 'source_before', 'source_after', 'check_digest', 'runner', 'cwd', 'log_sha256', 'truncated'];
const OUTCOMES = ['passed', 'failed', 'timed_out', 'interrupted', 'error'];
const CHANGE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const resultFor = outcome => (outcome === 'passed' ? 'passed' : outcome === 'error' ? 'unverified' : 'failed');

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

function validate(manifestArg, opts, rootArg) {
  const root = realpathDeep(rootArg || repoRoot());
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
  if (!SCHEMAS.includes(doc.schema)) return [`unknown evidence schema ${JSON.stringify(doc.schema)} — this runtime validates schemas ${SCHEMAS.join(' and ')}`];
  const schema2 = doc.schema === 2;
  const topKeys = schema2 ? TOP_KEYS_2 : TOP_KEYS;
  const checkKeys = schema2 ? CHECK_KEYS_2 : CHECK_KEYS;

  const problems = [];
  const problem = message => problems.push(message);
  for (const key of Object.keys(doc)) if (!topKeys.includes(key)) problem(`unknown top-level key "${key}"`);
  for (const key of topKeys) if (!(key in doc)) problem(`missing "${key}"`);
  if (schema2) {
    const change = doc.change;
    if (!isObject(change)) problem('change must be an object {id, prd_revision, base}');
    else {
      for (const key of Object.keys(change)) if (!['id', 'prd_revision', 'base'].includes(key)) problem(`change.${key} is not allowed`);
      if (typeof change.id !== 'string' || !CHANGE_ID.test(change.id)) problem('change.id must be a change ID ([a-z0-9][a-z0-9-]{0,63})');
      if (typeof change.prd_revision !== 'string' || !SHA256.test(change.prd_revision)) problem('change.prd_revision must be a 64-hex SHA-256 digest');
      if (typeof change.base !== 'string' || !HEX40.test(change.base)) problem('change.base must be a full 40-hex commit ID');
    }
  }

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
    for (const key of Object.keys(check)) if (!checkKeys.includes(key)) problem(`check ${name}: unknown key "${key}"`);
    if (!KINDS.includes(check.kind)) problem(`check ${name}: kind must be one of ${KINDS.join(', ')}`);
    if (schema2) validateProvenance(check, name, doc, problem);
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

// Schema 2: every check declares its provenance; a passed or failed command
// result exists only as a runtime attempt whose log digest the manifest carries.
function validateProvenance(check, name, doc, problem) {
  if (!PROVENANCE.includes(check.provenance)) { problem(`check ${name}: provenance must be runtime or authored`); return; }
  const artifactDigest = p => { const entry = Array.isArray(doc.artifacts) ? doc.artifacts.find(a => isObject(a) && a.path === p) : null; return entry ? entry.sha256 : null; };
  if (check.provenance === 'authored') {
    if ('attempt' in check) problem(`check ${name}: an authored check carries no attempt`);
    if (check.kind === 'command' && ['passed', 'failed'].includes(check.result)) problem(`check ${name}: a ${check.result} command check must have runtime provenance (run it through pincer-runtime.cjs check)`);
    return;
  }
  if (check.kind !== 'command') problem(`check ${name}: runtime provenance applies to command checks only`);
  const a = check.attempt;
  if (!isObject(a)) { problem(`check ${name}: runtime provenance requires an attempt object`); return; }
  for (const key of Object.keys(a)) if (!ATTEMPT_KEYS.includes(key)) problem(`check ${name}: attempt.${key} is not allowed`);
  for (const key of ATTEMPT_KEYS) if (!(key in a)) problem(`check ${name}: attempt.${key} is missing`);
  if (!nonempty(a.id)) problem(`check ${name}: attempt.id must be a nonempty string`);
  if (!Number.isInteger(a.sequence) || a.sequence < 1) problem(`check ${name}: attempt.sequence must be a positive integer`);
  if (!OUTCOMES.includes(a.outcome)) problem(`check ${name}: attempt.outcome must be one of ${OUTCOMES.join(', ')}`);
  else if (check.result !== resultFor(a.outcome)) problem(`check ${name}: result ${check.result} disagrees with attempt outcome ${a.outcome} (expected ${resultFor(a.outcome)})`);
  if (a.exit_code !== null && !Number.isInteger(a.exit_code)) problem(`check ${name}: attempt.exit_code must be an integer or null`);
  for (const key of ['started', 'finished']) if (typeof a[key] !== 'string' || !ISO_UTC.test(a[key])) problem(`check ${name}: attempt.${key} must be an ISO-8601 UTC timestamp`);
  for (const key of ['source_before', 'source_after']) if (a[key] !== null && (typeof a[key] !== 'string' || !SHA256.test(a[key]))) problem(`check ${name}: attempt.${key} must be a 64-hex digest or null`);
  if (typeof a.check_digest !== 'string' || !SHA256.test(a.check_digest)) problem(`check ${name}: attempt.check_digest must be a 64-hex digest`);
  if (!isObject(a.runner) || !nonempty(a.runner.shell) || !Array.isArray(a.runner.args) || !nonempty(a.runner.version)) problem(`check ${name}: attempt.runner must be {shell, args, version}`);
  if (!shortText(a.cwd)) problem(`check ${name}: attempt.cwd must be a short string`);
  if (typeof a.truncated !== 'boolean') problem(`check ${name}: attempt.truncated must be true or false`);
  if (typeof a.log_sha256 !== 'string' || !SHA256.test(a.log_sha256)) problem(`check ${name}: attempt.log_sha256 must be a 64-hex digest`);
  else if (Array.isArray(check.artifacts)) {
    const logs = check.artifacts.filter(p => typeof p === 'string' && /\.log$/.test(p));
    if (logs.length !== 1) problem(`check ${name}: a runtime check references exactly one .log artifact`);
    else if (artifactDigest(logs[0]) !== a.log_sha256) problem(`check ${name}: log artifact ${logs[0]} digest does not equal attempt.log_sha256`);
  }
}

// --- Export (schema 2) ---------------------------------------------------------
// Build the candidate evidence set from a draft of authored fields and the
// runtime's attempts for the candidate. Never invents a review transcript and
// never converts a review judgment into a command result.
function exportEvidence(root, { candidate, base, prd, draft, binding, attemptsFor, environment, now, atomicWrite }) {
  const version = prd.match(PRD_REF)[1];
  const dirRel = `.prd/evidence/prd-v${version}/${candidate}`;
  const dirAbs = path.join(root, dirRel);
  const problems = [];
  if (!isObject(draft)) return { problems: ['draft must be a JSON object'] };
  const allowed = ['environment', 'coverage_review', 'requirements', 'checks', 'visual_review'];
  for (const key of Object.keys(draft)) if (!allowed.includes(key)) problems.push(`draft: unknown key "${key}" (allowed: ${allowed.join(', ')})`);
  if (!Array.isArray(draft.checks)) problems.push('draft.checks must be an array');
  if (problems.length) return { problems };
  const env = isObject(draft.environment) ? draft.environment : {};
  const checks = [];
  const artifactPaths = new Set();
  for (const stub of draft.checks) {
    if (!isObject(stub) || typeof stub.id !== 'string' || !CHECK_ID.test(stub.id)) { problems.push(`draft.checks entries must be objects with a check ID such as C-01 (got ${JSON.stringify(isObject(stub) ? stub.id : stub)})`); continue; }
    // Authored artifact paths are validated before anything is written: no
    // traversal, no absolute paths, and inside this candidate's evidence directory.
    for (const p of Array.isArray(stub.artifacts) ? stub.artifacts : []) {
      if (typeof p !== 'string') { problems.push(`draft check ${stub.id}: artifact references must be strings`); continue; }
      const why = unsafePath(p);
      if (why) problems.push(`draft check ${stub.id}: artifact ${p}: ${why}`);
      else if (!p.startsWith(`${dirRel}/`)) problems.push(`draft check ${stub.id}: artifact ${p}: outside the evidence directory ${dirRel}/`);
    }
    const isStub = stub.kind === 'command' && !('result' in stub);
    if (!isStub) {
      if (stub.kind === 'command' && ['passed', 'failed'].includes(stub.result)) { problems.push(`draft check ${stub.id}: a ${stub.result} command result cannot be authored; omit result to populate it from the runtime attempt`); continue; }
      const authored = { ...stub, provenance: 'authored' };
      delete authored.attempt;
      for (const p of authored.artifacts || []) artifactPaths.add(p);
      checks.push(authored);
      continue;
    }
    const { attempt, pointed } = attemptsFor(stub.id);
    if (!attempt) { problems.push(`draft check ${stub.id}: no runtime attempt for candidate ${candidate}; run: node scripts/pincer-runtime.cjs check ${stub.id} --candidate ${candidate} -- <command>`); continue; }
    // The record must be complete, written for this check, and its captured
    // logs must still match the digests it recorded; anything else is refused.
    const changesMode = binding.mode === 'changes';
    const invalid = validateAttempt(attempt, contextKey({ kind: 'candidate', change: binding.change, candidate, check: stub.id, mode: binding.mode }), pointed || null);
    if (invalid) { problems.push(`draft check ${stub.id}: attempt ${typeof attempt.id === 'string' ? attempt.id : '?'} ${invalid}; run the check again`); continue; }
    if (changesMode && attempt.schema !== 2) { problems.push(`draft check ${stub.id}: attempt ${attempt.id} was recorded under schema ${attempt.schema} (before this project used change records) and is history; run the check again`); continue; }
    if (changesMode && attempt.context.change !== binding.change) { problems.push(`draft check ${stub.id}: attempt ${attempt.id} belongs to change ${attempt.context.change}, not ${binding.change}; run the check again`); continue; }
    if (attempt.outcome === 'running') { problems.push(`draft check ${stub.id}: attempt ${attempt.id} is still running`); continue; }
    const logRel = `${dirRel}/checks/${stub.id}.log`;
    const pieces = [`$ ${(attempt.check && attempt.check.display) || ''}`.replace(/\n$/, ''), ''];
    let missing = false, altered = null;
    for (const stream of ['stdout', 'stderr']) {
      const info = attempt.artifacts[stream];
      const file = path.join(root, info.path);
      let text = '';
      if (fs.existsSync(file)) {
        const data = fs.readFileSync(file);
        if (info.sha256 === null) { altered = altered || `captured ${stream} log ${info.path} has no recorded digest (the attempt was finalized by recover)`; }
        else if (crypto.createHash('sha256').update(data).digest('hex') !== info.sha256) { altered = altered || `captured ${stream} log ${info.path} does not match the digest the attempt recorded`; }
        text = data.toString('utf8');
      } else { missing = true; text = '[pincer: captured log missing from local state]'; }
      pieces.push(`--- ${stream}${info.truncated ? ' (truncated by the runtime)' : ''}${info.redactions ? ` (${info.redactions} redaction(s))` : ''} ---`);
      pieces.push(text.replace(/\n$/, ''));
    }
    if (missing) { problems.push(`draft check ${stub.id}: attempt ${attempt.id} has no captured log; run the check again`); continue; }
    if (altered) { problems.push(`draft check ${stub.id}: attempt ${attempt.id}: ${altered}; run the check again`); continue; }
    pieces.push(`--- outcome ${attempt.outcome}${attempt.exit_code !== null && attempt.exit_code !== undefined ? ` (exit ${attempt.exit_code})` : ''} ---`);
    const content = `${pieces.join('\n')}\n`;
    atomicWrite(path.join(dirAbs, 'checks', `${stub.id}.log`), content);
    artifactPaths.add(logRel);
    checks.push({
      id: stub.id, kind: 'command', required: Boolean(stub.required), result: resultFor(attempt.outcome),
      command: (attempt.check && attempt.check.display || '').replace(/\n$/, ''), timestamp: attempt.finished || attempt.started,
      artifacts: [logRel, ...(stub.artifacts || [])], provenance: 'runtime',
      attempt: {
        id: attempt.id, sequence: attempt.sequence, outcome: attempt.outcome, exit_code: attempt.exit_code ?? null,
        started: attempt.started, finished: attempt.finished, source_before: attempt.source ? attempt.source.before : null, source_after: attempt.source ? attempt.source.after : null,
        check_digest: attempt.check.digest, runner: attempt.runner, cwd: attempt.cwd || '.', log_sha256: crypto.createHash('sha256').update(content).digest('hex'), truncated: Boolean((attempt.artifacts.stdout && attempt.artifacts.stdout.truncated) || (attempt.artifacts.stderr && attempt.artifacts.stderr.truncated)),
      },
      ...(stub.note ? { note: stub.note } : {}), ...(attempt.outcome === 'error' ? { note: `${stub.note ? `${stub.note}; ` : ''}attempt error: ${attempt.error}` } : {}),
    });
  }
  if (problems.length) return { problems };
  const artifacts = [];
  for (const p of [...artifactPaths].sort()) {
    const abs = path.join(root, p);
    if (!fs.existsSync(abs)) { problems.push(`artifact ${p}: missing (authored artifacts must be saved before export)`); continue; }
    artifacts.push({ path: p, sha256: digestFile(abs) });
  }
  if (problems.length) return { problems };
  const manifest = {
    schema: 2, prd, base, candidate, created: now,
    environment: { os: environment.os, node: environment.node, tools: env.tools || [], limitations: env.limitations || [] },
    coverage_review: draft.coverage_review, requirements: draft.requirements, checks, visual_review: draft.visual_review, artifacts,
    change: { id: binding.change, prd_revision: binding.prd_revision, base: binding.base },
  };
  const manifestRel = `${dirRel}/manifest.json`;
  atomicWrite(path.join(root, manifestRel), `${JSON.stringify(manifest, null, 2)}\n`);
  const validation = validate(path.join(root, manifestRel), { candidate, base, prd }, root);
  return { manifest: manifestRel, problems: validation };
}


module.exports = { SCHEMA, SCHEMAS, HEX40, PRD_REF, CHECK_ID, validate, exportEvidence, resultFor, digestFile, repoRoot, realpathDeep, unsafePath };
