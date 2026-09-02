#!/usr/bin/env node
// pincer — installer for the PINCER workflow (Plan · Investigate · Narrow · Code · Evaluate · Release)
//
//   npx pincer-workflow init      install into the current repo (asks which platform)
//   npx pincer-workflow update    refresh an existing install, preserving local edits
//   npx pincer-workflow doctor    check the health of an install
//
// No dependencies by design. The kit is markdown files; this tool only copies
// them carefully: it never overwrites a file you edited — you get a *.new file
// and a warning instead.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'template');
const VERSION = createRequire(import.meta.url)('../package.json').version;
const MANIFEST = '.pincer.json';

const PLATFORM_ROOTS = {
  common: ['AGENTS.md', 'docs/dry-run-checklist.md', 'scripts/sync-prompts.sh', 'scripts/pincer-ticket.sh', 'scripts/pincer-status.sh'],
  claude: ['CLAUDE.md', '.claude'],
  codex: ['.codex', '.agents'],
  copilot: ['.github'],
};
const EXECUTABLES = ['scripts/sync-prompts.sh', 'scripts/pincer-ticket.sh', 'scripts/pincer-status.sh', '.claude/hooks/block-dangerous.sh', '.claude/hooks/ticket-guard.sh'];
const GITIGNORE_LINES = ['.env', '.env.*', '!.env.example'];

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function walk(root, rel = '') {
  const abs = path.join(root, rel);
  if (!fs.statSync(abs).isDirectory()) return [rel];
  return fs
    .readdirSync(abs)
    .filter((n) => n !== '.DS_Store')
    .flatMap((n) => walk(root, rel ? path.join(rel, n) : n));
}

function filesFor(platforms) {
  const roots = [...PLATFORM_ROOTS.common, ...platforms.flatMap((p) => PLATFORM_ROOTS[p])];
  return roots.flatMap((r) => walk(TEMPLATE, r)).sort();
}

function readManifest(dir) {
  const p = path.join(dir, MANIFEST);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    fail(`${MANIFEST} exists but is not valid JSON — fix or remove it first.`);
  }
}

function writeManifest(dir, platforms, hashes) {
  const data = { version: VERSION, platforms, files: hashes };
  fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify(data, null, 2) + '\n');
}

// Copies template files into dir. `baseline` (manifest hashes) tells an update
// which existing files are unmodified and therefore safe to refresh.
function install(dir, platforms, baseline) {
  const results = { written: [], skipped: [], conflicted: [] };
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
    if (sha(current) === sha(src)) {
      results.skipped.push(rel);
    } else if (baseline && baseline[rel] === sha(current)) {
      // untouched since install — safe to refresh with the new template version
      fs.writeFileSync(dest, src);
      results.written.push(rel);
    } else {
      fs.writeFileSync(dest + '.new', src);
      hashes[rel] = sha(current); // keep tracking the user's version as the baseline
      results.conflicted.push(rel);
    }
  }

  for (const rel of EXECUTABLES) {
    const p = path.join(dir, rel);
    if (fs.existsSync(p)) fs.chmodSync(p, 0o755);
  }

  ensureGitignore(dir);
  writeManifest(dir, platforms, hashes);
  return results;
}

function ensureGitignore(dir) {
  const p = path.join(dir, '.gitignore');
  const existing = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  const have = new Set(existing.split('\n').map((l) => l.trim()));
  const missing = GITIGNORE_LINES.filter((l) => !have.has(l));
  if (missing.length === 0) return;
  const lead = existing && !existing.endsWith('\n') ? '\n' : '';
  fs.appendFileSync(p, `${lead}${existing ? '\n' : ''}# secrets (added by pincer init)\n${missing.join('\n')}\n`);
}

function report({ written, skipped, conflicted }) {
  if (written.length) console.log(`  wrote    ${written.length} file(s)`);
  if (skipped.length) console.log(`  skipped  ${skipped.length} file(s) already up to date`);
  for (const rel of conflicted) {
    console.log(`  CONFLICT ${rel} — you edited this file; the new version is at ${rel}.new`);
  }
  if (conflicted.length) {
    console.log('\n  Merge each *.new file by hand (diff <file> <file>.new), then delete it.');
  }
}

function nextSteps(platforms) {
  console.log('\nNext steps:');
  if (platforms.includes('claude')) {
    console.log('  Claude Code   start `claude` in this repo and run /pincer-plan <brief>');
  }
  if (platforms.includes('codex')) {
    console.log('  Codex CLI     start `codex` in this repo and type $pincer-plan <brief>  (skills load from .agents/skills/; posture notes in .codex/README.md)');
  }
  if (platforms.includes('copilot')) {
    console.log('  Copilot       enable "chat.promptFiles": true in VS Code settings, then /pincer-plan in chat');
  }
  console.log('  All rules live in AGENTS.md — fill in its Conventions section once you know the stack.');
  const statusCmd = platforms.every((p) => p === 'codex') ? '$pincer-status' : platforms.includes('codex') ? '/pincer-status, $pincer-status on Codex' : '/pincer-status';
  console.log(`  Any session     scripts/pincer-status.sh shows where the workflow stands (also ${statusCmd})`);
}

async function askPlatforms() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const q = (s) => new Promise((res) => rl.question(s, res));
  console.log('Which platform(s) do you use?\n  1) Claude Code\n  2) Codex CLI\n  3) GitHub Copilot\n  4) all of them');
  const answer = (await q('Choose [1-4, default 4]: ')).trim() || '4';
  rl.close();
  const map = { 1: ['claude'], 2: ['codex'], 3: ['copilot'], 4: ['claude', 'codex', 'copilot'] };
  return map[answer] || fail(`invalid choice: ${answer}`);
}

function parsePlatformFlag(args) {
  const i = args.indexOf('--platform');
  if (i === -1) return null;
  const value = args[i + 1] || '';
  if (value === 'all') return ['claude', 'codex', 'copilot'];
  const list = value.split(',').map((s) => s.trim());
  if (list.every((p) => ['claude', 'codex', 'copilot'].includes(p)) && list.length) return list;
  fail(`--platform must be claude, codex, copilot (comma-separated) or all — got "${value}"`);
}

function fail(msg) {
  console.error(`pincer: ${msg}`);
  process.exit(1);
}

async function cmdInit(args) {
  const dir = process.cwd();
  if (readManifest(dir)) {
    fail(`this repo already has PINCER installed (${MANIFEST} exists) — use \`pincer update\`.`);
  }
  const platforms = parsePlatformFlag(args) || (process.stdin.isTTY ? await askPlatforms() : ['claude', 'codex', 'copilot']);
  console.log(`\nInstalling PINCER v${VERSION} for: ${platforms.join(', ')}\n`);
  report(install(dir, platforms, null));
  nextSteps(platforms);
}

async function cmdUpdate() {
  const dir = process.cwd();
  const manifest = readManifest(dir);
  if (!manifest) fail(`no ${MANIFEST} here — run \`pincer init\` first.`);
  console.log(`\nUpdating PINCER ${manifest.version} -> ${VERSION} for: ${manifest.platforms.join(', ')}\n`);
  report(install(dir, manifest.platforms, manifest.files));
}

function cmdDoctor() {
  const dir = process.cwd();
  const manifest = readManifest(dir);
  if (!manifest) fail(`no ${MANIFEST} here — run \`pincer init\` first.`);
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
    if (!fs.existsSync(p)) continue;
    check(!!(fs.statSync(p).mode & 0o100), `${rel} is executable`, `run: chmod +x ${rel}`);
  }

  const gi = fs.existsSync(path.join(dir, '.gitignore')) ? fs.readFileSync(path.join(dir, '.gitignore'), 'utf8') : '';
  check(GITIGNORE_LINES.every((l) => gi.split('\n').map((s) => s.trim()).includes(l)),
    '.gitignore covers .env files', 'add: .env / .env.* / !.env.example');

  const stale = fs.existsSync(TEMPLATE) && manifest.version !== VERSION;
  check(!stale, `install is current (v${manifest.version})`, 'run: pincer update');

  const edited = Object.entries(manifest.files)
    .filter(([rel, h]) => fs.existsSync(path.join(dir, rel)) && sha(fs.readFileSync(path.join(dir, rel))) !== h)
    .map(([rel]) => rel);
  if (edited.length) {
    console.log(`  note  locally edited (kept as-is on update): ${edited.join(', ')}`);
  }

  const leftovers = walk(TEMPLATE).map((r) => path.join(dir, r + '.new')).filter((p) => fs.existsSync(p));
  check(leftovers.length === 0, 'no unmerged *.new files', leftovers.map((p) => path.relative(dir, p)).join(', '));

  console.log(problems ? `\n${problems} problem(s) found.` : '\nAll good.');
  process.exit(problems ? 1 : 0);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'init') await cmdInit(rest);
else if (cmd === 'update') await cmdUpdate();
else if (cmd === 'doctor') cmdDoctor();
else {
  console.log(`pincer-workflow v${VERSION} — PRD-driven agentic delivery workflow

Usage:
  npx pincer-workflow init [--platform claude|codex|copilot|all]
  npx pincer-workflow update
  npx pincer-workflow doctor

Docs: https://github.com/orchestratedbyalex/pincer-workflow`);
  process.exit(cmd ? 1 : 0);
}
