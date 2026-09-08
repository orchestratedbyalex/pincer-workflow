# release-audit-read-only

**Decided 2026-09-06** (M0 tickets T-08, T-09). The release step audits, it
never mutates.

- `/pincer-release` reads `docs/release-checklist.md` (17 general items:
  artifacts, receipts, notes currency, scoped commits, test gate, visual
  evidence for UI, secrets, judgment notes). It runs the project's test and
  build commands **directly** and never calls `pincer-ticket.sh`. Any failure
  blocks PASS; judgment calls are named before the verdict.
- The old checklist is split in two: `docs/dry-run-checklist.md` is the
  manual trial of the kit on a toy or brownfield repo (the "first commit is
  the PRD", "4–7 tickets" rules lived there and were wrong for real repos);
  `docs/kit-maintenance-checklist.md` is for this repo's own releases
  (regenerate adapters, `npm test`, version bump, tag).
- Fixes found by evaluate or release go through a **new ticket** bound to the
  PRD, never a `review: fixes` commit.

**Why:** before M0, release re-ran `verify` on done tickets, which rewrote
receipts and could change the very candidate it was auditing; the checklist
mixed product-audit items with kit-trial items, so brownfield runs failed on
irrelevant rows. Dry run 2026-09-08 confirmed the new shape: 17/17, gate run
directly, tree clean before and after.

**Alternatives rejected:**
- Letting release stamp a "released" receipt — a second writer of trust
  state; the candidate commit ID in NOTES.md is already the release marker.
- One checklist with platform/profile switches — harder to read than two
  short lists with different audiences.

Related: [[revocable-receipts]], [[ticket-state-machine]], [[template-kit]].
