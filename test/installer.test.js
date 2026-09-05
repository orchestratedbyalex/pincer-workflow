import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { repo, tempDir, run, write, read } from './helpers.js';

const kit = tempDir();
for (const file of ['bin', 'template', 'package.json']) fs.cpSync(path.join(repo, file), path.join(kit, file), { recursive: true });
const cli = (dir, ...args) => {
  const r = run(dir, process.execPath, [path.join(kit, 'bin/pincer.js'), ...args]);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};

const fresh = tempDir();
cli(fresh, 'init', '--platform', 'all');
const original = read(fresh, 'AGENTS.md');
write(fresh, 'AGENTS.md', original + '\nLOCAL RULE\n');
for (let i = 0; i < 3; i++) cli(fresh, 'update');
assert.equal(read(fresh, 'AGENTS.md'), original + '\nLOCAL RULE\n', 'repeated update preserves edits');
assert.equal(read(fresh, 'AGENTS.md.new'), original);

// A sidecar may already contain the user's in-progress merge.
write(fresh, 'AGENTS.md.new', 'MERGE IN PROGRESS\n');
cli(fresh, 'update');
assert.equal(read(fresh, 'AGENTS.md.new'), 'MERGE IN PROGRESS\n');
assert.ok(fs.readdirSync(fresh).some(f => f.startsWith('AGENTS.md.new.')));
const afterFirstSidecar = fs.readdirSync(fresh).filter(f => f.startsWith('AGENTS.md.new'));
cli(fresh, 'update');
assert.deepEqual(fs.readdirSync(fresh).filter(f => f.startsWith('AGENTS.md.new')), afterFirstSidecar, 'same update reuses identical proposal');
const doctor = run(fresh, process.execPath, [path.join(kit, 'bin/pincer.js'), 'doctor']);
assert.equal(doctor.status, 1);
assert.match(doctor.stdout, /AGENTS\.md\.new/);

const existing = tempDir();
write(existing, 'AGENTS.md', 'EXISTING TEAM CONVENTIONS\n');
cli(existing, 'init', '--platform', 'codex');
cli(existing, 'update');
cli(existing, 'update');
assert.equal(read(existing, 'AGENTS.md'), 'EXISTING TEAM CONVENTIONS\n');

// Legacy manifests cannot prove that a baseline wasn't adopted from a conflict.
const legacy = tempDir();
cli(legacy, 'init', '--platform', 'copilot');
write(legacy, 'AGENTS.md', 'LEGACY LOCAL EDIT\n');
const manifest = JSON.parse(read(legacy, '.pincer.json'));
delete manifest.schema;
const { createHash } = await import('node:crypto');
manifest.files['AGENTS.md'] = createHash('sha256').update('LEGACY LOCAL EDIT\n').digest('hex');
write(legacy, '.pincer.json', JSON.stringify(manifest));
cli(legacy, 'update');
cli(legacy, 'update');
assert.equal(read(legacy, 'AGENTS.md'), 'LEGACY LOCAL EDIT\n');

// A trusted untouched install still receives genuine upstream changes.
const untouched = tempDir();
cli(untouched, 'init', '--platform', 'claude');
write(kit, 'template/AGENTS.md', original + '\nUPSTREAM V2\n');
cli(untouched, 'update');
assert.equal(read(untouched, 'AGENTS.md'), original + '\nUPSTREAM V2\n');
cli(fresh, 'update');
assert.match(read(fresh, 'AGENTS.md'), /LOCAL RULE/);

// Accepting the upstream file explicitly resolves its baseline for later upgrades.
write(existing, 'AGENTS.md', read(kit, 'template/AGENTS.md'));
cli(existing, 'update');
write(kit, 'template/AGENTS.md', original + '\nUPSTREAM V3\n');
cli(existing, 'update');
assert.equal(read(existing, 'AGENTS.md'), original + '\nUPSTREAM V3\n');
console.log('installer preservation tests passed');
