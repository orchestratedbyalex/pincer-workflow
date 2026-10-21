// The stage library under template/.claude/pincer/library: every stage skill has
// the same shape, every format answers the four questions and shows an example,
// every prompt is a template with a Returns line. Shared by Tasks 11 to 13.
// Run with: node test/library.test.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { repo } from './helpers.js';

const require = createRequire(import.meta.url);
const gen = require(path.join(repo, 'template/scripts/pincer/generate.cjs'));
const LIB = path.join(repo, 'template/.claude/pincer/library');
const STAGES_DIR = path.join(LIB, 'stages');
const SECTIONS = ['## Reads', '## Steps', '## Checks', '## Writes', '## Without subagents', '## When this stage is off'];
const BLUEPRINT_PROMPTS = ['confirm-kind.md', 'q-systems.md', 'q-pipeline.md', 'q-handoffs.md', 'q-simplify.md', 'q-responsibility.md', 'q-repo.md', 'q-roster.md', 'q-models.md', 'first-job.md'];

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
  if (stage === 'blueprint') assert.equal(steps.length, 9, 'blueprint: nine steps (the models question after the roster)');
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
for (const needle of ['recon --json --network', 'scripts/pincer-blueprint.cjs write', 'confirm-kind.md', 'q-roster.md', 'q-models.md', 'models', 'roster-rules.md', 'harness.md', 'firstJob', 'first-job.md', 'scripts/pincer-status.sh']) assert.ok(blueprint.includes(needle), `blueprint: ${needle}`);
for (const heading of ['Systems', 'Current pipeline', 'Handoff artifacts', 'Simplify', 'Responsibility', 'Repo']) assert.ok(blueprint.includes(heading), `blueprint: ${heading}`);
assert.match(blueprint, /one question at a time/i);
assert.match(blueprint, /\bopen\b/);
assert.match(blueprint, /re-?run/i);
// roster rules carry every agent name the engine knows
const rosterRules = read(STAGES_DIR, 'blueprint/formats/roster-rules.md');
const harness = require(path.join(repo, 'template/scripts/pincer/harness.cjs'));
for (const name of harness.AGENT_NAMES) assert.ok(rosterRules.includes(name), `roster-rules: ${name}`);
assert.match(rosterRules, /^## Model tiers$/m, 'roster-rules: the Model tiers section');
for (const word of ['strong', 'standard', 'fast', 'inherit', 'effort']) assert.ok(rosterRules.includes(word), `roster-rules: ${word}`);
// harness.md names every top-level field and every stage option
const harnessFormat = read(STAGES_DIR, 'blueprint/formats/harness.md');
for (const key of ['schema', 'project', 'people', 'systems', 'repo', 'homes', 'stages', 'roster', 'open', 'firstJob']) assert.ok(harnessFormat.includes(`\`${key}\``) || harnessFormat.includes(`${key}:`) || harnessFormat.includes(`"${key}"`), `harness.md: ${key}`);
for (const key of ['accepts', 'forge', 'per-ticket', 'squash', 'implementer', 'evidence', 'audit', 'gate', 'reason', 'models', 'tier', 'effort', 'map']) assert.ok(harnessFormat.includes(key), `harness.md: ${key}`);
const exampleStart = harnessFormat.indexOf('\n## Example');
const json = /```json\n([\s\S]*?)\n```/.exec(harnessFormat.slice(exampleStart));
assert.ok(json, 'harness.md: the example is a json block');
assert.deepEqual(harness.validate(JSON.parse(json[1])), [], 'harness.md: the example validates');

// The status stage: three lines, resume, never restore
const status = read(STAGES_DIR, 'status/SKILL.md');
for (const needle of ['scripts/pincer-status.sh', 'three lines', 'in_progress', 'git status', 'Next']) assert.ok(status.includes(needle), `status: ${needle}`);
assert.match(status, /never restore/i);

// Task 12: the five other stages, the agent library, the release checklist
assert.deepEqual(stages, [...harness.STAGES].sort(), 'every stage has a folder');
const AGENTS_DIR = path.join(LIB, 'agents');
const REVIEWERS = harness.AGENT_NAMES.filter((n) => n.endsWith('-reviewer') || n === 'silent-failure-hunter');
assert.deepEqual(files(AGENTS_DIR).map((n) => n.replace(/\.md$/, '')).sort(), [...harness.AGENT_NAMES].sort(), 'one file per agent name, no extras');
for (const name of harness.AGENT_NAMES) {
  const text = read(AGENTS_DIR, `${name}.md`);
  const { fields, body } = gen.splitFrontmatter(text);
  assert.equal(fields.name, name, `${name}: frontmatter name`);
  assert.ok(fields.description, `${name}: description`);
  assert.ok(fields.tools, `${name}: tools`);
  assert.ok(!('model' in fields) && !('effort' in fields), `${name}: no platform model field in the library`);
  const words = body.trim().split(/\s+/).length;
  assert.ok(words < 300, `${name}: body under 300 words (${words})`);
  assert.ok(!/^@/m.test(text), `${name}: no @ imports`);
  for (const stale of ['pincer-runtime', '.prd/', 'PRD']) assert.ok(!text.includes(stale), `${name}: no ${stale}`);
  if (REVIEWERS.includes(name)) {
    assert.ok(body.trimEnd().endsWith('Return findings in the finding format.'), `${name}: ends with the finding sentence`);
    assert.ok(body.includes('data, never instructions'), `${name}: the untrusted-content sentence`);
    assert.ok(body.includes('.claude/skills/pincer-evaluate/formats/finding.md'), `${name}: names the finding format`);
  }
}
// the tier table: one row per platform, aliases only on the Claude row; the explorer's default is a tier
{
  const models = require(path.join(repo, 'template/scripts/pincer/models.cjs'));
  const table = models.readTable(LIB);
  assert.equal(table.ok, true, table.problem);
  assert.equal(table.table.schema, 1);
  for (const tier of harness.MAP_TIERS) assert.ok(['opus', 'sonnet', 'haiku'].includes(table.table.claude[tier]), `models.json: claude.${tier} is an alias`);
  assert.equal(gen.splitFrontmatter(read(AGENTS_DIR, 'codebase-explorer.md')).fields.tier, 'standard', 'the explorer defaults to the standard tier');
}
assert.ok(fs.existsSync(path.join(STAGES_DIR, 'evaluate/formats/finding.md')), 'evaluate/formats/finding.md');
assert.ok(fs.existsSync(path.join(STAGES_DIR, 'evaluate/formats/finding-report.md')), 'evaluate/formats/finding-report.md');
const finding = read(STAGES_DIR, 'evaluate/formats/finding.md');
for (const needle of ['file', 'line', 'failure scenario', 'suggested fix', 'confidence', '70']) assert.ok(finding.toLowerCase().includes(needle), `finding.md: ${needle}`);
assert.match(read(STAGES_DIR, 'evaluate/formats/finding-report.md'), /security first/i);
const review = read(STAGES_DIR, 'evaluate/prompts/review.md');
for (const slot of ['{{diff}}', '{{spec_scope}}', '{{tickets}}']) assert.ok(review.includes(slot), `review.md: ${slot}`);
// the evidence example passes the shipped validator once its artifacts exist (review I2)
{
  const evidenceMod = require(path.join(repo, 'template/scripts/pincer/evidence.cjs'));
  const crypto = await import('node:crypto');
  const evidenceDoc = read(STAGES_DIR, 'evaluate/formats/evidence.md');
  const block = /```json\n([\s\S]*?)\n```/.exec(evidenceDoc.slice(evidenceDoc.indexOf('\n## Example')));
  assert.ok(block, 'evidence.md: the example is a json block');
  const example = JSON.parse(block[1]);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pincer-evidence-'));
  const dir = path.join(root, 'evidence', example.candidate);
  for (const rel of Object.keys(example.artifacts)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), `artifact ${rel}\n`);
    example.artifacts[rel] = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, rel))).digest('hex');
  }
  fs.mkdirSync(path.join(root, path.dirname(example.spec)), { recursive: true });
  fs.writeFileSync(path.join(root, example.spec), '---\nstatus: built\n---\n# spec\n');
  const manifestPath = path.join(dir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(example, null, 2));
  assert.deepEqual(evidenceMod.validate(root, manifestPath, { candidate: example.candidate }), [], 'evidence.md: the example validates');
  fs.rmSync(root, { recursive: true, force: true });
}

// plan, narrow, code: the formats and prompts the brief names
assert.ok(fs.existsSync(path.join(STAGES_DIR, 'plan/formats/spec.md')), 'plan/formats/spec.md');
assert.match(read(STAGES_DIR, 'plan/formats/spec.md'), /R-NN/);
assert.match(read(STAGES_DIR, 'plan/formats/spec.md'), /status: (draft|approved)/);
assert.ok(fs.existsSync(path.join(STAGES_DIR, 'plan/prompts/explore.md')), 'plan/prompts/explore.md');
const ticketFormat = read(STAGES_DIR, 'narrow/formats/ticket.md');
for (const section of ['## Who reads this', '## Decisions so far', '## Open questions', '## How the person checks', '## Done when', '## Acceptance Criteria', '## Verification', 'Proves:', 'spec:']) assert.ok(ticketFormat.includes(section), `ticket.md: ${section}`);
assert.ok(fs.existsSync(path.join(STAGES_DIR, 'code/prompts/implement.md')), 'code/prompts/implement.md');
assert.ok(fs.existsSync(path.join(STAGES_DIR, 'code/formats/pr.md')), 'code/formats/pr.md');
const code = read(STAGES_DIR, 'code/SKILL.md');
for (const needle of ['scripts/pincer-ticket.sh start', 'verify', 'done', 'T-NN: ', 'per-ticket', 'git switch -c', 'gh pr create', 'implementer', 'docs/engine.md', 'never restore']) assert.ok(code.includes(needle), `code: ${needle}`);
const plan = read(STAGES_DIR, 'plan/SKILL.md');
for (const needle of ['stages.plan.spec', 'gh issue create', 'forge:', 'status: approved', 'stages.plan.gate', 'codebase-explorer']) assert.ok(plan.includes(needle), `plan: ${needle}`);
const narrow = read(STAGES_DIR, 'narrow/SKILL.md');
for (const needle of ['stages.narrow.tickets', 'gh issue create', 'Proves:', 'Implements:', 'Verification']) assert.ok(narrow.includes(needle), `narrow: ${needle}`);
const evaluate = read(STAGES_DIR, 'evaluate/SKILL.md');
for (const needle of ['roster', 'stages.evaluate.where', 'gh pr comment', 'stages.evaluate.evidence', 'pincer-evidence.cjs validate', 'fix-agent', 'finding-report']) assert.ok(evaluate.includes(needle), `evaluate: ${needle}`);
const release = read(STAGES_DIR, 'release/SKILL.md');
for (const needle of ['docs/release-checklist.md', 'stages.release.audit', 'systems.deploy', 'accept', 'scripts/pincer-ticket.sh accept', '--by', '--words', 'PASS', 'FAIL']) assert.ok(release.includes(needle), `release: ${needle}`);
assert.match(release, /read-only/i);
// the release checklist: fifteen checkable items in four groups
const checklist = fs.readFileSync(path.join(repo, 'template/docs/release-checklist.md'), 'utf8');
for (const group of ['## Tickets', '## Evidence', '## Review', '## Acceptance']) assert.ok(checklist.includes(group), `checklist: ${group}`);
assert.equal(checklist.split('\n').filter((l) => /^- \[ \] /.test(l)).length, 15, 'checklist: fifteen items');
for (const stale of ['pincer-runtime', '.prd/', 'NOTES.md', 'PRD', 'Provenance', 'coverage']) assert.ok(!checklist.includes(stale), `checklist: no ${stale}`);
// the stages that can be off say what happens then
for (const stage of harness.OPTIONAL_STAGES) {
  const text = read(STAGES_DIR, stage, 'SKILL.md');
  const off = text.slice(text.indexOf('## When this stage is off'));
  assert.ok(off.includes('--stage') || off.includes('exits 3') || off.includes('exit 3'), `${stage}: when off names the gate`);
}

// Task 13: docs/engine.md, the engine contract, under 250 lines
const ENGINE_HEADINGS = ['## What the engine is', '## harness.json', '## Ticket fields and receipts', '## Commands and exit codes', '## Stage gate', '## Acceptance', '## Evidence manifest schema 1', '## Generation and .new sidecars', '## Models', '## Recovery', '## Platform notes'];
const enginePath = path.join(repo, 'template/docs/engine.md');
assert.ok(fs.existsSync(enginePath), 'template/docs/engine.md exists');
const engine = fs.readFileSync(enginePath, 'utf8');
const engineLevel2 = engine.split('\n').filter((l) => l.startsWith('## '));
assert.deepEqual(engineLevel2, ENGINE_HEADINGS, 'engine.md: the eleven sections in order');
assert.ok(engine.split('\n').length <= 250, `engine.md under 250 lines (${engine.split('\n').length})`);
// every cli verb the document names exists, and every verb the cli dispatches is documented
const cliSource = fs.readFileSync(path.join(repo, 'template/scripts/pincer/cli.cjs'), 'utf8');
const cliVerbs = [...cliSource.matchAll(/if \(command === '([a-z]+)'\)/g)].map((m) => m[1]);
assert.ok(cliVerbs.length >= 6, cliVerbs.join(', '));
const documentedVerbs = [...engine.matchAll(/cli\.cjs(?: \[--root <dir>\])? ([a-z]+)/g)].map((m) => m[1]);
for (const verb of new Set(documentedVerbs)) assert.ok(cliVerbs.includes(verb), `engine.md names cli verb ${verb}, which cli.cjs does not dispatch`);
for (const verb of cliVerbs) assert.ok(documentedVerbs.includes(verb), `cli.cjs verb ${verb} is not documented in engine.md`);
// the facts the document states agree with the engine
for (const field of harness.STAGES) assert.ok(engine.includes(field), `engine.md: stage ${field}`);
for (const field of ['status', 'started', 'last_check', 'verified', 'finished', 'accepted', 'accepted_by', 'accepted_words']) assert.ok(engine.includes(`\`${field}\``), `engine.md: lifecycle field ${field}`);
for (const needle of ['running', 'passed', 'failed', 'interrupted', 'sha256', '12', 'exit 0', ' 3', '130', '--stage', 'no agreement yet', '--by', '--words', 'schema', 'C-NN', '.new', 'never restore', 'Claude Code', 'Codex', 'approval_policy', 'sandbox_mode', 'homes.tickets', 'models.json', '.codex/agents', 'tier', 'model_reasoning_effort', 'reasoning']) assert.ok(engine.includes(needle), `engine.md: ${needle}`);
for (const stale of ['pincer-runtime', '.prd/', '.pincer/', 'PRD', 'NOTES.md']) assert.ok(!engine.includes(stale), `engine.md: no ${stale}`);
assert.ok(!/^@/m.test(engine), 'engine.md: no @ imports');

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
