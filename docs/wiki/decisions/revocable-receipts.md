# revocable-receipts

**Decided 2026-09-05** (M0 PRD `.prd/prd-v1.md`, built 2026-09-07, dry-run
confirmed 2026-09-08). Extends [[mechanical-done]].

A verification receipt is evidence about one moment, not a permanent stamp.
Three rules follow:

1. **Every attempt is recorded**, not just successes: `last_check: <ts>
   running|passed|failed|interrupted <hash>`. `running` is written before the
   block executes, so a killed session leaves `running`/`interrupted`, never a
   pass. A failure deletes `verified:`.
2. **`done` always re-runs the check**, including on a ticket that is already
   done. That is how a later regression revokes the receipt while
   `status: done` and `finished:` remain as history. Readiness (what `start`,
   status and release trust) is "latest attempt passed with the current block
   hash", never `status: done` alone.
3. **State is bound to a PRD revision.** Tickets carry `prd:`; NOTES.md carries
   `prd`, `base`, `candidate` as full commit IDs; status reports only the
   tickets of the latest PRD and marks notes stale when their PRD or candidate
   no longer matches HEAD's ancestry. A new PRD therefore silently stops
   release from passing on the previous candidate.

**Why:** the 2026-09-05 assessment (`docs/pincer-assessment-2026-09-05.md`,
defects A01–A09) showed the original design trusted `status: done` forever,
had no record of failed runs, and let one PRD's evaluation vouch for another
PRD's tickets. The differentiator of PINCER is harness enforcement; a receipt
that can never be withdrawn is not enforcement.

**Alternatives rejected:**
- A separate verification log file — duplicates state, and the hook already
  protects the ticket frontmatter; one more line there is enough.
- Re-verifying from the release audit — the audit must be read-only
  ([[release-audit-read-only]]); revocation belongs to the ticket script.
- Dropping `status: done` in favor of receipts only — history is still useful
  for humans and for the status table.

Implementation: [[ticket-state-machine]]. Same trust principle applied to the
installer: [[never-clobber-updates]] (manifest schema 2).

## Addendum (PRD v3, 2026-09-11): the one restore exception

"A restored receipt is never evidence" stays. PRD v3 added the single case where
restoring the ticket file from git is the right repair: the PRD is built with valid
candidate evidence, tracked files other than the ticket file being restored match the
evaluated candidate (or candidate + evidence-only commit) with nothing untracked, and
the ticket's Verification block passes when run directly (not via `verify`, which
would re-stamp). Then the committed evaluation still describes the tree; the agent
names the `git checkout -- tickets/…` command for the user and runs no `verify`,
refreshes no receipt and commits nothing. Without it, the interactive trial showed a
hand repair turning into a receipt-refresh commit that forced a second full
evaluation. Observed live once (eligible case, Sonnet `-p`). The environment ambiguity — a Sonnet
session bypassed a broken `PATH` and applied the exception — was **closed by T-29**
(`96ca033`): the code playbook now specifies the environment the block must pass in.
