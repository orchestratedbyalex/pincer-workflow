# PINCER 1.0: the harness builder

Design, 20 October 2026. Decided with the owner in a coaching session; the owner's
decisions are marked **(owner)**, the designer's calls **(call)**, and anything left
to the builder is in the last section.

## 1. Intent

Today PINCER installs the same pipeline into every project: brief, PRD, tickets, code,
evaluate, release, with one rulebook and one set of gates. The harness masterclass
teaches the opposite order: look at how *this* project works, agree the blueprint with
the people on it, and only then shape the pipeline, the artifacts, the skills and the
agents around that agreement. Every project is different, so every harness is.

PINCER 1.0 becomes the thing that builds a project's harness. A developer installs
it, PINCER looks at the repository, interviews the developer, writes the project's
agreement, and from then on works through the pipeline that agreement describes.
**(owner)**

Why now: PINCER's own evidence (the v6 benchmark, NOTES.md) shows the fixed pipeline
costs about five times a plain run with no acceptance advantage, no live session ever
used strict coverage, and the only project-specific section of its rulebook is an
empty comment. Nobody uses the current version, so nothing has to stay compatible.
**(owner)**

## 2. Goals, non-goals, anti-goals

Goals

- A developer on an unknown project reaches a written, project-specific agreement in
  one sitting, and PINCER tells them whether the project is greenfield or brownfield
  rather than asking. **(owner)**
- The five stages bend to the project: a stage can be switched off, its gate moved,
  its artifacts renamed or dropped, as the interview decides. **(owner)**
- The course's structure is the kit's structure: one skill folder per stage holding
  `SKILL.md`, `prompts/`, `agents/`, `formats/`. Dispatch prompts are files, findings
  have one shared format, templates carry the four questions (owner, home, readers,
  shape) and a real example. **(owner)**
- The agent roster is per project, chosen in the interview from a library, with a
  small default. **(owner)**
- Claude Code, Codex CLI and GitHub Copilot stay supported.
- The owner can test the whole thing on a real local project before anything is
  pushed or published. **(owner)**

Non-goals (this version)

- Change records, agreement digests, authorizations, strict coverage, the three
  runtime modes, migration from older installs, and the delivery-benchmark tooling in
  the shipped kit. They stay in git history. **(owner)**
- Native Windows, hosted telemetry, a web UI.
- Finishing PRD v8's study programme. See section 9.

Anti-goals (a failure even if it works)

- An interview that takes an hour or asks what the repository already shows.
- Nine reviewers dispatched on a one-line fix.
- An agreement a newcomer cannot read in one page.
- A stage that silently keeps running when the agreement switched it off.
- Removing the floor: a ticket done without a passing check, or a result nobody
  accepted.

## 3. Constraints

- Node 22+, no runtime dependencies. The kit is copied into other people's repos, so
  anything it depends on they inherit.
- `template/` stays the single source; Codex and Copilot adapters and the Claude
  plugin are generated from it and a test fails on stale output.
- Plain markdown and JSON only. Codex and Copilot do not follow Claude's `@` imports,
  so nothing the other platforms need may live behind one.
- Hooks, settings deny rules and subagents are Claude Code only, as today; every
  stage states its fallback for platforms without them.
- Secrets rule, untrusted-content rule and dependency gate stay as standing rules.

## 4. The floor

Two things no interview can remove. **(owner)**

1. A ticket is done only when its verification check has passed, stamped by the
   script, never typed by the agent. The hook keeps the script the only door.
2. The result of a change is accepted by a named person and that acceptance is
   recorded in the artifact, with the person's words.

Everything else is the project's choice.

## 5. The journey

### 5.1 Install

`npx pincer-workflow init` copies the kit and asks one thing, as today: which
platforms. It ends by printing the next command: run the blueprint. It no longer
installs a pipeline that is ready to use; until the blueprint exists, the stage
commands refuse with "no agreement yet, run /pincer-blueprint". **(call)**

### 5.2 Blueprint: the interview

A new stage skill, `blueprint`, run by the agent inside the repo (so it can read the
repository), not by the installer. **(call)**

Step one is recon, before any question. The skill reads and records:

- git: commit count, authors, branch names, merge style (merge commits, squash,
  rebase), tags, remote host.
- forge: with `gh` available, whether issues and PRs exist and are used, branch
  protection, Pages or deploy workflows. Without it, what the remote URL implies.
- code: languages, package manager, test runner and whether tests exist, CI config,
  deploy config, `.env.example`, existing `CLAUDE.md` / `AGENTS.md` / docs.
- running system: anything that says there is a live deployment (a Pages URL, a
  Vercel config, a deploy workflow that ran).

From that it decides greenfield or brownfield and says why, in one paragraph the
developer confirms. The rule of thumb from the course: brownfield when there is code,
history or a running system to respect; greenfield when the first real job is also
the first trace. **(owner: PINCER decides, the developer confirms)**

Step two is the interview, following the course's six questions, one at a time, with
options, the recommended one first, each option explained, and every answer
pre-filled from recon where recon could tell. The developer may answer "open" to
anything; open items are written as open, never guessed. **(call: the course's method,
already the owner's working habit)**

1. Systems: for each activity (define, build, test, review, deploy), where the work
   happens and where its record lives. Forge in or out.
2. Current pipeline: idea to result, as it runs today, gates in bold.
3. Handoff artifacts: what each stage passes to the next, and where it lives.
4. Simplify: which stages or artifacts to remove, combine or shorten, naming what
   each simplification must preserve.
5. Responsibility: for each artifact, who creates it, who keeps it current, who
   accepts it. Which decisions a person owns (scope, direction, pushing, merging,
   acceptance, the rules).
6. Repo: people, branches, checks, main-branch protection, merge strategy, commit
   identity.

Then, from the answers, the roster: which agents are active at which stage (section
7), proposed by the skill from the answers and confirmed by the developer.

Step three writes the outputs:

- The agreement at the top of `AGENTS.md`, six headings, one page, the shape of the
  course's blueprint slide. Below it the standing rules (secrets, untrusted content,
  dependencies) and the project's conventions. This is the human record.
- `harness.json` at the repo root: the machine-readable form the stage skills read.
  Which stages are on, in what order; per stage its gate, its input and output
  artifacts and their homes; the forge and branch settings; the roster; the names of
  the people who accept. Written by the blueprint skill, read by every other skill
  and by status. **(call)**
- The project's own copies of the stage skills it switched on, under
  `.pincer/skills/` for Codex-visible platforms and `.claude/skills/` for Claude
  Code, generated from the kit's library (section 6), so a developer can edit their
  project's steps without touching the library.

Step four names the first real job. On brownfield the skill proposes a small real
change and says the first run through the new pipeline doubles as the trace the
course asks for. On greenfield the first job *is* the trace. The agreement gets one
line: "Agreed enough to start; revisit after the first job." **(call: the course's
greenfield path)**

Re-running the blueprint later reads the existing agreement and asks only about what
changed.

### 5.3 The stages

The library ships six stage skills. The names stay PINCER's so the commands keep
their muscle memory. **(call)**

| Stage | Command | Default role | What the interview can bend |
|---|---|---|---|
| blueprint | `/pincer-blueprint` | the interview above | nothing; always on |
| plan | `/pincer-plan` | brief to a written spec (the PRD of today, now a `formats/spec.md`) | off for small changes; the spec can be a GitHub issue instead of a file |
| narrow | `/pincer-narrow` | spec to tickets with checks | tickets as local files or as forge issues; one ticket per change allowed |
| code | `/pincer-code` | build tickets in order, one commit each, verify, done | branch per ticket or commit to main; PR or no PR; implementer agent or main session |
| evaluate | `/pincer-evaluate` | review the diff with the roster, save evidence | review in the PR instead of a local report; evidence manifest on or off; roster per project |
| release | `/pincer-release` | read-only audit, then acceptance recorded | audit of a merged PR and a deploy instead of a clean tree; who accepts |
| status | `/pincer-status` | where the work stands, next command | nothing; always on |

Every stage skill has the course's shape:

```
skills/<stage>/
  SKILL.md        inputs it reads, steps, checks, outputs it writes, fallbacks
  prompts/        every prompt it sends: questions to the person, dispatches to agents
  agents/         the agent definitions it may dispatch (from the library, section 7)
  formats/        the shape of every artifact it reads or writes, each with an example
```

`SKILL.md` is short and reads `harness.json` first: if the stage is off it says so and
stops; otherwise it takes its gate, artifacts and roster from there. Rules that several
stages share (the secrets rule, the untrusted-content rule, "never run destructive
commands") live once in `AGENTS.md` and are referred to, not pasted. Recovery and
mechanics live in `docs/engine.md`, linked from the step that needs them.

### 5.4 The engine

Kept, trimmed to the floor and what a fresh session needs. **(owner: this small)**

- `scripts/pincer-ticket.sh` with `start`, `verify`, `done`, and new `accept`.
  `verify` runs the ticket's Verification block and stamps a receipt only on exit 0.
  `done` refuses without a current receipt or with unticked criteria. `accept T-NN
  --by "<name>" --words "<what they said>"` records acceptance in the ticket's
  frontmatter; the agent runs it only after the person said so, quoting them, the way
  the old authorize command did. These fields are written only by the script; the
  hook blocks hand edits on Claude Code, and on other platforms status flags them.
- `scripts/pincer-status.sh`: which stages are on, every ticket's state, what is
  blocked, elapsed time, next command. `--json` for tooling. Replaces today's
  status, resume and resume --brief with one report.
- `scripts/pincer-evidence.cjs`: writes and validates an evidence manifest under
  `.pincer/evidence/<candidate>/` when the agreement keeps evidence on. Schema kept
  as today's schema 1 (authored checks with digests); the runtime-attempt schemas go.
- Hooks: `block-dangerous.sh` and `ticket-guard.sh` as today, the guard extended to
  the acceptance fields.

Removed from the kit: `pincer-runtime.cjs` and its modules, change records, coverage,
migration, `runtime-contracts.md`, the dry-run checklist. `docs/engine.md` replaces
the contract document at a tenth of the size.

### 5.5 Templates

Every format file in `formats/` opens with the four questions as front matter and
ends with a real example. **(owner)**

```
owner    a human, named in harness.json
home     repo · forge · git · runtime
readers  AI → AI · human → human · AI → human
shape    this template + the example below
```

The ticket format keeps Objective, Context, Requirements, Acceptance Criteria,
Verification with its `Proves:` line, and Constraints. It gains:

- Who reads this, and how far the builder should get on its own.
- Decisions so far.
- Open questions, where "None." is a valid answer.
- How the person checks, before and after merge.
- Done when, and the acceptance line the script fills.

The parser already accepts extra front-matter keys and extra sections, so the engine
needs no change for this.

The spec format (the PRD) keeps problem, scope table, requirements with stable IDs,
success criteria, out of scope. Requirement IDs stay because tickets point at them;
the scenario grammar that fed strict coverage goes.

## 6. The library and the project's copies

The kit ships a library under `template/library/`: the six stage skills, the agent
definitions, the formats. The blueprint generates the project's copies of what it
switched on:

- Claude Code: `.claude/skills/pincer-<stage>/SKILL.md` plus a thin
  `.claude/commands/pincer-<stage>.md` that invokes it, and `.claude/agents/` for the
  active roster.
- Codex: `.agents/skills/pincer-<stage>/SKILL.md` (Codex's native skill format, so
  no conversion step, only a path rewrite for cross-references).
- Copilot: `.github/prompts/pincer-<stage>.prompt.md` generated as today.

`scripts/sync-prompts.sh` keeps doing the generation; it now reads `harness.json` to
know which stages to emit. `npx pincer-workflow update` refreshes the library and
regenerates untouched copies; edited copies get `.new` sidecars as today.

## 7. Agents and the roster

A library of agent definitions, each with one point of view, the course's "file
defines the worker, prompt supplies the task":

| Agent | Stage | In the default roster |
|---|---|---|
| codebase-explorer | plan, narrow | yes, brownfield only |
| implementer | code | no; the main session builds unless the project opts in |
| code-quality-reviewer | evaluate | yes |
| silent-failure-hunter | evaluate | yes |
| security-reviewer | evaluate | yes when the project handles secrets or external input |
| test-coverage-reviewer | evaluate | brownfield with thin tests |
| history-reviewer | evaluate | brownfield |
| standards-reviewer | evaluate | when the project names a style guide |
| accessibility-reviewer | evaluate | when there is a UI |
| fix-agent | evaluate (fixes through new tickets) | no |

The interview proposes the roster from the answers and recon; the developer confirms.
Each reviewer returns findings in `formats/finding.md` (file, line, one-sentence
defect, failure scenario, confidence), so the evaluate skill merges any set of them
into one `finding-report`. Dispatch prompts live in `prompts/` as templates with
named slots (`{{diff}}`, `{{spec_scope}}`, `{{tickets}}`), one per agent, filled by
the skill per run. **(owner: structure from the course slide; call: the roster table
and the default set of three)**

## 8. Cross-platform summary

| Piece | Claude Code | Codex | Copilot |
|---|---|---|---|
| Agreement | `AGENTS.md` via `CLAUDE.md` import | `AGENTS.md` native | pointed at by `copilot-instructions.md` |
| Stage skills | `.claude/skills/` + commands | `.agents/skills/` native | generated prompt files |
| Agents | subagents | inline fallback: the skill applies the agent file as a rubric | same fallback |
| Floor | script + hook | script + status warning | script + status warning |
| Recon | `gh`, git, filesystem | same | same |

## 9. What happens to the repository

- Work on branch `feat/harness-builder`, local only, until the owner has run the new
  version on a real project and says it feels right. Then merge and release as
  1.0.0. **(owner: local first; call: the version number)**
- `template/`, `plugin/`, `bin/pincer.js`, the tests and the README are rewritten.
- The repo-level study tooling (`scripts/delivery-benchmark*`, `docs/prd-v*`,
  `docs/wiki`, `.prd/`, `tickets/`) is left in place and untouched in this version.
  It was never shipped (`package.json` `files` is `bin` and `template`), and it is the
  project's history. **(call)**
- PRD v8 is in flight (T-100 to T-121, several open). This design supersedes its
  product goals; its study programme is not continued here. Open question for the
  owner in section 11.
- The repo's own `CLAUDE.md` keeps the dev loop (edit template, regenerate, test) and
  drops the wiki instruction unless the owner wants to keep the wiki.

## 10. Testing and the local trial

Suites, all offline, no model calls, Node 22 and 24 on macOS and Ubuntu as today:

- installer: packed install per platform, update preserves edits, doctor.
- blueprint output: a fixture repo per kind (empty, greenfield with a scaffold,
  brownfield with history and CI) runs recon and the expected classification and
  pre-filled answers come out; a hand-written answer set produces a valid
  `harness.json` and an `AGENTS.md` whose six headings match it.
- engine: ticket lifecycle including `accept`, hook guards, status report, evidence
  validator.
- generation parity: project copies, Codex skills, Copilot prompts and the plugin
  match the library; a stale generated file fails.
- stage behaviour: each stage refuses when off, reads its gate from `harness.json`,
  and names the right next command.

The interview itself is agent behaviour and is tested the course's way: the owner
runs it on a real project (wordAnalyzer is the candidate, since its agreement is
already half written by hand and can be compared) and brings the result back.

## 11. Open questions for the owner

1. PRD v8's open tickets: mark them superseded in the repo, or leave them untouched
   as history and say so only in the README?
2. The wiki under `docs/wiki/`: keep maintaining it for the rewrite, or freeze it?

## 12. Left to the builder

- The exact `harness.json` schema and its validator.
- The wording of the interview questions and their option lists, drawn from the
  course's Module 1 steps.
- The recon heuristics and their thresholds for greenfield versus brownfield.
- The contents of each agent definition and each prompt template.
- How a stage command on Claude Code invokes its skill file.
- The `accept` subcommand's frontmatter fields and the hook rule for them.
- What `docs/engine.md` must say so a fresh agent can repair a failed verify without
  the old runbook.
