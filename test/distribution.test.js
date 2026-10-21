// What the package ships: the generator run against the library with the always-on
// harness yields the shipped copies byte for byte, every installer root exists in
// template/, and the executables are executable.
// Run with: node test/distribution.test.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir } from './helpers.js';
import { PLATFORM_ROOTS, EXECUTABLES } from '../bin/pincer.js';

const require = createRequire(import.meta.url);
const gen = require(path.join(repo, 'template/scripts/pincer/generate.cjs'));
const harness = require(path.join(repo, 'template/scripts/pincer/harness.cjs'));
const template = path.join(repo, 'template');
const walk = (dir, rel = '') => {
  const abs = path.join(dir, rel);
  if (!fs.existsSync(abs)) return [];
  if (!fs.statSync(abs).isDirectory()) return [rel];
  return fs.readdirSync(abs).filter((n) => n !== '.DS_Store').flatMap((n) => walk(dir, rel ? `${rel}/${n}` : n)).sort();
};

// The fixture: a valid agreement with every optional stage off
const fixturePath = path.join(repo, 'test/fixtures/always-on.harness.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
assert.deepEqual(harness.validate(fixture), []);
for (const stage of harness.OPTIONAL_STAGES) assert.equal(harness.stageOn(fixture, stage), false, `${stage} is off in the fixture`);

// Generate into a temp dir and compare with what template/ ships
const out = tempDir();
const report = gen.generate(out, { harness: fixture, platforms: [...gen.PLATFORMS], library: path.join(template, gen.LIBRARY) });
assert.deepEqual(report.missing, [], 'the library has the always-on stages');
assert.deepEqual(report.conflicted, []);
assert.ok(report.written.length >= 8, report.written.join('\n'));
const produced = walk(out);
assert.ok(!produced.includes('.pincer.json'), 'no manifest is created');
for (const rel of produced) {
  assert.ok(fs.existsSync(path.join(template, rel)), `shipped copy missing: ${rel}. Run: npm run generate`);
  assert.ok(fs.readFileSync(path.join(template, rel)).equals(fs.readFileSync(path.join(out, rel))), `shipped copy stale: ${rel}. Run: npm run generate`);
}
// and template/ ships nothing generated beyond these
const shipped = ['.claude/skills', '.claude/commands', '.claude/agents', '.agents', '.github/prompts'].flatMap((d) => walk(template, d)).sort();
assert.deepEqual(shipped, produced, 'template/ ships exactly the always-on copies');
for (const rel of produced) assert.ok(/pincer-(blueprint|status)/.test(rel), rel);

// Every installer root exists in template/; the executables are executable; nothing retired ships
const roots = [...PLATFORM_ROOTS.common, ...PLATFORM_ROOTS.claude, ...PLATFORM_ROOTS.codex, ...PLATFORM_ROOTS.copilot];
for (const root of roots) assert.ok(fs.existsSync(path.join(template, root)), `template/${root}`);
assert.equal(new Set(roots).size, roots.length, 'no duplicate roots');
for (const rel of EXECUTABLES) {
  assert.ok(fs.existsSync(path.join(template, rel)), rel);
  assert.ok(fs.statSync(path.join(template, rel)).mode & 0o100, `${rel} is executable in template/`);
}
const everything = walk(template);
for (const rel of everything) assert.ok(!/pincer-runtime|\.prd|\.claude\/references|runtime-contracts|dry-run|\.pincer\.json/.test(rel), `retired or stray file in template/: ${rel}`);
// every shipped file is reachable from some root (nothing in template/ is left out of the install)
const covered = new Set(roots.flatMap((root) => walk(template, root)));
for (const rel of everything) assert.ok(covered.has(rel), `template/${rel} is shipped by no PLATFORM_ROOTS entry`);
// no @ imports in anything Codex or Copilot reads
for (const rel of everything.filter((f) => f.endsWith('.md') && f !== 'CLAUDE.md')) assert.ok(!/^@/m.test(fs.readFileSync(path.join(template, rel), 'utf8')), `${rel}: @ import`);
assert.match(fs.readFileSync(path.join(template, 'CLAUDE.md'), 'utf8'), /^@AGENTS\.md$/m);

// the maintainers' regeneration command is pinned in package.json and names the fixture
const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
assert.match(pkg.scripts.generate || '', /always-on\.harness\.json/);
assert.match(pkg.scripts.generate || '', /--root template/);
assert.match(pkg.scripts.generate || '', /--overwrite/);
assert.deepEqual(pkg.files, ['bin', 'template']);

console.log('distribution: ok');
