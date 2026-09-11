// Change identity and source identity (PRD v4 R-02, R-04): registration binds
// one explicitly selected PRD revision; the source manifest changes for every
// source change class and stays stable for lifecycle fields and checkbox marks;
// secret, symlink, submodule and non-git inputs follow the contract with no
// silent omission and no secret value in any output.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, createTicket, createPrd, write, read, run } from './helpers.js';

const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const require = createRequire(import.meta.url);
const identity = require(path.join(repo, 'template/scripts/pincer-runtime/identity.cjs'));
const source = require(path.join(repo, 'template/scripts/pincer-runtime/source.cjs'));
const parse = require(path.join(repo, 'template/scripts/pincer-runtime/parse.cjs'));

const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args]);
function passes(result, label) { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message) {
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=Pincer Test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '--allow-empty', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}
function fixture({ prds = [1] } = {}) {
  const dir = tempDir(); git(dir, 'init', '-q');
  for (const v of prds) createPrd(dir, v);
  createTicket(dir);
  write(dir, 'src/app.js', 'module.exports = 1;\n');
  write(dir, 'test/app.test.js', 'require("../src/app.js");\n');
  write(dir, 'package-lock.json', '{"lockfileVersion": 3}\n');
  write(dir, 'config.json', '{"port": 3000}\n');
  write(dir, '.gitignore', 'node_modules/\n.env\n.env.*\n!.env.example\n');
  commit(dir, 'base');
  return dir;
}
const digestOf = dir => { const m = source.snapshot(dir); assert.deepEqual(m.problems, [], `snapshot problems: ${JSON.stringify(m.problems)}`); return m.digest; };
const binding = (dir, id = 'prd-v1') => JSON.parse(read(dir, `.prd/changes/${id}.json`));

// Registration writes a valid binding; base is HEAD; default change ID is prd-vN.
{
  const dir = fixture();
  const out = passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'), 'register');
  assert.match(out, /^registered change prd-v1 → \.prd\/prd-v1\.md revision [0-9a-f]{12} base [0-9a-f]{7} \(\.prd\/changes\/prd-v1\.json\)$/m);
  const b = binding(dir);
  assert.equal(identity.validateBinding(b), null);
  assert.equal(b.base, git(dir, 'rev-parse', 'HEAD'));
  assert.equal(b.prd_revision, parse.prdDigest(read(dir, '.prd/prd-v1.md')));
  assert.equal(b.authorization, null);
  const note = rt(dir, 'register', '--prd', '.prd/prd-v1.md');
  assert.match(note.stdout, /^unchanged change prd-v1/, 'same revision is idempotent');
  assert.match(note.stderr, /does not prove human approval/, 'absent authorization is stated, never inferred from PRD status');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md', '--authorization', 'user approved the breakdown on 2026-09-11'), 'record authorization');
  assert.equal(binding(dir).authorization, 'user approved the breakdown on 2026-09-11');
  const loaded = identity.loadBinding(dir, { prd: '.prd/prd-v1.md' });
  assert.ok(loaded.binding, JSON.stringify(loaded));
}

// S-04: identical commands in two PRDs are two changes; the binding names each.
{
  const dir = fixture({ prds: [1, 2] });
  createTicket(dir, { id: 'T-02', prd: '.prd/prd-v2.md' });
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'), 'register v1');
  const refused = rt(dir, 'register', '--prd', '.prd/prd-v2.md');
  assert.equal(refused.status, 4, 'second PRD refused without --replace');
  assert.match(refused.stderr, /already binds \.prd\/prd-v1\.md as change "prd-v1"/);
  assert.match(refused.stderr, /--replace/);
  assert.ok(!fs.existsSync(path.join(dir, '.prd/changes/prd-v2.json')));
  const other = identity.loadBinding(dir, { prd: '.prd/prd-v2.md' });
  assert.equal(other.code, 'CHANGE_REQUIRED'); assert.equal(other.other, true, 'a binding for another PRD is not this PRD\'s binding');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v2.md', '--replace'), 'replace');
  assert.ok(!fs.existsSync(path.join(dir, '.prd/changes/prd-v1.json')), 'old binding removed');
  assert.equal(binding(dir, 'prd-v2').prd, '.prd/prd-v2.md');
  assert.notEqual(binding(dir, 'prd-v2').prd_revision, parse.prdDigest(read(dir, '.prd/prd-v1.md')), 'revisions differ per PRD');
  // Never the highest PRD number on its own: --prd is required.
  assert.equal(rt(dir, 'register').status, 2);
}

// S-05: PRD content edits invalidate the binding; a status change does not; --rebind clears it.
{
  const dir = fixture();
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'), 'register');
  const before = binding(dir);
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('status: ticketed', 'status: built'));
  assert.ok(identity.loadBinding(dir, { prd: '.prd/prd-v1.md' }).binding, 'lifecycle status change keeps the binding current');
  write(dir, '.prd/prd-v1.md', `${read(dir, '.prd/prd-v1.md')}\nR-02 added later.\n`);
  const changed = identity.loadBinding(dir, { prd: '.prd/prd-v1.md' });
  assert.equal(changed.code, 'REVISION_CHANGED');
  assert.match(changed.problem, /content changed since registration .* --rebind/);
  const refused = rt(dir, 'register', '--prd', '.prd/prd-v1.md');
  assert.equal(refused.status, 4); assert.match(refused.stderr, /--rebind/);
  assert.deepEqual(binding(dir), before, 'a refused register writes nothing');
  const rebound = rt(dir, 'register', '--prd', '.prd/prd-v1.md', '--rebind');
  assert.equal(rebound.status, 0, rebound.stderr);
  assert.match(rebound.stdout, /^rebound change prd-v1/);
  assert.match(rebound.stderr, /no longer establish readiness/);
  assert.ok(identity.loadBinding(dir, { prd: '.prd/prd-v1.md' }).binding);
  assert.equal(binding(dir).base, before.base, 'rebind keeps the base');
  assert.notEqual(binding(dir).prd_revision, before.prd_revision);
}

// S-06: missing, duplicate, malformed, unsupported-schema and ambiguous identifiers.
{
  const dir = fixture();
  let r = identity.loadBinding(dir, { prd: '.prd/prd-v1.md' });
  assert.equal(r.code, 'CHANGE_REQUIRED'); assert.match(r.problem, /register --prd \.prd\/prd-v1\.md/);
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'), 'register');
  const good = read(dir, '.prd/changes/prd-v1.json');
  write(dir, '.prd/changes/other.json', good.replace('"prd-v1"', '"other"'));
  r = identity.loadBinding(dir); assert.equal(r.code, 'AMBIGUOUS'); assert.match(r.problem, /other\.json, prd-v1\.json/);
  assert.equal(rt(dir, 'register', '--prd', '.prd/prd-v1.md').status, 4, 'ambiguous bindings refuse registration');
  fs.unlinkSync(path.join(dir, '.prd/changes/other.json'));
  write(dir, '.prd/changes/prd-v1.json', '{"schema": 1,');
  r = identity.loadBinding(dir); assert.equal(r.code, 'MALFORMED'); assert.match(r.problem, /malformed JSON/);
  write(dir, '.prd/changes/prd-v1.json', good.replace('"schema": 1', '"schema": 9'));
  r = identity.loadBinding(dir); assert.equal(r.code, 'UNSUPPORTED_SCHEMA'); assert.match(r.problem, /unsupported binding schema 9/);
  write(dir, '.prd/changes/prd-v1.json', good.replace(/"base": "[0-9a-f]{40}"/, '"base": "short"'));
  r = identity.loadBinding(dir); assert.equal(r.code, 'MALFORMED'); assert.match(r.problem, /base must be a full 40-hex commit ID/);
  write(dir, '.prd/changes/prd-v1.json', good.replace('"prd-v1"', '"renamed"'));
  r = identity.loadBinding(dir); assert.equal(r.code, 'MALFORMED'); assert.match(r.problem, /filename does not match change/);
  write(dir, '.prd/changes/prd-v1.json', good);
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('status: ticketed', 'status: nonsense'));
  r = identity.loadBinding(dir); assert.equal(r.code, 'INPUT_INVALID'); assert.match(r.problem, /PRD status must be/);
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('status: nonsense', 'status: ticketed'));
  // Registration itself validates its inputs.
  const noGit = tempDir(); createPrd(noGit);
  const refused = rt(noGit, 'register', '--prd', '.prd/prd-v1.md');
  assert.equal(refused.status, 4); assert.match(refused.stderr, /needs a git repository/);
  assert.match(rt(dir, 'register', '--prd', '.prd/prd-v7.md').stderr, /PRD does not exist/);
  assert.match(rt(dir, 'register', '--prd', '.prd/prd-v1.md', '--change', 'Bad_ID').stderr, /change ID must match/);
}

// S-11 (static): every source change class changes the digest; S-12: lifecycle
// fields, checkbox marks and attempts do not, acceptance text and the exclude file do.
{
  const dir = fixture();
  write(dir, 'bin/run.sh', '#!/bin/sh\necho hi\n'); commit(dir, 'script');
  const base = digestOf(dir);
  const changes = {
    'source edit': () => write(dir, 'src/app.js', 'module.exports = 2;\n'),
    'test edit': () => write(dir, 'test/app.test.js', '// changed\n'),
    'lockfile edit': () => write(dir, 'package-lock.json', '{"lockfileVersion": 2}\n'),
    'config edit': () => write(dir, 'config.json', '{"port": 3001}\n'),
    'new untracked file': () => write(dir, 'src/new.js', ''),
    'deletion': () => fs.unlinkSync(path.join(dir, 'config.json')),
    'mode change': () => fs.chmodSync(path.join(dir, 'bin/run.sh'), 0o755),
    'PRD body edit': () => write(dir, '.prd/prd-v1.md', `${read(dir, '.prd/prd-v1.md')}\nmore\n`),
    'ticket check edit': () => write(dir, 'tickets/T-01-example.md', read(dir, 'tickets/T-01-example.md').replace('\ntrue\n', '\ntrue && true\n')),
    'acceptance text edit': () => write(dir, 'tickets/T-01-example.md', read(dir, 'tickets/T-01-example.md').replace('expected behavior', 'expected behaviour')),
    'exclusion configuration': () => write(dir, '.prd/source-exclude', '# nothing excluded yet\n'),
  };
  for (const [label, apply] of Object.entries(changes)) {
    apply();
    assert.notEqual(digestOf(dir), base, `${label} changes the source digest`);
    git(dir, 'checkout', '--', '.'); git(dir, 'clean', '-fdq');
    assert.equal(digestOf(dir), base, `${label} reverted restores the digest`);
  }
  const stable = {
    'ticked box': () => write(dir, 'tickets/T-01-example.md', read(dir, 'tickets/T-01-example.md').replace('- [x] expected behavior', '- [ ] expected behavior')),
    'lifecycle fields': () => write(dir, 'tickets/T-01-example.md', read(dir, 'tickets/T-01-example.md').replace('status: open', 'status: done\nstarted: 2026-09-11T00:00:00Z\nlast_check: 2026-09-11T00:01:00Z passed abcdef012345\nverified: 2026-09-11T00:01:00Z abcdef012345\nfinished: 2026-09-11T00:02:00Z')),
    'PRD status': () => write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('status: ticketed', 'status: built')),
    'NOTES.md': () => write(dir, 'NOTES.md', '# notes\n'),
    'evidence artifact': () => write(dir, '.prd/evidence/prd-v1/x/manifest.json', '{}'),
    'change binding': () => write(dir, '.prd/changes/prd-v1.json', '{}'),
    'local runtime state (an attempt)': () => write(dir, '.pincer/runtime/attempts/000001.json', '{}'),
  };
  for (const [label, apply] of Object.entries(stable)) {
    apply();
    assert.equal(digestOf(dir), base, `${label} keeps the source digest`);
    git(dir, 'checkout', '--', '.'); git(dir, 'clean', '-fdq');
  }
  // Untracked exclusions are honoured; tracked or protected matches are refused.
  write(dir, 'build/out.js', 'generated\n');
  const withBuild = digestOf(dir);
  assert.notEqual(withBuild, base);
  write(dir, '.prd/source-exclude', 'build/\n');
  const m = source.snapshot(dir);
  assert.deepEqual(m.problems, []);
  assert.ok(m.excluded.includes('build/out.js'), 'untracked generated output excluded by configuration');
  assert.ok(m.files.some(e => e.path === '.prd/source-exclude'), 'the exclude file is itself an input');
  for (const [pattern, expected] of [['src/', /matches tracked file src\/app\.js/], ['*.js', /matches tracked file/], ['tickets/', /matches protected path tickets\//], ['.prd/*', /matches protected path/], ['source-exclude', /matches protected path \.prd\/source-exclude/]]) {
    write(dir, '.prd/source-exclude', `${pattern}\n`);
    const refused = source.snapshot(dir);
    assert.ok(refused.problems.some(p => p.code === 'UNSUPPORTED_INPUT' && expected.test(p.detail)), `pattern ${pattern} refused: ${JSON.stringify(refused.problems)}`);
    assert.equal(refused.digest, null);
    assert.equal(rt(dir, 'snapshot').status, 4);
  }
  git(dir, 'checkout', '--', '.'); git(dir, 'clean', '-fdq');
  // snapshot CLI: text and JSON forms; --store is content-addressed and never written by inspection.
  const text = passes(rt(dir, 'snapshot'), 'snapshot');
  assert.match(text, new RegExp(`^digest ${base}\nfiles \\d+\nexcluded 0\n$`));
  const json = JSON.parse(passes(rt(dir, 'snapshot', '--json'), 'snapshot --json'));
  assert.equal(json.digest, base); assert.equal(json.schema, 1);
  assert.ok(json.files.some(e => e.path === 'bin/run.sh' && e.mode === '100644'));
  assert.ok(json.limitations.some(l => /external services/.test(l)));
  assert.ok(!fs.existsSync(path.join(dir, '.pincer')), 'snapshot without --store writes nothing');
  passes(rt(dir, 'snapshot', '--store'), 'snapshot --store');
  assert.ok(fs.existsSync(path.join(dir, `.pincer/runtime/manifests/${base}.json`)));
  assert.equal(git(dir, 'status', '--porcelain', '--untracked-files=all', '--ignored=no'), '?? .pincer/runtime/manifests/' + base + '.json', 'local state is untracked until migration ignores it');
}

// S-14: secret paths block with a path-only diagnostic; .env.example is ordinary;
// symlinks and submodules are refused; ignored dependencies are limitations;
// a non-git directory is refused.
{
  const dir = fixture();
  write(dir, '.env.example', 'API_KEY=\n');
  assert.ok(source.snapshot(dir).files.some(e => e.path === '.env.example'), '.env.example is ordinary input');
  write(dir, '.env', 'API_KEY=supersecretvalue123\n');
  assert.deepEqual(source.snapshot(dir).problems, [], 'an ignored .env is not in the source view');
  git(dir, 'add', '-f', '.env');
  const secret = source.snapshot(dir);
  assert.equal(secret.digest, null);
  assert.equal(secret.problems[0].code, 'SECRET_PATH');
  assert.match(secret.problems[0].detail, /^\.env: secret file/);
  const cli = rt(dir, 'snapshot', '--json');
  assert.equal(cli.status, 4);
  assert.doesNotMatch(cli.stdout + cli.stderr, /supersecretvalue123/, 'no secret value in any output');
  assert.match(cli.stderr, /SECRET_PATH: \.env:/);
  git(dir, 'rm', '-q', '--cached', '.env'); fs.unlinkSync(path.join(dir, '.env'));
  write(dir, 'config/.env.local', 'X=1\n'); git(dir, 'add', '-f', 'config/.env.local');
  assert.equal(source.snapshot(dir).problems[0].code, 'SECRET_PATH', 'nested .env.* is a secret path');
  git(dir, 'rm', '-qf', 'config/.env.local');

  write(dir, 'node_modules/dep/index.js', 'x');
  const limited = source.snapshot(dir);
  assert.deepEqual(limited.problems, []);
  assert.ok(limited.limitations.some(l => /ignored paths are not part of the source identity: node_modules\//.test(l)), limited.limitations.join('|'));
  assert.ok(!limited.files.some(e => e.path.startsWith('node_modules/')), 'ignored dependencies are never hashed');

  fs.symlinkSync('src/app.js', path.join(dir, 'link.js'));
  const linked = source.snapshot(dir);
  assert.equal(linked.digest, null);
  assert.match(linked.problems[0].detail, /link\.js: symbolic links are not supported/);
  fs.unlinkSync(path.join(dir, 'link.js'));

  const sub = tempDir(); git(sub, 'init', '-q'); write(sub, 'README', 'sub\n'); commit(sub, 'sub');
  passes(run(dir, 'git', ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', sub, 'vendor/sub']), 'submodule add');
  const withSub = source.snapshot(dir);
  assert.equal(withSub.digest, null);
  assert.ok(withSub.problems.some(p => /vendor\/sub: submodules are not supported/.test(p.detail)), JSON.stringify(withSub.problems));

  const noGit = tempDir(); write(noGit, 'a.txt', 'a');
  const refused = source.snapshot(noGit);
  assert.equal(refused.problems[0].code, 'UNSUPPORTED_INPUT'); assert.match(refused.problems[0].detail, /not inside a git repository/);
  assert.equal(rt(noGit, 'snapshot').status, 4);
}

// A project below the git toplevel snapshots its own subtree with project-relative paths.
{
  const top = tempDir(); git(top, 'init', '-q'); write(top, 'README.md', 'mono\n'); commit(top, 'root');
  const project = path.join(top, 'packages', 'app'); fs.mkdirSync(project, { recursive: true });
  write(project, 'index.js', 'x\n'); commit(top, 'app');
  const m = source.snapshot(project);
  assert.deepEqual(m.problems, []);
  assert.deepEqual(m.files.map(e => e.path), ['index.js']);
}

// Digest lines sort in byte order and non-ASCII paths are kept unquoted.
{
  const dir = fixture();
  write(dir, 'docs/résumé.md', 'é\n');
  const m = source.snapshot(dir);
  assert.ok(m.files.some(e => e.path === 'docs/résumé.md'), m.files.map(e => e.path).join(','));
  const paths = m.files.map(e => Buffer.from(e.path));
  for (let i = 1; i < paths.length; i++) assert.ok(Buffer.compare(paths[i - 1], paths[i]) < 0, 'byte-ordered');
}
console.log('runtime identity and source manifest tests passed');
