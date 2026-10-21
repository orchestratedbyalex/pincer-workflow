---
name: pincer-plan
description: "Turn a brief into a written spec with stable requirement IDs, approved by the person before anything is built"
argument-hint: "<brief> (paste the full brief if you have one)"
---
# Plan

Turns a brief into a reviewable spec: the problem, the scope, requirements with
stable `R-NN` IDs, success criteria and what is out of scope. Scale the digging to
the uncertainty and the risk, not to the number of lines: a small patch on an
authorization boundary deserves more than a large one in a leaf. The spec feeds narrow.

## Reads
- `$ARGUMENTS`: the brief. Extract everything it answers before asking anything.
- `harness.json`: `project.kind`, `stages.plan.spec` (`file` or `forge`), `stages.plan.gate`, `homes.specs`, `roster.plan`, `systems.forge`.
- Existing specs under the specs home, to tell a revision from a new change.
- `.claude/skills/pincer-plan/formats/spec.md`: the shape of the spec, with an example.
- `.claude/skills/pincer-plan/prompts/explore.md`: the dispatch for `codebase-explorer`.
- `AGENTS.md`: the agreement, the conventions and the dependency gate.

## Steps
1. [session] Run `scripts/pincer-status.sh --stage plan`; on a non-zero exit print its message and stop. Then read `harness.json` for the fields above.
2. [session] Read the brief. Ask only the questions whose answers would change the scope or the architecture, at most three at a time, and never one the brief already answers. For a project with a user interface ask one design question: what it should feel like, and what it must not look like. Summarize your understanding in three to five sentences.
3. [session + agent] When `project.kind` is `brownfield` and `codebase-explorer` is in `roster.plan`: dispatch one or two explorers with `.claude/skills/pincer-plan/prompts/explore.md` (one for the structure, one for the patterns this change touches), then read the two or three load-bearing files they name yourself. Greenfield: skip, and say so.
4. [session] Propose the architecture: components, data flow, integration points, the decisions that matter. Recommend one approach; name an alternative only when the trade-off is real. Name the trust boundaries: which inputs are untrusted, where each is validated, which secrets exist and where they live. Verify the version of every dependency you name and the contract of every external API you build on; memory is a guess. Record every deliberate cut under Out of scope.
5. [session] Write the spec with `.claude/skills/pincer-plan/formats/spec.md` to `<homes.specs>/<name>.md` with `status: draft`. Assign `R-NN` IDs once; a revision keeps existing IDs and adds new ones, never renumbers. When `stages.plan.spec` is `forge`: create the issue with `gh issue create --title "<name>" --body-file <spec>`, then keep the local file as the frontmatter plus `forge: <issue url>` and the list of requirement IDs; the issue holds the discussion.
6. [session] Present the draft and ask for the gate named in `stages.plan.gate` (when it is empty: the person says the spec is approved). Set `status: approved` only after they say so, and record their words under `## Approval` in the spec. Never approve on their behalf; never ask again for a decision they already gave.
7. [session] Commit the spec on its own as `spec: <name>` after inspecting `git status --short` for unrelated staged work. Then run `scripts/pincer-status.sh` and quote its `Next:` line.

## Checks
- The spec exists under the specs home with `status: draft` or `approved`, and every `R-NN` is unique.
- `status: approved` appears only together with the person's words under `## Approval`.
- With `stages.plan.spec` set to `forge`, the frontmatter carries `forge: <url>` and the issue exists.

## Writes
- `<homes.specs>/<name>.md`; with `forge`, the issue too.
- One commit, `spec: <name>`. Nothing else: no code, no tickets.

## Without subagents
Explore the codebase yourself in a separate pass, applying `.claude/agents/codebase-explorer.md`
as the rubric, and say in the spec that the exploration was inline.

## When this stage is off
`scripts/pincer-status.sh --stage plan` exits 3 with the reason. Say so and stop: under
this agreement the ticket is the spec. Run `/pincer-narrow`, which writes a single
ticket from the brief, or `/pincer-code` when narrow is off as well.
