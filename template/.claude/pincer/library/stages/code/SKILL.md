---
name: pincer-code
description: "Build the open tickets in order: start, implement, verify, self-review, done, one commit each"
argument-hint: "[T-NN ...] (optional; defaults to every open ticket in dependency order)"
---
# Code

Builds the tickets one at a time and proves each with its own check. The ticket's
lifecycle fields are written only by `scripts/pincer-ticket.sh`: `start`, `verify`,
`done`. `verify` runs the Verification block and stamps a receipt only on exit 0;
`done` refuses without a receipt for the current block or with an unticked criterion.
On Claude Code a hook enforces this; elsewhere it is a standing rule and status
flags a missing or stale receipt.

## Reads
- `$ARGUMENTS`: ticket numbers, else every open ticket in dependency order.
- `harness.json`: `repo.branches` (`per-ticket` or `main`), `repo.pr`, `repo.merge`, `stages.code.implementer`, `roster.code`, `homes.tickets`, `homes.specs`, `stages.narrow.on`, `stages.plan.on`, `stages.release.on`.
- `scripts/pincer-status.sh`: every ticket's state and the next action; an `in_progress` ticket means you are resuming.
- The ticket, the files it names, the spec's architecture, and `AGENTS.md` (conventions, the dependency gate, the security defaults).
- `.claude/skills/pincer-code/prompts/implement.md`: the dispatch for `implementer`.
- `.claude/skills/pincer-code/formats/pr.md`: the pull request body.
- `docs/engine.md`: the exit codes, the receipt, and how a broken ticket file is recovered.

## Steps
1. [session] Run `scripts/pincer-status.sh --stage code`; on a non-zero exit print its message and stop. Then read `harness.json` for the fields above and the plain status report. An `in_progress` ticket: read it, run `git status` and `git diff`, and continue from where its receipt says you are, without asking the person to reconfirm work already agreed.
2. [session] When `stages.narrow.on` is false and no open ticket exists, write one ticket from the spec (or the brief in `$ARGUMENTS` when plan is off too) with the library's ticket format at `.claude/pincer/library/stages/narrow/formats/ticket.md`, commit it, then continue.
3. [session] Branch. `repo.branches` = `per-ticket`: before a ticket, `git switch -c <prefix>/T-NN-<slug>` from the main branch (prefix from `AGENTS.md` Conventions, default `feat`); a ticket that depends on unmerged work continues on the branch that holds it. `main`: stay on the main branch.
4. [session] Start: `scripts/pincer-ticket.sh start T-NN`. It refuses while a `depends_on` ticket is not done. Read the ticket and the files it names; announce "Starting T-NN: <title>".
5. [session + agent] Implement. Follow the conventions and the spec's architecture. A dependency the spec does not name is a stop-and-ask per `AGENTS.md`. S tickets: build directly. M tickets with `stages.code.implementer` true and `implementer` in `roster.code`: dispatch with `.claude/skills/pincer-code/prompts/implement.md`, the ticket body and the conventions pasted in, nothing else; read its report and its verify output yourself.
6. [session] Verify: `scripts/pincer-ticket.sh verify T-NN`. Red: fix and run it again, and report the real output, never an expectation. Green output is the definition of done, not your confidence. A check that only built or only grepped is not behavioral proof; say so. A tool the check needs but cannot run is reported as such, never fabricated.
7. [session] Self-review the diff before committing: silent failures (empty catches, un-awaited promises), leftover debug code, drift from the acceptance criteria, and the security sweep from `AGENTS.md` (no secret values, external input validated server-side, no internals in error output). If the review changed code, run `verify` again; the receipt must match what you commit.
8. [session] Close: tick every criterion you verified (`- [ ]` to `- [x]`; editing the checkboxes is allowed), then `scripts/pincer-ticket.sh done T-NN`. A criterion that was cut is a scope change for the spec's Out of scope, not a box to skip. Stage only this ticket's paths and its file, review `git diff --cached`, commit as `T-NN: <title>`. One line of progress ("T-02 done, 3 remaining"), then the next ticket.
9. [session] After the last ticket: when plan is on, set the spec to `status: built` and commit that alone as `spec: <name> built`. When `repo.pr` is true: push the branch and open the pull request with `gh pr create` and `.claude/skills/pincer-code/formats/pr.md`, asking first unless `AGENTS.md` authorises pushing; merging is the person's. When `stages.release.on` is false, ask the person to accept each ticket now and record it with `scripts/pincer-ticket.sh accept T-NN --by "<name>" --words "<their words>"`. Then run `scripts/pincer-status.sh` and quote its `Next:` line.

Recovery: a failed `verify` is fixed and run again; the failed receipt stays until a
passing one replaces it. A ticket file that is malformed or whose lifecycle fields
were edited by hand is reported with the validation error status printed and handed
to the person, who repairs it in their own terminal; then `start`, `verify`, `done`
again. You never restore a ticket file from git to clear a warning: a restored receipt
is not evidence. `docs/engine.md` has the details.

## Checks
- Every closed ticket shows `verified` on its status line and its commit is `T-NN: <title>`.
- `git status --short` is clean after each commit; only the ticket's paths went in.
- No lifecycle field was written by anything but the script.

## Writes
- Source and tests, one commit per ticket.
- Ticket files, only through the script and the tick boxes.
- The spec's `status: built` line when plan is on; the pull request when `repo.pr`.

## Without subagents
The session builds every ticket itself; `stages.code.implementer` has no effect, and
you say so once at the start.

## When this stage is off
`scripts/pincer-status.sh --stage code` exits 3 with the reason. The interview never
offers this, because the receipt per ticket is the floor; if `harness.json` says so
anyway, say so, build nothing, and ask the person to run `/pincer-blueprint`.
