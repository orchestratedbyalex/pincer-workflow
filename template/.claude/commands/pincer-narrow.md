---
description: "Turn the approved PRD into local, AI-ready ticket files"
argument-hint: "Path to PRD (optional — defaults to the latest in .prd/)"
---

# /pincer-narrow — PRD to Local Tickets

You are decomposing the PRD into coherent, independently verifiable tickets stored as
local markdown files (no external tracker needed). Ticket count and size follow the
change's dependencies and risk, plus any budget the user supplied. There is no hard
one-to-two-ticket cap for small PRDs and no default timebox: cohesion and dependencies
decide the count. A breakdown that follows the PRD needs no second approval; a newly
discovered consequential choice is surfaced before implementation.

**Initial request:** $ARGUMENTS

## Steps

1. Run `scripts/pincer-status.sh`. If tickets already exist for another PRD, leave them
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
   - Build the requirement map: for every `R-NN` in the PRD and each of its
     scenarios, name the ticket that owns the implementation and the executable
     check that exercises it, or an explicit review method when no executable check
     exists. Record the IDs in each ticket's Context as `Implements: R-NN, R-MM`.
     Enabling work that implements no requirement states its purpose in the ticket
     Objective. Resolve missing coverage and conflicting criteria with the user
     before implementation; do not start with an unmapped required scenario.
   - Every ticket gets a runnable command in its Verification block — a fenced `bash`
     block that exits 0 only when the ticket is done. `scripts/pincer-ticket.sh verify`
     runs it verbatim and stamps the receipt that `done` requires, so it must be
     non-interactive and self-contained (no "check by hand").
   - Each Verification section opens with `Proves:` — what the check establishes and
     which regression it detects. A check for an executable change must exercise
     observable behavior (including relevant rejection paths and, in brownfield work,
     preservation of existing behavior) and fail when the behavior is wrong, not only
     when an identifier is renamed. Reuse adequate focused tests. A build, a syntax
     check, or an identifier grep alone is not proof; static assertions are primary
     evidence only for static contracts such as generated files, and `Proves:` says so.
   - Adequacy is a judgment about what the command observes, never a word match: do
     not call a command sufficient because it contains `grep`, `test`, or a runner
     name, nor insufficient for lacking them. Manual visual judgment is recorded
     separately in evaluation; a tool the check needs but cannot run yields an
     explicit `unverified` result, never fabricated evidence or a silent waiver.
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
   `.claude/references/ticket-template.md`, with `status: open` and an explicit
   `prd: .prd/prd-vN.md` naming the selected PRD. Never infer this association from
   numbering or old notes. The other state fields
   (`started`, `last_check`, `verified`, `finished`) are added later by `scripts/pincer-ticket.sh` —
   never write them yourself.
4. Present the ticket list (number, title, size, dependencies) as a table, followed
   by the requirement map as a second table (requirement · scenario · ticket · check
   or review method). Whether the map is complete and each check is adequate is your
   judgment as the author; say so rather than presenting the table as mechanical proof.

Present the concrete breakdown and build order as a report, not a question. Reuse
existing authorization for the same scope and order.

5. Finalize. A breakdown that follows the PRD is already authorized by the PRD: do not
   ask whether to proceed. Update the selected PRD frontmatter to `status: ticketed`,
   inspect existing staged changes, stage that PRD and the explicit new ticket paths,
   review `git diff --cached`, and commit only those paths. Ask first — and finalize
   once it is resolved — only when step 4 surfaced a newly discovered consequential
   choice or a scope change the PRD does not cover. Finish with:
   "Tickets ready in `tickets/`. Run `/pincer-code` to start implementing."

## Authorization rule (shared by plan, narrow, code and evaluate)

Reuse explicit authorization for the same scope and decisions; ask only about a
material choice not already authorized, and prepare the concrete proposal before
asking. A decision the user delegated (for example "pick the architecture") does not
need another approval when you exercise it, but a newly discovered consequential
choice is surfaced before implementation. Record the authorization basis and the
scope it covers in the PRD or the handover. An agent-written record or a status
field is not authenticated human approval. When resuming without the context that
granted authorization, do not invent it — ask.
