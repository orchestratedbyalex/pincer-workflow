---
name: pincer-plan
description: "Create a PRD through brief discovery, codebase scan, and an architecture gate"
---
<!-- Generated from .claude/commands/pincer-plan.md by scripts/sync-prompts.sh — edit the source, not this file -->


# $pincer-plan — PRD Creation

You are turning a task brief into a compact PRD. This runs inside a short delivery
timebox (~2 hours total), so discovery is brief and the PRD is lean. The PRD feeds
`$pincer-narrow` next.

**Initial request:** the text that follows the `$pincer-plan` mention in the user's message (ask for it if there is none)

First run `scripts/pincer-status.sh`. If a PRD already exists, say so and ask whether
this is a new version of it (`.prd/prd-v{N+1}.md` — old versions are never overwritten)
or a fresh start; if tickets are in progress, stop and point at `$pincer-code` instead.

## Phase 1: Discovery (~5 min)

1. If `the text that follows the `$pincer-plan` mention in the user's message (ask for it if there is none)` contains the brief, extract what you can before asking anything.
   Never ask a question the brief already answers.
2. Ask only the questions whose answers would change the architecture or scope.
   Batch them (max 3–4 at once). Typical ones:
   - What does "done" look like — what will be run, demoed, or reviewed at the end?
   - Any required stack, or is it my choice?
   - What is explicitly out of scope?
3. If the project has a frontend, ask one design question: "What should this feel like,
   and what should it NOT look like?" Capture the answer for the Visual Direction section.

Summarize your understanding in 3–5 sentences and confirm before moving on.

## Phase 2: Codebase scan (conditional, ~5 min)

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

## Phase 3: Architecture (~5 min)

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
- Bias every decision toward "finishable in the remaining time". Cut before you gold-plate.

**Gate (heavy):** Ask for explicit approval of the architecture before writing the PRD.

## Phase 4: Write the PRD (~5 min)

1. Load `.claude/references/prd-template.md` and write all core sections.
2. Include optional sections only when they earn their space in the timebox.
3. Save to `.prd/prd-v1.md` (create `.prd/` if needed) with frontmatter:
   ```yaml
   ---
   version: 1
   status: draft
   date: {today}
   ---
   ```
4. If `.git/` doesn't exist, run `git init` and make an initial commit containing the
   PRD and this `.claude/` setup — planning should be visible in the history.

Finish with: "PRD saved to `.prd/prd-v1.md`. Run `$pincer-narrow` to break it into work items."
