#!/usr/bin/env node
// pincer — installer for PINCER, the harness builder
// (blueprint · plan · narrow · code · evaluate · release · status)
//
//   npx pincer-workflow init --platform <name>     install the kit into the current repo (asks in a terminal when no platform is named)
//   npx pincer-workflow update    refresh an install, preserving local edits; regenerate the project copies
//   npx pincer-workflow update --platform <name>   the same, and add a platform to the install
//   npx pincer-workflow doctor    check the health of an install, file by file against this package
//   --help on the tool or on a command prints its usage and changes nothing
//
// No dependencies by design. The kit is markdown plus a small Node core; this tool
// copies it carefully and never overwrites a file you edited: you get a *.new file
// and a warning instead. The install ends with one next step: run the blueprint,
// which interviews you and writes the agreement the other stages read.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = fileURLToPath(import.meta.url);
const TEMPLATE = path.join(path.dirname(HERE), '..', 'template');
const VERSION = createRequire(import.meta.url)('../package.json').version;
const requireAbsolute = createRequire(import.meta.url);
export const MANIFEST = '.pincer.json';
export const MANIFEST_SCHEMA = 3;
// Baselines recorded under these schemas were written by this installer and can be trusted.
const TRUSTED_SCHEMAS = [2, MANIFEST_SCHEMA];
export const PLATFORMS = ['claude', 'codex', 'copilot'];

// The .claude tree is the canonical, editable project copy and every platform's
// adapter points at it, so it ships everywhere; only Claude Code's own wiring
// (CLAUDE.md, settings.json, hooks) is platform-specific. Only the two always-on
// stages ship generated; the blueprint generates the stages it switches on.
export const PLATFORM_ROOTS = {
  common: [
    'AGENTS.md', 'docs/engine.md', 'docs/release-checklist.md',
    'scripts/pincer-ticket.sh', 'scripts/pincer-status.sh', 'scripts/pincer-evidence.cjs', 'scripts/pincer-blueprint.cjs', 'scripts/sync-prompts.sh', 'scripts/pincer',
    '.claude/pincer/library', '.claude/skills/pincer-blueprint', '.claude/skills/pincer-status', '.claude/commands/pincer-blueprint.md', '.claude/commands/pincer-status.md',
  ],
  claude: ['CLAUDE.md', '.claude/settings.json', '.claude/hooks'],
  codex: ['.codex/README.md', '.agents/skills/pincer-blueprint', '.agents/skills/pincer-status'],
  copilot: ['.github/copilot-instructions.md', '.github/prompts/pincer-blueprint.prompt.md', '.github/prompts/pincer-status.prompt.md'],
};
export const EXECUTABLES = ['scripts/sync-prompts.sh', 'scripts/pincer-ticket.sh', 'scripts/pincer-status.sh', 'scripts/pincer-blueprint.cjs', 'scripts/pincer-evidence.cjs', '.claude/hooks/block-dangerous.sh', '.claude/hooks/ticket-guard.sh'];
export const GITIGNORE_LINES = ['.env', '.env.*', '!.env.example'];
// Files an earlier kit installed that this version no longer ships. Never deleted
// here; doctor names them when neither the manifest nor the generator claims them.
const OBSOLETE = [
  'scripts/pincer-runtime.cjs', 'scripts/pincer-runtime', 'scripts/pincer-ticket-lib.sh', 'docs/runtime-contracts.md', 'docs/dry-run-checklist.md', '.claude/references',
  '.claude/commands/pincer-plan.md', '.claude/commands/pincer-narrow.md', '.claude/commands/pincer-code.md', '.claude/commands/pincer-evaluate.md', '.claude/commands/pincer-release.md',
];

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// The agreement between the markers in AGENTS.md is written by the blueprint, not by
// this installer: the installer owns the text around it. Every comparison and every
// proposal for that file is therefore made with the project's agreement in place.
const { AGREEMENT_START, AGREEMENT_END, AGENTS_FILE } = requireAbsolute(path.join(TEMPLATE, 'scripts/pincer/blueprint.cjs'));
function agreementSpan(text) {
  const start = text.indexOf(AGREEMENT_START), end = text.indexOf(AGREEMENT_END);
  return start === -1 || end < start ? null : { start, end: end + AGREEMENT_END.length };
}
// `text` with the agreement of `other` between its markers; unchanged when either has none.
function withAgreementOf(text, other) {
  const mine = agreementSpan(text), theirs = agreementSpan(other);
  if (!mine || !theirs) return text;
  return text.slice(0, mine.start) + other.slice(theirs.start, theirs.end) + text.slice(mine.end);
}
const ownsAgreement = (rel) => rel === AGENTS_FILE;
// The package's file as it belongs in this project, and the project's file as the installer sees it.
const forProject = (rel, shipped, project) => (ownsAgreement(rel) ? Buffer.from(withAgreementOf(shipped.toString(), project.toString())) : shipped);
const installerView = (rel, project, shipped) => (ownsAgreement(rel) ? Buffer.from(withAgreementOf(project.toString(), shipped.toString())) : project);

function walk(root, rel = '') {
  const abs = path.join(root, rel);
  if (!fs.statSync(abs).isDirectory()) return [rel];
  return fs.readdirSync(abs).filter((n) => n !== '.DS_Store').flatMap((n) => walk(root, rel ? path.join(rel, n) : n));
}

export function filesFor(platforms) {
  const roots = [...PLATFORM_ROOTS.common, ...platforms.flatMap((p) => PLATFORM_ROOTS[p])];
  return roots.flatMap((r) => walk(TEMPLATE, r)).sort();
}

function fail(msg) {
  console.error(`pincer: ${msg}`);
  process.exit(1);
}

function readManifest(dir) {
  const p = path.join(dir, MANIFEST);
  if (!fs.existsSync(p)) return null;
  let data;
  try { data = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { fail(`${MANIFEST} exists but is not valid JSON — fix or remove it first.`); }
  const unsafe = (f) => path.isAbsolute(f) || /^[A-Za-z]:/.test(f) || f.split(/[\\/]/).includes('..');
  const invalid = !data || typeof data !== 'object' || Array.isArray(data)
    || !Array.isArray(data.platforms) || !data.platforms.length || !data.platforms.every((x) => PLATFORMS.includes(x))
    || !data.files || typeof data.files !== 'object' || Array.isArray(data.files)
    || Object.keys(data.files).some(unsafe)
    || (data.generated !== undefined && (!isPlainObject(data.generated) || Object.keys(data.generated).some(unsafe)))
    || (data.schema !== undefined && !TRUSTED_SCHEMAS.includes(data.schema));
  if (invalid) fail(`${MANIFEST} has an unsupported or invalid schema — restore a valid manifest before updating.`);
  return data;
}

function writeManifest(dir, platforms, hashes, generated) {
  const data = { schema: MANIFEST_SCHEMA, version: VERSION, platforms, files: hashes, generated: isPlainObject(generated) ? generated : {} };
  fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify(data, null, 2) + '\n');
}

// Preserve in-progress merges too. Reuse an identical proposal, never replace a
// different existing sidecar (including one left by an earlier release).
function writeProposal(dest, content) {
  const base = dest + '.new';
  let proposal = base;
  let suffix = 0;
  while (fs.existsSync(proposal)) {
    if (fs.readFileSync(proposal).equals(content)) return proposal;
    proposal = `${base}.${sha(content).slice(0, 12)}${suffix ? `.${suffix}` : ''}`;
    suffix++;
  }
  fs.writeFileSync(proposal, content, { flag: 'wx' });
  return proposal;
}

// Copies the template files into dir. `baseline` (the manifest's hashes) tells an
// update which existing files are unmodified and therefore safe to refresh.
function install(dir, platforms, baseline, generated) {
  const results = { written: [], skipped: [], conflicted: [], removed: [] };
  const hashes = {};
  for (const rel of filesFor(platforms)) {
    const src = fs.readFileSync(path.join(TEMPLATE, rel));
    const dest = path.join(dir, rel);
    hashes[rel] = sha(src);
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, src);
      results.written.push(rel);
      continue;
    }
    const current = fs.readFileSync(dest);
    const wanted = forProject(rel, src, current);
    if (current.equals(wanted)) {
      results.skipped.push(rel);
    } else if (baseline && baseline[rel] === sha(installerView(rel, current, src))) {
      fs.writeFileSync(dest, wanted); // untouched since install: safe to refresh
      results.written.push(rel);
    } else {
      const proposal = writeProposal(dest, wanted);
      // Only a version this installer wrote grants overwrite permission later;
      // null means no trusted upstream baseline was ever established.
      hashes[rel] = baseline?.[rel] ?? null;
      results.conflicted.push({ rel, proposal: path.relative(dir, proposal) });
      continue;
    }
    // 1.0.2 and earlier proposed the blank agreement beside a filled one on every update.
    // A proposal that would change nothing but that is removed; any other is the person's.
    const sidecar = dest + '.new';
    if (ownsAgreement(rel) && !wanted.equals(src) && fs.existsSync(sidecar)) {
      const proposed = fs.readFileSync(sidecar).toString();
      const blank = withAgreementOf(proposed, src.toString()) === proposed; // its agreement is the package's placeholder
      if (blank && withAgreementOf(proposed, wanted.toString()) === wanted.toString()) { fs.rmSync(sidecar); results.removed.push(`${rel}.new`); }
    }
  }
  for (const rel of EXECUTABLES) {
    const p = path.join(dir, rel);
    if (fs.existsSync(p)) fs.chmodSync(p, 0o755);
  }
  ensureGitignore(dir);
  writeManifest(dir, platforms, hashes, generated);
  return results;
}

function ensureGitignore(dir) {
  const p = path.join(dir, '.gitignore');
  const existing = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  const have = new Set(existing.split('\n').map((l) => l.trim()));
  const missing = GITIGNORE_LINES.filter((l) => !have.has(l));
  if (!missing.length) return;
  const lead = existing && !existing.endsWith('\n') ? '\n' : '';
  fs.appendFileSync(p, `${lead}${existing ? '\n' : ''}# secrets (added by pincer init)\n${missing.join('\n')}\n`);
}

function report({ written, skipped, conflicted, removed }) {
  if (written.length) console.log(`  wrote    ${written.length} file(s)`);
  if (skipped.length) console.log(`  skipped  ${skipped.length} file(s) already up to date`);
  for (const rel of removed) console.log(`  removed  ${rel} — it proposed only the blank agreement; yours is kept`);
  for (const { rel, proposal } of conflicted) console.log(`  CONFLICT ${rel} — local content preserved; the new version is at ${proposal}`);
  if (conflicted.length) console.log('\n  Review and merge each reported proposal, then remove the resolved sidecars.');
}

// The installed engine, loaded from the project so an update uses the version it just wrote.
function installedEngine(dir) {
  let models = null;
  try { models = requireAbsolute(path.join(dir, 'scripts/pincer/models.cjs')); } catch { models = null; } // absent before 1.1
  return {
    harness: requireAbsolute(path.join(dir, 'scripts/pincer/harness.cjs')),
    generate: requireAbsolute(path.join(dir, 'scripts/pincer/generate.cjs')),
    models,
  };
}
// What the library or its table could not provide, as one sentence.
function missingText(name) {
  if (name === 'models.json') return 'the library has no models.json; run pincer update';
  if (name.startsWith('models.json:')) return `${name} — fix the library table; after an update the upstream copy is beside it as models.json.new`;
  if (name.startsWith('models/')) { const [platform, tier] = name.slice('models/'.length).split('/'); return `the library table has no ${platform} value for tier ${tier}; set models.map.${platform}.${tier} in harness.json`; }
  if (name.startsWith('agents/')) return `the library has no agent ${name.slice('agents/'.length)}`;
  return `the library has no stage ${name}`;
}
// The tiers in use and what each installed platform will run them on.
function reportModels(dir, engine, harness, platforms, check) {
  const { models } = engine;
  if (!models) { check(false, 'models checked', 'could not load scripts/pincer/models.cjs — run: pincer update'); return; }
  const library = engine.generate.libraryDir(dir);
  const read = models.readTable(library);
  if (!read.ok) {
    if (read.missing) check(false, 'library has models.json', 'run: pincer update');
    else check(false, 'library table readable', `${read.problem} — fix it; after an update the upstream copy is beside it as models.json.new`);
    return;
  }
  const table = models.overlay(read.table, harness.models.map);
  const eff = models.effective(harness, library);
  const inUse = new Set([...Object.values(eff.stages), ...Object.values(eff.agents)].map((entry) => entry.tier).filter((tier) => tier && tier !== 'inherit'));
  const tiers = engine.harness.MAP_TIERS.filter((tier) => inUse.has(tier));
  if (!tiers.length) console.log("  models  no tier in use; the session's model everywhere");
  for (const platform of tiers.length ? platforms : []) {
    const pairs = tiers.map((tier) => [tier, models.modelFor(table, platform, tier)]);
    console.log(`  models  ${platform}: ${pairs.filter(([, value]) => value).map(([tier, value]) => `${tier}=${value}`).join(', ')}`);
    for (const [tier, value] of pairs) if (!value) check(false, `tier ${tier} has a ${platform} value`, `set models.map.${platform}.${tier} in harness.json or update the kit`);
  }
  if (platforms.includes('codex') && fs.existsSync(path.join(dir, '.codex/agents'))) console.log('  note  Codex loads .codex/ only in a trusted project');
}

// With an agreement in place the project's stage copies come from the library just
// installed; the generator keeps edited copies and leaves .new sidecars beside them.
function regenerate(dir) {
  let engine;
  try { engine = installedEngine(dir); } catch (error) { console.log(`  note  could not load the installed engine (${error.message}); run scripts/sync-prompts.sh yourself`); return; }
  const loaded = engine.harness.load(dir);
  if (!loaded.ok) {
    console.log(loaded.missing
      ? '  note  no harness.json yet — run /pincer-blueprint; it generates the project copies of the stages it switches on'
      : `  note  harness.json: ${loaded.message} — fix it, then run scripts/sync-prompts.sh to regenerate the project copies`);
    return;
  }
  let result;
  try { result = engine.generate.generate(dir, { harness: loaded.harness }); } catch (error) {
    console.log(`  note  ${error.message} — fix the library file, then run scripts/sync-prompts.sh to regenerate the project copies`);
    return;
  }
  for (const rel of result.written) console.log(`  generated ${rel}`);
  for (const rel of result.conflicted) console.log(`  kept ${rel} (edited; fresh copy in ${rel}.new)`);
  for (const rel of result.retained) console.log(`  kept ${rel} (edited; not removed)`);
  for (const rel of result.removed) console.log(`  removed ${rel}`);
  for (const rel of result.unsafe) console.log(`  note  ignored unsafe baseline path ${rel} in ${MANIFEST}`);
  for (const name of result.missing) console.log(`  note  ${missingText(name)}`);
  console.log(`  generated: ${result.written.length} written, ${result.skipped.length} unchanged, ${result.conflicted.length} kept, ${result.removed.length} removed`);
}

// How each platform starts a stage; `stage` is blueprint on a new install and status on one that grew.
function platformSteps(platforms, stage) {
  if (platforms.includes('claude')) console.log(`  Claude Code   start \`claude\` in this repo and run /pincer-${stage}`);
  if (platforms.includes('codex')) console.log(`  Codex CLI     start \`codex\` in this repo and type $pincer-${stage}  (skills load from .agents/skills/; posture notes in .codex/README.md)`);
  if (platforms.includes('copilot')) console.log(`  Copilot       enable "chat.promptFiles": true in VS Code settings, then /pincer-${stage} in chat`);
}
function nextSteps(platforms) {
  console.log('\nNext: run the blueprint. It looks at the repository, interviews you, and writes the agreement (harness.json and the top of AGENTS.md).');
  platformSteps(platforms, 'blueprint');
  console.log('  Any session   scripts/pincer-status.sh shows where the work stands and the next command');
}

async function askPlatforms() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const q = (s) => new Promise((res) => rl.question(s, res));
  console.log('Which platform(s) do you use?\n  1) Claude Code\n  2) Codex CLI\n  3) GitHub Copilot\n  4) all of them');
  const answer = (await q('Choose [1-4, default 4]: ')).trim() || '4';
  rl.close();
  const map = { 1: ['claude'], 2: ['codex'], 3: ['copilot'], 4: [...PLATFORMS] };
  return map[answer] || fail(`invalid choice: ${answer}`);
}

// A command's arguments: --help or -h anywhere, --platform with its value where the
// command takes one, and the first argument the command does not know.
function readArgs(cmd, args) {
  const read = { help: false, platform: null, unknown: null };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') read.help = true;
    else if (cmd !== 'doctor' && arg === '--platform') read.platform = args[++i] ?? '';
    else if (cmd !== 'doctor' && arg.startsWith('--platform=')) read.platform = arg.slice('--platform='.length);
    else read.unknown ??= arg;
  }
  return read;
}
// A mistake in how the tool was called: nothing was touched.
function usageError(msg, cmd) {
  console.error(`pincer: ${msg}\n        see: npx pincer-workflow ${cmd ? `${cmd} ` : ''}--help`);
  process.exit(2);
}

function parsePlatformFlag(value) {
  if (value === null) return null;
  if (value === 'all') return [...PLATFORMS];
  const list = value.split(',').map((s) => s.trim());
  if (list.length && list.every((p) => PLATFORMS.includes(p))) return [...new Set(list)];
  fail(`--platform must be claude, codex, copilot (comma-separated) or all — got "${value}"`);
}

async function cmdInit(args) {
  const dir = process.cwd();
  if (readManifest(dir)) fail(`this repo already has PINCER installed (${MANIFEST} exists) — use \`pincer update\`, or \`pincer update --platform <name>\` to add a platform.`);
  const named = parsePlatformFlag(args.platform);
  // With nobody to ask, a guess would write three platforms' files into the repo.
  if (!named && !process.stdin.isTTY) usageError('name the platform to install: --platform claude, codex, copilot (comma-separated) or all.', 'init');
  const platforms = named || await askPlatforms();
  console.log(`\nInstalling PINCER v${VERSION} for: ${platforms.join(', ')}\n`);
  report(install(dir, platforms, null, {}));
  nextSteps(platforms);
}

// `--platform` adds to the install: the platforms already there stay, the named ones
// that are new get their files the way init would write them, and an existing file
// of theirs (a CLAUDE.md the project already had) is kept with a .new beside it.
async function cmdUpdate(args) {
  const dir = process.cwd();
  const manifest = readManifest(dir);
  if (!manifest) fail(`no ${MANIFEST} here — run \`pincer init\` first.`);
  const named = parsePlatformFlag(args.platform) || [];
  const added = named.filter((p) => !manifest.platforms.includes(p));
  const present = named.filter((p) => manifest.platforms.includes(p));
  const platforms = [...manifest.platforms, ...added];
  const adding = [added.length ? `adding: ${added.join(', ')}` : '', added.length && present.length ? `already installed: ${present.join(', ')}` : ''].filter(Boolean).join('; ');
  console.log(`\nUpdating PINCER ${manifest.version} -> ${VERSION} for: ${platforms.join(', ')}${adding ? ` (${adding})` : ''}\n`);
  if (present.length && !added.length) console.log(`  ${present.join(', ')} ${present.length === 1 ? 'is' : 'are'} already installed; nothing to add\n`);
  // A manifest without a schema could have adopted a local edit as its baseline;
  // there is no safe way to tell those from upstream files after the fact.
  const baseline = TRUSTED_SCHEMAS.includes(manifest.schema) ? manifest.files : null;
  if (!baseline) console.log('  Legacy baselines are untrusted; differing files will be preserved for review.');
  report(install(dir, platforms, baseline, manifest.generated));
  regenerate(dir);
  if (added.length) {
    // Without an agreement there is nothing for status to report yet: the blueprint comes first.
    const agreed = fs.existsSync(path.join(dir, 'harness.json'));
    console.log(agreed
      ? `\nAdded ${added.join(', ')}. The agreement and the tickets are shared; start there with the status stage:`
      : `\nAdded ${added.join(', ')}. There is no agreement yet: start there with the blueprint, which writes it:`);
    platformSteps(added, agreed ? 'status' : 'blueprint');
  }
}

function cmdDoctor() {
  const dir = process.cwd();
  const manifest = readManifest(dir);
  if (!manifest) fail(`no ${MANIFEST} here — run \`pincer init\` first.`);
  const generated = isPlainObject(manifest.generated) ? manifest.generated : {};
  let problems = 0;
  const check = (ok, label, hint) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || !hint ? '' : ` — ${hint}`}`);
    if (!ok) problems++;
  };

  console.log(`\nPINCER doctor (installed ${manifest.version}, this tool ${VERSION})\n`);
  const missing = Object.keys(manifest.files).filter((rel) => !fs.existsSync(path.join(dir, rel)));
  check(missing.length === 0, 'all installed files present', `missing: ${missing.join(', ')}`);
  for (const rel of EXECUTABLES) {
    const p = path.join(dir, rel);
    if (fs.existsSync(p)) check(!!(fs.statSync(p).mode & 0o100), `${rel} is executable`, `run: chmod +x ${rel}`);
  }
  const gi = fs.existsSync(path.join(dir, '.gitignore')) ? fs.readFileSync(path.join(dir, '.gitignore'), 'utf8').split('\n').map((s) => s.trim()) : [];
  check(GITIGNORE_LINES.every((l) => gi.includes(l)), '.gitignore covers .env files', 'add: .env / .env.* / !.env.example');
  const stale = fs.existsSync(TEMPLATE) && manifest.version !== VERSION;
  check(!stale, `install is current (v${manifest.version})`, 'run: pincer update');

  // The version label is not proof: a pre-release or a local build can carry the same
  // number. Every installed file is compared with this package's copy. One that differs
  // and was changed since it was installed is a local edit; one that still is what was
  // installed came from another build. With an older label the line above says it all.
  const shipped = fs.existsSync(TEMPLATE) ? new Set(filesFor(manifest.platforms)) : new Set();
  const edited = [];
  const foreign = [];
  for (const [rel, installed] of Object.entries(manifest.files)) {
    const p = path.join(dir, rel);
    if (!fs.existsSync(p)) continue;
    const packaged = shipped.has(rel) ? fs.readFileSync(path.join(TEMPLATE, rel)) : null;
    const current = sha(packaged ? installerView(rel, fs.readFileSync(p), packaged) : fs.readFileSync(p));
    if (packaged && current === sha(packaged)) continue;
    if (current !== installed) edited.push(rel);
    else foreign.push(rel);
  }
  const absent = [...shipped].filter((rel) => !(rel in manifest.files));
  if (fs.existsSync(TEMPLATE) && !stale) {
    const differences = [
      foreign.length ? `from another build labelled v${manifest.version}: ${foreign.join(', ')}` : '',
      absent.length ? `not installed: ${absent.join(', ')}` : '',
    ].filter(Boolean).join('; ');
    check(!differences, `installed files match this package (v${VERSION})`, `${differences} — run: pincer update`);
  }

  // The agreement, checked with the engine this install carries.
  if (!fs.existsSync(path.join(dir, 'harness.json'))) {
    console.log('  note  no harness.json yet — run /pincer-blueprint');
  } else {
    try {
      const engine = installedEngine(dir);
      const loaded = engine.harness.load(dir);
      check(loaded.ok, loaded.ok ? 'harness.json valid' : `harness.json: ${loaded.message}`);
      if (loaded.ok) reportModels(dir, engine, loaded.harness, manifest.platforms, check);
    } catch (error) {
      check(false, 'harness.json checked', `could not load scripts/pincer/harness.cjs (${error.message}) — run: pincer update`);
    }
  }

  // The project's stage copies and roster come from the library through the generator,
  // which recorded each one's content. A missing copy is a stage that cannot run. An
  // edited one is kept by every update; one that is itself derived from a copy
  // under .claude/ (a command, a Codex skill or agent, a Copilot prompt) is the
  // wrong place for the edit.
  const copies = Object.entries(generated);
  const changed = copies.filter(([rel, recorded]) => fs.existsSync(path.join(dir, rel)) && sha(fs.readFileSync(path.join(dir, rel))) !== recorded).map(([rel]) => rel);
  const source = (rel) => rel.startsWith('.claude/skills/') || rel.startsWith('.claude/agents/');
  if (copies.length) {
    const gone = copies.filter(([rel]) => !fs.existsSync(path.join(dir, rel))).map(([rel]) => rel);
    check(gone.length === 0, 'generated project copies present', `missing: ${gone.join(', ')} — run: scripts/sync-prompts.sh`);
  }

  const obsolete = OBSOLETE.filter((rel) => fs.existsSync(path.join(dir, rel)) && !(rel in manifest.files) && !(rel in generated));
  if (obsolete.length) console.log(`  note  obsolete kit file(s) from an earlier version, safe to delete: ${obsolete.join(', ')}`);
  if (edited.length) console.log(`  note  locally edited (kept as-is on update): ${edited.join(', ')}`);
  if (changed.some(source)) console.log(`  note  edited project copies (kept on update, the fresh copy beside each as .new): ${changed.filter(source).join(', ')}`);
  if (changed.some((rel) => !source(rel))) console.log(`  note  edited by hand, but generated from the copy under .claude/ (change it there, then run scripts/sync-prompts.sh): ${changed.filter((rel) => !source(rel)).join(', ')}`);

  const leftovers = [...new Set([...walk(TEMPLATE), ...Object.keys(manifest.files), ...Object.keys(generated)])].flatMap((rel) => {
    const parent = path.dirname(path.join(dir, rel));
    const base = path.basename(rel) + '.new';
    return fs.existsSync(parent) ? fs.readdirSync(parent).filter((name) => name === base || name.startsWith(base + '.')).map((name) => path.join(parent, name)) : [];
  });
  check(leftovers.length === 0, 'no unmerged *.new files', leftovers.map((p) => path.relative(dir, p)).join(', '));

  console.log(problems ? `\n${problems} problem(s) found.` : '\nAll good.');
  process.exit(problems ? 1 : 0);
}

const USAGE = {
  init: `Usage:
  npx pincer-workflow init --platform <claude|codex|copilot|all>

Installs the kit into the current repository. Name several platforms with commas
(--platform claude,codex). In a terminal the platform may be left out and init asks;
anywhere else it must be named. A repository that already has an install is refused:
use update there.`,
  update: `Usage:
  npx pincer-workflow update [--platform <claude|codex|copilot|all>]

Refreshes the install in the current repository to this version. A file you edited is
kept and the new version is written beside it as <file>.new; the agreement in AGENTS.md
is never replaced. With an agreement in place the project's stage copies are generated
again. --platform adds the named platforms to the install and keeps the ones it has.`,
  doctor: `Usage:
  npx pincer-workflow doctor

Checks the install in the current repository: every installed file against this
package, the agreement, the model tiers and unmerged .new files. Changes nothing.
Exit 0 when all is good, 1 when a problem was found.`,
};
function usage(cmd) {
  if (USAGE[cmd]) { console.log(`pincer-workflow v${VERSION} — ${cmd}\n\n${USAGE[cmd]}`); return; }
  console.log(`pincer-workflow v${VERSION} — a harness builder for AI coding agents

Usage:
  npx pincer-workflow init --platform <claude|codex|copilot|all>
  npx pincer-workflow update [--platform <claude|codex|copilot|all>]   (--platform adds a platform)
  npx pincer-workflow doctor
  npx pincer-workflow <command> --help

After init, run the blueprint (/pincer-blueprint or $pincer-blueprint): it writes the
agreement the other stages read. Docs: https://github.com/orchestratedbyalex/pincer-workflow`);
}

// Run the command only when this file is the program, not when a test imports it.
const invoked = process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(HERE); } catch { return false; } })();
if (invoked) {
  const [cmd, ...rest] = process.argv.slice(2);
  const commands = { init: cmdInit, update: cmdUpdate, doctor: cmdDoctor };
  if (!cmd || cmd === '--help' || cmd === '-h') usage();
  else if (!commands[cmd]) { usage(); fail(`unknown ${cmd.startsWith('-') ? 'option' : 'command'} "${cmd}".`); } // exit 1, as it always was
  else {
    const args = readArgs(cmd, rest);
    if (args.help) usage(cmd);
    else if (args.unknown !== null) usageError(`${cmd} does not take ${args.unknown.startsWith('-') ? 'the option' : 'the argument'} "${args.unknown}".`, cmd);
    else await commands[cmd](args);
  }
}
