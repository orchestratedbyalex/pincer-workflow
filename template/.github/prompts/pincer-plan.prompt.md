---
mode: agent
description: "Create a PRD through brief discovery, codebase scan, and an architecture gate"
---
<!-- Generated from .claude/commands/pincer-plan.md by scripts/sync-prompts.sh — edit the source, not this file -->


# /pincer-plan — PRD Creation

You are turning a task brief into a reviewable PRD. Scale discovery and detail to
the change's uncertainty, risk, and any time budget the user supplied. The PRD feeds
`/pincer-narrow` next.

**Initial request:** ${input:request:Task brief or arguments (optional)}

First run `scripts/pincer-status.sh`. If a PRD already exists, preserve it and select
the next unused numeric version for this change. Use the brief and repository state to
distinguish a revision from a new change; ask only if that distinction changes scope or
architecture. If tickets for the current PRD are in progress, resume `/pincer-code`
unless the user explicitly authorized a separate change.

## Phase 1: Discovery

1. If `${input:request:Task brief or arguments (optional)}` contains the brief, extract what you can before asking anything.
   Never ask a question the brief already answers.
2. Ask only the questions whose answers would change the architecture or scope.
   Batch them (max 3–4 at once). Typical ones:
   - What does "done" look like — what will be run, demoed, or reviewed at the end?
   - Any required stack, or is it my choice?
   - What is explicitly out of scope?
3. If the project has a frontend, ask one design question: "What should this feel like,
   and what should it NOT look like?" Capture the answer for the Visual Direction section.

Summarize your understanding in 3–5 sentences. Existing authorization in the request or
session carries forward; ask only about an unresolved choice that materially changes the result.

## Phase 2: Codebase scan (conditional)

If the repo already contains source code, launch 1–2 `codebase-explorer` agents in parallel
(one for architecture/structure, one for patterns relevant to the feature). Read the 2–3 most
load-bearing files they identify yourself — don't rely solely on agent summaries. If the
repo is empty, skip and say so. (No subagents on this platform? Do the exploration
yourself, inline, following the rules in `.claude/agents/codebase-explorer.md`.)

**Brownfield scaling:** if the existing code is substantial or load-bearing (production
traffic, other consumers, no green test suite), this phase grows and Phase 4 shrinks —
a wrong map costs more than a thin PRD. Additionally establish: which paths the change
touches are load-bearing, what test coverage protects them (run the suite, don't assume),
and the blast radius + rollback story for the change. Record these in the PRD's
Architecture section. Greenfield speed assumptions do not transfer to brownfield work.

## Phase 3: Architecture

Propose the architecture: components, data flow, integration points, and key decisions.
- Recommend one approach; mention an alternative only when the trade-off is real.
- Name the trust boundaries in one or two sentences: which inputs are untrusted
  (user input, LLM output, third-party responses), where each is validated, and
  which secrets exist and where they live (server-side only). This becomes the
  PRD's Security section when the project handles secrets or external input.
- Verify versions of key dependencies with `npm view <pkg> version` (or the ecosystem's
  equivalent) before naming them — don't trust training data.
- Verify the contract of any external API the plan builds on (one live request or the
  current official docs) before designing around it — endpoint shapes remembered from
  training data are guesses.
- Respect any explicit delivery budget. Record deliberate cuts in Out of Scope.

Prepare the full draft before seeking any approval still required. The user should review a
concrete scope and architecture; do not repeat an approval already given for the same decision.

## Phase 4: Write the PRD

1. Load `.claude/references/prd-template.md` and write all core sections.
2. Include optional sections when risk or the product context warrants them.
3. Save to the next unused `.prd/prd-v{N}.md` (create `.prd/` if needed), with `N`
   matching the filename and frontmatter:
   ```yaml
   ---
   version: {N}
   status: draft
   date: {today}
   ---
   ```
4. If `.git/` doesn't exist, run `git init`. Commit the PRD and only the intended setup
   paths after inspecting existing staged work; planning should be visible in history
   without absorbing unrelated brownfield changes.

Present the saved draft and obtain approval only when the same scope/architecture was not
already authorized. Finish with: "PRD saved to `.prd/prd-v{N}.md`. Run `/pincer-narrow`
to break it into work items."
