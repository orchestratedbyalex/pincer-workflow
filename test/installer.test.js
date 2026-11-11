// The installer preserves local edits across updates, proposes upstream changes
// as .new sidecars, keeps an existing AGENTS.md, refuses a second init, and
// regenerates the project's stage copies when an agreement exists.
// Run with: node test/installer.test.js
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { repo, tempDir, run, write, read } from './helpers.js';
import { MANIFEST_SCHEMA } from '../bin/pincer.js';

// A private copy of the kit, so the tests can change the template to simulate a release.
const kit = tempDir();
for (const file of ['bin', 'template', 'package.json']) fs.cpSync(path.join(repo, file), path.join(kit, file), { recursive: true });
const pincer = (dir, ...args) => run(dir, process.execPath, [path.join(kit, 'bin/pincer.js'), ...args]);
const cli = (dir, ...args) => { const r = pincer(dir, ...args); assert.equal(r.status, 0, `${r.stdout}${r.stderr}`); return r.stdout; };
const sha = (text) => createHash('sha256').update(text).digest('hex');

// Edits survive three updates; the upstream version waits in a sidecar
const fresh = tempDir();
cli(fresh, 'init', '--platform', 'all');
const original = read(fresh, 'AGENTS.md');
write(fresh, 'AGENTS.md', original + '\nLOCAL RULE\n');
for (let i = 0; i < 3; i++) cli(fresh, 'update');
assert.equal(read(fresh, 'AGENTS.md'), original + '\nLOCAL RULE\n', 'repeated update preserves edits');
assert.equal(read(fresh, 'AGENTS.md.new'), original);
assert.equal(JSON.parse(read(fresh, '.pincer.json')).schema, MANIFEST_SCHEMA);

// A sidecar may already contain the user's in-progress merge: never replaced, a distinct proposal appears once
write(fresh, 'AGENTS.md.new', 'MERGE IN PROGRESS\n');
cli(fresh, 'update');
assert.equal(read(fresh, 'AGENTS.md.new'), 'MERGE IN PROGRESS\n');
assert.ok(fs.readdirSync(fresh).some((f) => f.startsWith('AGENTS.md.new.')));
const afterFirstSidecar = fs.readdirSync(fresh).filter((f) => f.startsWith('AGENTS.md.new'));
cli(fresh, 'update');
assert.deepEqual(fs.readdirSync(fresh).filter((f) => f.startsWith('AGENTS.md.new')), afterFirstSidecar, 'the same update reuses an identical proposal');
let doctor = pincer(fresh, 'doctor');
assert.equal(doctor.status, 1);
assert.match(doctor.stdout, /AGENTS\.md\.new/);

// An existing AGENTS.md is kept, on init and on every update
const existing = tempDir();
write(existing, 'AGENTS.md', 'EXISTING TEAM CONVENTIONS\n');
cli(existing, 'init', '--platform', 'codex');
cli(existing, 'update');
cli(existing, 'update');
assert.equal(read(existing, 'AGENTS.md'), 'EXISTING TEAM CONVENTIONS\n');

// init twice is refused and changes nothing
const before = read(existing, '.pincer.json');
const twice = pincer(existing, 'init', '--platform', 'codex');
assert.equal(twice.status, 1);
assert.match(twice.stderr, /already has PINCER installed/);
assert.equal(read(existing, '.pincer.json'), before);

// A legacy manifest (no schema) cannot prove its baselines; differing files are preserved
const legacy = tempDir();
cli(legacy, 'init', '--platform', 'copilot');
write(legacy, 'AGENTS.md', 'LEGACY LOCAL EDIT\n');
const manifest = JSON.parse(read(legacy, '.pincer.json'));
delete manifest.schema;
manifest.files['AGENTS.md'] = sha('LEGACY LOCAL EDIT\n');
write(legacy, '.pincer.json', JSON.stringify(manifest));
cli(legacy, 'update');
cli(legacy, 'update');
assert.equal(read(legacy, 'AGENTS.md'), 'LEGACY LOCAL EDIT\n');
assert.equal(JSON.parse(read(legacy, '.pincer.json')).schema, MANIFEST_SCHEMA, 'a legacy manifest is upgraded');

// A 0.7 manifest (schema 2) is trusted as a baseline and upgraded to schema 3 with empty generated baselines
const seven = tempDir();
cli(seven, 'init', '--platform', 'claude');
const m2 = JSON.parse(read(seven, '.pincer.json'));
m2.schema = 2;
delete m2.generated;
write(seven, '.pincer.json', JSON.stringify(m2));
cli(seven, 'update');
const m3 = JSON.parse(read(seven, '.pincer.json'));
assert.equal(m3.schema, MANIFEST_SCHEMA);
assert.deepEqual(m3.generated, {});
assert.deepEqual(m3.platforms, ['claude']);
// an unknown schema is refused
write(seven, '.pincer.json', JSON.stringify({ ...m3, schema: 9 }));
assert.equal(pincer(seven, 'update').status, 1);
write(seven, '.pincer.json', JSON.stringify(m3));

// A manifest whose generated baselines point outside the project is refused (review C1)
write(seven, '.pincer.json', JSON.stringify({ ...m3, generated: { '../victim.txt': 'deadbeef' } }));
const refused = pincer(seven, 'update');
assert.equal(refused.status, 1);
assert.match(refused.stderr, /unsupported or invalid/);
write(seven, '.pincer.json', JSON.stringify(m3));

// A trusted untouched install still receives genuine upstream changes
const untouched = tempDir();
cli(untouched, 'init', '--platform', 'claude');
write(kit, 'template/AGENTS.md', original + '\nUPSTREAM V2\n');
cli(untouched, 'update');
assert.equal(read(untouched, 'AGENTS.md'), original + '\nUPSTREAM V2\n');
cli(fresh, 'update');
assert.match(read(fresh, 'AGENTS.md'), /LOCAL RULE/);

// Accepting the upstream file explicitly resolves its baseline for later upgrades
write(existing, 'AGENTS.md', read(kit, 'template/AGENTS.md'));
cli(existing, 'update');
write(kit, 'template/AGENTS.md', original + '\nUPSTREAM V3\n');
cli(existing, 'update');
assert.equal(read(existing, 'AGENTS.md'), original + '\nUPSTREAM V3\n');

// With an agreement in place, update refreshes the library and regenerates the project copies
const agreed = tempDir();
cli(agreed, 'init', '--platform', 'all');
assert.ok(!fs.existsSync(path.join(agreed, '.claude/skills/pincer-plan')));
write(agreed, 'harness.json', JSON.stringify({ schema: 1, project: { name: 'agreed', kind: 'greenfield' }, people: [{ name: 'Alex', accepts: true }], roster: { plan: ['codebase-explorer'] } }));
let out = cli(agreed, 'update');
assert.ok(fs.existsSync(path.join(agreed, '.claude/skills/pincer-plan/SKILL.md')), 'update generated the stage copies');
assert.ok(fs.existsSync(path.join(agreed, '.claude/agents/codebase-explorer.md')), 'update generated the roster');
assert.ok(fs.existsSync(path.join(agreed, '.github/prompts/pincer-code.prompt.md')));
assert.match(out, /generated/);
const generated = JSON.parse(read(agreed, '.pincer.json')).generated;
assert.ok(generated['.claude/skills/pincer-plan/SKILL.md'], 'baselines recorded in the manifest');
// the tiers: the library default renders on every platform, doctor reports the mapping
const table = JSON.parse(read(agreed, '.claude/pincer/library/models.json'));
assert.match(read(agreed, '.claude/agents/codebase-explorer.md'), /^model: sonnet$/m, 'the library default renders');
assert.doesNotMatch(read(agreed, '.claude/agents/codebase-explorer.md'), /^tier:/m);
assert.match(read(agreed, '.codex/agents/codebase-explorer.toml'), new RegExp(`^model = ${JSON.stringify(table.codex.standard)}$`, 'm'));
let tiersDoctor = pincer(agreed, 'doctor');
assert.equal(tiersDoctor.status, 0, `${tiersDoctor.stdout}${tiersDoctor.stderr}`);
assert.match(tiersDoctor.stdout, /^  models  claude: standard=sonnet$/m);
assert.ok(tiersDoctor.stdout.includes(`  models  codex: standard=${table.codex.standard}\n`), tiersDoctor.stdout);
assert.match(tiersDoctor.stdout, /Codex loads \.codex\/ only in a trusted project/);
// a tier the table cannot translate is a doctor problem; an edited table survives update with a sidecar
write(agreed, 'harness.json', JSON.stringify({ schema: 1, project: { name: 'agreed', kind: 'greenfield' }, people: [{ name: 'Alex', accepts: true }], roster: { plan: ['codebase-explorer'] }, models: { agents: { 'codebase-explorer': 'fast' } } }));
write(agreed, '.claude/pincer/library/models.json', JSON.stringify({ ...table, codex: { strong: table.codex.strong, standard: table.codex.standard } }));
tiersDoctor = pincer(agreed, 'doctor');
assert.equal(tiersDoctor.status, 1);
assert.match(tiersDoctor.stdout, /FAIL  tier fast has a codex value — set models\.map\.codex\.fast in harness\.json or update the kit/);
out = cli(agreed, 'update');
assert.ok(!JSON.parse(read(agreed, '.claude/pincer/library/models.json')).codex.fast, 'the edited table is kept');
assert.ok(fs.existsSync(path.join(agreed, '.claude/pincer/library/models.json.new')), 'the upstream table waits beside it');
assert.match(read(agreed, '.claude/agents/codebase-explorer.md'), /^model: haiku$/m);
fs.renameSync(path.join(agreed, '.claude/pincer/library/models.json.new'), path.join(agreed, '.claude/pincer/library/models.json'));
// a broken table is diagnosed, not called missing (review I2)
write(agreed, '.claude/pincer/library/models.json', '{');
tiersDoctor = pincer(agreed, 'doctor');
assert.equal(tiersDoctor.status, 1);
assert.match(tiersDoctor.stdout, /FAIL  library table readable — models\.json: invalid JSON/);
assert.doesNotMatch(tiersDoctor.stdout, /library has models\.json/);
fs.copyFileSync(path.join(kit, 'template/.claude/pincer/library/models.json'), path.join(agreed, '.claude/pincer/library/models.json'));
// a library agent that cannot be a Codex agent is a note from update, not a crash (review I3)
const explorerLib = read(agreed, '.claude/pincer/library/agents/codebase-explorer.md');
write(agreed, '.claude/pincer/library/agents/codebase-explorer.md', explorerLib + "\n'''\n");
out = cli(agreed, 'update');
assert.match(out, /note  agents\/codebase-explorer\.md: the body contains '''/);
assert.ok(!out.includes('    at '), out);
write(agreed, '.claude/pincer/library/agents/codebase-explorer.md', explorerLib);
fs.rmSync(path.join(agreed, '.claude/pincer/library/agents/codebase-explorer.md.new'), { force: true });
// an edited project copy survives the next update and gets a sidecar from the new library
write(agreed, '.claude/skills/pincer-plan/SKILL.md', read(agreed, '.claude/skills/pincer-plan/SKILL.md') + '\nOURS\n');
write(kit, 'template/.claude/pincer/library/stages/plan/SKILL.md', read(kit, 'template/.claude/pincer/library/stages/plan/SKILL.md') + '\nUPSTREAM PLAN\n');
out = cli(agreed, 'update');
assert.match(read(agreed, '.claude/skills/pincer-plan/SKILL.md'), /OURS/);
assert.match(read(agreed, '.claude/skills/pincer-plan/SKILL.md.new'), /UPSTREAM PLAN/);
assert.match(read(agreed, '.claude/pincer/library/stages/plan/SKILL.md'), /UPSTREAM PLAN/, 'the library itself was refreshed');
assert.match(out, /kept .*pincer-plan\/SKILL\.md/);
assert.equal(JSON.parse(read(agreed, '.pincer.json')).generated['.claude/skills/pincer-plan/SKILL.md'], generated['.claude/skills/pincer-plan/SKILL.md'], 'the baseline stays at the last generated content');
// a broken agreement does not stop the update; it is reported
write(agreed, 'harness.json', '{"schema": 1}');
out = cli(agreed, 'update');
assert.match(out, /harness\.json/);

// A platform is added to an existing install with `update --platform`: the new
// platform's files arrive, existing files and edits stay, the manifest names both.
const grow = tempDir();
write(grow, 'CLAUDE.md', 'OUR CLAUDE NOTES\n');
cli(grow, 'init', '--platform', 'codex');
write(grow, 'harness.json', JSON.stringify({ schema: 1, project: { name: 'grow', kind: 'greenfield' }, people: [{ name: 'Alex', accepts: true }] }));
cli(grow, 'update');
assert.ok(!fs.existsSync(path.join(grow, '.claude/settings.json')), 'a Codex install has no Claude Code wiring');
assert.ok(!fs.existsSync(path.join(grow, '.github/prompts/pincer-code.prompt.md')));
const codexAgents = read(grow, 'AGENTS.md');
const refusedInit = pincer(grow, 'init', '--platform', 'claude');
assert.equal(refusedInit.status, 1);
assert.match(refusedInit.stderr, /already has PINCER installed.*update --platform/);
const unknownPlatform = pincer(grow, 'update', '--platform', 'cursor');
assert.equal(unknownPlatform.status, 1);
assert.match(unknownPlatform.stderr, /--platform must be/);
assert.equal(pincer(grow, 'update', '--platform').status, 1, 'a missing value is refused');
assert.deepEqual(JSON.parse(read(grow, '.pincer.json')).platforms, ['codex'], 'a refused update changes nothing');
out = cli(grow, 'update', '--platform', 'claude');
assert.match(out, /adding: claude/);
assert.match(out, /Claude Code +start `claude`/, 'the added platform gets its first step');
assert.deepEqual(JSON.parse(read(grow, '.pincer.json')).platforms, ['codex', 'claude']);
for (const rel of ['.claude/settings.json', '.claude/hooks/ticket-guard.sh', '.claude/hooks/block-dangerous.sh', '.claude/hooks/hook-policy.cjs']) assert.ok(fs.existsSync(path.join(grow, rel)), `${rel} installed`);
assert.ok(fs.statSync(path.join(grow, '.claude/hooks/ticket-guard.sh')).mode & 0o100, 'the hook is executable');
assert.equal(read(grow, 'CLAUDE.md'), 'OUR CLAUDE NOTES\n', 'an existing file of the new platform is kept');
assert.equal(read(grow, 'CLAUDE.md.new'), read(kit, 'template/CLAUDE.md'), 'and the kit version waits beside it');
assert.equal(read(grow, 'AGENTS.md'), codexAgents, 'the agreement file is untouched');
assert.ok(fs.existsSync(path.join(grow, '.agents/skills/pincer-code/SKILL.md')), 'the first platform keeps its copies');
fs.renameSync(path.join(grow, 'CLAUDE.md.new'), path.join(grow, 'CLAUDE.md'));
doctor = pincer(grow, 'doctor');
assert.equal(doctor.status, 0, `${doctor.stdout}${doctor.stderr}`);
assert.doesNotMatch(doctor.stdout, /locally edited/, 'a file that equals the package is not called edited');
// several at once, an installed one named again, and the generated copies of the new platform
out = cli(grow, 'update', '--platform', 'claude,copilot');
assert.match(out, /adding: copilot/);
assert.deepEqual(JSON.parse(read(grow, '.pincer.json')).platforms, ['codex', 'claude', 'copilot']);
assert.ok(fs.existsSync(path.join(grow, '.github/prompts/pincer-code.prompt.md')), 'the stage copies are generated for the added platform');
out = cli(grow, 'update', '--platform', 'all');
assert.doesNotMatch(out, /adding:/);
assert.equal(pincer(grow, 'doctor').status, 0);

// doctor compares the installed files with this package, not only the version label
const built = tempDir();
cli(built, 'init', '--platform', 'claude');
doctor = pincer(built, 'doctor');
assert.equal(doctor.status, 0, `${doctor.stdout}${doctor.stderr}`);
assert.match(doctor.stdout, /ok {4}installed files match this package/);
// a local edit is a note, not a problem
const checklist = read(built, 'docs/release-checklist.md');
write(built, 'docs/release-checklist.md', checklist + '\nOURS\n');
doctor = pincer(built, 'doctor');
assert.equal(doctor.status, 0, `${doctor.stdout}${doctor.stderr}`);
assert.match(doctor.stdout, /note {2}locally edited \(kept as-is on update\): docs\/release-checklist\.md$/m);
// the package changes under the same version label: the untouched files are another build's
write(kit, 'template/docs/engine.md', read(kit, 'template/docs/engine.md') + '\nANOTHER BUILD\n');
write(kit, 'template/scripts/pincer/extra.cjs', "'use strict';\n");
doctor = pincer(built, 'doctor');
assert.equal(doctor.status, 1, `${doctor.stdout}${doctor.stderr}`);
assert.match(doctor.stdout, /ok {4}install is current/, 'the version label alone still looks current');
const mismatch = doctor.stdout.split('\n').find((line) => line.includes('installed files match this package'));
assert.match(mismatch, /^ {2}FAIL {2}installed files match this package \(v[0-9.]+\) — from another build labelled v[0-9.]+: docs\/engine\.md; not installed: scripts\/pincer\/extra\.cjs — run: pincer update$/);
assert.ok(!mismatch.includes('release-checklist'), 'a local edit is not blamed on another build');
assert.match(doctor.stdout, /locally edited \(kept as-is on update\): docs\/release-checklist\.md$/m);
// update brings the install to this build
write(built, 'docs/release-checklist.md', checklist);
cli(built, 'update');
assert.match(read(built, 'docs/engine.md'), /ANOTHER BUILD/);
doctor = pincer(built, 'doctor');
assert.equal(doctor.status, 0, `${doctor.stdout}${doctor.stderr}`);
// an older version label is the version check's business alone
write(built, '.pincer.json', JSON.stringify({ ...JSON.parse(read(built, '.pincer.json')), version: '0.0.1' }));
write(kit, 'template/docs/engine.md', read(kit, 'template/docs/engine.md') + '\nA LATER RELEASE\n');
doctor = pincer(built, 'doctor');
assert.equal(doctor.status, 1);
assert.match(doctor.stdout, /FAIL {2}install is current \(v0\.0\.1\) — run: pincer update/);
assert.doesNotMatch(doctor.stdout, /another build/);

console.log('installer: ok');
