'use strict';
// T-101: the execution identity is resolved from bytes and effective values before
// planning. Paths and authentication remain runtime inputs, never configuration dumps.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const freeze = require('./freeze.cjs');
const hash = freeze.sha256;
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}
function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: expected an object`);
  if (Object.keys(value).some(k => !keys.includes(k))) throw new Error(`${label}: unknown provenance field`);
}
function text(value, label, pattern = /^[a-zA-Z0-9._:+/-]+$/) {
  if (typeof value !== 'string' || !pattern.test(value) || freeze.secretIn(value)) throw new Error(`${label}: invalid non-secret identity`);
  return value;
}
function positive(value, label, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || (integer && !Number.isSafeInteger(value))) throw new Error(`${label}: requires a positive finite${integer ? ' safe whole' : ''} number`);
  return value;
}
// Canonicalizing the declared root supports /tmp on macOS. No descendant link is
// followed, including links in a parent of an explicitly named file.
function contained(root, rel) {
  const bad = freeze.unsafe(rel);
  if (bad) throw new Error(`input path: ${bad}`);
  let full = fs.realpathSync(root);
  for (const part of rel.split('/')) {
    full = path.join(full, part);
    if (fs.lstatSync(full).isSymbolicLink()) throw new Error('input path: symbolic link is forbidden');
  }
  return full;
}
function tree(root, rel) {
  const files = {};
  function visit(name) {
    if (/(?:^|\/)(?:\.env(?:\.[^/]*)?|\.credentials\.json|auth\.json|credentials(?:\.json)?|\.npmrc|\.netrc|id_rsa|id_ed25519|\.ssh|\.aws)(?:\/|$)/i.test(name)) throw new Error('input tree contains a protected configuration path');
    const full = contained(root, name), stat = fs.statSync(full);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(full).sort()) visit(`${name}/${child}`);
    } else if (stat.isFile()) files[name] = hash(fs.readFileSync(full));
    else throw new Error('input path: only regular files and directories are supported');
  }
  visit(rel);
  return { digest: hash(canonical(files)), files };
}
// Browser distributions use internal framework/version links. Bind link text as well
// as every ordinary target file, without traversing links or weakening generic tree().
function browserRuntimeTree(root, rel) {
  const runtimeRoot = contained(root, rel);
  const files = {}, links = {}, directories = new Map();
  const edge = (from, to) => { if (!directories.has(from)) directories.set(from, []); directories.get(from).push(to); };
  const inside = target => {
    const relative = path.relative(runtimeRoot, target);
    return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`);
  };
  function visit(full, name) {
    if (/(?:^|\/)(?:\.env(?:\.[^/]*)?|\.credentials\.json|auth\.json|credentials(?:\.json)?|\.npmrc|\.netrc|id_rsa|id_ed25519|\.ssh|\.aws)(?:\/|$)/i.test(name)) throw new Error('browser runtime contains a protected configuration path');
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(full);
      if (path.isAbsolute(target) || !inside(path.resolve(path.dirname(full), target))) throw new Error('browser runtime link escapes its bundle');
      let resolved;
      try { resolved = fs.realpathSync(full); }
      catch { throw new Error('browser runtime link is broken or cyclic'); }
      if (!inside(resolved)) throw new Error('browser runtime link resolves outside its bundle');
      const targetStat = fs.statSync(resolved);
      if (!targetStat.isFile() && !targetStat.isDirectory()) throw new Error('browser runtime link target is not a regular file or directory');
      if (targetStat.isDirectory()) edge(path.dirname(full), resolved);
      links[name] = { target, resolved: path.relative(runtimeRoot, resolved).split(path.sep).join('/') };
    } else if (stat.isDirectory()) {
      if (full !== runtimeRoot) edge(path.dirname(full), full);
      for (const child of fs.readdirSync(full).sort()) visit(path.join(full, child), `${name}/${child}`);
    } else if (stat.isFile()) files[name] = hash(fs.readFileSync(full));
    else throw new Error('browser runtime supports only ordinary files, directories and internal links');
  }
  visit(runtimeRoot, rel);
  const active = new Set(), complete = new Set();
  function acyclic(directory) {
    if (active.has(directory)) throw new Error('browser runtime link creates a directory cycle');
    if (complete.has(directory)) return;
    active.add(directory);
    for (const next of directories.get(directory) || []) acyclic(next);
    active.delete(directory); complete.add(directory);
  }
  acyclic(runtimeRoot);
  return { digest: hash(canonical({ files, links })), files, links };
}
function browserIdentity(root, browser) {
  if (browser === null || browser === undefined) return null;
  object(browser, ['entry', 'roots', 'runtime'], 'browser');
  contained(root, browser.entry);
  if (!Array.isArray(browser.roots) || !browser.roots.length || new Set(browser.roots).size !== browser.roots.length) throw new Error('browser: explicit unique dependency roots required');
  const files = {};
  for (const rel of [...browser.roots].sort()) Object.assign(files, tree(root, rel).files);
  if (!Object.hasOwn(files, browser.entry)) throw new Error('browser: entry must belong to its dependency closure');
  // Dependency closure is supplied as an explicit, fully bundled artifact. External
  // packages, dynamic loading and absolute imports cannot silently escape that bundle.
  for (const rel of Object.keys(files).filter(n => /\.(?:c?js|mjs)$/.test(n))) {
    const source = fs.readFileSync(contained(root, rel), 'utf8');
    if (/\brequire\s*\(\s*[^'"\s]|\bimport\b|\bexport\b|\bcreateRequire\b|\brequire\s*\.|\bmodule\s*\[|\bmodule\s*\.\s*require|\beval\s*\(|\bFunction\s*\(/.test(source)) throw new Error('browser: unsupported loader syntax; a restricted CommonJS bundle is required');
    const imports = [...source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)|\b(?:import|export)\s+[^;\n]*?\bfrom\s*['"]([^'"]+)['"]/g)];
    for (const match of imports) {
      const dep = match[1] || match[2];
      if (dep.startsWith('node:')) continue;
      if (!dep.startsWith('.')) throw new Error('browser: external imports require a bundled dependency artifact');
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(rel), dep));
      if (freeze.unsafe(base)) throw new Error('browser: escaping dependency');
      const candidates = [base, `${base}.js`, `${base}.cjs`, `${base}.json`, `${base}/index.js`, `${base}/index.cjs`];
      if (!candidates.some(p => Object.hasOwn(files, p))) throw new Error('browser: dependency is outside the declared closure');
    }
  }
  object(browser.runtime, ['name', 'version', 'path', 'executable'], 'browser runtime');
  const runtime = { name: text(browser.runtime.name, 'browser runtime name'), version: text(browser.runtime.version, 'browser runtime version'), ...browserRuntimeTree(root, browser.runtime.path) };
  if (browser.runtime.executable !== undefined) {
    const executable = contained(root, browser.runtime.executable);
    const relative = path.relative(contained(root, browser.runtime.path), executable);
    if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`) || !fs.statSync(executable).isFile()) throw new Error('browser executable must belong to the runtime artifact');
    runtime.executable = browser.runtime.executable;
  }
  return { entry: browser.entry, files, digest: hash(canonical(files)), runtime };
}
function versionProbeFixture(version) {
  text(version, 'fixture version', /^\d+\.\d+\.\d+$/);
  return `#!/bin/sh\nif [ "$#" -eq 1 ] && [ "$1" = "--version" ]; then\n  printf '%s\\n' '${version} (Claude Code)'\n  exit 0\nfi\nexit 99\n`;
}
function resolve(root, spec, input, { inputRoot = root } = {}) {
  object(input, ['model', 'tool', 'caps', 'kit', 'browser', 'configuration'], 'effective inputs');
  // Full provider IDs are explicit; aliases like sonnet/opus/latest cannot be pinned
  // without a provider resolution step. The eventual session must also attest its model.
  const model = text(input.model, 'resolved model', /^claude-[a-z0-9-]*\d[a-z0-9.-]*$/);
  if (/(?:^|-)latest(?:-|$)/.test(model)) throw new Error('resolved model: aliases are not allowed');
  object(input.tool, ['executable', 'version', 'kind'], 'tool');
  const executable = fs.realpathSync(input.tool.executable);
  if (!fs.statSync(executable).isFile()) throw new Error('tool: executable must be a regular file');
  const expectedVersion = text(input.tool.version, 'tool version', /^\d+\.\d+\.\d+$/);
  const toolBytes = fs.readFileSync(executable);
  const kind = input.tool.kind || 'native';
  const magic = toolBytes.subarray(0, 4).toString('hex');
  const native = ['7f454c46', 'cffaedfe', 'feedfacf', 'cafebabe', 'bebafeca', 'cefaedfe', 'feedface'].includes(magic) || toolBytes.subarray(0, 2).toString() === 'MZ';
  if (kind === 'version-probe-fixture') {
    // This exact fixture can answer --version only, never launch a model.
    if (toolBytes.toString() !== versionProbeFixture(expectedVersion)) throw new Error('tool: fixture must be the inert version-only probe');
  } else if (kind !== 'native' || !native) throw new Error('tool: standalone native CLI required; launcher dependency closure is unknown');
  const probe = spawnSync(executable, ['--version'], { encoding: 'utf8', timeout: 10000, maxBuffer: 4096, env: { PATH: '/usr/bin:/bin' } });
  const match = (probe.stdout || '').trim().match(/^(\d+\.\d+\.\d+)(?: \(Claude Code\))?$/);
  if (probe.status !== 0 || !match || match[1] !== expectedVersion) throw new Error('tool: installed version does not match the pinned Claude Code version');
  object(input.caps, ['turns_per_session', 'wall_clock_minutes', 'spend_usd'], 'caps');
  const caps = {
    turns_per_session: positive(input.caps.turns_per_session, 'turn cap', true),
    wall_clock_minutes: positive(input.caps.wall_clock_minutes, 'wall-clock cap', true),
    spend_usd: positive(input.caps.spend_usd, 'spend cap'),
  };
  object(input.kit, ['path', 'commit'], 'kit');
  const kitPath = contained(inputRoot, input.kit.path);
  if (!fs.statSync(kitPath).isFile()) throw new Error('kit: expected an archive file');
  const kit = { commit: text(input.kit.commit, 'kit commit', /^[a-f0-9]{40}$/), digest: hash(fs.readFileSync(kitPath)) };
  object(input.configuration, ['permission_mode', 'cwd_kind', 'isolation_profile', 'isolation_observation_digest'], 'configuration');
  if (!['manual', 'acceptEdits', 'auto', 'dontAsk', 'plan'].includes(input.configuration.permission_mode) || input.configuration.cwd_kind !== 'scratch') throw new Error('configuration: explicit supported permission posture and scratch cwd required');
  if (Object.hasOwn(input.configuration, 'isolation_profile')) text(input.configuration.isolation_profile, 'isolation profile', /^[a-z][a-z0-9-]+$/);
  if (Object.hasOwn(input.configuration, 'isolation_observation_digest')) text(input.configuration.isolation_observation_digest, 'isolation observation digest', /^[a-f0-9]{64}$/);
  const configuration = { ...input.configuration };
  const staticManifest = freeze.compute(root, spec);
  const effective = {
    model, tool: { name: 'claude-code', kind, version: expectedVersion, digest: hash(toolBytes) },
    caps, kit, browser: browserIdentity(inputRoot, input.browser), configuration,
    platform: { os: os.platform(), release: os.release(), arch: os.arch(), node: process.version },
    // Bind all study siblings, including helpers added after this module was authored.
    helpers: tree(root, 'scripts/delivery-benchmark-v7'),
  };
  const inputs = { ...staticManifest.inputs, effective: hash(canonical(effective)), caps: hash(canonical(caps)), configuration: hash(canonical(configuration)) };
  const order = [...staticManifest.order, 'effective'];
  return { ...staticManifest, schema: 2, inputs, order, caps, effective, cohort: hash(canonical({ inputs, order })) };
}
function assertCurrent(bundle) {
  if (!bundle || !bundle.manifest || bundle.manifest.schema !== 2) throw new Error('resolved effective manifest required; historical records are read-only');
  const current = resolve(bundle.root, bundle.spec, bundle.input, { inputRoot: bundle.inputRoot || bundle.root });
  if (canonical(current) !== canonical(bundle.manifest)) throw new Error('effective execution inputs changed; plan a new cohort');
  return current;
}
function recordInputs(manifest) {
  const { effective: e, inputs, caps } = manifest;
  return {
    provenance: { protocol: inputs.protocol, prompts: inputs.briefs, driver: inputs.driver,
      collector: inputs.collector, evaluator: inputs.evaluators, caps: inputs.caps,
      configuration: inputs.configuration },
    environment: { model: e.model, tool: e.tool.name, tool_version: e.tool.version,
      os: e.platform.os, node: e.platform.node, platform_release: e.platform.release,
      permission_mode: e.configuration.permission_mode, caps,
      ...(e.configuration.isolation_profile ? { isolation_profile: e.configuration.isolation_profile } : {}),
      // A native-login cohort is measured under the native usage profile from the plan on, so
      // its records never read as legacy API-key accounting (T-121).
      ...(['claude-project-native-login-v1', 'claude-project-current-account-login-v1'].includes(e.configuration.isolation_profile) ? { measurement_profile: 'claude-code-result-native-usage-v1', tool_surface: 'claude-code' } : {}),
      ...(e.configuration.isolation_observation_digest ? { isolation_observation_digest: e.configuration.isolation_observation_digest } : {}),
      fixture: e.tool.kind === 'version-probe-fixture' },
  };
}
function parseArgs(argv) {
  const valued = new Set(['runs', 'execution-inputs', 'input-root', 'study-manifest', 'study-input-root', 'study-purpose', 'repetitions', 'briefs', 'model', 'max-turns', 'wall-clock-minutes', 'max-budget-usd', 'kit', 'browser']);
  // The launch assertion carries no numbers and is not the agent's to pass: a human agreed
  // the estimate cap AND the account-usage envelope (native-tool contracts §5.3). The former
  // spending-cap spelling is refused by name so old automation fails before planning.
  const boolean = new Set(['help', 'plan-only', 'i-agreed-the-usage-envelope']);
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].startsWith('--') ? argv[i].slice(2) : '';
    if (name === 'i-have-a-spending-cap') throw new Error('--i-have-a-spending-cap was renamed: --i-agreed-the-usage-envelope asserts that a human agreed the estimate cap and the account-usage envelope');
    if ((!valued.has(name) && !boolean.has(name)) || Object.hasOwn(out, name)) throw new Error('unknown or duplicate option');
    if (boolean.has(name)) out[name] = true;
    else {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`--${name}: missing value`);
      out[name] = argv[++i];
    }
  }
  for (const key of ['max-turns', 'wall-clock-minutes', 'max-budget-usd']) if (Object.hasOwn(out, key)) {
    if (!/^(?:[1-9]\d*)(?:\.\d+)?$/.test(out[key])) throw new Error(`--${key}: invalid numeric cap`);
    out[key] = positive(Number(out[key]), key, key !== 'max-budget-usd');
  }
  // The study purpose is an explicit label on the approved manifest, never inferred.
  if (Object.hasOwn(out, 'study-purpose') && !['measured', 'operational-smoke'].includes(out['study-purpose'])) throw new Error('--study-purpose: expected measured or operational-smoke');
  if (Object.hasOwn(out, 'study-purpose') && !Object.hasOwn(out, 'study-manifest')) throw new Error('--study-purpose: requires --study-manifest');
  // A repetition prefix plans and drives only the first N scheduled repetitions.
  if (Object.hasOwn(out, 'repetitions')) {
    if (!/^[1-9]$/.test(out.repetitions)) throw new Error('--repetitions: expected a single positive digit');
    out.repetitions = Number(out.repetitions);
  }
  // The briefs to plan and drive, in schedule order. The internal API takes this list from
  // its caller; the operator entry point has to take it from here, or the documented smoke
  // command plans every brief and the allocation refuses the cells it never approved.
  if (Object.hasOwn(out, 'briefs')) {
    if (!/^[a-z0-9-]+(?:,[a-z0-9-]+)*$/.test(out.briefs)) throw new Error('--briefs: expected a comma-separated list of brief ids');
    out.briefs = out.briefs.split(',');
    if (new Set(out.briefs).size !== out.briefs.length) throw new Error('--briefs: duplicate brief id');
  }
  // An operational smoke names the briefs it may plan; the whole schedule is never implied.
  if (out['study-purpose'] === 'operational-smoke' && !Object.hasOwn(out, 'briefs')) throw new Error('--study-purpose operational-smoke: requires --briefs');
  return out;
}
module.exports = { versionProbeFixture, canonical, contained, tree, browserRuntimeTree, browserIdentity, resolve, assertCurrent, recordInputs, parseArgs };
