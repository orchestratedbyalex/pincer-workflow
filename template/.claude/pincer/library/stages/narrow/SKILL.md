---
name: pincer-narrow
description: "Turn the approved spec, or the brief when plan is off, into tickets with runnable checks"
argument-hint: "[spec path] (optional; defaults to the newest approved spec)"
---
# Narrow

Decomposes the spec into tickets a session can build and prove one at a time. The
count follows the dependencies and the risk, not a quota. Every ticket carries a
runnable check, because `scripts/pincer-ticket.sh verify` runs that check verbatim
and `done` refuses without its receipt.

## Reads
- `$ARGUMENTS`: a spec path, or the brief itself when plan is off.
- `harness.json`: `stages.plan.on`, `stages.narrow.tickets` (`file` or `forge`), `homes.specs`, `homes.tickets`, `project.kind`, `roster.narrow`, `repo.checks`, `stages.code.implementer`, `roster.code`.
- The spec, which must be `status: approved`; a draft means the gate was not given yet.
- Existing tickets under the tickets home: numbering continues and nothing is renumbered.
- `.claude/skills/pincer-narrow/formats/ticket.md`: the ticket shape, with an example.
- `.claude/skills/pincer-narrow/prompts/explore.md`: the dispatch for `codebase-explorer`.

## Steps
1. [session] Run `scripts/pincer-status.sh --stage narrow`; on a non-zero exit print its message and stop. Then read `harness.json` for the fields above.
2. [session] Pick the spec: `$ARGUMENTS`, else the newest approved spec in the specs home; a draft stops you here. When `stages.plan.on` is false there is no spec: write a single ticket from the brief in `$ARGUMENTS`, leave out `Implements:` and the `spec:` field, and continue at step 6.
3. [session + agent] When `project.kind` is `brownfield` and `codebase-explorer` is in `roster.narrow`: dispatch it with `.claude/skills/pincer-narrow/prompts/explore.md` for the paths the change touches, their test coverage and what is load-bearing; read the key files yourself.
4. [session] Decompose. One coherent unit per ticket, sized S, M or L; ordered by dependency with `depends_on`. Brownfield: the smallest protected vertical change first, and a characterization ticket before changing load-bearing code that has no coverage. Greenfield: a walking skeleton when it cuts integration risk, and a setup ticket that adds `.gitignore` for `.env*` and an `.env.example` before any secret can exist. A surface that takes external input gets a reject-path criterion. Every `R-NN` is implemented by a named ticket (`Implements:` in its Context) or you stop and resolve the gap with the person.
5. [session] Give every ticket a Verification block that exits 0 only when the ticket is done: non-interactive and self-contained, opening with `Proves:` (what it establishes and which regression it catches). Exercise behavior, not names; a build or a grep alone is not proof. At least one ticket's check runs the test runner from `repo.checks`. You may run a check once on the tree as it is, to see it fail for the reason the ticket names: `scripts/pincer-ticket.sh check T-NN` runs the block as a dry run and records nothing, so do not copy the block out of the ticket to run it; never build the feature to watch a check pass, which is the code stage's work. Put anything you need outside the repository for this in a `mktemp -d` directory and remove it before the stage ends.
6. [session] Write each ticket to `<homes.tickets>/T-NN-<slug>.md` with the format, `status: open` and `spec: <spec path>`. Never write `started`, `last_check`, `verified`, `finished` or the `accepted` fields; the script owns them. When `stages.narrow.tickets` is `forge`: `gh issue create --title "T-NN: <title>" --body-file <ticket>` per ticket, and `forge: <url>` in the local file.
7. [session] Present the table (number, title, size, depends on, check) and the requirement map (`R-NN`, ticket, check). When `stages.code.implementer` is true, `implementer` is in `roster.code` and no ticket is size M, say so under the table: the implementer is dispatched for M tickets only, so the code stage builds every ticket inline. Commit the tickets as `tickets: <spec name>` after inspecting `git status --short`. Then run `scripts/pincer-status.sh` and quote its `Next:` line.

## Checks
- `scripts/pincer-status.sh` lists every new ticket as `open` and none as `invalid`.
- Every Verification block runs without a human and opens with `Proves:`.
- Every `R-NN` of the spec is named by a ticket, or the gap was resolved with the person.

## Writes
- The ticket files under the tickets home; with `forge`, one issue per ticket.
- One commit, `tickets: <spec name>`. No code.

## Without subagents
Explore inline, applying `.claude/agents/codebase-explorer.md` as the rubric, and note
it in the tickets' Decisions so far.

## When this stage is off
`scripts/pincer-status.sh --stage narrow` exits 3 with the reason. Say so and stop:
`/pincer-code` writes one ticket per change from the spec or the brief, using the
library's ticket format at `.claude/pincer/library/stages/narrow/formats/ticket.md`,
before it starts building.
