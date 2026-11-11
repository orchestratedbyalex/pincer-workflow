# PINCER — a harness builder for AI coding agents

PINCER looks at your project, interviews you, and writes the agreement under which an
AI coding agent works there: which stages run, where the artifacts live, who accepts.
Then it runs the pipeline that agreement describes, with one floor that never bends:
a ticket is done only on a script-stamped passing check, and accepted only when a
named person said so, in their words. It works on Claude Code, Codex CLI and GitHub
Copilot from one kit, and it has no dependencies.

## Install

PINCER 1.0 is live on [npm](https://www.npmjs.com/package/pincer-workflow).
Install it in your project:

```bash
npx pincer-workflow@latest init --platform all
```

The same package is also attached to the [GitHub release](https://github.com/orchestratedbyalex/pincer-workflow/releases/tag/v1.0.2).

Node.js 22+, git and bash are required. PINCER uses your coding tool's own
authentication; it does not require a provider API key.

Then start your agent in the repository and run the blueprint:

```
/pincer-blueprint                 # Claude Code and Copilot
$pincer-blueprint                 # Codex CLI
```

Until the blueprint has run there is no agreement, and every other stage refuses.
Codex-only installs point to `$pincer-blueprint`; Claude Code, Copilot and mixed
installs use `/pincer-blueprint`. A draft spec stays at the plan approval step. `scripts/pincer-status.sh` works in any
shell from the first minute and always ends with the next command.

## The journey

**Blueprint** reads the repository first (git history, CI, deploy configuration, tests,
the forge when `gh` is available) and says whether the project is greenfield or
brownfield, and why; you confirm. Then it interviews you, one question at a time,
through the six sections of a harness agreement: Systems, Current pipeline, Handoff
artifacts, Simplify, Responsibility, Repo. Every answer it could pre-fill is shown as
"I see X; is that right?", and `open` is always an allowed answer. It proposes the
roster of review agents from your answers, writes `harness.json` and the agreement at
the top of `AGENTS.md`, generates the project's copies of the stages you kept, and
names the first real job. The first run through the pipeline is the trace you revisit
the agreement with.

The stages the agreement keeps, and what the interview can bend:

| Stage | Command | Default role | What the interview can bend |
|---|---|---|---|
| blueprint | `/pincer-blueprint` | the interview above | nothing; always on |
| plan | `/pincer-plan` | brief to a written spec with stable `R-NN` IDs | off for small changes; the spec can be a forge issue instead of a file |
| narrow | `/pincer-narrow` | spec to tickets with runnable checks | tickets as local files or as forge issues; one ticket per change |
| code | `/pincer-code` | build tickets in order, one commit each, verify, done | branch per ticket or commit to main; PR or no PR; implementer agent or the main session |
| evaluate | `/pincer-evaluate` | review the diff with the roster, run the checks, save evidence | review in the PR instead of a local report; evidence on or off; the roster |
| release | `/pincer-release` | read-only audit, then acceptance recorded and committed | audit a merged PR and a deploy instead of a clean tree; who accepts |
| status | `/pincer-status` | where the work stands, the next command | nothing; always on |

Each stage is a short skill with the same six sections (Reads, Steps, Checks, Writes,
Without subagents, When this stage is off). It reads `harness.json` first and refuses
when the agreement switched it off. The project copies under `.claude/skills/` are
yours to edit; the Codex skills and Copilot prompts are generated from them.

## The floor

- `scripts/pincer-ticket.sh verify T-NN` runs the ticket's Verification block and
  stamps a receipt only on exit 0. `done` refuses without a receipt for the current
  check, or with an unticked criterion.
- `scripts/pincer-ticket.sh accept T-NN --by "<name>" --words "<their words>"` records
  the acceptance of a done ticket: a person named in the agreement, quoted. The agent
  runs it only after the person said so. Release commits those three acceptance
  fields separately, checks the final tree is clean, and keeps the evaluated
  candidate distinct from the acceptance commit.
- The eight lifecycle fields of a ticket are written only by that script. On Claude
  Code a hook enforces it; on Codex and Copilot it is a standing rule, and status flags
  a missing, failed or stale receipt and every done ticket without acceptance.
- Evidence, when the agreement keeps it, is a validated manifest under the evidence
  home that release reads instead of trusting chat.
- Nothing is restored from git to clear a warning. A failed check is fixed and run
  again; a hand-edited ticket is repaired by the person, then verified again.

`docs/engine.md` in the installed kit is the full contract: fields, receipts, exit
codes, the gate, the manifest, generation, recovery.

## What you get

| Path | What it is |
|---|---|
| `AGENTS.md` | the agreement between two markers, then the standing rules and your conventions |
| `harness.json` | the machine-readable agreement, written by the blueprint, read by every stage |
| `scripts/pincer-ticket.sh` | `start`, `verify`, `done`, `accept`: the only writer of ticket lifecycle fields |
| `scripts/pincer-status.sh` | the report, `--json`, and the stage gate `--stage <name>` |
| `scripts/pincer-blueprint.cjs` | `recon`, `write`, `generate` |
| `scripts/pincer-evidence.cjs` | `validate` and `digest` for evidence manifests |
| `scripts/sync-prompts.sh` | regenerates the project copies, Codex skills and Copilot prompts |
| `scripts/pincer/` | the dependency-free Node core behind the four entry points |
| `.claude/pincer/library/` | the library: every stage skill, prompt, format and agent |
| `.claude/skills/pincer-<stage>/` | the project's editable copy of each stage that is on |
| `.claude/commands/`, `.agents/skills/`, `.github/prompts/` | the thin commands, the Codex skills, the Copilot prompts, generated |
| `.claude/agents/` | the review agents the roster names, with the model of their tier |
| `.codex/agents/` | the same agents as Codex agent files, generated when Codex is installed |
| `.claude/pincer/library/models.json` | the tier table: the model each platform runs a tier on |
| `docs/engine.md`, `docs/release-checklist.md` | the engine contract and the release audit |
| `specs/`, `tickets/`, `evidence/` | the default homes, all overridable in `harness.json` |

Secrets never enter the kit: `init` adds `.env`, `.env.*` and `!.env.example` to
`.gitignore`, and the standing rules in `AGENTS.md` say the rest.

## Platforms

| | Claude Code | Codex CLI | GitHub Copilot |
|---|---|---|---|
| Agreement | `AGENTS.md` via the `CLAUDE.md` import | `AGENTS.md` natively | pointed at by `.github/copilot-instructions.md` |
| Stages | `.claude/skills/` plus `/pincer-*` commands | `.agents/skills/`, invoked as `$pincer-*` | `.github/prompts/`, invoked as `/pincer-*` with prompt files enabled |
| Agents | subagents | subagents from `.codex/agents/` | the Claude agent files, read by VS Code |
| Floor | script plus hook | script plus status warning | script plus status warning |

The hook exists only on Claude Code. On the other platforms the rule in `AGENTS.md`
carries the weight, `scripts/pincer-status.sh` reports what the rule would have
stopped, and the posture notes in `.codex/README.md` apply. Node 22 or newer, git and
bash are needed everywhere; `gh` only for the forge-facing steps the agreement chose.

## Model tiers

The agreement says which tier each stage and each roster agent runs on: `strong`,
`standard`, `fast`, or `inherit` for the session's model, with an optional effort
(`low`, `medium`, `high`). The blueprint proposes the tiers right after the roster
(reviewers strong, the implementer and the explorer standard, every stage as run) and
writes what you confirm under `models` in `harness.json`; nothing moves to a stronger
tier unless you said so. One table in the library, `.claude/pincer/library/models.json`,
maps a tier to each platform's model name, and the generator writes the platform's own
field: Claude Code agent and skill frontmatter, Codex agent files, the Copilot prompt
files. `harness.json` never names a vendor's model; a project that must pin one sets
`models.map.<platform>.<tier>`. When a vendor ships a new model the table changes by one
row and `npx pincer-workflow update` carries it into every project; `doctor` shows what
each installed platform will run.

## Update

```bash
npx pincer-workflow@latest update                      # edited files get a .new sidecar
npx pincer-workflow@latest update --platform claude    # the same, and add a platform to the install
npx pincer-workflow@latest doctor                      # checks the install and agreement
```

With an agreement in place, `update` also refreshes the library and regenerates the
project copies you did not edit; an edited copy stays and gets the new version beside
it as `<file>.new`.

`update --platform <claude|codex|copilot|all>` adds a platform to an existing install,
for example Claude Code to a project that started on Codex. The platforms already
installed stay, the agreement and the tickets are shared, a file the project already
had (its own `CLAUDE.md`) is kept with the kit's version beside it as `.new`, and the
stage copies are generated for the new platform. `init` refuses a second install and
points here.

`doctor` compares every installed file with the package that runs it, not only the
version number. A file you changed is listed as locally edited. A file that is still
what was installed but differs from this package came from another build with the
same version number (a pre-release, a local `npm pack`); `doctor` fails and names
it, and `update` brings the install to this build.

## Trying it locally before release

```bash
npm pack                                           # in this repository: pincer-workflow-1.0.2.tgz
cp pincer-workflow-1.0.2.tgz ../some-project/ && cd ../some-project
npx ./pincer-workflow-1.0.2.tgz init --platform all   # the ./ matters: npx treats a bare path as a command
scripts/pincer-status.sh                           # prints "no agreement yet" and "Next: /pincer-blueprint"
```

Use a project outside this repository. Claude Code loads every `CLAUDE.md` above the
working directory, so a trial project nested in this checkout also gets the kit's
developer instructions and does not behave like a real install.

## Status of the older channels

- The Claude Code plugin channel is paused; the kit installs with `npx` on every platform.
- The wiki under `docs/wiki/` is frozen at 0.7 and kept for history.
- PRD v8 is superseded by the harness-builder design; its open tickets are marked so.
- The GitHub Pages site describes 1.0. See [CHANGELOG.md](CHANGELOG.md) before upgrading from 0.7.

## Design principles

- **A person owns the decisions** — scope, direction, acceptance, anything that leaves
  the machine (pushing, merging) and the rules; the agent does the work and writes
  down the technical decisions it takes.
- **Nothing is done while its verification fails** — every ticket carries a runnable
  check, and "done" is a state only a passing run of that check can unlock: the
  receipt is stamped by the script, never typed by the agent.
- **Accepted means a named person said so** — acceptance is recorded with the
  person's name and their words, per ticket, and release passes only with it.
- **State lives in files, not in the conversation** — a new session runs
  `/pincer-status` and knows exactly where to resume.
- **Evidence is saved, not narrated** — requirements carry stable IDs from the spec
  to the tickets, and the evaluation writes a validated manifest that release reads.
- **Scope is a first-class artifact** — cuts are recorded in the spec, never silent;
  stages switched off carry their reason in the agreement.
- **Security is threaded through every stage** — designed in at plan, specified as
  reject-path criteria at narrow, swept before every commit at code, audited at
  evaluate and release.
- **Layered guardrails** — the Claude Code hooks cover documented high-risk command
  and ticket-state forms while sandbox and approval controls remain the security
  boundary; other platforms use their native controls plus the standing rules.

## License

MIT
