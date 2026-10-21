// Repository recon and the greenfield/brownfield classification through
// scripts/pincer-blueprint.cjs recon. Fixtures are built here with git init.
// Run with: node test/recon.test.js
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, run, write } from './helpers.js';

const require = createRequire(import.meta.url);
const { recon, classify } = require(path.join(repo, 'template/scripts/pincer/recon.cjs'));
const blueprint = path.join(repo, 'template/scripts/pincer-blueprint.cjs');
const cliFile = path.join(repo, 'template/scripts/pincer/cli.cjs');
const cli = (dir, ...args) => run(dir, process.execPath, [blueprint, ...args]);
const both = (r) => `${r.stdout}${r.stderr}`;
const gitEnv = {
  ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test Author', GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test Author', GIT_COMMITTER_EMAIL: 'test@example.com',
};
function git(dir, ...args) {
  const r = run(dir, 'git', ['-c', 'commit.gpgsign=false', ...args], { env: gitEnv });
  assert.equal(r.status, 0, both(r));
  return r.stdout.trim();
}
function commit(dir, message) { git(dir, 'add', '-A'); git(dir, 'commit', '-q', '--allow-empty', '-m', message); }
function gitDir() { const dir = tempDir(); git(dir, 'init', '-q', '--initial-branch=main'); return dir; }

// An empty directory: greenfield, no git, nothing seen, exit 0
let dir = tempDir();
let result = recon(dir);
assert.equal(result.kind, 'greenfield');
assert.equal(result.facts.git, false);
assert.equal(result.facts.commits, 0);
assert.equal(result.facts.sourceFiles, 0);
assert.deepEqual(result.facts.ci, []);
assert.deepEqual(result.facts.deploy, []);
assert.ok(result.unavailable.includes('git'), JSON.stringify(result.unavailable));
assert.ok(result.unavailable.includes('gh'), JSON.stringify(result.unavailable));
assert.deepEqual(result.facts.gh, { available: false, issues: null, prs: null, protection: null });
assert.ok(result.reasons.length >= 1 && result.reasons.every((s) => /^[A-Z0-9].*\.$/.test(s)), JSON.stringify(result.reasons));
assert.equal(result.prefill.project.kind, 'greenfield');
let r = cli(dir, 'recon');
assert.equal(r.status, 0, both(r));
assert.equal(r.stdout.split('\n')[0], 'greenfield');
for (const reason of result.reasons) assert.ok(r.stdout.includes(reason), r.stdout);
assert.match(r.stdout, /^could not see: git, gh$/m);
assert.equal(r.stderr, '');

// --json parses and carries the five keys; gh is never queried without --network
r = cli(dir, 'recon', '--json');
assert.equal(r.status, 0, both(r));
let parsed = JSON.parse(r.stdout);
assert.deepEqual(Object.keys(parsed).sort(), ['facts', 'kind', 'prefill', 'reasons', 'unavailable']);
assert.equal(parsed.facts.gh.available, false);
// the same through the engine's cli and through --root from elsewhere
r = run(dir, process.execPath, [cliFile, 'recon', '--json']);
assert.equal(r.status, 0, both(r));
assert.equal(JSON.parse(r.stdout).kind, 'greenfield');
r = cli(tempDir(), '--root', dir, 'recon', '--json');
assert.equal(r.status, 0, both(r));
assert.equal(JSON.parse(r.stdout).facts.git, false);

// Six commits each adding a .js file: brownfield because of the history
dir = gitDir();
for (let i = 1; i <= 6; i++) { write(dir, `src/mod${i}.js`, `module.exports = ${i};\n`); commit(dir, `add mod${i}`); }
result = recon(dir);
assert.equal(result.kind, 'brownfield', JSON.stringify(result));
assert.ok(result.reasons.some((s) => /6 commits/.test(s)), JSON.stringify(result.reasons));
assert.equal(result.facts.git, true);
assert.equal(result.facts.commits, 6);
assert.equal(result.facts.sourceFiles, 6);
assert.deepEqual(result.facts.authors, ['Test Author']);
assert.equal(result.facts.branch, 'main');
assert.deepEqual(result.facts.branches, ['main']);
assert.equal(result.facts.mergeStyle, 'squash-or-rebase');
assert.equal(result.facts.remote, null);
assert.equal(result.facts.forge, null);
assert.equal(result.facts.tags, 0);
assert.deepEqual(result.facts.languages, ['JavaScript']);
assert.equal(result.facts.packageManager, null);
assert.deepEqual(result.facts.tests, { present: false, runner: null });
assert.equal(result.facts.envExample, false);
assert.deepEqual(result.facts.instructions, []);
assert.ok(!result.unavailable.includes('git'), JSON.stringify(result.unavailable));
assert.ok(result.unavailable.includes('gh'));
assert.equal(result.prefill.project.kind, 'brownfield');
assert.equal(result.prefill.systems.forge, 'none');
assert.equal(result.prefill.systems.ci, false);
assert.equal(result.prefill.repo.checks, undefined);
assert.equal(result.prefill.repo.merge, undefined);
r = cli(dir, 'recon');
assert.equal(r.status, 0, both(r));
assert.equal(r.stdout.split('\n')[0], 'brownfield');
assert.match(r.stdout, /^could not see: gh$/m);

// A merge commit, a tag, a GitHub remote and a token in the URL that must not leak
git(dir, 'checkout', '-q', '-b', 'feature');
write(dir, 'src/feature.js', '1;\n'); commit(dir, 'feature');
git(dir, 'checkout', '-q', 'main');
git(dir, 'merge', '-q', '--no-ff', '--no-edit', 'feature');
git(dir, 'tag', 'v0.1.0');
git(dir, 'remote', 'add', 'origin', 'https://alice:ghp_secret123@github.com/acme/widgets.git');
result = recon(dir);
assert.equal(result.facts.commits, 8);
assert.equal(result.facts.mergeStyle, 'merge');
assert.equal(result.facts.tags, 1);
assert.deepEqual(result.facts.branches, ['feature', 'main']);
assert.equal(result.facts.remote, 'https://github.com/acme/widgets.git');
assert.equal(result.facts.forge, 'github');
assert.equal(result.prefill.systems.forge, 'github');
assert.equal(result.prefill.systems.remote, 'https://github.com/acme/widgets.git');
assert.equal(result.prefill.repo.merge, 'merge');
assert.ok(!JSON.stringify(result).includes('ghp_secret123'));
r = cli(dir, 'recon', '--json');
assert.ok(!r.stdout.includes('ghp_secret123'), r.stdout);

// One commit and a CI workflow: brownfield because of CI
dir = gitDir();
write(dir, '.github/workflows/ci.yml', 'name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n');
write(dir, 'README.md', '# Widgets\n');
commit(dir, 'ci');
result = recon(dir);
assert.equal(result.kind, 'brownfield', JSON.stringify(result));
assert.ok(result.reasons.some((s) => /CI/.test(s)), JSON.stringify(result.reasons));
assert.deepEqual(result.facts.ci, ['.github/workflows/ci.yml']);
assert.deepEqual(result.facts.deploy, []);
assert.equal(result.facts.commits, 1);
assert.equal(result.facts.sourceFiles, 0);
assert.equal(result.prefill.systems.ci, true);
assert.deepEqual(result.facts.instructions, ['README.md']);

// A workflow that deploys counts as CI and as a deploy; so do vercel.json and a Dockerfile
write(dir, '.github/workflows/release.yml', 'name: Release\non: push\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - run: ./deploy.sh\n');
write(dir, 'vercel.json', '{}\n');
write(dir, 'Dockerfile', 'FROM node:22\n');
result = recon(dir);
assert.deepEqual(result.facts.ci, ['.github/workflows/ci.yml', '.github/workflows/release.yml']);
assert.deepEqual(result.facts.deploy, ['.github/workflows/release.yml', 'Dockerfile', 'vercel.json']);
assert.ok(result.reasons.some((s) => /deploy/i.test(s)), JSON.stringify(result.reasons));

// Deploy config alone, no git at all: still brownfield, there is a running system to respect
dir = tempDir();
write(dir, 'fly.toml', 'app = "widgets"\n');
result = recon(dir);
assert.equal(result.kind, 'brownfield');
assert.deepEqual(result.facts.deploy, ['fly.toml']);

// A scaffold with one commit and a test script: greenfield, checks pre-filled from the runner
dir = gitDir();
write(dir, 'package.json', '{"name":"widgets","scripts":{"test":"node --test"}}\n');
write(dir, 'src/index.js', 'export default 1;\n');
write(dir, 'test/index.test.js', 'import "../src/index.js";\n');
write(dir, '.env.example', 'API_KEY=\n');
write(dir, 'CLAUDE.md', '# notes\n');
write(dir, 'AGENTS.md', '# agreement\n');
commit(dir, 'scaffold');
result = recon(dir);
assert.equal(result.kind, 'greenfield', JSON.stringify(result));
assert.ok(result.reasons.some((s) => /1 commit\b/.test(s)), JSON.stringify(result.reasons));
assert.deepEqual(result.facts.tests, { present: true, runner: 'npm test' });
assert.equal(result.facts.packageManager, 'npm');
assert.equal(result.facts.envExample, true);
assert.deepEqual(result.facts.instructions, ['AGENTS.md', 'CLAUDE.md']);
assert.deepEqual(result.prefill.repo.checks, ['npm test']);
assert.equal(result.prefill.project.kind, 'greenfield');
// a pnpm lockfile names the runner after the package manager
write(dir, 'pnpm-lock.yaml', 'lockfileVersion: 9\n');
result = recon(dir);
assert.equal(result.facts.packageManager, 'pnpm');
assert.deepEqual(result.prefill.repo.checks, ['pnpm test']);

// Python: pytest from pyproject.toml, language from the extension
dir = tempDir();
write(dir, 'pyproject.toml', '[tool.pytest.ini_options]\n');
write(dir, 'app/main.py', 'print(1)\n');
write(dir, 'tests/test_main.py', 'def test_a(): pass\n');
result = recon(dir);
assert.deepEqual(result.facts.tests, { present: true, runner: 'pytest' });
assert.deepEqual(result.facts.languages, ['Python']);
assert.equal(result.facts.sourceFiles, 2);
assert.deepEqual(result.prefill.repo.checks, ['pytest']);

// sourceFiles skips node_modules, .git, .claude and scripts/pincer; languages are ordered by count
dir = tempDir();
write(dir, 'node_modules/dep/index.js', '1;\n');
write(dir, '.git/hooks/x.js', '1;\n');
write(dir, '.claude/hooks/hook.cjs', '1;\n');
write(dir, 'scripts/pincer/cli.cjs', '1;\n');
write(dir, 'scripts/build.sh', 'true\n');
write(dir, 'lib/a.ts', '1;\n');
write(dir, 'lib/b.ts', '1;\n');
write(dir, 'notes.txt', 'not code\n');
result = recon(dir);
assert.equal(result.facts.sourceFiles, 3);
assert.deepEqual(result.facts.languages, ['TypeScript', 'Shell']);

// classify on bare facts: the thresholds from the brief
const facts = (patch) => ({ commits: 0, sourceFiles: 0, ci: [], deploy: [], git: true, ...patch });
assert.equal(classify(facts({ commits: 5, sourceFiles: 1 })).kind, 'brownfield');
assert.equal(classify(facts({ commits: 4, sourceFiles: 40 })).kind, 'greenfield');
assert.equal(classify(facts({ commits: 50, sourceFiles: 0 })).kind, 'greenfield');
assert.equal(classify(facts({ ci: ['.gitlab-ci.yml'] })).kind, 'brownfield');
assert.equal(classify(facts({ deploy: ['netlify.toml'] })).kind, 'brownfield');
assert.equal(classify(facts({ git: false })).kind, 'greenfield');
assert.ok(classify(facts({ git: false })).reasons.some((s) => /git/i.test(s)));

// Usage errors exit 2 with usage on stderr; a missing root exits 1
assert.equal(cli(dir, 'recon', '--bogus').status, 2);
assert.equal(cli(dir, 'bogus').status, 2);
r = cli(dir);
assert.equal(r.status, 2);
assert.match(r.stderr, /usage/);
r = cli(dir, '--root', path.join(dir, 'missing'), 'recon');
assert.equal(r.status, 1, both(r));
assert.match(r.stderr, /missing/);
assert.ok(!r.stderr.includes('    at '), r.stderr);

console.log('ok recon');
