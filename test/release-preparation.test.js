import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { repo, tempDir, run, write, read, createPrd, createTicket, step, writeEvidence, writeNotes, statusScript } from './helpers.js';
const require = createRequire(import.meta.url);
const { prepare } = require('../scripts/prepare-release.cjs');
const script = path.join(repo, 'scripts/prepare-release.cjs');
function pass(result) { assert.equal(result.status, 0, result.stdout + result.stderr); return result.stdout; }
function git(dir, ...args) { return pass(run(dir, 'git', args)).trim(); }
function commit(dir, message = 'fixture') {
  git(dir, 'add', '-A'); git(dir, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', message);
  return git(dir, 'rev-parse', 'HEAD');
}
function fixture() {
  const dir = tempDir();
  for (const rel of ['package.json', 'bin', 'template', 'plugin', 'scripts/build-plugin.sh', '.claude-plugin', 'README.md', 'LICENSE']) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.cpSync(path.join(repo, rel), path.join(dir, rel), { recursive: true });
  }
  // Keep the fixture's starting version independent of future real releases: testing
  // preparation to 0.7.0 must still exercise an update when the repository is 0.7.0.
  for (const rel of ['package.json', 'plugin/.claude-plugin/plugin.json']) {
    const metadata = JSON.parse(read(dir, rel)); metadata.version = '0.0.0-fixture';
    write(dir, rel, JSON.stringify(metadata, null, 2) + '\n');
  }
  git(dir, 'init', '-q'); commit(dir); return dir;
}
function snapshot(dir) {
  const result = {};
  function visit(relative = '') {
    for (const name of fs.readdirSync(path.join(dir, relative)).sort()) {
      const rel = relative ? `${relative}/${name}` : name;
      const stat = fs.lstatSync(path.join(dir, rel));
      if (stat.isDirectory()) visit(rel);
      else result[rel] = { mode: stat.mode & 0o777, data: stat.isSymbolicLink() ? fs.readlinkSync(path.join(dir, rel)) : crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, rel))).digest('hex') };
    }
  }
  visit(); return result;
}
function cli(dir, args = ['--version', '0.7.0', '--apply']) {
  const result = run(dir, process.execPath, [script, ...args], { timeout: 120000 });
  assert.equal(result.error, undefined, result.error?.message);
  return { status: result.status, report: JSON.parse(result.stdout) };
}
function refusedUnchanged(dir, code, args) {
  const before = snapshot(dir); const result = cli(dir, args);
  assert.notEqual(result.status, 0); assert.equal(result.report.ok, false);
  assert.equal(result.report.code, code, JSON.stringify(result.report));
  assert.deepEqual(snapshot(dir), before, `${code}: no target/index/ref mutation`);
  assert.deepEqual(result.report.applied, []); return result;
}

// Real generators and packed tarball checks; preview leaves even the index untouched.
const dir = fixture();
const initial = snapshot(dir); const initialHead = git(dir, 'rev-parse', 'HEAD');
const preview = cli(dir, ['--version', '0.7.0', '--preview']);
assert.equal(preview.status, 0, JSON.stringify(preview.report));
assert.equal(preview.report.pack.tarball_verified, true);
assert.deepEqual(snapshot(dir), initial, 'preview writes no target files, git objects or index');
assert.deepEqual(preview.report.applied, []);
assert.ok(preview.report.changes.some(x => x.path === 'package.json'));
assert.ok(preview.report.changes.some(x => x.path === 'plugin/.claude-plugin/plugin.json'));
const applied = cli(dir);
assert.equal(applied.status, 0, JSON.stringify(applied.report));
assert.deepEqual(applied.report.changes, preview.report.changes);
assert.equal(JSON.parse(read(dir, 'package.json')).version, '0.7.0');
assert.equal(JSON.parse(read(dir, 'plugin/.claude-plugin/plugin.json')).version, '0.7.0');
assert.equal(git(dir, 'rev-parse', 'HEAD'), initialHead);
assert.equal(git(dir, 'tag', '--list'), '');
assert.equal(git(dir, 'diff', '--cached', '--name-only'), '');
const prepared = snapshot(dir);
const repeated = cli(dir); assert.equal(repeated.status, 0, JSON.stringify(repeated.report));
assert.deepEqual(repeated.report.changes, []); assert.deepEqual(snapshot(dir), prepared);
assert.equal(repeated.report.candidate_selected, false);
const owned = rel => rel === 'package.json' || ['plugin/', 'template/.agents/skills/', 'template/.github/prompts/'].some(p => rel.startsWith(p));
for (const rel of Object.keys(prepared)) if (!owned(rel)) assert.deepEqual(prepared[rel], initial[rel], `preserved ${rel}`);

// CLI invalidity is rejected before scratch work or mutation.
for (const args of [[], ['--apply'], ['--version','01.2.3','--apply'], ['--version','1.2.3-01','--apply'],
  ['--version','v1.2.3','--apply'], ['--version','1.2.3','--apply','--preview'],
  ['--version','1.2.3','--apply','--version','2.0.0'], ['--version','1.2.3','--apply','--unknown'],
  ['--preview','--version'], ['--version','1.2.3+','--preview']]) refusedUnchanged(dir, 'USAGE', args);

// User work, including owned generated edits, is never swallowed by preparation.
commit(dir, 'prepared metadata');
write(dir, 'README.md', 'user work\n'); refusedUnchanged(dir, 'UNRELATED_WORK');
git(dir, 'restore', 'README.md');
write(dir, 'unrelated.txt', 'user work\n'); refusedUnchanged(dir, 'UNTRACKED_WORK'); fs.unlinkSync(path.join(dir,'unrelated.txt'));
write(dir, 'README.md', 'staged user work\n'); git(dir, 'add', 'README.md'); refusedUnchanged(dir, 'STAGED_WORK'); git(dir, 'restore', '--staged', 'README.md'); git(dir, 'restore', 'README.md');
write(dir, 'plugin/commands/plan.md', 'authored changes\n'); refusedUnchanged(dir, 'OWNED_WORK'); git(dir, 'restore', 'plugin/commands/plan.md');
const altered = JSON.parse(read(dir, 'package.json')); altered.description = 'unrelated'; write(dir, 'package.json', JSON.stringify(altered)); refusedUnchanged(dir, 'UNRELATED_WORK'); git(dir, 'restore', 'package.json');

// New canonical playbooks create untracked generated files; an exact second apply is safe.
{
  const f = fixture();
  fs.copyFileSync(path.join(f,'template/.claude/commands/pincer-plan.md'), path.join(f,'template/.claude/commands/pincer-extra.md'));
  write(f,'plugin/commands/obsolete.md','stale generated output');
  commit(f,'new canonical playbook');
  const first = cli(f); assert.equal(first.status,0,JSON.stringify(first.report));
  assert.ok(first.report.changes.some(row => row.action === 'add'));
  assert.ok(first.report.changes.some(row => row.path === 'plugin/commands/obsolete.md' && row.action === 'delete'));
  const before = snapshot(f); const again = cli(f);
  assert.equal(again.status,0,JSON.stringify(again.report)); assert.deepEqual(again.report.changes,[]); assert.deepEqual(snapshot(f),before);
  write(f,'plugin/commands/extra.md','user rewrite'); refusedUnchanged(f,'UNTRACKED_WORK');
}
// Ignored files at new output paths also count as user work, not disposable output.
{
  const f = fixture();
  fs.copyFileSync(path.join(f,'template/.claude/commands/pincer-plan.md'),path.join(f,'template/.claude/commands/pincer-extra.md'));
  write(f,'.gitignore','plugin/commands/extra.md\n'); commit(f,'ignored output fixture');
  write(f,'plugin/commands/extra.md','private ignored work'); refusedUnchanged(f,'UNTRACKED_WORK');
}
// The exported API enforces the same mode/version validation before writes.
for (const options of [{version:'0.7.0',mode:'oops'},{version:'bad',mode:'apply'}]) {
  const before = snapshot(dir); const report = prepare(dir,options);
  assert.equal(report.ok,false); assert.equal(report.code,'USAGE'); assert.deepEqual(snapshot(dir),before);
}

// Scratch generator failures, undeclared writes and nondeterminism leave target untouched.
for (const [suffix, code] of [
  ['\nexit 17\n','CHECK_FAILED'],
  ['\nprintf changed > README.md\n','GENERATOR_SCOPE'],
  ['\nprintf "$RANDOM" >> plugin/commands/plan.md\n','GENERATOR_PARITY'],
]) {
  const f = fixture(); fs.appendFileSync(path.join(f,'scripts/build-plugin.sh'), suffix); commit(f, 'broken generator fixture'); refusedUnchanged(f, code);
}
{
  const f = fixture(); const pkg = JSON.parse(read(f, 'package.json')); pkg.files = ['bin'];
  write(f,'package.json', JSON.stringify(pkg,null,2)+'\n'); commit(f, 'broken pack fixture'); refusedUnchanged(f,'PACK_INVALID');
}
{
  const f = fixture(); fs.unlinkSync(path.join(f,'template/.claude/commands/pincer-plan.md'));
  fs.symlinkSync('/tmp', path.join(f,'template/.claude/commands/pincer-plan.md'));
  commit(f, 'symlink fixture'); refusedUnchanged(f,'UNSAFE_PATH');
}

// A target write failure after validation reports actual partial files, never success.
{
  const f = fixture(); const original = fs.chmodSync;
  const originalVersion = JSON.parse(read(f,'plugin/.claude-plugin/plugin.json')).version;
  fs.chmodSync = function(file, ...args) {
    if (file === path.join(fs.realpathSync(f),'package.json')) throw Object.assign(new Error('injected target chmod failure'),{code:'EIO'});
    return original.call(this,file,...args);
  };
  let result;
  try { result = prepare(f,{version:'0.7.0',mode:'apply'}); } finally { fs.chmodSync = original; }
  assert.equal(result.ok,false); assert.equal(result.partial,true); assert.deepEqual(result.applied,['package.json']);
  assert.equal(JSON.parse(read(f,'package.json')).version,'0.7.0');
  assert.equal(JSON.parse(read(f,'plugin/.claude-plugin/plugin.json')).version,originalVersion);
  assert.equal(git(f,'diff','--cached','--name-only'),'');
}

// A write that truncates then throws is also reported as a partial effect.
{
  const f = fixture(); const original = fs.writeFileSync;
  fs.writeFileSync = function(file, data, ...args) {
    if (file === path.join(fs.realpathSync(f),'package.json')) {
      original.call(this,file,'truncated'); throw Object.assign(new Error('injected partial write'),{code:'EIO'});
    }
    return original.call(this,file,data,...args);
  };
  let report;
  try { report = prepare(f,{version:'0.7.0',mode:'apply'}); } finally { fs.writeFileSync = original; }
  assert.equal(report.ok,false); assert.equal(report.partial,true); assert.deepEqual(report.applied,['package.json']);
  assert.equal(read(f,'package.json'),'truncated');
}

// Prepared metadata is committed before selecting/evaluating a real candidate fixture.
// Uses the runtime status/evidence boundary, not an authored string assertion.
const base = git(dir,'rev-parse','HEAD');
createPrd(dir); createTicket(dir,{command:'test "$(cat source.txt)" = good'}); write(dir,'source.txt','good');
pass(step(dir,'verify')); pass(step(dir,'done'));
write(dir,'.prd/prd-v1.md',read(dir,'.prd/prd-v1.md').replace('ticketed','built'));
commit(dir,'built source before release preparation');
assert.equal(cli(dir,['--version','0.7.1-rc.1+fixture','--apply']).status,0);
const candidate = commit(dir,'prepared candidate');
const evidence = writeEvidence(dir,{base,candidate}); writeNotes(dir,{base,candidate,evidence:evidence.manifest}); commit(dir,'evaluation');
let status = pass(run(dir,'bash',[statusScript]));
assert.match(status,new RegExp(`Notes.*current \\(${candidate}\\)`));
assert.match(status,/Next.*pincer-release/);
const evaluated = git(dir,'rev-parse','HEAD');
write(dir,'source.txt','later change'); commit(dir,'source after evaluation');
status = pass(run(dir,'bash',[statusScript])); assert.match(status,/stale: candidate changed after evaluation: source.txt/);
// Restore the evaluated snapshot on a fresh local branch for an independent version test.
git(dir,'checkout','-q','-b','version-mutation',evaluated);
const pkg = JSON.parse(read(dir,'package.json')); pkg.version = '0.7.2'; write(dir,'package.json',JSON.stringify(pkg,null,2)+'\n'); commit(dir,'version after evaluation');
status = pass(run(dir,'bash',[statusScript])); assert.match(status,/stale: candidate changed after evaluation: package.json/);
console.log('release preparation tests passed (scratch generators/pack, refusal/preservation, partial effects, candidate freshness)');
