# PINCER 1.1 Model Tiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the agreement name a model tier and an optional effort per stage and per roster agent, and have the generator write each platform's native model fields from one library table.

**Architecture:** `harness.cjs` learns the `models` vocabulary (validation and defaults). A new `models.cjs` reads the library table `models.json`, lays the agreement's `map` over it, resolves tiers per platform and computes the effective tier per role, with library agent files carrying a `tier:` default. `generate.cjs` renders the Claude agent, skill and command frontmatter, a Codex agent TOML per roster member, a model line in the Copilot prompts and a hint line in the Codex skills, under the existing baseline and sidecar rules. The blueprint gains one interview question and one agreement line; status, doctor and the docs report it.

**Tech Stack:** Node 22+ CommonJS for the kit (`.cjs`, `node:` modules only), ESM for the installer and tests, markdown and JSON for the library.

**Spec:** `docs/superpowers/specs/2026-10-21-model-tiers-design.md`

## Global Constraints

- Node `>=22`; no dependencies; every `require` is `node:` or a relative sibling. No `@` imports in anything Codex or Copilot reads.
- `template/` is the single source. After ANY edit under `template/`: `npm test`. After an edit to `template/.claude/pincer/library/stages/blueprint/` or `status/`: `npm run generate`, then `npm test` (`test/distribution.test.js` fails on stale shipped copies).
- `harness.json` stays schema 1; `models` is additive; a document without it is valid and means "as run" everywhere.
- Tiers: `strong`, `standard`, `fast`, `inherit`, and `""` for "not set". Efforts: `low`, `medium`, `high`, and `""`. These exact strings everywhere.
- No tier or effort on `blueprint` or `status`; the validator rejects an entry for them.
- A model field is written only when the tier resolves to a value; an effort field is written whenever an effort is set, with or without a model.
- No `.github/agents/` files; no generated Codex `config.toml`; no tool-name translation.
- The Claude row of the table uses only the aliases `opus`, `sonnet`, `haiku` (never `fable`, never an id). Library agent and stage files never carry `model:` or `effort:`.
- Course text paraphrased, never copied; the six agreement headings used as is.
- Branch `feat/model-tiers`, local only: no push, no publish, no version bump (`npm version minor` is the owner's step after the branch lands).
- Commit messages end with the two attribution lines used on the previous branch (`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and the `Claude-Session:` line).

## Review Focus

1. A 1.0 project whose `.claude/agents/codebase-explorer.md` equals the old library copy (with `model: sonnet`) and that has no `.pincer.json`: the next generate overwrites it, no sidecar. (Task 3)
2. A library agent whose body contains `'''`: generate throws with the file named and writes nothing for that run, rather than producing a broken Codex file. (Task 3)
3. `models.map` naming an unknown platform, an unknown tier, or an empty string: `write` refuses with the exact field named and writes nothing. (Task 1)
4. A project that edited the library's `models.json` by hand: `pincer update` keeps the edit, puts the upstream version beside it as `.new`, and the generator resolves from the edited copy. (Task 8)
5. An effort set with no tier on a stage: the Claude skill gets `effort:` and no `model:`, the Codex skill gets the Effort hint, the Copilot prompt gets no model line, status prints `effort high`. (Tasks 4 and 6)

---

## File structure

```
template/scripts/pincer/
  harness.cjs          + TIERS, MAP_TIERS, EFFORTS, PLATFORMS, models defaults, validation, normalize, activeAgents
  models.cjs           NEW: readTable, overlay, modelFor, libraryTier, effective, statusLine, agreementLine
  generate.cjs         + rewriteFrontmatter, renderAgent, renderCodexAgent, model fields in derived files, Codex agent paths
  blueprint.cjs        + {{models}} slot
  status.cjs           + Models: line and report.models
  cli.cjs              + messages for the new `missing` entries
template/.claude/pincer/library/
  models.json          NEW: the tier table
  agents/codebase-explorer.md        model: sonnet -> tier: standard
  agreement.md                       + "- Models: {{models}}"
  stages/blueprint/SKILL.md          + the models step, the re-run note
  stages/blueprint/prompts/q-models.md   NEW
  stages/blueprint/formats/roster-rules.md   + "## Model tiers"
  stages/blueprint/formats/harness.md        + models rows and example
template/.claude/skills/pincer-blueprint/, .agents/..., .github/prompts/...   regenerated shipped copies
template/docs/engine.md              + "## Models", table rows, generation, platform notes
template/.codex/README.md            rewritten for subagents
template/.github/copilot-instructions.md   + one line
bin/pincer.js                        doctor: models lines, missing-value problem, Codex trust note
README.md, CLAUDE.md                 model tiers paragraph; the table rule
test/
  models.test.js       NEW
  harness.test.js, generate.test.js, blueprint-write.test.js, status.test.js, installer.test.js, library.test.js   extended
```

---

### Task 1: The `models` vocabulary in harness.json

**Files:**
- Modify: `template/scripts/pincer/harness.cjs`
- Modify: `template/scripts/pincer/generate.cjs:131-136` (`activeAgents` moves to harness; generate imports it)
- Test: `test/harness.test.js`

**Interfaces:**
- Produces: `TIERS = ['strong','standard','fast','inherit']`, `MAP_TIERS = ['strong','standard','fast']`, `EFFORTS = ['low','medium','high']`, `PLATFORMS = ['claude','codex','copilot']`, `activeAgents(harness): string[]` (sorted unique names from the rosters of stages that are on; `generate.cjs` re-exports it unchanged so existing importers keep working).
- `normalize(doc).models` is always `{ stages, agents, map }`: `stages` has every optional stage, `agents` every `AGENT_NAMES` entry, each `{ tier: '', effort: '' }` unless set; a bare string `s` in the input becomes `{ tier: s, effort: '' }`; `map` is `{ [platform]: { [tier]: string } }` with only what the input gave. Unknown stage or agent keys are kept as given (like `stages`); `validate` rejects them.
- Validation messages, in reading order, exactly:
  - `models must be an object`; `models.stages must be an object`; `models.agents must be an object`; `models.map must be an object`
  - `models.stages.<name>: <name> is always on and runs on the session's model` (blueprint, status)
  - `models.stages.<name> is not a stage (stages: plan, narrow, code, evaluate, release)`
  - `models.agents.<name>: unknown agent (agents: <AGENT_NAMES joined ', '>)`
  - `models.stages.<name> must be a tier or an object` / `models.agents.<name> must be a tier or an object` (neither string nor object)
  - `models.stages.<name>.tier must be strong, standard, fast or inherit` / same for agents (a string not in `TIERS` and not `""`)
  - `models.stages.<name>.effort must be low, medium or high` / same for agents (not in `EFFORTS` and not `""`)
  - `models.map.<platform> is not a platform (claude, codex, copilot)`; `models.map.<platform> must be an object`
  - `models.map.<platform>.<tier> is not a tier (strong, standard, fast)`; `models.map.<platform>.<tier> must be a non-empty string`

- [ ] **Step 1: Write the failing tests** in `test/harness.test.js`, after the existing `normalize` block:

```js
// models: shorthand expands, defaults fill, nothing else changes
const m = harness.normalize({ ...minimal(), models: { stages: { evaluate: { tier: 'strong', effort: 'high' }, narrow: 'fast' }, agents: { 'security-reviewer': 'strong' }, map: { codex: { strong: 'gpt-x' } } } });
assert.deepEqual(m.models.stages.evaluate, { tier: 'strong', effort: 'high' });
assert.deepEqual(m.models.stages.narrow, { tier: 'fast', effort: '' });
assert.deepEqual(m.models.stages.plan, { tier: '', effort: '' });
assert.deepEqual(Object.keys(m.models.stages).sort(), [...harness.OPTIONAL_STAGES].sort());
assert.deepEqual(Object.keys(m.models.agents).sort(), [...harness.AGENT_NAMES].sort());
assert.deepEqual(m.models.agents['security-reviewer'], { tier: 'strong', effort: '' });
assert.deepEqual(m.models.map, { codex: { strong: 'gpt-x' } });
assert.deepEqual(n.models.map, {});
assert.deepEqual(harness.validate(m), []);
assert.deepEqual(harness.TIERS, ['strong', 'standard', 'fast', 'inherit']);
assert.deepEqual(harness.EFFORTS, ['low', 'medium', 'high']);
assert.deepEqual(harness.PLATFORMS, ['claude', 'codex', 'copilot']);
// every models problem, in reading order
assert.deepEqual(problemsOf({ models: 'opus' }), ['models must be an object']);
assert.deepEqual(problemsOf({ models: { stages: { blueprint: 'strong' } } }), ["models.stages.blueprint: blueprint is always on and runs on the session's model"]);
assert.deepEqual(problemsOf({ models: { stages: { deploy: 'strong' } } }), ['models.stages.deploy is not a stage (stages: plan, narrow, code, evaluate, release)']);
assert.deepEqual(problemsOf({ models: { agents: { foo: 'strong' } } }), [`models.agents.foo: unknown agent (agents: ${harness.AGENT_NAMES.join(', ')})`]);
assert.deepEqual(problemsOf({ models: { stages: { code: 7 } } }), ['models.stages.code must be a tier or an object']);
assert.deepEqual(problemsOf({ models: { stages: { code: 'opus' } } }), ['models.stages.code.tier must be strong, standard, fast or inherit']);
assert.deepEqual(problemsOf({ models: { agents: { implementer: { tier: 'fast', effort: 'max' } } } }), ['models.agents.implementer.effort must be low, medium or high']);
assert.deepEqual(problemsOf({ models: { map: { vim: {} } } }), ['models.map.vim is not a platform (claude, codex, copilot)']);
assert.deepEqual(problemsOf({ models: { map: { claude: 'opus' } } }), ['models.map.claude must be an object']);
assert.deepEqual(problemsOf({ models: { map: { claude: { inherit: 'opus' } } } }), ['models.map.claude.inherit is not a tier (strong, standard, fast)']);
assert.deepEqual(problemsOf({ models: { map: { copilot: { strong: '' } } } }), ['models.map.copilot.strong must be a non-empty string']);
assert.deepEqual(harness.validate({ ...minimal(), models: { stages: { code: { tier: '', effort: '' } } } }), [], 'empty strings are "not set"');
// activeAgents: rosters of stages that are on, sorted, unique
assert.deepEqual(harness.activeAgents(harness.normalize({ ...minimal(), roster: { plan: ['codebase-explorer'], narrow: ['codebase-explorer'], evaluate: ['security-reviewer', 'code-quality-reviewer'] } })), ['code-quality-reviewer', 'codebase-explorer', 'security-reviewer']);
assert.deepEqual(harness.activeAgents(harness.normalize({ ...minimal(), stages: { evaluate: { on: false } }, roster: { evaluate: ['security-reviewer'] } })), []);
```

- [ ] **Step 2: Run `node test/harness.test.js`.** Expected: FAIL at the first `m.models` assertion (`models` is undefined).
- [ ] **Step 3: Implement** the constants, `DEFAULTS.models`, the `models` branch of `validate` (a `checkModelEntry(problems, label, value)` helper shared by stages and agents), the expansion in `normalize`, and `activeAgents` in `harness.cjs`; replace the body of `activeAgents` in `generate.cjs` with `harness.activeAgents` and keep it exported.
- [ ] **Step 4: Run `npm test`.** Expected: `ok 13 suites`.
- [ ] **Step 5: Commit** `feat(harness): the models vocabulary (tiers, efforts, map)`.

---

### Task 2: The table and the resolver

**Files:**
- Create: `template/scripts/pincer/models.cjs`, `template/.claude/pincer/library/models.json`
- Modify: `template/.claude/pincer/library/agents/codebase-explorer.md:5` (`model: sonnet` becomes `tier: standard`)
- Test: `test/models.test.js` (new), `test/library.test.js`

**Interfaces:**
- Consumes: `harness.TIERS`, `MAP_TIERS`, `EFFORTS`, `PLATFORMS`, `OPTIONAL_STAGES`, `AGENT_NAMES`, `stageOn`, `activeAgents`, `normalize`.
- Produces, all pure except the two readers:
  - `TABLE_FILE = 'models.json'`
  - `readTable(libraryDir): { ok: true, table } | { ok: false, missing: true, problem: 'models.json: no such file' } | { ok: false, problem }` where `problem` is one of `models.json: invalid JSON (<message>)`, `models.json: schema must be 1`, `models.json: <platform>.<tier> must be a non-empty string` (first fault wins, platforms then tiers in order).
  - `overlay(table, map): table` (a copy; `map[platform][tier]` replaces the entry).
  - `modelFor(table, platform, tier): string | null | undefined` (`null` for `''` and `inherit`; `undefined` when the table has no entry).
  - `libraryTier(libraryDir, name): string` (the `tier:` frontmatter value of `agents/<name>.md`, `''` when absent or the file is missing; read with a regex over the frontmatter block, not the generator).
  - `effective(harness, libraryDir): { stages: { [stage]: { tier, effort } }, agents: { [name]: { tier, effort, source } } }` for every optional stage that is on and every active agent; an agent's tier is the agreement's when non-empty, else the library's (`source: 'library'`), else `''` (`source: 'none'`); effort is the agreement's.
  - `describeEntry({ tier, effort }): string` → `''`, `'strong'`, `'strong/high'`, or `'effort high'`.
  - `statusLine(effective): string` → `''` when every entry is empty; else stage items in `OPTIONAL_STAGES` order joined `', '`, then `'; '`, then agent items by name joined `', '` (either group alone when the other is empty), each item `<name> <describeEntry>`.
  - `agreementLine(effective): string` → `the session's model everywhere.` when nothing is set; else stage items `<stage> on <tier>` (`<stage> on the session's model` when only effort) with ` (<effort> effort)` appended where set, joined `', '`; then `'; '` and agent groups in tier order strong, standard, fast, inherit, then the effort-only group: names joined with `', '` and a final `' and '`, each name followed by ` (<effort> effort)` where set, then ` on <tier>` (or ` on the session's model`); groups joined `'; '`; then `; everything else on the session's model.`
- `models.json` shape: `{ "schema": 1, "claude": { "strong": "opus", "standard": "sonnet", "fast": "haiku" }, "codex": { ... }, "copilot": { ... } }`. The Codex and Copilot values are looked up when this task runs: Codex from the current model list in the Codex docs (`https://learn.chatgpt.com/docs/config-file/config-basic.md` and its model page) and the `codex` CLI if installed; Copilot from the model names the VS Code chat model picker shows in the current VS Code docs. Note both sources in the commit message.

- [ ] **Step 1: Write `test/models.test.js`** (the repo's style: top-level asserts, `console.log('ok models')` last):

```js
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
```

Add to `test/library.test.js`, in the agent loop: `assert.ok(!('model' in fields) && !('effort' in fields), `${name}: no platform model field in the library`)`; and after the loop: the table check (`models.readTable(LIB).ok`, every `claude` value in `['opus','sonnet','haiku']`, the file is `schema: 1`), and `assert.equal(gen.splitFrontmatter(read(AGENTS_DIR, 'codebase-explorer.md')).fields.tier, 'standard')`.

- [ ] **Step 2: Run `node test/models.test.js` and `node test/library.test.js`.** Expected: the first fails with module not found; the second fails on `codebase-explorer: no platform model field`.
- [ ] **Step 3: Implement `models.cjs`**, write `models.json` with the values looked up as described, change the explorer's frontmatter line.
- [ ] **Step 4: Run `npm test`.** Expected: `ok 14 suites`.
- [ ] **Step 5: Commit** `feat(models): the tier table and the resolver`.

---

### Task 3: Generator, part one: the agents

**Files:**
- Modify: `template/scripts/pincer/generate.cjs`, `template/scripts/pincer/cli.cjs:165-172` (`reportGenerated`)
- Test: `test/generate.test.js`

**Interfaces:**
- Consumes: `models.readTable`, `overlay`, `modelFor`, `effective`; `harness.PLATFORMS`.
- Produces:
  - `rewriteFrontmatter(text, { drop = [], add = {} }): string` — removes frontmatter lines whose key is in `drop`, appends `key: value` lines for `add` (in the given order) before the closing `---`; a value matching `/^[A-Za-z0-9._-]+$/` is written bare, any other is JSON-quoted; returns the input byte for byte when nothing is dropped and nothing is added.
  - `renderAgent(libraryText, { model, effort }): string` — `rewriteFrontmatter(text, { drop: ['tier', 'model', 'effort'], add })` with `model` and then `effort` added only when they are non-empty strings.
  - `renderCodexAgent(name, libraryText, { model, effort }): string` — exactly:
    ```
    # Generated by scripts/pincer/cli.cjs generate from .claude/pincer/library/agents/<name>.md — edit the agreement and the library, not this file
    name = "<frontmatter name, else the file name>"
    description = "<frontmatter description>"
    model = "<model>"                      (only when set)
    model_reasoning_effort = "<effort>"    (only when set)
    developer_instructions = '''
    <body, leading blank lines removed, one trailing newline>
    '''
    ```
    `name` and `description` are JSON-stringified; a body containing `'''` throws `Error("agents/<name>.md: the body contains ''' and cannot be a Codex agent")`.
  - `codexAgentPath(name) = '.codex/agents/<name>.toml'`; `MARKER_TEXT = 'Generated by scripts/pincer/cli.cjs generate from '`; `carriesMarker` now checks `MARKER_TEXT`; `DERIVED_PATH` also matches `^\.codex\/agents\/[a-z-]+\.toml$`; `KEEP_DIRS` gains `.codex`; `inScope` treats `.codex/` like `.agents/` (codex only).
  - `generatedPaths(doc, platforms, { library })` adds `codexAgentPath(name)` per active agent when `codex` is in `platforms`.
  - In `generate()`: the table is `overlay(readTable(lib).table, h.models.map)` when the read succeeds; `resolve(platform, entry)` returns `{ model, effort }` where `model = modelFor(...)` and an `undefined` result pushes `models/<platform>/<tier>` to `report.missing` once per pair and yields `null`; when the table is missing and a non-empty, non-`inherit` tier is looked up, `report.missing` gets `models.json` once and every model is `null`. The Claude agent file is `place(agentPath(name), renderAgent(text, resolve('claude', eff.agents[name])))`; with `codex` installed, `place(codexAgentPath(name), renderCodexAgent(...resolve('codex', ...)))`. Rendering happens for every agent before the first `place` of the run, so a throw writes nothing.
  - `equalIgnoringModelFields(a, b): boolean` — true when `rewriteFrontmatter(a, { drop: ['tier', 'model', 'effort'] })` equals the same of `b`. `place(rel, fresh, { ours })` takes an optional predicate over the current file's text; for an agent path it is `(current) => equalIgnoringModelFields(current, libraryText)`, so a file that differs from the library only in its model and effort lines is the generator's whatever those lines say (a 1.0 file with `model: sonnet`, a re-render under another tier, no manifest needed), while a body or tools edit still conflicts. The same predicate, against the library's SKILL.md, applies to the stage project copy `.claude/skills/pincer-<stage>/SKILL.md` (Task 4 relies on it). Removal uses it too: an inactive agent's Claude file, or an off stage's SKILL.md, is removed when it equals the library copy ignoring those fields, replacing today's `current === pristine[rel]` for those two path kinds. The rule is stated in `docs/engine.md` in Task 9: the model and effort lines of an agent file and a project copy belong to the generator; the tier belongs in the agreement.
  - `cli.cjs` `reportGenerated`: `models.json` renders as `library has no models.json; run npx pincer-workflow update`; `models/<platform>/<tier>` as `library table has no <platform> value for tier <tier>; set models.map.<platform>.<tier> in harness.json`.

- [ ] **Step 1: Write the failing tests** at the end of `test/generate.test.js`, before the final `console.log`, with a second fixture agent carrying a tier and a fixture table:

```js
// Models: agents rendered per tier, a Codex agent per roster member, markers, removal, the 1.0 case
const TABLE = { schema: 1, claude: { strong: 'opus', standard: 'sonnet', fast: 'haiku' }, codex: { strong: 'cx-s', standard: 'cx-m', fast: 'cx-f' }, copilot: { strong: 'Cp S', standard: 'Cp M', fast: 'Cp F' } };
const REVIEWER = `---\nname: security-reviewer\ndescription: "Reviews a diff for secrets"\ntools: Read, Grep\ntier: standard\n---\nYou review for secrets.\n\nReturn findings in the finding format.\n`;
const withModels = (patch) => harness.normalize({ ...planOn(), stages: { plan: { on: true }, ...OFF, evaluate: { on: true } }, roster: { plan: ['codebase-explorer'], evaluate: ['security-reviewer'] }, models: patch });
dir = tempDir();
lib = fixtureLibrary(dir);
write(dir, `${lib}/agents/security-reviewer.md`, REVIEWER);
write(dir, `${lib}/stages/evaluate/SKILL.md`, PLAN_SKILL.replace(/pincer-plan/g, 'pincer-evaluate').replace('# Plan', '# Evaluate'));
write(dir, `${lib}/models.json`, JSON.stringify(TABLE));
report = gen.generate(dir, { harness: withModels({ agents: { 'codebase-explorer': { tier: 'strong', effort: 'high' } } }), platforms: ALL, library: lib });
assert.deepEqual(report.missing, ['blueprint']);
// the Claude file: tier dropped, model and effort appended, body intact
let agent = read(dir, AGENT_PATH);
assert.equal(agent, EXPLORER.replace('---\nRead', 'model: opus\neffort: high\n---\nRead'));
agent = read(dir, '.claude/agents/security-reviewer.md');
assert.ok(!agent.includes('tier:'), agent);
assert.match(agent, /^model: sonnet$/m);
assert.doesNotMatch(agent, /^effort:/m);
assert.ok(agent.endsWith('Return findings in the finding format.\n'));
// the Codex file
const toml = read(dir, '.codex/agents/security-reviewer.toml');
assert.equal(toml, `# Generated by scripts/pincer/cli.cjs generate from .claude/pincer/library/agents/security-reviewer.md — edit the agreement and the library, not this file\nname = "security-reviewer"\ndescription = "Reviews a diff for secrets"\nmodel = "cx-m"\ndeveloper_instructions = '''\nYou review for secrets.\n\nReturn findings in the finding format.\n'''\n`);
assert.match(read(dir, '.codex/agents/codebase-explorer.toml'), /^model = "cx-s"\nmodel_reasoning_effort = "high"$/m);
assert.ok(gen.generatedPaths(withModels({}), ALL, { library: path.join(dir, lib) }).includes('.codex/agents/security-reviewer.toml'));
assert.ok(!gen.generatedPaths(withModels({}), ['claude', 'copilot'], { library: path.join(dir, lib) }).some((p) => p.startsWith('.codex/')));
// inherit and "" write no model field; the library tier is the fallback; the map overrides the table
report = gen.generate(dir, { harness: withModels({ agents: { 'codebase-explorer': 'inherit', 'security-reviewer': '' }, map: { claude: { standard: 'fable' } } }), platforms: ALL, library: lib });
assert.equal(read(dir, AGENT_PATH), EXPLORER);
assert.match(read(dir, '.claude/agents/security-reviewer.md'), /^model: fable$/m);
assert.doesNotMatch(read(dir, '.codex/agents/codebase-explorer.toml'), /^model/m);
// effort alone is written
report = gen.generate(dir, { harness: withModels({ agents: { 'codebase-explorer': { tier: '', effort: 'low' } } }), platforms: ALL, library: lib });
assert.equal(read(dir, AGENT_PATH), EXPLORER.replace('---\nRead', 'effort: low\n---\nRead'));
assert.match(read(dir, '.codex/agents/codebase-explorer.toml'), /^model_reasoning_effort = "low"$/m);
// a tier the table cannot translate is reported, not written
write(dir, `${lib}/models.json`, JSON.stringify({ ...TABLE, codex: { strong: 'cx-s', standard: 'cx-m' } }));
report = gen.generate(dir, { harness: withModels({ agents: { 'codebase-explorer': 'fast' } }), platforms: ALL, library: lib });
assert.deepEqual(report.missing.sort(), ['blueprint', 'models/codex/fast']);
assert.match(read(dir, AGENT_PATH), /^model: haiku$/m);
assert.doesNotMatch(read(dir, '.codex/agents/codebase-explorer.toml'), /^model/m);
// no table at all: reported once, only when a lookup was needed
fs.unlinkSync(path.join(dir, `${lib}/models.json`));
report = gen.generate(dir, { harness: withModels({ agents: { 'codebase-explorer': 'fast' } }), platforms: ALL, library: lib });
assert.deepEqual(report.missing.sort(), ['blueprint', 'models.json']);
report = gen.generate(dir, { harness: withModels({ agents: { 'codebase-explorer': 'inherit', 'security-reviewer': 'inherit' } }), platforms: ALL, library: lib });
assert.deepEqual(report.missing, ['blueprint']);
write(dir, `${lib}/models.json`, JSON.stringify(TABLE));
// a Codex file edited by hand: kept with a sidecar; without a baseline the marker still decides
gen.generate(dir, { harness: withModels({}), platforms: ALL, library: lib });
const tomlCopy = read(dir, '.codex/agents/security-reviewer.toml');
assert.match(tomlCopy, /^model = "cx-m"$/m);
write(dir, '.codex/agents/security-reviewer.toml', tomlCopy + '\n# mine\n');
report = gen.generate(dir, { harness: withModels({}), platforms: ALL, library: lib });
assert.ok(read(dir, '.codex/agents/security-reviewer.toml').includes('# mine'));
assert.equal(read(dir, '.codex/agents/security-reviewer.toml.new'), tomlCopy);
assert.ok(report.conflicted.includes('.codex/agents/security-reviewer.toml'));
write(dir, '.codex/agents/security-reviewer.toml', tomlCopy.replace('cx-m', 'stale'));
fs.unlinkSync(path.join(dir, '.codex/agents/security-reviewer.toml.new'));
report = gen.generate(dir, { harness: withModels({}), platforms: ALL, library: lib });
assert.equal(read(dir, '.codex/agents/security-reviewer.toml'), tomlCopy, 'a marked derived file is the generator\'s');
// an agent leaves the roster: both files go; a platform dropped leaves its files alone
report = gen.generate(dir, { harness: withModels({}), platforms: ['claude'], library: lib });
assert.ok(exists(dir, '.codex/agents/security-reviewer.toml'), 'codex files are out of scope without codex');
const noReviewer = harness.normalize({ ...withModels({}), roster: { plan: ['codebase-explorer'], evaluate: [] } });
report = gen.generate(dir, { harness: noReviewer, platforms: ALL, library: lib });
assert.ok(!exists(dir, '.claude/agents/security-reviewer.md') && !exists(dir, '.codex/agents/security-reviewer.toml'));
assert.ok(report.removed.includes('.codex/agents/security-reviewer.toml'));
assert.ok(exists(dir, '.codex'), 'the .codex directory itself stays');
// the 1.0 case: an agent file equal to the old library copy, no manifest, is overwritten
dir = tempDir();
lib = fixtureLibrary(dir);
write(dir, `${lib}/models.json`, JSON.stringify(TABLE));
const OLD = EXPLORER.replace('---\nRead', 'model: sonnet\n---\nRead');
write(dir, AGENT_PATH, OLD);
write(dir, `${lib}/agents/codebase-explorer.md`, EXPLORER.replace('---\nRead', 'tier: standard\n---\nRead'));
report = gen.generate(dir, { harness: planOn(), platforms: ALL, library: lib });
assert.equal(read(dir, AGENT_PATH), EXPLORER.replace('---\nRead', 'model: sonnet\n---\nRead'));
assert.ok(!exists(dir, `${AGENT_PATH}.new`));
// a library copy the project edited and that still carries model: and tier: renders one model line
write(dir, `${lib}/agents/codebase-explorer.md`, EXPLORER.replace('---\nRead', 'model: sonnet\ntier: strong\n---\nRead'));
report = gen.generate(dir, { harness: planOn(), platforms: ALL, library: lib });
assert.equal(read(dir, AGENT_PATH), EXPLORER.replace('---\nRead', 'model: opus\n---\nRead'));
// a body with ''' refuses before anything is written
write(dir, `${lib}/agents/codebase-explorer.md`, EXPLORER + "'''\n");
const before = fs.readdirSync(path.join(dir, '.claude/agents'));
assert.throws(() => gen.generate(dir, { harness: planOn(), platforms: ALL, library: lib }), /agents\/codebase-explorer\.md: the body contains '''/);
assert.deepEqual(fs.readdirSync(path.join(dir, '.claude/agents')), before);
// rewriteFrontmatter alone
assert.equal(gen.rewriteFrontmatter(EXPLORER, {}), EXPLORER);
assert.equal(gen.rewriteFrontmatter(EXPLORER, { add: { model: 'opus', effort: 'x y' } }), EXPLORER.replace('---\nRead', 'model: opus\neffort: "x y"\n---\nRead'));
assert.equal(gen.rewriteFrontmatter(REVIEWER, { drop: ['tier'] }), REVIEWER.replace('tier: standard\n', ''));
```

Also extend the CLI block: after the `--harness bad.json` case, create a harness with `models.agents['codebase-explorer'] = 'fast'` and a library table without `codex.fast`, run `generate`, and assert `r.stderr` matches `/library table has no codex value for tier fast; set models\.map\.codex\.fast in harness\.json/` and exit 0.

- [ ] **Step 2: Run `node test/generate.test.js`.** Expected: FAIL at the first model assertion (`agent` still equals `EXPLORER`).
- [ ] **Step 3: Implement** the helpers, the agent rendering, the Codex agent path class, the markers, the `missing` entries and the removal rules in `generate.cjs`; the two messages in `cli.cjs`. Render every agent before the first `place`.
- [ ] **Step 4: Run `npm test`.** Expected: `ok 14 suites`.
- [ ] **Step 5: Commit** `feat(generate): agent model fields and Codex agent files from the tiers`.

---

### Task 4: Generator, part two: the stages

**Files:**
- Modify: `template/scripts/pincer/generate.cjs` (`renderCommand`, `renderCodex`, `renderCopilot`, `derived`, the stage loop)
- Test: `test/generate.test.js`

**Interfaces:**
- Consumes: `resolve(platform, entry)` from Task 3; `eff.stages[stage]`.
- Produces: `derived(stage, skillText, fields)` where `fields = { claude, codex, copilot }`, each `{ model, effort }` (`null`/`''` when unset); the stage loop computes the project copy as `rewriteFrontmatter(libraryText, { drop: ['model', 'effort'], add })` with the Claude values (so an unset stage is a byte copy, as today), the command gets the same two fields after `argument-hint`, the Copilot prompt gets `model: "<copilot model>"` after `description` when set, and the Codex skill gets, after the generated comment and a blank line, one line and a blank line:
  - with a model: `Model: this stage was agreed to run on the <tier> tier (<codex model>[, effort <effort>]). If this session runs on another model, say so before starting or restart with \`codex -m <codex model>\`.`
  - effort only: `Effort: this stage was agreed to run at <effort> effort on the session's model; if this session is set lower, restart with \`codex -c model_reasoning_effort=<effort>\`.`
  The tier in the first form is the agreement's tier word (`strong`), not the model.

- [ ] **Step 1: Write the failing tests** after the Task 3 block:

```js
// Stages: the project copy, the command, the Copilot prompt and the Codex hint carry the tier
dir = tempDir();
lib = fixtureLibrary(dir);
write(dir, `${lib}/models.json`, JSON.stringify(TABLE));
const stageTiers = (stages) => harness.normalize({ ...planOn(), models: { stages } });
report = gen.generate(dir, { harness: stageTiers({ plan: { tier: 'strong', effort: 'high' } }), platforms: ALL, library: lib });
assert.equal(read(dir, '.claude/skills/pincer-plan/SKILL.md'), PLAN_SKILL.replace('---\n# Plan', 'model: opus\neffort: high\n---\n# Plan'));
command = read(dir, '.claude/commands/pincer-plan.md');
assert.ok(command.startsWith('---\ndescription: "Brief to a written spec"\nargument-hint: "<brief>"\nmodel: opus\neffort: high\n---\n'), command);
copilot = read(dir, '.github/prompts/pincer-plan.prompt.md');
assert.ok(copilot.startsWith('---\nmode: agent\ndescription: "Brief to a written spec"\nmodel: "Cp S"\n---\n'), copilot);
codex = read(dir, '.agents/skills/pincer-plan/SKILL.md');
assert.match(codex, /-->\n\nModel: this stage was agreed to run on the strong tier \(cx-s, effort high\)\. If this session runs on another model, say so before starting or restart with `codex -m cx-s`\.\n\n# Plan/);
// the status stage is untouched
assert.equal(read(dir, '.claude/skills/pincer-status/SKILL.md'), STATUS_SKILL);
assert.doesNotMatch(read(dir, '.github/prompts/pincer-status.prompt.md'), /^model:/m);
// effort alone
report = gen.generate(dir, { harness: stageTiers({ plan: { tier: '', effort: 'medium' } }), platforms: ALL, library: lib });
assert.equal(read(dir, '.claude/skills/pincer-plan/SKILL.md'), PLAN_SKILL.replace('---\n# Plan', 'effort: medium\n---\n# Plan'));
assert.doesNotMatch(read(dir, '.github/prompts/pincer-plan.prompt.md'), /^model:/m);
assert.match(read(dir, '.agents/skills/pincer-plan/SKILL.md'), /\n\nEffort: this stage was agreed to run at medium effort on the session's model; if this session is set lower, restart with `codex -c model_reasoning_effort=medium`\.\n\n# Plan/);
// back to unset: the byte copy returns, the derived files lose the fields
report = gen.generate(dir, { harness: stageTiers({}), platforms: ALL, library: lib });
assert.equal(read(dir, '.claude/skills/pincer-plan/SKILL.md'), PLAN_SKILL);
assert.doesNotMatch(read(dir, '.claude/commands/pincer-plan.md'), /^model:|^effort:/m);
assert.doesNotMatch(read(dir, '.agents/skills/pincer-plan/SKILL.md'), /^(Model|Effort):/m);
// an edited project copy keeps its edit; the derived files take the model from the resolution, not from the copy
write(dir, '.claude/skills/pincer-plan/SKILL.md', PLAN_SKILL.replace('---\n# Plan', 'model: haiku\n---\n# Plan (ours)'));
report = gen.generate(dir, { harness: stageTiers({ plan: 'strong' }), platforms: ALL, library: lib });
assert.deepEqual(report.conflicted, ['.claude/skills/pincer-plan/SKILL.md']);
assert.match(read(dir, '.claude/commands/pincer-plan.md'), /^model: opus$/m);
assert.match(read(dir, '.github/prompts/pincer-plan.prompt.md'), /^model: "Cp S"$/m);
assert.ok(read(dir, '.agents/skills/pincer-plan/SKILL.md').includes('# Plan (ours)'));
```

- [ ] **Step 2: Run `node test/generate.test.js`.** Expected: FAIL at the project copy assertion (no `model:` line).
- [ ] **Step 3: Implement** the three renderers' new fields and the stage loop.
- [ ] **Step 4: Run `npm test`.** Expected: `ok 14 suites`.
- [ ] **Step 5: Commit** `feat(generate): stage model fields for Claude, Copilot and the Codex hint`.

---

### Task 5: The agreement line

**Files:**
- Modify: `template/.claude/pincer/library/agreement.md` (one line under `### 5 Responsibility`, after the `{{#each people}}` block and before `- A person owns`: `- Models: {{models}}`)
- Modify: `template/scripts/pincer/blueprint.cjs` (`view(h, lib)` gains `models: models.agreementLine(models.effective(h, lib))`; `renderAgreement` passes the library dir)
- Test: `test/blueprint-write.test.js`

**Interfaces:**
- Consumes: `models.effective`, `models.agreementLine`.
- Produces: the `{{models}}` slot; `renderAgreement(h, { library })` unchanged in signature.

- [ ] **Step 1: Write the failing tests.** In the existing `answers` run (roster `evaluate: ['code-quality-reviewer']`, no `models`): `assert.match(section(agreement, 5), /^- Models: the session's model everywhere\.$/m)`. Then a second write with `answers` plus `models: { stages: { evaluate: 'strong' }, agents: { 'code-quality-reviewer': { tier: 'strong', effort: 'high' } } }`: `assert.match(section(agreement, 5), /^- Models: evaluate on strong; code-quality-reviewer \(high effort\) on strong; everything else on the session's model\.$/m)`; and the line sits between the last person line and `- A person owns` (compare indexes). Keep the `written.stages.status === undefined` style assertions; add `assert.deepEqual(written.models.stages.evaluate, { tier: 'strong', effort: '' })`.
- [ ] **Step 2: Run `node test/blueprint-write.test.js`.** Expected: FAIL (`Models:` absent).
- [ ] **Step 3: Implement** the template line and the slot.
- [ ] **Step 4: Run `npm test`.** Expected: `ok 14 suites`.
- [ ] **Step 5: Commit** `feat(blueprint): the Models line of the agreement`.

---

### Task 6: Status reports the tiers

**Files:**
- Modify: `template/scripts/pincer/status.cjs` (`gather` adds `report.models`; `render` adds the line)
- Test: `test/status.test.js`

**Interfaces:**
- Consumes: `models.effective`, `models.statusLine`, `generate.libraryDir(root)`.
- Produces: `report.models` = `effective(...)` when the agreement loads, else `null`; `render` pushes `Models: <statusLine>` right after the `Stages:` line only when `statusLine` is non-empty.

- [ ] **Step 1: Write the failing tests** after the JSON block (line 152): `createHarness(dir, { models: { stages: { evaluate: { tier: 'strong', effort: 'high' } }, agents: { 'security-reviewer': 'strong' } }, roster: { evaluate: ['security-reviewer'] } })`; `r = status(dir)`; the third line of `r.stdout` (after `PINCER —` and `Stages:`) is `Models: evaluate strong/high; security-reviewer strong`; `--json` has `models.stages.evaluate` equal `{ tier: 'strong', effort: 'high' }` and `models.agents['security-reviewer'].source === 'agreement'`. Then `createHarness(dir, { roster: { evaluate: ['security-reviewer'] } })`: no `Models:` line and `json.models.agents['security-reviewer'].tier === ''`. Then effort only: `models: { stages: { narrow: { effort: 'high' } } }` gives `Models: narrow effort high`. Without an agreement (a fresh temp dir): `json.models === null`. End the block with `createHarness(dir)` so the tests that follow see the default agreement again.
- [ ] **Step 2: Run `node test/status.test.js`.** Expected: FAIL (second line is a ticket line).
- [ ] **Step 3: Implement** in `status.cjs`.
- [ ] **Step 4: Run `npm test`.** Expected: `ok 14 suites`.
- [ ] **Step 5: Commit** `feat(status): the Models line`.

---

### Task 7: The interview

**Files:**
- Create: `template/.claude/pincer/library/stages/blueprint/prompts/q-models.md`
- Modify: `template/.claude/pincer/library/stages/blueprint/formats/roster-rules.md` (a `## Model tiers` section before `## Example`), `formats/harness.md` (rows for `models.stages.<stage>`, `models.agents.<name>`, `models.map.<platform>.<tier>`; the example gains a `models` block that validates), `stages/blueprint/SKILL.md` (a new step 5 after the roster step, steps 5 to 8 renumbered 6 to 9, the Reads list names the new prompt, the re-run paragraph gains the sentence: `When the file has no \`models\` key, propose the tiers once (step 5); otherwise ask only when the person wants to change them.`)
- Regenerate: `template/.claude/skills/pincer-blueprint/`, `template/.claude/commands/pincer-blueprint.md`, `template/.agents/skills/pincer-blueprint/SKILL.md`, `template/.github/prompts/pincer-blueprint.prompt.md` through `npm run generate`
- Test: `test/library.test.js`

**Interfaces:**
- `q-models.md`: the library prompt shape (a `# Models` title, a sentence on how to use it, `---` block with `{{tier_table}}` and the explanation, `---`, exactly one `Returns: models.stages and models.agents as tiers, with an effort only where the person named one` line). The body says in plain words: a tier is strong, standard or fast and is translated to the model each platform knows; `inherit` keeps the session's model; everything not named runs on the session's model; effort is low, medium or high and stays the platform's default unless named; `open` leaves a role unset and is recorded under `open`.
- `roster-rules.md` `## Model tiers`: a table of the proposal: every reviewer (the seven `-reviewer` names and `silent-failure-hunter`) `strong`, `implementer` and `fix-agent` `standard`, `codebase-explorer` `standard` (the library's default), every stage unset, every effort unset; one sentence each on why; the rule that the person may change any line and that nothing is written the person did not confirm.
- Step 5 of the blueprint: `[session] Propose the model tier per role from the "Model tiers" section of \`.claude/skills/pincer-blueprint/formats/roster-rules.md\` and ask the person to confirm with \`.claude/skills/pincer-blueprint/prompts/q-models.md\`; record the answers under \`models\`.`

- [ ] **Step 1: Write the failing tests** in `test/library.test.js`: add `'q-models.md'` to `BLUEPRINT_PROMPTS`; add `'q-models.md'`, `'models'` to the blueprint needles; `assert.match(rosterRules, /## Model tiers/)` and for each of `strong`, `standard`, `fast`, `inherit`, `effort` that `rosterRules` includes it; for `harnessFormat` add `models`, `tier`, `effort`, `map` to the needles (the example-validates assertion already exists); assert the blueprint's numbered steps are nine (`steps.length === 9` for the blueprint stage).
- [ ] **Step 2: Run `node test/library.test.js`.** Expected: FAIL on the prompts list.
- [ ] **Step 3: Write** the prompt, the sections, the rows, the example block, the step and the re-run note; then `npm run generate`.
- [ ] **Step 4: Run `npm test`.** Expected: `ok 14 suites` (the distribution suite passes only after the regenerate).
- [ ] **Step 5: Commit** `feat(blueprint): the models question and the tier rules` (include the regenerated shipped copies).

---

### Task 8: Doctor and the installer tests

**Files:**
- Modify: `bin/pincer.js` (`installedEngine` adds `models` and `generate`'s `libraryDir`; `cmdDoctor` after the `harness.json valid` check)
- Test: `test/installer.test.js`

**Interfaces:**
- Consumes: `models.readTable`, `overlay`, `modelFor`, `effective`; `generate.libraryDir`.
- Produces, in doctor, when `harness.json` loads: when `scripts/pincer/models.cjs` cannot be loaded, `check(false, 'models checked', 'could not load scripts/pincer/models.cjs — run: pincer update')`; else when `readTable` is not ok, `check(false, 'library has models.json', 'run: pincer update')`; else the tiers in use are the set of non-empty, non-`inherit` tiers across `effective.stages` and `effective.agents`; with none, one line `  models  no tier in use; the session's model everywhere`; with some, per installed platform `  models  <platform>: <tier>=<value>[, ...]` in `MAP_TIERS` order, and for a tier without a value `check(false, `tier ${tier} has a ${platform} value`, `set models.map.${platform}.${tier} in harness.json or update the kit`)`. When `codex` is installed and `.codex/agents` exists: `  note  Codex loads .codex/ only in a trusted project`.

- [ ] **Step 1: Write the failing tests** in the `agreed` block of `test/installer.test.js`, after the first `update`:

```js
const table = JSON.parse(read(agreed, '.claude/pincer/library/models.json'));
assert.match(read(agreed, '.claude/agents/codebase-explorer.md'), /^model: sonnet$/m, 'the library default renders');
assert.doesNotMatch(read(agreed, '.claude/agents/codebase-explorer.md'), /^tier:/m);
assert.match(read(agreed, '.codex/agents/codebase-explorer.toml'), new RegExp(`^model = ${JSON.stringify(table.codex.standard)}$`, 'm'));
let doctor = pincer(agreed, 'doctor');
assert.equal(doctor.status, 0, `${doctor.stdout}${doctor.stderr}`);
assert.match(doctor.stdout, /^  models  claude: standard=sonnet$/m);
assert.ok(doctor.stdout.includes(`  models  codex: standard=${table.codex.standard}\n`), doctor.stdout);
assert.match(doctor.stdout, /Codex loads \.codex\/ only in a trusted project/);
// a tier the table cannot translate is a doctor problem; an edited table survives update with a sidecar
write(agreed, 'harness.json', JSON.stringify({ schema: 1, project: { name: 'agreed', kind: 'greenfield' }, people: [{ name: 'Alex', accepts: true }], roster: { plan: ['codebase-explorer'] }, models: { agents: { 'codebase-explorer': 'fast' } } }));
write(agreed, '.claude/pincer/library/models.json', JSON.stringify({ ...table, codex: { strong: table.codex.strong, standard: table.codex.standard } }));
doctor = pincer(agreed, 'doctor');
assert.equal(doctor.status, 1);
assert.match(doctor.stdout, /FAIL  tier fast has a codex value — set models\.map\.codex\.fast in harness\.json or update the kit/);
out = cli(agreed, 'update');
assert.ok(!JSON.parse(read(agreed, '.claude/pincer/library/models.json')).codex.fast, 'the edited table is kept');
assert.ok(fs.existsSync(path.join(agreed, '.claude/pincer/library/models.json.new')), 'the upstream table waits beside it');
assert.match(read(agreed, '.claude/agents/codebase-explorer.md'), /^model: haiku$/m);
fs.renameSync(path.join(agreed, '.claude/pincer/library/models.json.new'), path.join(agreed, '.claude/pincer/library/models.json'));
```

Keep the existing "broken agreement" case last; it still expects `harness.json` in the output.

- [ ] **Step 2: Run `node test/installer.test.js`.** Expected: FAIL on the first `models` doctor line.
- [ ] **Step 3: Implement** in `bin/pincer.js`.
- [ ] **Step 4: Run `npm test`.** Expected: `ok 14 suites`.
- [ ] **Step 5: Commit** `feat(installer): doctor reports the tiers per platform`.

---

### Task 9: Documentation

**Files:**
- Modify: `template/docs/engine.md` (a `## Models` section between `## Generation and .new sidecars` and `## Recovery`: the vocabulary, the table and the `map`, the library `tier:` default, resolution, what the generator writes per platform, what each platform honours as the spec's table; the `models.*` rows in the harness table; the Codex agent files and the Claude agent rendering in the generation section, with the sentence that the model and effort lines of an agent file and a project copy belong to the generator and the tier belongs in the agreement; the Codex and Copilot platform notes), `template/.codex/README.md` (Codex has subagents; the roster ships as `.codex/agents/<name>.toml` generated from the library; Codex loads `.codex/` only in a trusted project; no generated config; the "Without subagents" sections apply only when agents are switched off), `template/.github/copilot-instructions.md` (one line: the roster agents are the files under `.claude/agents/`, which VS Code reads), `README.md` (a `## Model tiers` section after `## Platforms`: the vocabulary in four sentences, the table, `pincer update` as the upgrade path; the Platforms table's Agents row for Codex becomes `subagents from .codex/agents/`; the What-you-get table gains `.codex/agents/` and `.claude/pincer/library/models.json`), `CLAUDE.md` (the table rule: the Claude row stays aliases; the vendor rows change on a model release with the catalogue checked; the tests pin the shape)
- Test: `test/library.test.js`

- [ ] **Step 1: Write the failing tests**: insert `'## Models'` into `ENGINE_HEADINGS` after `'## Generation and .new sidecars'`; add `'models.json'`, `'.codex/agents'`, `'tier'`, `'model_reasoning_effort'`, `'reasoning'` to the engine needles; keep the 250-line ceiling.
- [ ] **Step 2: Run `node test/library.test.js`.** Expected: FAIL on the headings list.
- [ ] **Step 3: Write** the sections and lines named above.
- [ ] **Step 4: Run `npm test`.** Expected: `ok 14 suites`.
- [ ] **Step 5: Commit** `docs: model tiers in the engine contract, the platform notes and the README`.
