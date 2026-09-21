#!/usr/bin/env node
'use strict';
// Maintainer-only preparation. No git mutation, lifecycle change or publication.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const GENERATED = ['plugin/', 'template/.agents/skills/', 'template/.github/prompts/'];
const owned = rel => rel === 'package.json' || GENERATED.some(prefix => rel.startsWith(prefix));
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function parse(argv) {
  const args = {}; let mode;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--version' && !args.version) args.version = argv[++i];
    else if (['--preview', '--apply'].includes(argv[i]) && !mode) mode = argv[i].slice(2);
    else fail('USAGE', 'Use --version <semver> and exactly one of --preview or --apply; no other or duplicate flags.');
  }
  if (!mode || typeof args.version !== 'string' || !semver.test(args.version)) fail('USAGE', 'Supply a valid SemVer (without v prefix) and exactly one of --preview or --apply.');
  return { version: args.version, mode };
}
function run(root, command, args, extraEnv = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', ...extraEnv } });
  if (result.error || result.status !== 0) fail('CHECK_FAILED', `${command} ${args.join(' ')} failed: ${result.error?.message || result.stderr || result.stdout}`);
  return result.stdout;
}
function digest(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function entry(root, rel) {
  const absolute = path.join(root, rel);
  if (!fs.existsSync(absolute)) return null;
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('UNSAFE_PATH', `${rel}: expected an ordinary file, not a symlink or directory.`);
  return { hash: digest(fs.readFileSync(absolute)), mode: stat.mode & 0o777 };
}
function safePath(root, rel) {
  if (!rel || path.isAbsolute(rel) || rel.split('/').some(x => x === '..' || x === '.')) fail('UNSAFE_PATH', `Unsafe relative path: ${rel}`);
  const parts = rel.split('/'); let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    if (!fs.existsSync(current)) {
      // lstat also detects dangling links, which existsSync deliberately ignores.
      try { if (fs.lstatSync(current).isSymbolicLink()) fail('UNSAFE_PATH', `${rel}: symlink`); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      continue;
    }
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || (i < parts.length - 1 && !stat.isDirectory())) fail('UNSAFE_PATH', `${rel}: unsafe ancestor`);
  }
}
function tree(root) {
  const output = {};
  function walk(rel) {
    for (const name of fs.readdirSync(path.join(root, rel)).sort()) {
      const next = rel ? `${rel}/${name}` : name;
      const stat = fs.lstatSync(path.join(root, next));
      if (stat.isSymbolicLink()) fail('UNSAFE_PATH', `${next}: symlink in preparation input/output`);
      if (stat.isDirectory()) walk(next);
      else if (stat.isFile()) output[next] = entry(root, next);
      else fail('UNSAFE_PATH', `${next}: unsupported file type`);
    }
  }
  walk(''); return output;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function changed(a, b) { return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().filter(rel => !same(a[rel] || null, b[rel] || null)); }
function gitState(root) {
  const head = run(root, 'git', ['rev-parse', 'HEAD']).trim();
  const staged = run(root, 'git', ['diff', '--cached', '--name-only', '-z']);
  if (staged) fail('STAGED_WORK', 'Index contains staged work. Commit or separately resolve it before preparation.');
  const untracked = run(root, 'git', ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  const untrackedForeign = untracked.filter(rel => !owned(rel));
  if (untrackedForeign.length) fail('UNTRACKED_WORK', `Untracked work must be explicitly resolved first: ${untrackedForeign.join(', ')}`);
  const tracked = run(root, 'git', ['ls-files', '-z']).split('\0').filter(Boolean);
  const dirty = run(root, 'git', ['diff', '--name-only', '-z']).split('\0').filter(Boolean);
  const foreign = dirty.filter(rel => !owned(rel));
  if (foreign.length) fail('UNRELATED_WORK', `Commit or separately resolve unrelated changes: ${foreign.join(', ')}`);
  const files = {};
  for (const rel of [...tracked, ...untracked]) { safePath(root, rel); files[rel] = entry(root, rel); }
  return { head, tracked, dirty, untracked, files };
}
function checkPack(scratch, temporary, version) {
  const packed = path.join(temporary, 'packed'); fs.mkdirSync(packed);
  const data = JSON.parse(run(scratch, 'npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', packed],
    { npm_config_cache: path.join(temporary, 'npm-cache'), npm_config_offline: 'true', npm_config_audit: 'false', npm_config_fund: 'false' }))[0];
  if (!data || data.name !== 'pincer-workflow' || data.version !== version) fail('PACK_INVALID', 'Packed package identity/version differs from requested version.');
  const names = new Set(data.files.map(file => file.path));
  for (const rel of ['package.json', 'bin/pincer.js', 'template/AGENTS.md', 'template/.claude/commands/pincer-plan.md',
    'template/.claude/hooks/hook-policy.cjs', 'template/.agents/skills/pincer-plan/SKILL.md',
    'template/.github/prompts/pincer-plan.prompt.md', 'template/scripts/pincer-runtime.cjs',
    'template/scripts/pincer-runtime/lifecycle.cjs', 'template/scripts/pincer-evidence.cjs', 'template/docs/runtime-contracts.md']) {
    if (!names.has(rel)) fail('PACK_INVALID', `Packed layout missing ${rel}`);
  }
  for (const rel of names) if (!(rel === 'package.json' || /^(README|LICENSE)(\.|$)/.test(rel) || rel.startsWith('bin/') || rel.startsWith('template/'))) fail('PACK_INVALID', `Unexpected distributed path: ${rel}`);
  if (!fs.existsSync(path.join(packed, path.basename(data.filename)))) fail('PACK_INVALID', 'npm pack did not produce its reported tarball.');
  const extracted = path.join(temporary, 'extracted'); fs.mkdirSync(extracted);
  run(scratch, 'tar', ['-xzf', path.join(packed, path.basename(data.filename)), '-C', extracted]);
  for (const rel of names) {
    safePath(path.join(extracted, 'package'), rel);
    if (!same(entry(scratch, rel), entry(path.join(extracted, 'package'), rel))) fail('PACK_INVALID', `Packed bytes/mode differ: ${rel}`);
  }
  if (JSON.parse(fs.readFileSync(path.join(extracted, 'package/package.json'))).version !== version) fail('VERSION_MISMATCH', 'Tarball metadata differs from requested version.');
  const plugin = JSON.parse(fs.readFileSync(path.join(scratch, 'plugin/.claude-plugin/plugin.json')));
  if (plugin.version !== version) fail('VERSION_MISMATCH', 'Plugin version disagrees with package version.');
  const market = JSON.parse(fs.readFileSync(path.join(scratch, '.claude-plugin/marketplace.json')));
  if (!market.plugins.some(p => p.name === 'pincer' && p.source === './plugin')) fail('PLUGIN_INVALID', 'Marketplace must resolve pincer to ./plugin.');
  return { version: data.version, files: names.size, tarball_verified: true };
}
function prepare(root, options = {}) {
  root = fs.realpathSync(root);
  const report = { ok: false, mode: options.mode, version: options.version, declared_paths: ['package.json', ...GENERATED], changes: [], applied: [], candidate_selected: false };
  let temporary, before;
  const attempted = [];
  try {
    parse(['--version', options.version, `--${options.mode}`]);
    if (run(root, 'git', ['rev-parse', '--show-toplevel']).trim() !== root) fail('NOT_REPOSITORY_ROOT', 'Run from the distribution repository root.');
    before = gitState(root);
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pincer-release-'));
    const scratch = path.join(temporary, 'source'); fs.mkdirSync(scratch);
    for (const rel of before.tracked) {
      if (!before.files[rel]) continue;
      fs.mkdirSync(path.dirname(path.join(scratch, rel)), { recursive: true });
      fs.copyFileSync(path.join(root, rel), path.join(scratch, rel));
      fs.chmodSync(path.join(scratch, rel), before.files[rel].mode);
    }
    const initial = tree(scratch);
    const packageFile = path.join(scratch, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packageFile));
    if (pkg.name !== 'pincer-workflow') fail('NOT_DISTRIBUTION', 'Expected the pincer-workflow distribution package.');
    if (before.dirty.includes('package.json')) {
      const committed = JSON.parse(run(root, 'git', ['show', 'HEAD:package.json']));
      const actual = { ...pkg }; delete actual.version; delete committed.version;
      if (!same(actual, committed)) fail('UNRELATED_WORK', 'package.json has edits beyond the prepared version.');
    }
    pkg.version = options.version; fs.writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);
    const generate = () => { run(scratch, 'bash', ['template/scripts/sync-prompts.sh']); run(scratch, 'bash', ['scripts/build-plugin.sh']); };
    generate(); const desired = tree(scratch);
    const escaped = changed(initial, desired).filter(rel => !owned(rel));
    if (escaped.length) fail('GENERATOR_SCOPE', `Generator changed undeclared paths: ${escaped.join(', ')}`);
    generate(); if (changed(desired, tree(scratch)).length) fail('GENERATOR_PARITY', 'Generators are not deterministic on a second pass.');
    for (const rel of before.dirty) if (!same(before.files[rel], desired[rel] || null)) fail('OWNED_WORK', `${rel}: existing edits differ from desired generated output; resolve them explicitly.`);
    for (const rel of before.untracked) if (!same(before.files[rel], desired[rel] || null)) fail('UNTRACKED_WORK', `${rel}: untracked file differs from desired generated output; preserve and resolve it separately.`);
    report.pack = checkPack(scratch, temporary, options.version);
    if (changed(desired, tree(scratch)).length) fail('PACK_MUTATION', 'Packaging modified the prepared source.');
    const changes = changed(before.files, desired);
    report.changes = changes.map(rel => ({ path: rel, action: !desired[rel] ? 'delete' : !initial[rel] ? 'add' : 'update' }));
    // Recheck all source bytes, modes, index, HEAD and untracked work after slow generators.
    if (!same(before, gitState(root))) fail('SOURCE_CHANGED', 'Repository changed during scratch validation; nothing applied.');
    for (const rel of changes) {
      safePath(root, rel);
      if (!before.tracked.includes(rel) && fs.existsSync(path.join(root, rel))) fail('UNTRACKED_WORK', `${rel}: existing ignored file would be overwritten.`);
    }
    if (options.mode === 'apply') for (const rel of changes) {
      // Never recursively replace a directory: only explicitly computed files are touched.
      const target = path.join(root, rel);
      safePath(root, rel);
      attempted.push(rel);
      if (desired[rel]) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, fs.readFileSync(path.join(scratch, rel)));
        report.applied.push(rel); // A chmod failure still reports the written file.
        fs.chmodSync(target, desired[rel].mode);
      } else { fs.unlinkSync(target); report.applied.push(rel); }
    }
    report.ok = true;
    report.message = options.mode === 'preview' ? 'Scratch validation passed; target unchanged. Review listed changes before apply.' : 'Preparation validated and applied. Review and commit before selecting the candidate; evaluation and release gates remain required.';
  } catch (error) {
    report.applied = attempted.filter(rel => { try { return !same(before.files[rel] || null, entry(root, rel)); } catch { return true; } });
    report.code = error.code || 'PREPARATION_FAILED'; report.message = error.message;
    report.partial = report.applied.length > 0;
  } finally { if (temporary) fs.rmSync(temporary, { recursive: true, force: true }); }
  return report;
}
function main(argv = process.argv.slice(2), root = process.cwd()) {
  let options;
  try { options = parse(argv); } catch (error) { process.stdout.write(`${JSON.stringify({ ok: false, code: error.code, message: error.message, applied: [] }, null, 2)}\n`); return 2; }
  const report = prepare(root, options); process.stdout.write(`${JSON.stringify(report, null, 2)}\n`); return report.ok ? 0 : 1;
}
if (require.main === module) process.exitCode = main();
module.exports = { parse, prepare, main };
