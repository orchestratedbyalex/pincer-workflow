---
description: "Turn the approved PRD into local, AI-ready ticket files"
argument-hint: "Path to PRD (optional — defaults to the latest in .prd/)"
---

# /pincer-narrow — PRD to Local Tickets

You are decomposing the PRD into small, independently verifiable tickets stored as local
markdown files (no external tracker needed). Target: 4–7 tickets that fit a ~75-minute
build window.

**Initial request:** $ARGUMENTS

## Steps

1. Read the PRD (`$ARGUMENTS` or the latest `.prd/prd-v*.md`). If its status isn't
   `draft`, ask which PRD to use.
2. Decompose into tickets. Rules:
   - Each ticket is one coherent unit: sized S or M, never L. Split anything larger.
   - Ticket 1 is always the walking skeleton: project scaffold + a thin end-to-end slice
     that runs. Everything after builds on a working base.
   - Order by dependency; note blockers explicitly ("depends on T-01").
   - Every ticket gets a verification command or check the builder can actually run.
   - If the brief or stack implies automated tests, at least one ticket's verification
     command must be the test runner (e.g. `npm test`) — manual checks alone don't count.
   - Any ticket whose surface accepts external input (HTTP endpoint, form, file,
     LLM output) gets an acceptance criterion for the reject path — what invalid
     input produces (e.g. "empty goal → 400 with a clear message"), not only the
     happy path.
   - The walking skeleton (T-01) includes `.gitignore` covering `.env*` (except
     `.env.example`) and an `.env.example` naming any required secrets — before
     any secret can exist in the repo.
   - Brownfield: a ticket that modifies load-bearing code with no test coverage
     is preceded by a characterization ticket — a test that pins the current
     behavior before any ticket is allowed to change it.
3. Write each ticket to `tickets/T-{NN}-{slug}.md` using
   `.claude/references/ticket-template.md`.
4. Present the ticket list (number, title, size, dependencies) as a table.

**Gate (medium):** Ask for approval of the breakdown and build order. Adjust if pushed back.

5. After approval, update the PRD frontmatter to `status: ticketed`, commit the tickets
   (`git add .prd tickets && git commit`), and finish with:
   "Tickets ready in `tickets/`. Run `/pincer-code` to start implementing."
