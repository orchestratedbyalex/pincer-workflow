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
  'template/.github/prompts/pincer-plan.prompt.md', 'template/scripts/pincer-ticket-lib.sh',
  'template/scripts/pincer-evidence.cjs', 'template/docs/release-checklist.md',
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

for (const [platform, layout] of Object.entries(layouts)) {
  const greenfield = tempDir();
  passes(pincer(greenfield, 'init', '--platform', platform), `${platform} greenfield init`);
  for (const relative of ['AGENTS.md', 'docs/release-checklist.md', 'scripts/pincer-ticket.sh', 'scripts/pincer-ticket-lib.sh', 'scripts/pincer-evidence.cjs', '.claude/commands/pincer-plan.md', ...layout.present])
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
