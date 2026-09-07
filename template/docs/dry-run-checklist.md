# PINCER Dry-Run Checklist

How to test that the `.claude/` workflow works: run the full chain on a small toy
feature (e.g. "a CLI todo app in TypeScript — add, list, complete, delete, stored in a
local JSON file"), then tick every box below. All boxes ticked = the workflow passes.
A failed box points at the command file to fix.

Use a throwaway copy of this repo and a cheap model (`claude --model sonnet`).

## After `/pincer-plan`

- [ ] `.prd/prd-v1.md` exists
- [ ] Its frontmatter has `version`, `status: draft`, and `date`
- [ ] All 6 core sections are present (Problem, Solution, Scope, Architecture,
      Success Criteria, Out of Scope)
- [ ] The Scope table has both columns filled (in AND out)
- [ ] No implementation code inside the PRD
- [ ] Discovery asked ≤4 questions and none were already answered by the brief
- [ ] `.git/` exists and the selected PRD is committed without unrelated brownfield work

## After `/pincer-narrow`

- [ ] Ticket files are named `T-{NN}-{slug}.md`; count follows dependencies and risk
- [ ] Every ticket has a coherent S, M, or L scope; larger work is split when that
      improves ownership, dependency order, or verification
- [ ] Greenfield uses a walking skeleton when helpful; brownfield protects the
      smallest useful vertical change
- [ ] Every ticket has a runnable, non-interactive command in its fenced
      Verification block (it is what `scripts/pincer-ticket.sh verify` runs)
- [ ] Dependencies are declared where they exist (`depends_on`)
- [ ] If the brief or stack implies automated tests, at least one ticket's
      verification command is the test runner
- [ ] Every ticket whose surface accepts external input has a reject-path
      acceptance criterion (what invalid input produces), not only the happy path
- [ ] Greenfield setup covers `.env*` (except `.env.example`) and names required
      secrets in `.env.example`; brownfield preserves and verifies existing conventions
- [ ] PRD frontmatter now says `status: ticketed`
- [ ] Tickets are committed

## After `/pincer-code`

- [ ] One commit per ticket, messages formatted `T-{NN}: {title}`
- [ ] Every ticket file now says `status: done`
- [ ] Every done ticket carries `started`, `verified` (receipt) and `finished`
      stamps — `scripts/pincer-status.sh` prints no "done without a receipt" warning
- [ ] Every done ticket has all acceptance-criteria checkboxes ticked
- [ ] `scripts/pincer-ticket.sh verify T-{NN}` passes on done tickets (spot-check
      at least two)
- [ ] Any scope cut made during build is recorded in the PRD's Out of Scope section
- [ ] PRD frontmatter now says `status: built`

## After `/pincer-evaluate`

- [ ] Findings (if any) were presented with `file:line` references
- [ ] The mechanical security audit ran: history grep for secret-like strings,
      `git ls-files` shows no `.env` beyond `.env.example`, dependency audit,
      and (if there's an API) one invalid-input request returned a clean 4xx
- [ ] If the project has a UI, it was actually opened and checked visually, not
      only read as code
- [ ] Approved fixes were committed as `review: fixes` and re-verified
- [ ] `NOTES.md` exists at the repo root and covers: what was built, what was cut
      and why, known issues, next steps

## Overall

- [ ] `git log --oneline` reads as a coherent story: setup → tickets → T-01…T-NN → review
- [ ] No `.env` file contents ever appeared in the conversation
- [ ] `git log -p` contains no secret values anywhere in history (a committed-then-
      deleted key is still leaked)
- [ ] Every dependency in the lockfile is named in the PRD's architecture or was
      explicitly approved during build
- [ ] `NOTES.md` has a Handover section (orientation, dependency justification,
      what breaks first)
- [ ] Brownfield only: untested load-bearing code got a characterization test
      before being modified
- [ ] Platform adapters in sync: `scripts/sync-prompts.sh` then `git status`
      shows no changes in `.agents/skills/` or `.github/prompts/`
- [ ] `scripts/pincer-status.sh` says `Next /pincer-release`; if the user supplied a
      budget, its elapsed figure and any deliberate cuts are reported against that budget
