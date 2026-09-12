// Distribution of the change workflow (PRD v5 R-09, R-06, R-04; T-59): every
// packed layout (Claude-only, Codex-only, Copilot-only, all platforms) and the
// plugin ship the identical runtime modules and execute the declared change
// commands end to end; canonical and generated guidance name valid commands and
// carry the same authorization rule; the guards allow documented drafts and
// reject direct state manipulation; the installer preserves customized files and
// doctor reports migration availability; no version bump or release happens.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repo, tempDir, write, read, run } from './helpers.js';

function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
const kit = tempDir();
for (const file of ['bin', 'template', 'package.json']) fs.cpSync(path.join(repo, file), path.join(kit, file), { recursive: true });
const pincer = (dir, ...args) => run(dir, process.execPath, [path.join(kit, 'bin/pincer.js'), ...args], { timeout: 60000 });
const MODULES = ['agreement', 'authorization', 'changes', 'evidence', 'fsutil', 'gates', 'identity', 'lifecycle', 'locator', 'migrate', 'parse', 'readiness', 'resume', 'runner', 'sanitize', 'source', 'state', 'status', 'transaction', 'transitions'];
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const runtimeDigests = root => Object.fromEntries(['scripts/pincer-runtime.cjs', ...MODULES.map(m => `scripts/pincer-runtime/${m}.cjs`)].map(rel => [rel, fs.existsSync(path.join(root, rel)) ? digest(path.join(root, rel)) : null]));
const canonical = runtimeDigests(path.join(repo, 'template'));
assert.ok(Object.values(canonical).every(Boolean), 'every runtime module exists in the template');
assert.deepEqual(runtimeDigests(path.join(repo, 'plugin')), canonical, 'the plugin ships the identical runtime modules');
assert.equal(JSON.parse(read('/', path.join(repo, 'plugin/.claude-plugin/plugin.json'))).version, JSON.parse(read('/', path.join(repo, 'package.json'))).version, 'plugin and package versions agree (no bump here)');

// The declared change journey on an installed layout: register → authorize → select
// → activate → verify → done → pause → resume report → resume → complete → resume report.
function journey(project, label) {
  const node = (...args) => run(project, process.execPath, args, { timeout: 60000 });
  const sh = (...args) => run(project, 'bash', args, { timeout: 60000 });
  const git = (...args) => passes(run(project, 'git', args), `${label}: git ${args.join(' ')}`);
  const commit = m => { git('add', '-A'); git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', m); };
  git('init', '-q');
  write(project, '.prd/prd-v1.md', '---\nversion: 1\nstatus: ticketed\ndate: 2026-09-11\n---\n# Fixture\n');
  write(project, 'tickets/T-01-fixture.md', '---\nticket: T-01\nstatus: open\nsize: S\nprd: .prd/prd-v1.md\ndepends_on: []\n---\n\n## Objective\nFixture.\n\n## Acceptance Criteria\n- [x] ok\n\n## Verification\n```bash\ntest -f value.txt\n```\n');
  write(project, 'value.txt', 'good\n');
  fs.appendFileSync(path.join(project, '.gitignore'), '.pincer/\n');
  commit('fixture');
  assert.match(passes(node('scripts/pincer-runtime.cjs', 'register', '--prd', '.prd/prd-v1.md'), `${label}: register`), /^registered change prd-v1 .* · planned/m);
  commit('Register PRD v1');
  const shown = JSON.parse(passes(node('scripts/pincer-runtime.cjs', 'change', 'show', 'prd-v1', '--json'), `${label}: show`));
  assert.equal(shown.authorization.verdict, 'AUTHORIZATION_REQUIRED', label);
  passes(node('scripts/pincer-runtime.cjs', 'change', 'authorize', 'prd-v1', '--agreement', shown.agreement.current, '--reference', 'fixture session', '--excerpt', 'go ahead'), `${label}: authorize`);
  passes(node('scripts/pincer-runtime.cjs', 'change', 'select', 'prd-v1'), `${label}: select`);
  commit('Authorize PRD v1');
  assert.match(passes(sh('scripts/pincer-status.sh'), `${label}: status`), /^Runtime  changes · selected prd-v1 · planned · agreement [0-9a-f]{12} \(G-01\) · authorization current \(A-01\)/m);
  const blocked = sh('scripts/pincer-ticket.sh', 'verify', 'T-01');
  assert.equal(blocked.status, 1, label); assert.match(blocked.stderr, /LIFECYCLE_BLOCKED/, `${label}: planned change executes nothing`);
  passes(node('scripts/pincer-runtime.cjs', 'change', 'activate', 'prd-v1'), `${label}: activate`);
  assert.match(passes(sh('scripts/pincer-ticket.sh', 'start', 'T-01'), `${label}: start`), /started/);
  assert.match(passes(sh('scripts/pincer-ticket.sh', 'verify', 'T-01'), `${label}: verify`), /attempt 000001-/);
  assert.match(passes(sh('scripts/pincer-ticket.sh', 'done', 'T-01'), `${label}: done`), /T-01 done/);
  passes(node('scripts/pincer-runtime.cjs', 'change', 'pause', 'prd-v1', '--reason', 'end of session', '--note', 'nothing left'), `${label}: pause`);
  const report = JSON.parse(passes(node('scripts/pincer-runtime.cjs', 'resume', '--json'), `${label}: resume report`));
  assert.equal(report.change.lifecycle.state, 'paused', label); assert.equal(report.agreement.verdict, 'current', label);
  assert.equal(report.next.command, 'node scripts/pincer-runtime.cjs change resume prd-v1', label);
  passes(node('scripts/pincer-runtime.cjs', 'change', 'resume', 'prd-v1'), `${label}: change resume`);
  commit('T-01 done');
  passes(node('scripts/pincer-runtime.cjs', 'change', 'complete', 'prd-v1'), `${label}: complete`);
  assert.match(JSON.parse(passes(node('scripts/pincer-runtime.cjs', 'resume', '--json'))).next.command, /^\/pincer-evaluate/, `${label}: completed routes to evaluation`);
  assert.equal(node('scripts/pincer-runtime.cjs', 'ready').status, 1, `${label}: no evaluation yet`);
  assert.match(passes(node('scripts/pincer-runtime.cjs', 'change', 'list'), `${label}: list`), /^\* prd-v1 {11}completed/m);
  // Hooks on this layout: exact change calls are allowed; state writes are blocked.
  const hook = path.join(project, '.claude/hooks/hook-policy.cjs');
  if (fs.existsSync(hook)) {
    const check = command => spawnSync(process.execPath, [hook, 'ticket'], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8', cwd: project }).status;
    assert.equal(check('node scripts/pincer-runtime.cjs change pause prd-v1 --reason x'), 0, `${label}: change commands are allowed writers`);
    assert.equal(check('node scripts/pincer-runtime.cjs resume'), 0, label);
    assert.equal(check('echo {} > .prd/evidence/changes/prd-v1.json'), 2, `${label}: locator writes are blocked`);
    assert.equal(check('rm -rf .prd/changes/prd-v1'), 2, `${label}: snapshot deletion is blocked`);
    assert.equal(check('cat .pincer/drafts/candidate.json'), 0, `${label}: the draft location stays readable`);
    const edit = (file, content) => spawnSync(process.execPath, [hook, 'ticket'], { input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: path.join(project, file), content } }), encoding: 'utf8', cwd: project }).status;
    assert.equal(edit('.pincer/drafts/candidate.json', '{}'), 0, `${label}: authored drafts under .pincer/drafts are allowed`);
    assert.equal(edit('.prd/evidence/changes/prd-v1.json', '{}'), 2, `${label}: locator edits are blocked`);
    assert.equal(edit('.prd/changes/prd-v1/agreements/G-01.json', '{}'), 2, `${label}: snapshot edits are blocked`);
  }
}

const layouts = { claude: ['.claude/commands/pincer-code.md'], codex: ['.agents/skills/pincer-code/SKILL.md'], copilot: ['.github/prompts/pincer-code.prompt.md'], all: ['.claude/commands/pincer-code.md', '.agents/skills/pincer-code/SKILL.md', '.github/prompts/pincer-code.prompt.md'] };
for (const [platform, guidance] of Object.entries(layouts)) {
  const project = tempDir();
  passes(pincer(project, 'init', '--platform', platform), `${platform} init`);
  assert.deepEqual(runtimeDigests(project), canonical, `${platform} layout ships the identical runtime modules`);
  for (const rel of guidance) {
    const text = read(project, rel);
    for (const command of [/change\s+select <id>/, /change activate <id>/, /change pause <id> --reason/, /change authorize/, /change decide/, /change complete <id>/]) assert.match(text, command, `${platform}: ${rel} names ${command}`);
    assert.match(text, /pincer-runtime\.cjs resume/, `${platform}: ${rel} names the resume report`);
    assert.match(text, /## Authorization rule \(shared by plan, narrow, code and evaluate\)/, `${platform}: ${rel} carries the authorization rule`);
  }
  journey(project, platform);
  passes(pincer(project, 'doctor'), `${platform} doctor after the journey`);
  // Every named command in the guidance exists in the runtime's usage text.
  const usage = run(project, process.execPath, ['scripts/pincer-runtime.cjs']).stderr;
  for (const sub of ['change list', 'change show <id>', 'change select <id>', 'change revise <id>', 'change authorize <id>', 'change decide <id>', 'change activate|resume|complete <id>', 'change pause <id> --reason', 'change reopen <id> --reason', 'change cancel <id> --decision', 'change supersede <id> --with', 'resume [--change <id>] [--json]']) assert.ok(usage.includes(sub), `${platform}: runtime usage names ${sub}`);
}

// Generated adapters are current and carry the same rule as the canonical playbooks.
const canonicalCode = read('/', path.join(repo, 'template/.claude/commands/pincer-code.md'));
const rule = canonicalCode.match(/## Authorization rule[\s\S]*$/)[0].trim();
for (const rel of ['template/.agents/skills/pincer-code/SKILL.md', 'template/.github/prompts/pincer-code.prompt.md', 'plugin/commands/code.md']) {
  const text = read('/', path.join(repo, rel));
  const adapted = text.match(/## Authorization rule[\s\S]*$/)[0].trim().replaceAll('$pincer-', '/pincer-').replaceAll('/pincer:', '/pincer-');
  assert.equal(adapted, rule, `${rel} carries the same authorization rule`);
  assert.ok(/change\s+select <id>/.test(text) && text.includes('pincer-runtime.cjs resume'), `${rel} names the change commands`);
}
const pluginCode = read('/', path.join(repo, 'plugin/commands/code.md'));
assert.match(pluginCode, /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/pincer-runtime\.cjs change/, 'plugin paths are rewritten for change commands');

// Installer update preserves customized user files and never touches change state; doctor reports a v0.5.0 binding.
{
  const project = tempDir();
  passes(pincer(project, 'init', '--platform', 'claude'));
  const custom = read(project, 'AGENTS.md') + '\nLOCAL RULE\n';
  write(project, 'AGENTS.md', custom);
  write(project, '.prd/changes/prd-v1.json', JSON.stringify({ schema: 1, change: 'prd-v1', prd: '.prd/prd-v1.md', prd_revision: 'a'.repeat(64), base: 'b'.repeat(40), registered: '2026-09-11T00:00:00Z', authorization: 'old text', runtime: 1, legacy_receipts: {} }));
  write(project, '.prd/prd-v1.md', '---\nversion: 1\nstatus: ticketed\ndate: 2026-09-11\n---\n# Fixture\n');
  passes(pincer(project, 'update'));
  assert.equal(read(project, 'AGENTS.md'), custom, 'update preserves the customized file');
  assert.equal(JSON.parse(read(project, '.prd/changes/prd-v1.json')).schema, 1, 'update never converts a binding');
  const doctor = pincer(project, 'doctor');
  assert.match(doctor.stdout, /migration to change records available: \.prd\/changes\/prd-v1\.json is a v0\.5\.0 binding/);
  assert.equal(JSON.parse(read('/', path.join(kit, 'package.json'))).version, JSON.parse(read('/', path.join(repo, 'package.json'))).version, 'no version bump occurred');
}
console.log('change distribution tests passed');
