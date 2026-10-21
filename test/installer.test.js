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

console.log('installer: ok');
