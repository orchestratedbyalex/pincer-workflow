# PRD v8 implementation progress

## Execution basis — 19 September 2026

User instruction: “can you make sure the PRD v8 and its tickets get implemented? you
might use other agents to work on the tasks so that context gets managed properly
and you Astra check their work so that we stay efficients in tokens”. This authorizes
implementation and bounded delegation within PRD v8. The primary agent reviews work,
verifies tickets and owns commits. Live spending, project access and independent human
reviewer selection remain concrete execution inputs, not inferred allocations.

- Branch: `feat/prd-v8`, based on planning commit `c7cb6bc`.
- Management: legacy mode retained as specified by the PRD.
- Independent management kit: `v0.6.0` (`694241c`), `template/scripts/` extracted to
  `/tmp/pincer-v8-management-694241c/scripts/`. Aggregate SHA-256 over sorted
  relative-path + NUL + content is
  `c0354c6452d0f5605a7d5a28c385321df4fc7fe7b5fe46fd7d6284cfc1d35cb9`.
  This algorithm differs from earlier tree-digest algorithms; it identifies this extraction.
- User-owned untracked `docs/diagrams/` and `docs/pincer-workflow-guide.md` are preserved.
- Runtime status, ticket receipts and individual commits are authoritative for completion.

## Observational prerequisites

Project selection and two independent reviewers were requested while implementation
continues. No paid session has been launched. T-109 will prepare the numeric allocation,
wall-clock limits and exact launch manifest before any spending request. Implementation
checks cannot substitute for T-110 onward's live observations.

## Review and continuation

Start with this file, `docs/prd-v8-contracts.md`, the ticket map and runtime status.
Run ticket lifecycle commands through the pinned kit from the repository working
directory. Never edit lifecycle fields or close an observation with synthetic evidence.
Record completed tickets, review findings and current blockers below as work proceeds.

### T-100

Contracts and all 30 v7 scenario obligations reconciled. Static contract verification
includes 15 negative document mutations and a frozen-content mutation. Parent reviewed
the historical sequencing disposition, preservation boundaries and deferred findings.
Runtime readiness remains independent from authored documentation.

### T-101

Effective manifests now bind resolved tool/model/caps, kit bytes, browser closure and
all execution helpers. Existing-plan validation precedes writes. Parent reviewed the
secret/path boundaries and fixture-only session seam; focused suites passed. The static
v7 manifest was explicitly regenerated for the changed execution code. Historical cohorts
remain readable. Real orchestration refuses until T-102 supplies isolation; the old direct
shell entry is a known remaining boundary assigned to T-102, not live readiness.

### T-108

Release preparation is verified in disposable fixtures: preview/apply, packed layout,
idempotency, unrelated-work refusal, truncated writes and candidate freshness. Parent
review found and corrected API-only validation and partial-effects/idempotency gaps.
Distribution and historical-contract suites pass. No repository version was changed;
no candidate was selected, tagged or published.

### T-103

Independent-process controls prove one launch per cell, separate-cell concurrency,
exclusive rerun allocation, complete atomic checkpoints, and explicit dead-owner recovery.
Surviving inherited or registered detached children prevent reclaim. Parent review added
complete recovery-receipt publication and retry validation. The sandbox denies the process
group inspection needed by these tests; verification passed outside it. Ambiguous hosts
remain blocked rather than assumed dead. T-104 still owns checkpoint replay and attempts.
