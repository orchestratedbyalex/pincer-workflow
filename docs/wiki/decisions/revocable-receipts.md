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
