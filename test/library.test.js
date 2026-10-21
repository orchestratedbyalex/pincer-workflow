// The stage library under template/.claude/pincer/library: every stage skill has
// the same shape, every format answers the four questions and shows an example,
// every prompt is a template with a Returns line. Shared by Tasks 11 to 13.
// Run with: node test/library.test.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo } from './helpers.js';

const require = createRequire(import.meta.url);
const gen = require(path.join(repo, 'template/scripts/pincer/generate.cjs'));
const LIB = path.join(repo, 'template/.claude/pincer/library');
const STAGES_DIR = path.join(LIB, 'stages');
const SECTIONS = ['## Reads', '## Steps', '## Checks', '## Writes', '## Without subagents', '## When this stage is off'];
const BLUEPRINT_PROMPTS = ['confirm-kind.md', 'q-systems.md', 'q-pipeline.md', 'q-handoffs.md', 'q-simplify.md', 'q-responsibility.md', 'q-repo.md', 'q-roster.md', 'first-job.md'];

const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8');
const listDir = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => !n.startsWith('.')).sort() : []);
const files = (dir, ext = '.md') => listDir(dir).filter((n) => n.endsWith(ext));
// Headings in order of appearance, with their line numbers.
const headings = (text) => text.split('\n').map((line, i) => [line, i]).filter(([line]) => /^#{1,3} /.test(line));

assert.ok(fs.existsSync(STAGES_DIR), 'the library has a stages/ directory');
const stages = listDir(STAGES_DIR);
assert.ok(stages.includes('blueprint') && stages.includes('status'), stages.join(', '));

for (const stage of stages) {
  const dir = path.join(STAGES_DIR, stage);
  const skillFile = path.join(dir, 'SKILL.md');
  assert.ok(fs.existsSync(skillFile), `${stage}/SKILL.md exists`);
  const text = read(skillFile);
  const { fields, body } = gen.splitFrontmatter(text);
  // frontmatter: name, description, argument-hint
  assert.equal(fields.name, `pincer-${stage}`, `${stage}: name`);
  assert.ok(fields.description && fields.description.length <= 200, `${stage}: one-line description`);
  assert.ok('argument-hint' in fields, `${stage}: argument-hint`);
  assert.ok(!/^description:\s*[>|]/m.test(text), `${stage}: description on one line`);
  // the six body sections, in order, and nothing else at level two
  const level2 = headings(body).filter(([line]) => line.startsWith('## ')).map(([line]) => line.trim());
  assert.deepEqual(level2, SECTIONS, `${stage}: sections in order`);
  // steps: numbered, each with an owner in brackets
  const stepsText = body.slice(body.indexOf('## Steps'), body.indexOf('## Checks'));
  const steps = stepsText.split('\n').filter((line) => /^\d+\. /.test(line));
  assert.ok(steps.length >= 2, `${stage}: at least two numbered steps`);
  steps.forEach((step, i) => {
    assert.ok(step.startsWith(`${i + 1}. `), `${stage}: step ${i + 1} numbered in order: ${step}`);
    assert.match(step, /^\d+\. \[(session|session \+ agent)\] /, `${stage}: step owner: ${step}`);
  });
  // first step reaches for the stage gate
  assert.ok(steps[0].includes('--stage'), `${stage}: first step names the stage gate: ${steps[0]}`);
  // the skill reads harness.json first and never names the retired runtime
  assert.ok(body.includes('harness.json'), `${stage}: reads harness.json`);
  for (const stale of ['pincer-runtime', '.prd/', '.pincer/', 'PRD']) assert.ok(!text.includes(stale), `${stage}: no ${stale}`);
  // sibling references are repo-relative so the Codex copy needs no path rewrite (Task 10 ruling)
  for (const match of text.matchAll(/(?<![\w./-])(prompts|formats|agents)\/[\w.-]+\.md/g)) {
    assert.fail(`${stage}: sibling reference must be repo-relative (.claude/skills/pincer-${stage}/${match[0]})`);
  }
  for (const match of text.matchAll(/\.claude\/skills\/pincer-([a-z]+)\/(prompts|formats)\/([\w.-]+\.md)/g)) {
    assert.ok(fs.existsSync(path.join(STAGES_DIR, match[1], match[2], match[3])), `${stage}: ${match[0]} exists in the library`);
  }
  // no @ imports in anything Codex or Copilot reads
  assert.ok(!/^@/m.test(text), `${stage}: no @ imports`);
  // formats: the four questions and a filled example
  for (const name of files(path.join(dir, 'formats'))) {
    const format = read(dir, 'formats', name);
    const fm = gen.splitFrontmatter(format);
    for (const key of ['owner', 'home', 'readers', 'shape']) assert.ok(fm.fields[key], `${stage}/formats/${name}: ${key}`);
    const example = format.indexOf('\n## Example');
    assert.ok(example > 0, `${stage}/formats/${name}: ## Example`);
    assert.ok(format.slice(example).trim().split('\n').length >= 4, `${stage}/formats/${name}: the example is filled`);
    assert.ok(!/\{\{[\w.]+\}\}/.test(format.slice(example)), `${stage}/formats/${name}: the example has no unfilled slots`);
  }
  // prompts: templates with slots and a one-line Returns section
  for (const name of files(path.join(dir, 'prompts'))) {
    const prompt = read(dir, 'prompts', name);
    assert.match(prompt, /\{\{[\w.]+\}\}/, `${stage}/prompts/${name}: has a {{slot}}`);
    const returns = prompt.split('\n').filter((line) => /^Returns:/.test(line));
    assert.equal(returns.length, 1, `${stage}/prompts/${name}: exactly one Returns: line`);
    assert.ok(returns[0].length > 'Returns: '.length, `${stage}/prompts/${name}: Returns says what`);
  }
}

// The blueprint: the nine prompts, the two formats, the eight steps the brief names
assert.deepEqual(files(path.join(STAGES_DIR, 'blueprint/prompts')).sort(), [...BLUEPRINT_PROMPTS].sort());
for (const name of ['roster-rules.md', 'harness.md']) assert.ok(fs.existsSync(path.join(STAGES_DIR, 'blueprint/formats', name)), name);
const blueprint = read(STAGES_DIR, 'blueprint/SKILL.md');
for (const needle of ['recon --json --network', 'scripts/pincer-blueprint.cjs write', 'confirm-kind.md', 'q-roster.md', 'roster-rules.md', 'harness.md', 'firstJob', 'first-job.md', 'scripts/pincer-status.sh']) assert.ok(blueprint.includes(needle), `blueprint: ${needle}`);
for (const heading of ['Systems', 'Current pipeline', 'Handoff artifacts', 'Simplify', 'Responsibility', 'Repo']) assert.ok(blueprint.includes(heading), `blueprint: ${heading}`);
assert.match(blueprint, /one question at a time/i);
assert.match(blueprint, /\bopen\b/);
assert.match(blueprint, /re-?run/i);
// roster rules carry every agent name the engine knows
const rosterRules = read(STAGES_DIR, 'blueprint/formats/roster-rules.md');
const harness = require(path.join(repo, 'template/scripts/pincer/harness.cjs'));
for (const name of harness.AGENT_NAMES) assert.ok(rosterRules.includes(name), `roster-rules: ${name}`);
// harness.md names every top-level field and every stage option
const harnessFormat = read(STAGES_DIR, 'blueprint/formats/harness.md');
for (const key of ['schema', 'project', 'people', 'systems', 'repo', 'homes', 'stages', 'roster', 'open', 'firstJob']) assert.ok(harnessFormat.includes(`\`${key}\``) || harnessFormat.includes(`${key}:`) || harnessFormat.includes(`"${key}"`), `harness.md: ${key}`);
for (const key of ['accepts', 'forge', 'per-ticket', 'squash', 'implementer', 'evidence', 'audit', 'gate', 'reason']) assert.ok(harnessFormat.includes(key), `harness.md: ${key}`);
const exampleStart = harnessFormat.indexOf('\n## Example');
const json = /```json\n([\s\S]*?)\n```/.exec(harnessFormat.slice(exampleStart));
assert.ok(json, 'harness.md: the example is a json block');
assert.deepEqual(harness.validate(JSON.parse(json[1])), [], 'harness.md: the example validates');

// The status stage: three lines, resume, never restore
const status = read(STAGES_DIR, 'status/SKILL.md');
for (const needle of ['scripts/pincer-status.sh', 'three lines', 'in_progress', 'git status', 'Next']) assert.ok(status.includes(needle), `status: ${needle}`);
assert.match(status, /never restore/i);

// Course text is paraphrased, never copied: no eight-word run of a library file
// appears in the masterclass playbook. Runs only where the playbook is checked out.
const PLAYBOOK = '/Users/alex/Documents/harness-masterclass/harness-playbook';
if (fs.existsSync(PLAYBOOK)) {
  const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []));
  const grams = new Set();
  for (const file of walk(PLAYBOOK)) { const w = normalize(fs.readFileSync(file, 'utf8')); for (let i = 0; i + 8 <= w.length; i++) grams.add(w.slice(i, i + 8).join(' ')); }
  const libraryFiles = walk(STAGES_DIR).concat(fs.existsSync(path.join(LIB, 'agents')) ? walk(path.join(LIB, 'agents')) : []);
  for (const file of libraryFiles) {
    const w = normalize(fs.readFileSync(file, 'utf8'));
    for (let i = 0; i + 8 <= w.length; i++) {
      const gram = w.slice(i, i + 8).join(' ');
      assert.ok(!grams.has(gram), `${path.relative(repo, file)} copies the course: "${gram}"`);
    }
  }
}

console.log('ok library');
