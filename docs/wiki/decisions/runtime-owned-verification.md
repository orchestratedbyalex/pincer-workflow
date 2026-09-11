# runtime-owned-verification

**Decided 2026-09-11** (PRD v4 `.prd/prd-v4.md`, `profile: standard`, T-29..T-43 on
`feat/prd-v4`). Supersedes the "done re-runs the check" rule of
[[revocable-receipts]] for migrated projects; keeps it for legacy ones.

## What

Verification is executed and recorded by a shared Node runtime ([[runtime]]), not
by the agent and not by Bash helpers:

1. **Explicit change identity.** `.prd/changes/<id>.json` binds one PRD path and
   its content revision (SHA-256 with the `status` line removed) plus a base commit
   and an optional recorded authorization. Registration never infers approval from
   PRD status and never picks the highest PRD number.
2. **Attempts, not receipts.** Every `verify` writes a `running` record before
   launch, captures sanitized output, snapshots the source before and after, and
   finalizes `passed|failed|timed_out|interrupted|error`. Readiness = latest attempt
   passed against the current source, check and ticket digests. `done` consumes it
   and never re-runs. Nothing is written into tracked ticket receipts.
3. **Source-bound.** The source manifest (tracked + untracked non-ignored files,
   modes, deletions, normalized tickets/PRDs, fixed exclusions) makes any source
   change `SOURCE_CHANGED`; a check that mutates source cannot pass.
4. **Evidence schema 2** is exported from candidate attempts (`check`, `evidence
   export`); schema 1 stays valid as `legacy` provenance. A newer same-source
   nonpassing attempt blocks release until re-exported.
5. **Explicit migration** with preview, backups and idempotent apply; legacy
   receipts become history (`LEGACY_RECEIPT`), never runtime evidence.

## Why

The interactive trials showed the remaining gap between what ran and what the
workflow could establish: agent-authored logs, receipt-refresh commits after
repairs, a recovery exception that depended on wording, and two policy
implementations (awk + Node) drifting. The v0.4.1 baseline in
`docs/trial-2026-09-11-prd-v4.md` still needed a receipt-refresh commit after a
repaired regression and left a ticket diff after an environmental failure; the
runtime needed neither.

## Rejected

- Keeping receipts in the ticket and adding an attempts log beside them: two truths.
- Letting a later pass clear a same-source failure without re-export: the PRD asks
  for "freshly resolved and evaluated".
- Requiring `change.base` to equal the evaluation base: registration happens after
  the PRD commit, the evaluation base precedes it; they are recorded separately.
- Migrating this repository during the work: forbidden by PRD v4 §9; its own
  evaluation stays schema 1 via the pinned v0.4.1 kit.

## Limits

Local provenance only (no attestation: records and logs are validated against each
other for mistake detection, T-45, but a rewrite of both is undetectable); POSIX
process groups; a kit update inside a
migrated project invalidates every done ticket's attempt; fresh clones validate the
saved record only. Follow-ups are PRD v4 §10 (lifecycle, coverage impact, platform
parity).
