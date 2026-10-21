// The tier table and the resolver: models.json in the library, the agreement's map
// laid over it, the effective tier per role, and the two lines status and the
// agreement print. Run with: node test/models.test.js
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, write } from './helpers.js';

const require = createRequire(import.meta.url);
const models = require(path.join(repo, 'template/scripts/pincer/models.cjs'));
const harness = require(path.join(repo, 'template/scripts/pincer/harness.cjs'));
const LIB = path.join(repo, 'template/.claude/pincer/library');
const TABLE = { schema: 1, claude: { strong: 'opus', standard: 'sonnet', fast: 'haiku' }, codex: { strong: 'cx-s', standard: 'cx-m', fast: 'cx-f' }, copilot: { strong: 'Cp S', standard: 'Cp M', fast: 'Cp F' } };
const h = (patch) => harness.normalize({ schema: 1, project: { kind: 'greenfield' }, people: [{ name: 'A', accepts: true }], ...patch });

// readTable: the shipped table, a missing one, a broken one
let r = models.readTable(LIB);
assert.equal(r.ok, true);
for (const p of harness.PLATFORMS) for (const t of harness.MAP_TIERS) assert.ok(typeof r.table[p][t] === 'string' && r.table[p][t], `${p}.${t}`);
let dir = tempDir();
assert.deepEqual(models.readTable(dir), { ok: false, missing: true, problem: 'models.json: no such file' });
write(dir, 'models.json', '{');
assert.match(models.readTable(dir).problem, /^models\.json: invalid JSON/);
write(dir, 'models.json', JSON.stringify({ ...TABLE, codex: { strong: 'x', standard: '', fast: 'z' } }));
assert.equal(models.readTable(dir).problem, 'models.json: codex.standard must be a non-empty string');
// overlay and modelFor
const laid = models.overlay(TABLE, { codex: { strong: 'cx-pro' }, claude: { strong: 'fable' } });
assert.equal(laid.codex.strong, 'cx-pro');
assert.equal(laid.claude.strong, 'fable');
assert.equal(TABLE.codex.strong, 'cx-s', 'overlay copies');
assert.equal(models.modelFor(TABLE, 'codex', 'fast'), 'cx-f');
assert.equal(models.modelFor(TABLE, 'claude', 'inherit'), null);
assert.equal(models.modelFor(TABLE, 'claude', ''), null);
assert.equal(models.modelFor({ schema: 1, claude: { strong: 'opus' } }, 'claude', 'fast'), undefined);
// libraryTier reads the tier: field of a library agent
assert.equal(models.libraryTier(LIB, 'codebase-explorer'), 'standard');
assert.equal(models.libraryTier(LIB, 'implementer'), '');
assert.equal(models.libraryTier(LIB, 'nobody'), '');
// effective: agreement wins, then the library default, only on stages and active agents
let eff = models.effective(h({ roster: { plan: ['codebase-explorer'], evaluate: ['security-reviewer', 'code-quality-reviewer'] }, models: { stages: { evaluate: { tier: 'strong', effort: 'high' } }, agents: { 'security-reviewer': 'strong' } } }), LIB);
assert.deepEqual(Object.keys(eff.stages).sort(), [...harness.OPTIONAL_STAGES].sort());
assert.deepEqual(eff.stages.evaluate, { tier: 'strong', effort: 'high' });
assert.deepEqual(eff.stages.plan, { tier: '', effort: '' });
assert.deepEqual(eff.agents['security-reviewer'], { tier: 'strong', effort: '', source: 'agreement' });
assert.deepEqual(eff.agents['codebase-explorer'], { tier: 'standard', effort: '', source: 'library' });
assert.deepEqual(eff.agents['code-quality-reviewer'], { tier: '', effort: '', source: 'none' });
assert.ok(!('implementer' in eff.agents), 'inactive agents are absent');
eff = models.effective(h({ stages: { evaluate: { on: false } }, roster: { evaluate: ['security-reviewer'] }, models: { agents: { 'codebase-explorer': 'fast' } } }), LIB);
assert.ok(!('evaluate' in eff.stages) && !('security-reviewer' in eff.agents));
// describeEntry, statusLine, agreementLine
assert.equal(models.describeEntry({ tier: '', effort: '' }), '');
assert.equal(models.describeEntry({ tier: 'strong', effort: '' }), 'strong');
assert.equal(models.describeEntry({ tier: 'strong', effort: 'high' }), 'strong/high');
assert.equal(models.describeEntry({ tier: '', effort: 'high' }), 'effort high');
const full = { stages: { plan: { tier: '', effort: '' }, narrow: { tier: '', effort: 'high' }, evaluate: { tier: 'strong', effort: 'high' } }, agents: { 'security-reviewer': { tier: 'strong', effort: '', source: 'agreement' }, 'code-quality-reviewer': { tier: 'strong', effort: 'medium', source: 'agreement' }, 'codebase-explorer': { tier: 'standard', effort: '', source: 'library' }, 'history-reviewer': { tier: '', effort: '', source: 'none' } } };
assert.equal(models.statusLine(full), 'narrow effort high, evaluate strong/high; code-quality-reviewer strong/medium, codebase-explorer standard, security-reviewer strong');
assert.equal(models.agreementLine(full), "narrow on the session's model (high effort), evaluate on strong (high effort); code-quality-reviewer (medium effort) and security-reviewer on strong; codebase-explorer on standard; everything else on the session's model.");
const empty = { stages: { plan: { tier: '', effort: '' } }, agents: { 'history-reviewer': { tier: '', effort: '', source: 'none' } } };
assert.equal(models.statusLine(empty), '');
assert.equal(models.agreementLine(empty), "the session's model everywhere.");
assert.equal(models.agreementLine({ stages: {}, agents: { implementer: { tier: '', effort: 'low', source: 'agreement' } } }), "implementer (low effort) on the session's model; everything else on the session's model.");
assert.equal(models.statusLine({ stages: {}, agents: { implementer: { tier: 'fast', effort: '', source: 'agreement' } } }), 'implementer fast');

console.log('ok models');
