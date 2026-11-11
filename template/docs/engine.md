# The PINCER engine

The contract between the stage skills and the scripts under `scripts/pincer/`. The
skills are prose for an agent and bend to the agreement; the engine is the part that
does not bend. It stamps the receipts, records the acceptance, validates the evidence
and generates the project's copies. Read this when you want to know exactly what a
script does, or when a session has to recover from a mistake.

## What the engine is

Four entry points over one dependency-free Node core (`scripts/pincer/`, Node 22 or
newer, CommonJS, `node:` modules only). `scripts/pincer-ticket.sh` moves a ticket
through its lifecycle and is the only writer of its lifecycle fields.
`scripts/pincer-status.sh` reports where the work stands and gates the stages.
`scripts/pincer-evidence.cjs` validates and digests evidence.
`scripts/pincer-blueprint.cjs` reads the repository (recon), writes the agreement
(write) and generates the project copies (generate); `scripts/sync-prompts.sh` is
`generate` under its old name. Every entry point resolves the project root from
`--root <dir>`, else the nearest directory up from the working directory that holds
`harness.json`, else the working directory. The engine never talks to the forge; the
skills do, with `gh`.

## harness.json

The machine-readable agreement at the repository root, written by the blueprint stage
through `write` and read by every other stage. Schema 1. Unknown keys are kept and
ignored. `blueprint` and `status` never appear under `stages`: they are always on and
the validator rejects an entry for them.

| Field | Values | Default |
|---|---|---|
| `schema` | `1` | required |
| `project.kind` | `greenfield`, `brownfield` | required |
| `project.name`, `project.reason` | text | `""` |
| `people[]` | `{name, role, accepts}`, at least one with `accepts: true` | required |
| `systems.forge` | `github`, `none`, `other` | `none` |
| `systems.remote` | URL without credentials | `""` |
| `systems.ci` | true, false | `false` |
| `systems.deploy`, `systems.secrets` | text | `""` |
| `repo.branches` | `per-ticket`, `main` | `main` |
| `repo.pr` | true, false | `false` |
| `repo.merge` | `merge`, `squash`, `rebase` | `merge` |
| `repo.protection` | text | `""` |
| `repo.checks` | list of commands | `[]` |
| `homes.specs`, `homes.tickets`, `homes.evidence` | relative paths inside the repository, no leading `/` or `..` | `specs`, `tickets`, `evidence` |
| `stages.plan` | `{on, spec: file or forge, gate, reason}` | `on: true, spec: file, gate: ""` |
| `stages.narrow` | `{on, tickets: file or forge, reason}` | `on: true, tickets: file` |
| `stages.code` | `{on, implementer, reason}` | `on: true, implementer: false` |
| `stages.evaluate` | `{on, where: local or pr, evidence, reason}` | `on: true, where: local, evidence: true` |
| `stages.release` | `{on, audit: tree or pr, reason}` | `on: true, audit: tree` |
| `roster.plan`, `roster.narrow`, `roster.code`, `roster.evaluate` | lists of agent names from the library | `[]` |
| `models.stages.<stage>` | a tier or `{tier, effort}`; `plan`, `narrow`, `code`, `evaluate`, `release` | not set |
| `models.agents.<name>` | a tier or `{tier, effort}`, for a library agent name | not set |
| `models.map.<platform>.<tier>` | a model name, for `claude`, `codex`, `copilot` and `strong`, `standard`, `fast` | none |
| `open` | list of text | `[]` |
| `firstJob` | text | `""` |

A file that fails validation makes every entry point print `harness.json: <problem>`
and exit 3. A missing file prints `harness.json: no agreement yet: run /pincer-blueprint`
and exits 3, except for `status`, which reports it and exits 0, and the always-on gates.

## Ticket fields and receipts

A ticket is `<homes.tickets>/T-NN-<slug>.md` with a closed `---` frontmatter of
unique, unindented `key: value` lines; `#` starts a comment, except in
`accepted_words`, which is read verbatim. Required keys: `ticket`, `status`, `size`
(`S`, `M`, `L`), `depends_on` (an inline list such as `[T-01]`). Optional: `spec` (a
relative `.md` path that must exist), `forge` (free text), `timeout` (seconds, default
600). The body needs one `## Acceptance Criteria` section with checkboxes and one
`## Verification` section with one fenced `bash` block.

The eight lifecycle fields are written only by `scripts/pincer-ticket.sh`:

| Field | Written by | Format |
|---|---|---|
| `status` | start, done | `open`, `in_progress`, `done` |
| `started` | start | ISO UTC timestamp, `YYYY-MM-DDTHH:MM:SSZ` |
| `last_check` | verify | `<timestamp> running|passed|failed|interrupted <hash>` |
| `verified` | verify, on a pass | `<timestamp> <hash>` |
| `finished` | done | timestamp |
| `accepted` | accept | timestamp |
| `accepted_by` | accept | a name from `people` with `accepts: true` |
| `accepted_words` | accept | what the person said, verbatim, on one line |

The hash is the first 12 hex characters of sha256 over the Verification block: the
lines inside the fence joined with newlines plus one trailing newline. Change the
block and the receipt no longer matches it. `verify` writes `running` first, runs the
block with `bash -eo pipefail` under the ticket's timeout, then writes `passed`
(together with `verified`), `failed`, or `interrupted` for a signal or a timeout. A
ticket is ready when `verified` carries the current hash and the `last_check` for that
hash is not a failure.

## Commands and exit codes

Exit codes everywhere: 0 ok, 1 refused (the reason on stderr), 2 usage, 3 no
agreement, stage off or invalid `harness.json`, 130 interrupted.

`scripts/pincer-ticket.sh` runs `node scripts/pincer/cli.cjs ticket <verb> <T-NN>`:
- `start T-NN`: `open` to `in_progress`, stamps `started`. Refuses when a `depends_on` ticket is not done and ready, when the ticket is already done, and with exit 3 when `harness.json` is missing or `stages.code.on` is false.
- `verify T-NN`: starts an open ticket, runs the block, stamps the receipt only on exit 0. A failed check exits 1 and prints `FAILED (exit N)`; a block with no runnable command is refused.
- `done T-NN`: `in_progress` to `done` when the receipt matches the current block, no newer check failed, and every criterion is ticked; stamps `finished`.
- `accept T-NN --by "<name>" --words "<their words>"`: on a done ticket writes the three acceptance fields together; refuses a name that is not an acceptor and empty words.

`scripts/pincer-status.sh` runs `node scripts/pincer/cli.cjs status`:
- The report, or `--json` for data. `--stage <name>` prints `on` and exits 0, or the reason and exits 3; a name that is not a stage exits 2. An invalid `harness.json` still renders the report and then exits 3.
- `Next:` is the first rule that matches, judged on the change in hand and not on the project's history: verify a ticket in progress, commit a done ticket whose `done` is in no commit yet (`/pincer-code T-NN (done, not committed)`: the ticket file at `HEAD` is missing, not done or carries another receipt, which is what a session cut off before the commit leaves; warned about, listed under `uncommitted`, not asked outside a git repository), code an open one, wait for a draft spec's approval, narrow an approved spec that no ticket names in its `spec:` field, then evaluate, then release. With everything accepted, a `firstJob` the agreement named after the last acceptance is the next change to plan, as it is on a new project. With `stages.evaluate.evidence` on, evaluate stays next until one manifest covers every done ticket not yet accepted: the ticket file at the manifest's `candidate` commit is done with the receipt it carries now. `--json` lists the others under `unevaluated`; outside a git repository any manifest counts.

`scripts/pincer-evidence.cjs` runs `node scripts/pincer/cli.cjs evidence`:
`validate <manifest> [--candidate <sha>]` prints `ok <candidate>` or one
`evidence: <manifest>: <problem>` line each and exits 1; `digest <file>...` prints
`<sha256>  <file>` per file.

`scripts/pincer-blueprint.cjs` has three verbs:
- `recon [--json] [--network]` runs `node scripts/pincer/cli.cjs recon`: the kind, the reasons, the facts, the prefill and what it could not see. Offline unless `--network`, which lets it ask `gh`.
- `write [--answers <file>]` runs `node scripts/pincer/cli.cjs write`: validates the answers (default: `harness.json` itself), writes `harness.json`, renders the agreement between the markers in `AGENTS.md`, runs the generator. Validation problems: one per line, exit 3, nothing written. One agreement marker without the other: exit 1, nothing written.
- `generate [--harness <file>] [--platform <claude,codex,copilot|all>] [--overwrite]` runs `node scripts/pincer/cli.cjs generate`, also reachable as `scripts/sync-prompts.sh`. See Generation below.

## Stage gate

Every stage skill's first step runs `scripts/pincer-status.sh --stage <name>`.
`blueprint` and `status` are always on and print `on` even without `harness.json`. The
other five (`plan`, `narrow`, `code`, `evaluate`, `release`) print `on` when the
agreement has them on, else the reason (`no agreement yet: run /pincer-blueprint`,
`stage <name> is off in harness.json`, or the validation problem) with exit 3.
`scripts/pincer-ticket.sh start` and `verify` apply the same gate for `code`. The hook
on Claude Code does not read `harness.json`; the gate lives in the scripts, so it holds
on every platform.

## Acceptance

A ticket is `done` only on a receipt and accepted only when a named person said so.
`accept` writes `accepted`, `accepted_by` and `accepted_words` together; the validator
refuses a partial trio. The name must be in `people` with `accepts: true`; quote the
person's words verbatim. Acceptance does not block the next ticket, but status warns
about each done ticket without it and points to release (or `accept` if release is off).
Release passes only when every done ticket is accepted. Run `accept` only after the person says so; it never commits or publishes.

Release first audits read-only, allowing only `done without acceptance` warnings; all other warnings fail.
Record the manifest's evaluated `candidate` and current `audit_head` separately; only retained evidence
and existing acceptance fields may differ, never implementation, checks, spec or agreement.
Without evidence, `audit_head` is the candidate. The technical audit starts and ends with a clean tree.

After the person accepts, inspect working-tree, staged and committed diffs against `audit_head`:
only `accepted`, `accepted_by` and `accepted_words` in those tickets' frontmatter may change.
Commit separately as `accept: <candidate short sha>`, recording its full `acceptance_commit`;
skip an empty commit when nothing was newly accepted. Require a clean tree, status without warnings
and unchanged evidence validated against the original candidate. The verdict names both identities;
acceptance is not a newly tested candidate. Unexpected changes stop release for re-evaluation.

Branch and PR rules still apply: a required acceptance PR must be merged with passing checks before PASS.
Never push, merge or publish without the user's authorization. Unanswered acceptance or an incomplete
required remote step is pending, not passed.

## Evidence manifest schema 1

`<homes.evidence>/<candidate>/manifest.json`, where the directory's basename is the
candidate's full commit id. Top-level keys, all required and no others: `schema` (1),
`candidate` and `base` (40 hex characters), `created` (UTC timestamp), `spec` (a path
that exists), `environment` (`tools` and `limitations`, each a list of short
strings), `checks`, `visual_review`, `artifacts`. Each check has `id` (`C-NN`), `kind` (`command`, `review`, `visual`),
`required`, `result` (`passed`, `failed`, `unverified`), `command` (required for a
command check), `log` (an artifact path) and an optional `note`; a required check
must be `passed`. `visual_review` has `applicable` and, when false, `reason`.
`artifacts` maps paths inside the manifest's directory to their sha256, and the
digests must match the files. The validator checks that the record is consistent, not
that the commands ran. Status reports `Evidence:` per manifest and release reads the
same validator.

## Generation and .new sidecars

`generate` reads the library (`.claude/pincer/library/`, the project's own copy) and
the agreement. For every stage that is on it copies `library/stages/<stage>/` to
`.claude/skills/pincer-<stage>/` (the project copy: edit this one), writes the thin
`.claude/commands/pincer-<stage>.md`, and per installed platform the Codex skill
`.agents/skills/pincer-<stage>/SKILL.md` (`/pincer-x` mentions become `$pincer-x`,
`$ARGUMENTS` becomes a sentence) and the Copilot prompt
`.github/prompts/pincer-<stage>.prompt.md`, both derived from the project copy as it
stands. Agents named by the rosters of the stages that are on are rendered to
`.claude/agents/<name>.md`: the library copy with its `tier:` line dropped and the
model and effort of its tier appended; with Codex installed each also gets
`.codex/agents/<name>.toml` (see Models). The model and effort lines of an agent file
and of a project copy belong to the generator and the tier belongs in the agreement: a
file that differs from the library copy only in those lines is the generator's to
overwrite or remove when no baseline records it; with a baseline in `.pincer.json`, a
hand-written model line conflicts like any other edit and gets a sidecar.

Baselines live in `.pincer.json` under `generated` when the installer wrote it. A
target whose hash matches its baseline or the fresh content is overwritten; one that
matches neither was edited by hand and is kept, with the fresh content beside it as
`<file>.new`. Derived files carry the comment
`<!-- Generated by scripts/pincer/cli.cjs generate from <source> ... -->`; a file that
still carries it is the generator's to overwrite or remove. The files of a stage
switched off, or of an agent dropped from every active roster, are removed when
unedited and reported when not. `--overwrite` treats every target as unedited.
Platforms come from `.pincer.json`, all three without one; `--platform` overrides them
for one run. Kit maintainers regenerate the shipped copies the same way, with
`--root template`, `--platform all` and a `--harness` file in which every optional
stage is off; a test fails when the shipped copies are stale.

## Models

The agreement names a tier per role under `models.stages.<stage>` (the five optional
stages) and `models.agents.<name>`: `strong`, `standard`, `fast`, `inherit` for the
session's model, or `""` for not set, each with an optional effort `low`, `medium` or
`high`. The library's `models.json` maps a tier to each platform's model name: the
Claude row holds the aliases `opus`, `sonnet`, `haiku`; the Codex and Copilot rows name
the vendors' current models and change when a vendor ships. `models.map.<platform>.<tier>`
in the agreement overrides one entry. A library agent file may carry `tier:` as the
kit's default for that role (`codebase-explorer`: `standard`). Resolution, in
`scripts/pincer/models.cjs`: the agreement's tier, else the library's, else not set.
`inherit` and not set write no model field, so the host's own order stands; an effort
is written whenever set, with or without a model. The always-on stages take no tier:
their copies are installer-owned and the validator rejects an entry for them.

What the generator writes. Claude Code: `model:` and `effort:` in the agent files and,
for a stage with a tier, in its project copy and thin command; the model applies to the
stage's first turn and the session's model resumes on the next prompt. Codex:
`.codex/agents/<name>.toml` per roster agent, with `model` and
`model_reasoning_effort`, and one hint line at the top of the stage skill, which has no
model field. Copilot: `model:` in the prompt file; the agents are the Claude files,
which VS Code reads and maps itself. A tier the table cannot translate, or a missing
table, is reported once and the field is left out; doctor prints the resolved mapping
per installed platform. The host decides last: Claude Code's model allowlist and
subagent env vars, Copilot org policy and Codex project trust override any file.

| Role | Claude Code | Codex | Copilot (VS Code) |
|---|---|---|---|
| agent model | frontmatter, under the host's resolution order | agent file | the Claude file, mapped by VS Code |
| agent effort | frontmatter | agent file | not available |
| stage model | first turn of the stage | a hint in the skill | the prompt file |
| stage effort | frontmatter | the same hint | not available |

## Recovery

- A failed check: fix the cause and run `verify` again. The failed `last_check` stays until a pass replaces it; it is information, not damage.
- An interrupted check (a signal, the timeout, exit 130): run `verify` again.
- A ticket that status reports as `invalid`, or whose lifecycle fields were edited by hand: the person repairs the file in their own terminal, then `verify` runs again (and `done` again if it was done). The session reports the problem and never edits those fields itself.
- A check that changed after it passed: `done` refuses with both hashes; run `verify` again.
- The rule under all of these: you never restore a ticket file from git (`checkout`, `restore`, `reset --hard`, `stash`) to clear a warning, because that revives an old receipt as if it were new evidence. On Claude Code the hook blocks it; elsewhere it is the standing rule in `AGENTS.md`.
- `write` refused: fix the answers file and run it again; nothing was written. One agreement marker without the other in `AGENTS.md`: put the missing marker back by hand, then `write`.
- A `.new` sidecar: compare it with the project copy, take what you want, delete the sidecar. `generate` writes a new one only when the fresh content differs again.

## Platform notes

- Claude Code: `.claude/settings.json` wires two PreToolUse hooks. `block-dangerous.sh` refuses destructive commands. `ticket-guard.sh` protects the eight lifecycle fields of a ticket, which only the project's own `scripts/pincer-ticket.sh start|verify|done|accept` (or the `cli.cjs ticket` form at the same path) may write, and the engine (`scripts/pincer/`, `scripts/pincer-*.sh`, `scripts/pincer-*.cjs`, `scripts/sync-prompts.sh`) and the hooks (`.claude/hooks/`, `.claude/settings.json`), which `npx pincer-workflow update` refreshes. Edit, Write, MultiEdit and NotebookEdit are judged by the file they reach: `//`, `/./`, `..`, symbolic and hard links are resolved and case is ignored, as macOS and Windows ignore it. A shell line is read as its commands, split at `;`, `&&`, `||`, `|`, a single `&`, new lines, subshells and substitutions, through wrappers such as `sudo`, `env`, `command`, `nice`, `timeout` and `xargs`; a here-document is data unless a shell reads it. A line that cannot be read with certainty (a quote, a test or a substitution that never closes, a `#` or `<<` inside `((…))` that may be two subshells, a `#` straight after a paren) is refused, and so is any call the hook fails on. Each command is judged by what it can write. A redirect is a write by its target: duplicating a file descriptor (`2>&1`), discarding output (`2>/dev/null`) and saving a read to another path pass, `~/copy.md` included: the home directory is known. A command known to read only (`cat`, `grep`, `sed -n`, `diff`, `git log|show|diff|add|commit`, and the like) may name a protected file, a copy may read one (`cp tickets/T-01-x.md /tmp/`), and the engine's entry points are run freely; a lookalike of the ticket script elsewhere is refused. Any other command that names a protected file is refused: the guard keeps a list of readers, not of writers, so a tool it does not know is refused there, and text in quotes handed to such a tool (a pull request body) is not a path. A relative path is tried from the project root, from where the shell stands and from each `cd` on the line; a target the shell computes (a variable, a substitution, a pattern) is refused when the line names a protected file. Whole-tree `git checkout`, `restore`, `reset --hard`, `stash` and `clean -f` are refused as before. Deliberately wide: `T-NN*` in any directory named `tickets` is a ticket, inside the project or not, so a copy into a scratch clone's `tickets/` is refused too; the engine and the hooks are this project's only. A `homes.tickets` that does not end in `tickets` loses hook coverage, and the rule in `AGENTS.md` carries the weight alone; the hook does not read `harness.json`. It is a guard rail against mistakes, not a sandbox: a program the line runs can still write any file, so the sandbox and the approval controls remain the security boundary.
- Codex: reads `AGENTS.md` natively; the stages are skills under `.agents/skills/`, invoked as `$pincer-<stage>`; the roster agents are `.codex/agents/<name>.toml`, generated from the library, and Codex loads `.codex/` only in a project marked trusted. No hook. Posture in `~/.codex/config.toml`: `approval_policy = "on-request"` and `sandbox_mode = "workspace-write"`; never run with approvals disabled. Status warns about missing, failed or stale receipts and about hand-edited fields.
- Copilot: `.github/copilot-instructions.md` points at `AGENTS.md`; the stages are prompt files under `.github/prompts/`, invoked as `/pincer-<stage>` with prompt files enabled; the roster agents are the files under `.claude/agents/`, which VS Code reads in the Claude format. No hook; the same rule.
- Everywhere: Node 22 or newer, git and bash. `gh` only for the forge-facing steps the skills name. The engine runs offline.
