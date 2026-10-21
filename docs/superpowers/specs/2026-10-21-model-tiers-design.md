# PINCER 1.1: model tiers

Design, 21 October 2026. Decided with the owner in conversation after the 1.0 trial;
the owner's decisions are marked **(owner)**, the designer's calls **(call)**, and
what is left to the builder is in the last section. This extends the 1.0 design
(`2026-10-20-harness-builder-design.md`). The floor, the stages, the engine's
contracts and the prompts are unchanged.

## 1. Intent

PINCER's prompts are files the agent reads, upgraded through `pincer update`. The
owner wants the kit to use the best practice for whichever model it runs with, on
Claude Code, Codex and Copilot alike. **(owner)**

Two routes were weighed and dropped. Detecting the running model and fetching the
vendor's guidance into the prompt is nondeterministic, is the injection surface the
kit's own untrusted-content rule exists to close, and is impossible on Codex and
Copilot, which expose no model to a skill. An unattended job that rewrites the prompt
templates ships text nobody read and skips the tests. **(owner, after discussion)**

What differs between current models is mostly mechanics the generator already
renders per platform. What the kit can act on, and what changes behaviour far more
than wording, is which model and how much reasoning each role gets. So PINCER becomes
model aware by declaration: the agreement names a tier per role in platform-neutral
words, one table in the library maps tiers to each platform's model names, and the
generator writes each platform's native field. The prompts stay one set. A new vendor
model is one row of the table. **(owner)**

## 2. Goals, non-goals, anti-goals

Goals:

- The agreement says which tier, and optionally which effort, each stage and each
  roster agent runs on. Platform-neutral words; no vendor id in `harness.json`.
- The generator writes the platform's own field: Claude Code agent, skill and command
  frontmatter; Codex agent files; the Copilot prompt files.
- A new vendor model is a one-row change to the library table, shipped by
  `pincer update`; a project can override a row in its agreement.
- A 1.0 project updates without a change in behaviour until its blueprint is re-run.
- Status says what was agreed; doctor says what each installed platform will get and
  flags a tier the kit cannot translate.

Non-goals:

- Detecting the running model, on any platform.
- Per-model prompt text. The library stays one set of prompts.
- Copilot agent files under `.github/agents/`. VS Code reads the kit's Claude-format
  agent files from `.claude/agents/` and maps their model aliases and tool names
  itself; a second file per agent would list every agent twice.
- Translating tool allowlists for Codex. Its agent files cannot restrict tools; the
  agent bodies carry the read-only rule for reviewers.
- The Copilot cloud coding agent. This design covers the VS Code harness.
- A generated Codex `config.toml`. Codex has no per-stage model field and a
  project-wide one would change every Codex session in the repository; posture
  (approval policy, sandbox) stays the README's recommendation.
- Effort for agents on Copilot. The Claude agent format VS Code reads has no effort
  field; the limit is documented.

Anti-goals:

- Anything that fights what the person's host enforces. Claude Code's model allowlist
  and subagent env vars, Copilot org policy and Codex project trust all override a
  file; the kit writes defaults and never claims more.
- A silent cost change. No role moves to a stronger tier unless the person said so in
  the interview; the defaults reproduce 1.0 exactly.
- A second vocabulary. Tiers are the only words the agreement and the interview use.

## 3. Constraints

- Everything 1.0 enforces: Node 22 or newer, no dependencies, every `require` is
  `node:` or a relative sibling, the engine runs offline, the library is kit-owned
  with `.new` sidecars on local edits, generated files carry the marker, baselines
  live in `.pincer.json`, the six agreement headings are used as is, course text is
  paraphrased, `npm test` after every edit under `template/`, `npm run generate`
  keeps the shipped copies current.
- `harness.json` stays schema 1. `models` is additive; a document without it is valid
  and means "as run" everywhere.
- Platform facts this design rests on, read in the vendors' docs on 21 October 2026:
  - Claude Code. Agent files accept `model` (`sonnet`, `opus`, `haiku`, `fable`, a full
    id, or `inherit`) and `effort` (`low`, `medium`, `high`, `xhigh`, `max`). Omitted
    `model` falls to the per-dispatch parameter, then `CLAUDE_CODE_SUBAGENT_MODEL`,
    then the session's model. Skills and command files accept `model` and `effort`;
    the model override lasts the current turn and the session's model resumes on
    the next prompt. A skill and a command with the same name: the skill wins.
  - Codex. Subagents are on by default. A project ships them as TOML files under
    `.codex/agents/`, one per file, with required `name`, `description` and
    `developer_instructions` and optional `model` and `model_reasoning_effort`;
    permissions, sandbox, approvals and MCP servers are inherited and cannot be set
    there. Codex loads `.codex/` only in a project the person has marked trusted.
    Skills have no model field.
  - Copilot in VS Code. Prompt files accept `model` (one model name as the picker
    shows it; the picker's model when omitted). Claude-format agent files in
    `.claude/agents/` are read with `name`, `description`, `tools`, `model`
    (`sonnet`, `opus`, `haiku`, `inherit`) and more, and VS Code "maps supported
    Claude tool and model names to their VS Code equivalents"; `effort` and
    `fable` are not in its list.

## 4. The vocabulary: `models` in harness.json

Four tiers and three efforts. **(call)**

- Tier: `strong` (the most capable model the platform offers), `standard`, `fast`,
  or `inherit` (whatever the session runs on). The empty string means "not set",
  which falls through to the library's default for that role, else to `inherit`.
- Effort: `low`, `medium`, `high`, or the empty string for the platform's default.
  Three levels because all three platforms accept exactly these; `xhigh` and `max`
  are not portable. Effort stands on its own: a role may name an effort and no tier,
  and the effort is then written for the session's model. A value the person wrote
  is never dropped. **(call)**

Shape, every key optional:

```json
"models": {
  "stages": { "evaluate": { "tier": "strong", "effort": "high" }, "narrow": "fast" },
  "agents": { "security-reviewer": "strong", "codebase-explorer": { "tier": "standard" } },
  "map":    { "codex": { "strong": "gpt-6.1-sol" }, "claude": { "strong": "fable" } }
}
```

- `models.stages.<stage>`: any of the five optional stages (`plan`, `narrow`,
  `code`, `evaluate`, `release`). An entry for `blueprint` or `status` is
  rejected, like a `stages` entry for them: their project copies are shipped kit
  files the installer refreshes on every update, and a rendered field there would
  turn every `pincer update` into a conflict with a sidecar. They run on the
  session's model. **(call)**
- `models.agents.<name>`: any name in the agent library.
- A bare string is shorthand for `{ "tier": "<string>", "effort": "" }`.
- `models.map.<platform>.<tier>`: a model name that replaces the library table's
  entry for that platform and tier; platforms `claude`, `codex`, `copilot`; tiers
  `strong`, `standard`, `fast`; values non-empty strings.

Validation, in the style of the rest of the validator: one problem per fault, in
reading order (`models.stages.deploy is not a stage`, `models.stages.status: status
is always on and runs on the session's model`, `models.agents.foo: unknown agent`,
`models.stages.code.tier must be strong, standard, fast or inherit`,
`models.map.copilot.strong must be a non-empty string`). `normalize` expands the
shorthand and fills every optional stage and every agent with
`{ tier: "", effort: "" }` and `map` with `{}`. **(call)**

Tiers belong to roles, not to platforms: the agreement never says "opus". The only
platform words in the agreement are the optional `map` overrides, and those are for
a project that must pin a vendor name, such as a Bedrock id or an org allowlist.

## 5. The table: `library/models.json`

One file, `.claude/pincer/library/models.json`, shipped with the library and so
refreshed by `pincer update` with the usual sidecar when a project edited it:

```json
{
  "schema": 1,
  "claude":  { "strong": "opus", "standard": "sonnet", "fast": "haiku" },
  "codex":   { "strong": "<id>", "standard": "<id>", "fast": "<id>" },
  "copilot": { "strong": "<picker name>", "standard": "<picker name>", "fast": "<picker name>" }
}
```

- The Claude row uses aliases, never ids, so it floats to the newest model and also
  survives VS Code's mapping of Claude-format agent files. `strong` is `opus`;
  `fable` is Claude Code only and reachable through a project's `map`. **(call)**
- The Codex and Copilot rows name concrete models and are the rows that change when
  a vendor ships. The builder fills them from the vendors' current catalogues at
  build time (section 13).
- A library agent file may carry a `tier:` frontmatter field: the kit's default for
  that role when the agreement leaves it unset. `codebase-explorer.md` gets
  `tier: standard`, which replaces its 1.0 `model: sonnet` line and preserves that
  behaviour on every platform. No other library agent carries one. Library files
  never carry `model:` or `effort:`; those are the generator's. **(call)**

Resolution, in `scripts/pincer/models.cjs`, pure and tested on its own:

- `effective(harness, libraryDir)`: for every optional stage that is on and every
  agent in an active roster, `{ tier, effort, source }`, where `source` is
  `agreement`, `library` or `none`. The agreement's tier wins; a library `tier:`
  is next; then the empty string. Effort comes from the agreement alone.
- `modelFor(table, platform, tier)`: the table entry after the agreement's `map` is
  laid over it; `null` for `inherit` and for the empty string. A tier the table has
  no entry for on that platform is reported as `models/<platform>/<tier>` in the
  generator's `missing` list and in doctor, and no model field is written for that
  role.

Maintenance is then one row. When a vendor ships a model, a maintainer changes the
row, runs the tests, publishes, and projects pull it with `pincer update`. A
scheduled agent may propose that row as a pull request; it never merges or publishes.
**(owner)**

## 6. What the generator writes

The generator keeps its contract (library and agreement in, project copies and
derived files out, baselines and sidecars) and gains these outputs. Two rules hold
everywhere. A model field is written only when the tier resolves to a value: for
`inherit` and for the empty string the field is omitted, because an omitted field
leaves the host's own resolution order intact and an explicit `inherit` would
defeat an env var the person set on purpose. An effort field is written whenever an
effort is set, with or without a model field. **(call)**

Agents, for every name in an active roster:

- `.claude/agents/<name>.md` is now rendered, not copied: the library frontmatter
  with `tier` dropped and, when resolved, `model: <claude value>` and
  `effort: <effort>` appended after the library's fields; the body unchanged. This
  file is what Claude Code dispatches and what VS Code reads for Copilot.
- `.codex/agents/<name>.toml`, only when `codex` is an installed platform:

  ```toml
  # Generated by scripts/pincer/cli.cjs generate from .claude/pincer/library/agents/<name>.md — edit the agreement and the library, not this file
  name = "<name>"
  description = "<description>"
  model = "<codex value>"
  model_reasoning_effort = "<effort>"
  developer_instructions = '''
  <body>
  '''
  ```

  The two model lines appear only when resolved. `name` and `description` are
  basic strings; the body is a literal multi-line string, and a body containing
  `'''` fails generation with the file named rather than producing a broken file.

Stages, for every stage that is on whose tier or effort resolves:

- The project copy `.claude/skills/pincer-<stage>/SKILL.md` and the thin command
  `.claude/commands/pincer-<stage>.md` get `model: <claude value>` and
  `effort: <effort>` in their frontmatter, each under the rule above. The
  library's SKILL.md never carries them. Claude Code applies the model for the stage's first turn and the session's
  model resumes on the next prompt; the design accepts this as the platform's limit
  and the docs say so.
- The Copilot prompt `.github/prompts/pincer-<stage>.prompt.md` gets
  `model: "<copilot value>"`.
- The Codex skill `.agents/skills/pincer-<stage>/SKILL.md` has no model field, so
  it gets one line after the generated comment: `Model: this stage was agreed to
  run on the <tier> tier (<codex value>[, effort <effort>]). If this session runs
  on another model, say so before starting or restart with \`codex -m <codex
  value>\`.` With an effort and no tier the line reads `Effort: this stage was
  agreed to run at <effort> effort on the session's model; if this session is set
  lower, restart with \`codex -c model_reasoning_effort=<effort>\`.` A
  prompt-level hint, honest about the limit. **(call)**

Markers, baselines and removal, the same rules as every generated file:

- `.codex/agents/*.toml` joins the derived-path pattern and the marker check learns
  the TOML comment form of the marker; `.codex` joins the directories the pruner
  never removes.
- A target that matches its baseline or the fresh content is overwritten; one that
  matches neither is kept with the fresh content beside it as `<file>.new`. An
  agent file written by 1.0 equals the old library copy, which is its baseline, so
  it is overwritten, not conflicted.
- When an agent leaves every active roster its Codex file is removed under the same
  unedited rule as its Claude file; `.codex/` paths are in scope only when `codex`
  is installed, like `.agents/` today.
- `generatedPaths` lists the new paths so the installer's doctor claims them.

What each platform then honours, stated in the docs so nobody expects more:

| Role | Claude Code | Codex | Copilot (VS Code) |
|---|---|---|---|
| agent model | frontmatter, under the host's resolution order | agent file | the Claude file, mapped by VS Code |
| agent effort | frontmatter | agent file | not available |
| stage model | first turn of the stage | a hint in the skill | the prompt file |
| stage effort | frontmatter | the same hint | not available |

## 7. The interview and the agreement

One more step in the blueprint, after the roster is confirmed and before the
answers are written. **(call)**

- `formats/roster-rules.md` gains a "Model tiers" section with the proposal rules:
  every reviewer `strong` (a judgment task that runs once per change); `implementer`
  and `fix-agent` `standard` (they run per ticket); `codebase-explorer` `standard`,
  the library's default (read-heavy, runs often); every stage unset; every effort
  unset. The person may change any line. `inherit` keeps the session's model;
  `open` leaves the role unset and is recorded under `open`.
- A new prompt `prompts/q-models.md`, one question in the interview's style: the
  proposed table, what a tier means, that everything else runs on the session's
  model, and that effort is named only when wanted. It returns `models.stages` and
  `models.agents`.
- `formats/harness.md` gains the `models.*` rows and the example gains a `models`
  block. The agents are stated in platform-neutral words throughout.
- The re-run path adds `models` to what it compares: when the file has none, the
  re-run proposes tiers once.

The agreement in `AGENTS.md` gets one line under "5 Responsibility", after the
people and before the two fixed lines, rendered from the effective tiers:
`- Models: evaluate on strong (high effort); reviewers on strong, the implementer
and the explorer on standard; everything else on the session's model.` With nothing
set anywhere: `- Models: the session's model everywhere.` Stages first in stage
order, then agents grouped by tier in tier order, effort in parentheses where set; a
role with an effort and no tier reads `narrow on the session's model (high
effort)`. **(call)**

## 8. Status and doctor

- `scripts/pincer-status.sh` prints a `Models:` line after `Stages:` whenever any
  effective tier or effort is set: `Models: evaluate strong/high, narrow effort
  high; codebase-explorer standard, security-reviewer strong`. Per role: the tier,
  `<tier>/<effort>` when both are set, `effort <effort>` when only the effort is.
  `--json` carries `models` as `effective` returns it. No platform words: status
  does not know which platform runs it.
- `pincer doctor`, which knows the installed platforms from `.pincer.json`, prints
  one `models` line per platform with the tiers in use and their values, reports a
  problem for a tier with no value on an installed platform (`tier fast has no codex
  value; set models.map.codex.fast in harness.json or update the kit`), and prints
  one note when `codex` is installed and `.codex/agents/` exists: Codex loads it only
  in a trusted project. A missing `models.json` in the library is a problem that
  names `pincer update`. **(call)**

## 9. Upgrading a 1.0 project

`pincer update` refreshes the library: `models.json` arrives and
`codebase-explorer.md` changes from `model: sonnet` to `tier: standard`. The
regeneration that follows re-renders `.claude/agents/codebase-explorer.md` with
`model: sonnet` from the standard tier, so the file's content is unchanged for Claude
Code and Copilot. With `codex` installed, `.codex/agents/codebase-explorer.toml`
appears, which is new behaviour on Codex and the one visible change: the explorer
is dispatched there rather than explored inline. Nothing else changes until the
person re-runs the blueprint and answers the models question. The kit ships as
1.1.0 (`npm version minor`), by the owner's hand. **(call)**

## 10. Documentation

- `docs/engine.md`: a "Models" section (the vocabulary, the table, resolution, what
  each platform honours), the `models.*` rows in the harness table, the Codex agent
  files in the generation section, and the platform notes.
- `.codex/README.md`: Codex has subagents; the roster ships as `.codex/agents/`
  generated from the library; the trust requirement; no generated config; the
  "Without subagents" sections apply only when the person switched agents off.
- `.github/copilot-instructions.md`: one line that the roster agents are the files
  under `.claude/agents/`, which VS Code reads.
- `README.md`: a "Model tiers" paragraph and the maintenance rule.
- This repository's `CLAUDE.md`: the table's rule (the Claude row stays aliases; the
  vendor rows change on a model release, with the catalogue checked, and the tests
  pin the shape).

## 11. Testing

Under the existing runner, test first, the suite green after every task:

- `harness.test.js`: every `models` validation message, the always-on rejection
  among them; shorthand expansion; the filled defaults; a document without `models`
  unchanged in meaning.
- `models.test.js`, new: table loading and the `map` overlay; `modelFor` for every
  tier including `inherit` and the empty string; a missing entry; `effective` with
  an agreement tier, a library default, and neither, and its restriction to active
  rosters and stages that are on.
- `generate.test.js`: the Claude agent rendering (tier dropped, model and effort
  added, nothing added when unresolved, effort alone when only it is set, a stale
  `model:` line in an edited library copy stripped before appending); the Codex
  file written only with `codex` installed, its shape, and the `'''` guard; the stage skill and command
  frontmatter; the Copilot prompt line; the Codex hint line; removal when an agent
  leaves the roster or a platform is dropped; a hand-edited Codex file gets a
  sidecar; the marker check on TOML; a 1.0-shaped agent file is overwritten, not
  conflicted; a missing table reports `missing` and writes no model field.
- `blueprint-write.test.js`: the `Models:` agreement line in the empty case and the
  set case.
- `status.test.js`: the `Models:` line and the JSON field.
- `installer.test.js`: doctor's models lines, the missing-value problem, the Codex
  trust note.
- `library.test.js`: no library agent or stage carries `model:` or `effort:`; the
  table has three platforms times three tiers of non-empty strings and the Claude
  row is drawn from the aliases VS Code also maps; `q-models.md` and the roster
  rules section exist and the blueprint skill names them.
- `distribution.test.js` stays as is: the always-on fixture has no `models`, so the
  shipped copies do not change.

## 12. Decided

- **(owner)** Model awareness by declaration, not detection; one set of prompts; one
  table; the generator writes native fields; a scheduled agent may propose table
  changes but never merges.
- **(owner)** Every platform: Claude Code, Codex, Copilot.
- **(call)** The tier and effort names; the `models` shape; `inherit` written as an
  omitted field.
- **(call)** Tiers per stage rather than per session; Codex gets a hint line
  instead of a generated config.
- **(call)** No `.github/agents/` files; Copilot uses the Claude files VS Code
  already maps.
- **(call)** `strong` is `opus` on Claude; `fable` through `map`.
- **(call)** The library default for the explorer stays `standard`; reviewers are
  proposed `strong`; no stage tier is proposed.
- **(call)** The agreement line's wording and place; the status and doctor output.
- **(call)** No tier on `blueprint` or `status`: their copies are installer-owned
  and a rendered field would make every update a conflict.
- **(call)** Effort stands on its own and is written whenever set.

## 13. Left to the builder

- The exact Codex and Copilot strings for the table, taken from the vendors' current
  catalogues when the task runs (the Codex model list the CLI and docs name; the
  model names the VS Code picker shows), with the source noted in the task.
- Where the appended frontmatter fields sit and how values are quoted; the marker
  check for TOML; the escaping of `name` and `description` in TOML.
- Whether `effective` and `modelFor` live in `models.cjs` alone or share helpers
  with `harness.cjs`.
- The exact wording of `q-models.md`, the roster-rules section, the agreement
  sentence's grouping, and the hint line, within the shapes above.
- Fixtures and the test helper changes.

Points the design reviewer settled and the plan should keep: the derived command,
Codex and Copilot files take model values from the resolution, never from a
hand-edited project copy's frontmatter; the re-run's "proposes tiers once" keys on
the presence of `models` in the file, since `write` fills it; a rendered agent file
without a baseline treats the raw library copy as pristine, as removals already do;
a missing `models.json` is reported only when a lookup is attempted, so fixture
libraries without one keep working; the `'''` guard renders everything first and
throws before writing anything; the engine-headings list in `library.test.js` gains
the new "Models" heading.
