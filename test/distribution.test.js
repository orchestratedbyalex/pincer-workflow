import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { repo, tempDir, run, write, read } from './helpers.js';

function passes(result, label) {
  assert.equal(result.error, undefined, `${label}: process completed`);
  assert.equal(result.status, 0, `${label}: ${result.stdout}${result.stderr}`);
  return result.stdout;
}

function snapshot(root) {
  const result = new Map();
  function visit(relative = '') {
    const directory = path.join(root, relative);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue;
      const next = relative ? path.join(relative, entry.name) : entry.name;
      const absolute = path.join(root, next);
      if (entry.isDirectory()) visit(next);
      else {
        const stat = fs.statSync(absolute);
        result.set(next, {
          hash: crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex'),
          executable: Boolean(stat.mode & 0o111),
        });
      }
    }
  }
  visit();
  return Object.fromEntries([...result].sort(([a], [b]) => a.localeCompare(b)));
}

// Regenerate from canonical sources in isolation; committed outputs must match exactly.
const generated = tempDir();
for (const relative of ['package.json', 'scripts', 'template']) {
  fs.cpSync(path.join(repo, relative), path.join(generated, relative), { recursive: true });
}
passes(run(generated, 'bash', ['template/scripts/sync-prompts.sh']), 'generate agent adapters');
passes(run(generated, 'bash', ['scripts/build-plugin.sh']), 'generate plugin');
for (const relative of ['template/.agents', 'template/.github/prompts', 'plugin']) {
  assert.deepEqual(snapshot(path.join(generated, relative)), snapshot(path.join(repo, relative)), `${relative} generated parity`);
}

// Pack the actual npm artifact, install that tarball, and use its CLI for every fixture.
const packed = tempDir();
const npmCache = tempDir();
const npmOptions = { env: { ...process.env, npm_config_cache: npmCache } };
const packResult = run(repo, 'npm', ['pack', '--json', '--pack-destination', packed], npmOptions);
const packOutput = passes(packResult, 'npm pack');
const packData = JSON.parse(packOutput)[0];
const tarball = path.join(packed, path.basename(packData.filename));
assert.ok(fs.existsSync(tarball), 'npm pack produced a tarball');
const packedNames = new Set(packData.files.map(file => file.path));
for (const relative of [
  'bin/pincer.js', 'template/AGENTS.md', 'template/.claude/commands/pincer-plan.md',
  'template/.claude/hooks/hook-policy.cjs', 'template/.agents/skills/pincer-plan/SKILL.md',
  'template/.github/prompts/pincer-plan.prompt.md', 'template/scripts/pincer-runtime.cjs', 'template/scripts/pincer-runtime/lifecycle.cjs',
  'template/scripts/pincer-evidence.cjs', 'template/docs/release-checklist.md', 'template/docs/runtime-contracts.md',
]) assert.ok(packedNames.has(relative), `tarball missing ${relative}`);

const installed = tempDir();
write(installed, 'package.json', '{"private":true}\n');
passes(run(installed, 'npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], npmOptions), 'install packed artifact');
const cli = path.join(installed, 'node_modules/pincer-workflow/bin/pincer.js');
assert.ok(fs.existsSync(cli), 'packed CLI installed');

const layouts = {
  claude: {
    present: ['CLAUDE.md', '.claude/hooks/hook-policy.cjs'],
    absent: ['.agents', '.codex', '.github/copilot-instructions.md'],
  },
  codex: {
    present: ['.agents/skills/pincer-plan/SKILL.md', '.codex/README.md'],
    absent: ['CLAUDE.md', '.claude/hooks', '.github/copilot-instructions.md'],
  },
  copilot: {
    present: ['.github/copilot-instructions.md', '.github/prompts/pincer-plan.prompt.md'],
    absent: ['CLAUDE.md', '.claude/hooks', '.agents', '.codex'],
  },
  all: {
    present: ['CLAUDE.md', '.claude/hooks/hook-policy.cjs', '.agents/skills/pincer-plan/SKILL.md', '.codex/README.md', '.github/copilot-instructions.md'],
    absent: [],
  },
};

function pincer(project, ...args) {
  return run(project, process.execPath, [cli, ...args]);
}

// PRD v4 S-28: every layout and the plugin carry the identical runtime, and the
// installed copy executes the compatibility commands on a small git fixture.
const runtimeFiles = root => Object.fromEntries(
  ['scripts/pincer-runtime.cjs', ...fs.readdirSync(path.join(root, 'scripts/pincer-runtime')).map(n => `scripts/pincer-runtime/${n}`), 'scripts/pincer-ticket.sh', 'scripts/pincer-status.sh', 'scripts/pincer-evidence.cjs']
    .map(rel => [rel, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex')]),
);
const canonicalRuntime = runtimeFiles(path.join(repo, 'template'));
assert.ok(Object.keys(canonicalRuntime).length >= 12, 'runtime modules present in the template');
assert.deepEqual(runtimeFiles(path.join(repo, 'plugin')), canonicalRuntime, 'plugin ships the identical runtime');
function exercisesRuntime(project, label) {
  const sh = (...args) => run(project, 'bash', args, { timeout: 60000 });
  const node = (...args) => run(project, process.execPath, args, { timeout: 60000 });
  const git = (...args) => passes(run(project, 'git', args), `${label}: git ${args.join(' ')}`);
  git('init', '-q');
  write(project, '.prd/prd-v1.md', '---\nversion: 1\nstatus: ticketed\ndate: 2026-09-11\n---\n# Fixture\n');
  write(project, 'tickets/T-01-fixture.md', '---\nticket: T-01\nstatus: open\nsize: S\nprd: .prd/prd-v1.md\ndepends_on: []\n---\n\n## Objective\nFixture.\n\n## Acceptance Criteria\n- [x] ok\n\n## Verification\n```bash\ntest -f value.txt\n```\n');
  write(project, 'value.txt', 'good\n');
  fs.appendFileSync(path.join(project, '.gitignore'), '.pincer/\n');
  git('add', '-A'); git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', 'fixture');
  assert.match(passes(sh('scripts/pincer-status.sh'), `${label}: legacy status`), /^Runtime  legacy/m);
  assert.match(passes(sh('scripts/pincer-ticket.sh', 'verify', 'T-01'), `${label}: legacy verify`), /receipt: /);
  assert.match(passes(sh('scripts/pincer-ticket.sh', 'done', 'T-01'), `${label}: legacy done`), /T-01 done/);
  git('add', '-A'); git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', 'done');
  assert.match(passes(node('scripts/pincer-runtime.cjs', 'migrate', '--preview', '--prd', '.prd/prd-v1.md'), `${label}: migrate preview`), /migration plan/);
  assert.match(passes(node('scripts/pincer-runtime.cjs', 'migrate', '--apply', '--prd', '.prd/prd-v1.md'), `${label}: migrate apply`), /^migrated/m);
  assert.match(passes(node('scripts/pincer-runtime.cjs', 'register', '--prd', '.prd/prd-v1.md'), `${label}: register`), /^unchanged change prd-v1/m);
  assert.match(passes(sh('scripts/pincer-ticket.sh', 'verify', 'T-01'), `${label}: migrated verify`), /attempt 000001-/);
  const status = JSON.parse(passes(node('scripts/pincer-runtime.cjs', 'status', '--json'), `${label}: status --json`));
  assert.equal(status.mode, 'migrated', label);
  assert.equal(status.tickets[0].latest_attempt.outcome, 'passed', label);
  assert.match(passes(sh('scripts/pincer-status.sh'), `${label}: migrated status`), /^Runtime  change prd-v1/m);
  assert.equal(node('scripts/pincer-runtime.cjs', 'ready', 'T-01').status, 0, `${label}: ready`);
}

for (const [platform, layout] of Object.entries(layouts)) {
  const greenfield = tempDir();
  passes(pincer(greenfield, 'init', '--platform', platform), `${platform} greenfield init`);
  assert.deepEqual(runtimeFiles(greenfield), canonicalRuntime, `${platform} layout ships the identical runtime`);
  exercisesRuntime(greenfield, platform);
  for (const relative of ['AGENTS.md', 'docs/release-checklist.md', 'docs/runtime-contracts.md', 'scripts/pincer-ticket.sh', 'scripts/pincer-runtime.cjs', 'scripts/pincer-runtime/lifecycle.cjs', 'scripts/pincer-evidence.cjs', '.claude/commands/pincer-plan.md', ...layout.present])
    assert.ok(fs.existsSync(path.join(greenfield, relative)), `${platform} greenfield missing ${relative}`);
  for (const relative of layout.absent)
    assert.ok(!fs.existsSync(path.join(greenfield, relative)), `${platform} greenfield unexpectedly contains ${relative}`);
  passes(pincer(greenfield, 'doctor'), `${platform} greenfield doctor`);

  const brownfield = tempDir();
  const existingRules = `# ${platform} project rules\n`;
  write(brownfield, 'AGENTS.md', existingRules);
  const init = passes(pincer(brownfield, 'init', '--platform', platform), `${platform} brownfield init`);
  assert.match(init, /CONFLICT AGENTS\.md/);
  assert.equal(read(brownfield, 'AGENTS.md'), existingRules, `${platform} preserves existing project rules`);
  passes(pincer(brownfield, 'update'), `${platform} brownfield update`);
  assert.equal(read(brownfield, 'AGENTS.md'), existingRules, `${platform} update preserves existing project rules`);
  for (const name of fs.readdirSync(brownfield).filter(name => name.startsWith('AGENTS.md.new'))) {
    fs.rmSync(path.join(brownfield, name));
  }
  passes(pincer(brownfield, 'doctor'), `${platform} brownfield doctor after explicit sidecar resolution`);
}

// Plugin metadata and hook references must resolve inside the generated plugin.
const marketplace = JSON.parse(read(repo, '.claude-plugin/marketplace.json'));
const pluginEntry = marketplace.plugins.find(plugin => plugin.name === 'pincer');
assert.ok(pluginEntry, 'marketplace declares pincer plugin');
assert.ok(fs.existsSync(path.resolve(repo, pluginEntry.source, '.claude-plugin/plugin.json')), 'marketplace plugin source resolves');
const pluginManifest = JSON.parse(read(repo, 'plugin/.claude-plugin/plugin.json'));
const packageManifest = JSON.parse(read(repo, 'package.json'));
assert.equal(pluginManifest.version, packageManifest.version, 'plugin and package versions match');
const pluginHooks = JSON.parse(read(repo, 'plugin/hooks/hooks.json'));
for (const group of pluginHooks.hooks.PreToolUse) {
  for (const hook of group.hooks) {
    const match = hook.command.match(/\/hooks\/([^" ]+)/);
    assert.ok(match && fs.existsSync(path.join(repo, 'plugin/hooks', match[1])), `plugin hook command resolves: ${hook.command}`);
  }
}
assert.match(read(repo, 'plugin/hooks/block-dangerous.sh'), /hook-policy\.cjs/);
assert.match(read(repo, 'plugin/hooks/ticket-guard.sh'), /hook-policy\.cjs/);
assert.equal(read(repo, 'plugin/scripts/pincer-evidence.cjs'), read(repo, 'template/scripts/pincer-evidence.cjs'), 'plugin ships the evidence validator');

console.log('distribution parity and packed-install tests passed');
