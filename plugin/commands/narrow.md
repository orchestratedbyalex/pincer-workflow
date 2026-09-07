---
description: "Turn the approved PRD into local, AI-ready ticket files"
argument-hint: "Path to PRD (optional — defaults to the latest in .prd/)"
---

# /pincer:narrow — PRD to Local Tickets

You are decomposing the PRD into coherent, independently verifiable tickets stored as
local markdown files (no external tracker needed). Ticket count and size follow the
change's dependencies and risk, plus any budget the user supplied.

**Initial request:** $ARGUMENTS

## Steps

1. Run `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-status.sh`. If tickets already exist for another PRD, leave them
   as history. New tickets continue the numbering and existing ones are never renumbered.
   If tickets already exist for this PRD, extend them only when the current request already
   authorizes that work; otherwise present the concrete addition before asking. Then read the
   PRD (`$ARGUMENTS` or the latest `.prd/prd-v*.md`). If its status isn't `draft`, ask
   which PRD to use.
2. Decompose into tickets. Rules:
   - Each ticket is one coherent unit. Use S, M, or L as relative scope indicators and
     split work when that improves dependency order, verification, or ownership.
   - For greenfield work, use a walking skeleton when it reduces integration risk. For
     brownfield work, begin with the smallest protected vertical change; add a
     characterization ticket before changing load-bearing code that lacks coverage.
   - Order by dependency; note blockers explicitly ("depends on T-01").
   - Every ticket gets a runnable command in its Verification block — a fenced `bash`
     block that exits 0 only when the ticket is done. `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-ticket.sh verify`
     runs it verbatim and stamps the receipt that `done` requires, so it must be
     non-interactive and self-contained (no "check by hand").
   - If the brief or stack implies automated tests, at least one ticket's verification
     command must be the test runner (e.g. `npm test`) — manual checks alone don't count.
   - Any ticket whose surface accepts external input (HTTP endpoint, form, file,
     LLM output) gets an acceptance criterion for the reject path — what invalid
     input produces (e.g. "empty goal → 400 with a clear message"), not only the
     happy path.
   - A greenfield setup ticket includes `.gitignore` covering `.env*` (except
     `.env.example`) and an `.env.example` naming any required secrets before any
     secret can exist in the repo. In brownfield repositories, preserve and verify
     the existing ignore and environment conventions.
3. Write each ticket to `tickets/T-{NN}-{slug}.md` using
   `${CLAUDE_PLUGIN_ROOT}/references/ticket-template.md`, with `status: open` and an explicit
   `prd: .prd/prd-vN.md` naming the selected PRD. Never infer this association from
   numbering or old notes. The other state fields
   (`started`, `last_check`, `verified`, `finished`) are added later by `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-ticket.sh` —
   never write them yourself.
4. Present the ticket list (number, title, size, dependencies) as a table.

Present the concrete breakdown and build order. Reuse existing authorization for the same
scope and order; ask only when the breakdown introduces a material decision or scope change.

5. Once authorized, update the selected PRD frontmatter to `status: ticketed`. Inspect
   existing staged changes, stage that PRD and the explicit new ticket paths, review
   `git diff --cached`, and commit only those paths. Finish with:
   "Tickets ready in `tickets/`. Run `/pincer:code` to start implementing."
