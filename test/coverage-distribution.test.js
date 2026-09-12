// PRD v6 T-75 (R-08, R-09; S-24): every packed layout and the plugin ship the
// identical strict-coverage runtime and run the strict journey end to end
// (register → adopt → authorize → complete → declared check → export → reports);
// generated playbooks route through coverage/impact, disposition changed scope before
// approval and distinguish structural checks from the adequacy judgment; the guards
// protect the runtime-owned snapshots while authored map edits stay allowed; the
// installer preserves user files, doctor reports adoption availability, older
// runtimes refuse the new schemas; no version bump happens.
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
const fx = path.join(repo, 'test/fixtures/prd-v6');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const STRICT_MODULES = ['requirements', 'coverage', 'dispositions', 'adopt', 'phases', 'impact', 'checks'];
const runtimeDigests = root => Object.fromEntries(['scripts/pincer-runtime.cjs', 'scripts/pincer-evidence.cjs', ...fs.readdirSync(path.join(repo, 'template/scripts/pincer-runtime')).map(m => `scripts/pincer-runtime/${m}`)].map(rel => [rel, fs.existsSync(path.join(root, rel)) ? digest(path.join(root, rel)) : null]));
const canonical = runtimeDigests(path.join(repo, 'template'));
for (const m of STRICT_MODULES) assert.ok(canonical[`scripts/pincer-runtime/${m}.cjs`], `the strict module ${m} exists in the template`);
assert.deepEqual(runtimeDigests(path.join(repo, 'plugin')), canonical, 'the plugin ships the identical runtime modules');
assert.equal(JSON.parse(read('/', path.join(repo, 'plugin/.claude-plugin/plugin.json'))).version, JSON.parse(read('/', path.join(repo, 'package.json'))).version, 'plugin and package versions agree (no bump here)');

// The strict journey on an installed layout.
function journey(project, label) {
  const node = (...args) => run(project, process.execPath, args, { timeout: 60000 });
  const sh = (...args) => run(project, 'bash', args, { timeout: 60000 });
  const git = (...args) => passes(run(project, 'git', args), `${label}: git ${args.join(' ')}`).trim();
  const commit = m => { git('add', '-A'); git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', m); return git('rev-parse', 'HEAD'); };
  const rtJson = (...args) => JSON.parse(passes(node('scripts/pincer-runtime.cjs', ...args, '--json'), `${label}: ${args.join(' ')}`));
  git('init', '-q');
  write(project, '.prd/prd-v1.md', read(fx, 'strict/prd-v1.md'));
  for (const f of fs.readdirSync(path.join(fx, 'strict/tickets'))) write(project, `tickets/${f}`, read(fx, `strict/tickets/${f}`).replace('- [ ] expected behavior', '- [x] expected behavior'));
  write(project, '.prd/coverage/prd-v1.json', read(fx, 'strict/coverage/prd-v1.json'));
  write(project, 'value.txt', 'good\n');
  fs.appendFileSync(path.join(project, '.gitignore'), '.pincer/\n');
  commit('fixture');
  passes(node('scripts/pincer-runtime.cjs', 'register', '--prd', '.prd/prd-v1.md'), `${label}: register`);
  passes(node('scripts/pincer-runtime.cjs', 'change', 'select', 'prd-v1'), `${label}: select`);
  const digestNow = () => rtJson('change', 'show', 'prd-v1').agreement.current;
  passes(node('scripts/pincer-runtime.cjs', 'change', 'authorize', 'prd-v1', '--agreement', digestNow(), '--reference', 'fixture session', '--excerpt', 'go ahead'), `${label}: authorize`);
  passes(node('scripts/pincer-runtime.cjs', 'change', 'activate', 'prd-v1'), `${label}: activate`);
  assert.match(passes(sh('scripts/pincer-status.sh'), `${label}: status before adoption`), /^Coverage unverified · strict coverage not adopted/m);
  assert.match(passes(pincer(project, 'doctor'), `${label}: doctor`), /strict coverage adoption available: \.prd\/coverage\/prd-v1\.json exists/);
  assert.match(passes(node('scripts/pincer-runtime.cjs', 'coverage', 'adopt', '--preview', '--change', 'prd-v1'), `${label}: preview`), /^adoption plan for change prd-v1/m);
  assert.match(passes(node('scripts/pincer-runtime.cjs', 'coverage', 'adopt', '--apply', '--change', 'prd-v1'), `${label}: adopt`), /^adopted strict coverage for change prd-v1 \(schema 3 record/m);
  assert.equal(JSON.parse(read(project, '.prd/changes/prd-v1.json')).schema, 3, label);
  passes(node('scripts/pincer-runtime.cjs', 'change', 'decide', 'prd-v1', '--summary', 'defer S-03 (impact report) to the next change'), `${label}: decide`);
  passes(node('scripts/pincer-runtime.cjs', 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', 'fixture session', '--excerpt', 'agreed: S-03 is deferred'), `${label}: resolve`);
  passes(node('scripts/pincer-runtime.cjs', 'change', 'authorize', 'prd-v1', '--agreement', digestNow(), '--reference', 'fixture session', '--excerpt', 'approved with S-03 deferred', '--decision', 'D-01'), `${label}: authorize strict`);
  commit('Adopt strict coverage for PRD v1');
  const cov = rtJson('coverage');
  assert.equal(cov.strict, true); assert.ok(cov.structure.complete, `${label}: ${JSON.stringify(cov.structure.problems)}`); assert.equal(cov.next.ticket, 'T-01', label);
  assert.match(passes(sh('scripts/pincer-status.sh'), `${label}: status`), /^Coverage strict · agreement G-\d\d \(A-\d\d\) · structure complete · implementation 0\/2 scenarios \(1 dispositioned\) · candidate not evaluated$/m);
  for (const t of ['T-01', 'T-02', 'T-03']) { passes(sh('scripts/pincer-ticket.sh', 'verify', t), `${label}: verify ${t}`); passes(sh('scripts/pincer-ticket.sh', 'done', t), `${label}: done ${t}`); }
  assert.equal(rtJson('impact').verdict, 'unchanged', label);
  passes(node('scripts/pincer-runtime.cjs', 'change', 'complete', 'prd-v1'), `${label}: complete`);
  write(project, '.prd/prd-v1.md', read(project, '.prd/prd-v1.md').replace('status: ticketed', 'status: built'));
  const candidate = commit('PRD v1: built');
  const base = git('rev-parse', 'HEAD~1');
  const substituted = node('scripts/pincer-runtime.cjs', 'check', 'C-01', '--candidate', candidate, '--', 'true');
  assert.equal(substituted.status, 4, label); assert.match(substituted.stderr, /CHECK_UNDECLARED/, `${label}: a supplied command is refused`);
  assert.match(passes(node('scripts/pincer-runtime.cjs', 'check', 'C-01', '--candidate', candidate), `${label}: declared check`), /✓ C-01 passed/);
  const dirRel = `.prd/evidence/prd-v1/${candidate}`;
  write(project, `${dirRel}/review/wording.md`, '# reviewed\n');
  write(project, '.pincer/drafts/c.json', JSON.stringify({ environment: { tools: ['bash'], limitations: [] }, coverage_review: 'reviewed', adequacy: { verdict: 'adequate', note: 'the command and the review establish the scenarios' }, checks: [{ id: 'C-01' }, { id: 'C-02', result: 'passed', timestamp: '2026-09-12T12:00:00Z', artifacts: [`${dirRel}/review/wording.md`] }], visual_review: { applicable: false, reason: 'no UI' } }));
  assert.match(passes(node('scripts/pincer-runtime.cjs', 'evidence', 'export', '--candidate', candidate, '--base', base, '--prd', '.prd/prd-v1.md', '--draft', '.pincer/drafts/c.json'), `${label}: export`), /\(schema 3\) — delivery: original false, agreed true/);
  assert.match(passes(node('scripts/pincer-evidence.cjs', 'validate', `${dirRel}/manifest.json`, '--candidate', candidate, '--prd', '.prd/prd-v1.md'), `${label}: validate`), /^ok [0-9a-f]{40} schema 3$/m);
  commit('evaluate: PRD v1');
  assert.match(passes(node('scripts/pincer-runtime.cjs', 'ready'), `${label}: ready`), /^ready candidate /m);
  const report = rtJson('resume');
  assert.equal(report.schema, 2); assert.equal(report.coverage.candidate.adequacy, 'adequate'); assert.equal(report.next.rule, 8, label);
  assert.match(passes(sh('scripts/pincer-status.sh'), `${label}: status after evaluation`), /^Provenance runtime \(schema 3\)/m);
  // Hooks on this layout: the map is authored, the snapshots and locators are runtime-owned.
  const hook = path.join(project, '.claude/hooks/hook-policy.cjs');
  if (fs.existsSync(hook)) {
    const edit = (file, content) => spawnSync(process.execPath, [hook, 'ticket'], { input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: path.join(project, file), content } }), encoding: 'utf8', cwd: project }).status;
    assert.equal(edit('.prd/coverage/prd-v1.json', '{}'), 0, `${label}: the authored map may be edited`);
    assert.equal(edit(`${dirRel}/coverage/map.json`, '{}'), 2, `${label}: the evidence map snapshot is runtime-owned`);
    assert.equal(edit(`${dirRel}/coverage/inventory.json`, '{}'), 2, `${label}: the evidence inventory snapshot is runtime-owned`);
    assert.equal(edit(`${dirRel}/review/wording.md`, '# x'), 0, `${label}: authored review artifacts stay editable`);
    assert.equal(edit('.prd/changes/prd-v1/agreements/G-02.json', '{}'), 2, `${label}: agreement snapshots are runtime-owned`);
    const check = command => spawnSync(process.execPath, [hook, 'ticket'], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8', cwd: project }).status;
    assert.equal(check('node scripts/pincer-runtime.cjs coverage adopt --apply --change prd-v1'), 0, `${label}: adoption is an allowed writer`);
    assert.equal(check('node scripts/pincer-runtime.cjs coverage --json'), 0, label);
    assert.equal(check(`echo x > ${dirRel}/coverage/map.json`), 2, `${label}: snapshot writes are blocked`);
  }
}

const layouts = { claude: ['.claude/commands/pincer-code.md', '.claude/commands/pincer-narrow.md', '.claude/commands/pincer-evaluate.md', '.claude/commands/pincer-release.md'], codex: ['.agents/skills/pincer-code/SKILL.md', '.agents/skills/pincer-narrow/SKILL.md', '.agents/skills/pincer-evaluate/SKILL.md', '.agents/skills/pincer-release/SKILL.md'], copilot: ['.github/prompts/pincer-code.prompt.md', '.github/prompts/pincer-narrow.prompt.md', '.github/prompts/pincer-evaluate.prompt.md', '.github/prompts/pincer-release.prompt.md'], all: ['.claude/commands/pincer-code.md', '.agents/skills/pincer-code/SKILL.md', '.github/prompts/pincer-code.prompt.md'] };
for (const [platform, guidance] of Object.entries(layouts)) {
  const project = tempDir();
  passes(pincer(project, 'init', '--platform', platform), `${platform} init`);
  assert.deepEqual(runtimeDigests(project), canonical, `${platform} layout ships the identical runtime modules`);
  for (const rel of guidance) {
    const text = read(project, rel);
    if (/code/.test(rel)) { assert.match(text, /pincer-runtime\.cjs coverage/, `${platform}: ${rel} reads coverage`); assert.match(text, /pincer-runtime\.cjs impact/, `${platform}: ${rel} reads impact`); assert.match(text, /generic\s+instruction to continue,\s+resume or not re-ask never authorizes new scope|general\s+instruction to continue,\s+resume or not re-ask never authorizes new scope/, `${platform}: ${rel} keeps the continue rule`); assert.match(text, /OBLIGATION_MISSING|SCOPE_UNAUTHORIZED/, `${platform}: ${rel} names the scope codes`); }
    if (/narrow/.test(rel)) { assert.match(text, /\.prd\/coverage\/<change id>\.json/, `${platform}: ${rel} authors the map once`); assert.match(text, /coverage adopt --preview --change prd-vN/, `${platform}: ${rel} adopts explicitly`); assert.match(text, /Never record a disposition\s+the user did not state/, `${platform}: ${rel} dispositions scope before approval`); }
    if (/evaluate/.test(rel)) { assert.match(text, /check C-NN --candidate <sha>` \(no command, no\s+timeout/, `${platform}: ${rel} runs declared checks`); assert.match(text, /adequacy: \{ verdict: "adequate" \| "inadequate", note \}/, `${platform}: ${rel} records the adequacy judgment`); assert.match(text, /no `requirements` \(they are derived\)/, `${platform}: ${rel} derives dispositions`); }
    if (/release/.test(rel)) { assert.match(text, /original versus\s+agreed scope/, `${platform}: ${rel} distinguishes delivery`); assert.match(text, /never imply strict coverage was established/, `${platform}: ${rel} keeps unverified honest`); }
  }
  journey(project, platform);
  passes(pincer(project, 'doctor'), `${platform} doctor after the journey`);
  const usage = run(project, process.execPath, ['scripts/pincer-runtime.cjs']).stderr;
  for (const sub of ['coverage [--change <id>] [--json]', 'coverage adopt --preview|--apply --change <id>', 'impact [--change <id>] [--from G-NN|A-NN] [--json]']) assert.ok(usage.includes(sub), `${platform}: runtime usage names ${sub}`);
}

// Generated adapters and the plugin are current and carry the strict coverage guidance.
for (const rel of ['template/.agents/skills/pincer-narrow/SKILL.md', 'template/.github/prompts/pincer-narrow.prompt.md', 'plugin/commands/narrow.md']) {
  const text = read('/', path.join(repo, rel));
  assert.match(text, /coverage adopt --preview --change prd-vN/, `${rel} adopts explicitly`);
  assert.match(text, /## Authorization rule \(shared by plan, narrow, code and evaluate\)/, `${rel} carries the authorization rule`);
}
assert.match(read('/', path.join(repo, 'plugin/commands/code.md')), /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/pincer-runtime\.cjs coverage/, 'plugin paths are rewritten for the coverage command');
assert.match(read('/', path.join(repo, 'plugin/references/prd-template.md')), /- \*\*S-01:\*\*/, 'the plugin PRD template uses the scenario grammar');
assert.match(read('/', path.join(repo, 'plugin/hooks/hook-policy.cjs')), /coverage\)\(\[\\\\\/\]\|\$\)/, 'the plugin hook guards the coverage snapshots');

// Installer update preserves customized user files and never adopts; the pinned v5 readers refuse the new schemas.
{
  const project = tempDir();
  passes(pincer(project, 'init', '--platform', 'claude'));
  const custom = read(project, 'AGENTS.md') + '\nLOCAL RULE\n';
  write(project, 'AGENTS.md', custom);
  const map = read(fx, 'strict/coverage/prd-v1.json');
  write(project, '.prd/coverage/prd-v1.json', map);
  write(project, '.prd/prd-v1.md', read(fx, 'strict/prd-v1.md'));
  write(project, '.prd/changes/prd-v1.json', read(fx, 'v5/changes/prd-v1.json'));
  passes(pincer(project, 'update'));
  assert.equal(read(project, 'AGENTS.md'), custom, 'update preserves the customized file');
  assert.equal(read(project, '.prd/coverage/prd-v1.json'), map, 'update never touches the authored map');
  assert.equal(JSON.parse(read(project, '.prd/changes/prd-v1.json')).schema, 2, 'update never adopts');
  // `update` left an AGENTS.md.new proposal for the customized file (doctor reports it as unmerged, exit 1); the adoption note is still printed.
  assert.match(pincer(project, 'doctor').stdout, /strict coverage adoption available/);
  const v5changes = (await import('node:module')).createRequire(import.meta.url)(path.join(repo, 'test/fixtures/prd-v6/v5-kit/scripts/pincer-runtime/changes.cjs'));
  const strictRecord = JSON.parse(read(fx, 'v5/changes/prd-v1.json'));
  assert.equal(v5changes.validateRecord({ ...strictRecord, schema: 3, runtime: 3 }, '.prd/changes/prd-v1.json').code, 'UNSUPPORTED_SCHEMA', 'the PRD v5 reader refuses schema 3 records');
  assert.equal(JSON.parse(read('/', path.join(kit, 'package.json'))).version, JSON.parse(read('/', path.join(repo, 'package.json'))).version, 'no version bump occurred');
}
console.log('coverage distribution tests passed');
