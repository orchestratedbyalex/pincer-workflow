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

### T-102 — implementation verified, observation pending

Native and fixture sessions share explicit environment construction, a custody-registered
supervisor, incremental protected captures and bounded teardown. Parent review added
pre-workspace gating, preservation of kit discovery without duplicate hook registration,
and capture-I/O failure termination. The legacy bypass launch is disabled. Offline
verification passes; no native session occurred. Acceptance remains open for real CLI
authentication, kit discovery and managed policy. No API key is available in this session;
the user was asked whether to provide one through the environment.

### T-107

Real Chrome 153.0.8010.48 accepted the working UI and rejected five broken controls,
including transparent ancestors that pass markup checks. Observed timeouts with an active
server and SIGTERM clean up browser, profile and server; forbidden resource requests
remain blocked. Parent reviewed a retained screenshot and artifact bindings. Final runtime
provenance includes the full app bundle (674 files, seven confined internal links);
external/broken/cyclic links are refused. Preflight probes version, native input and
screenshot capability before measured UI preparation. No model session was used.
Latest runtime verification artifacts: `/var/folders/yc/tz09y39n7t7_h5wm36tdcgbh0000gn/T/pincer-browser-gate-zNm3ni`.

### T-104

Schema 8 records every attempt and durable session intent while preserving schema 7
readability. Real process kills exercise setup, session start/end, pre-evaluation and
streaming capture boundaries. Restart retains prior artifacts and reconstructs the exact
original base from verified Git objects in a sterile repository; interrupted commits,
hooks and replacement refs are excluded. Original unrelated file bytes have protected,
hash-bound recipes. Native legacy history without an original base is refused. Parent
and independent agent review added reverse session-ledger checks, safe recipe paths and
malformed-record handling. Measurement completeness remains T-105's next obligation.

The T-102 review also moved task text to stdin so flag-shaped prompts cannot change
launcher options. Its focused verification passed again; native observation remains open.

### Scheduling correction

Commit `c6090aa` repairs the smoke/observation dependency cycle without changing scope.
T-106 can proceed after T-105 using the verified T-102 implementation. T-110 now requires
both T-102 and T-109 complete. The separately authorized operational smoke may supply
T-102's native observations; offline fixtures cannot close them. Static graph checks cover
both the removed cycle and the retained measured-run gate.

### T-105

Versioned measurement blocks collect all recorded sessions across attempts. Each metric
has independent completeness and a measured subtotal; whole-tree tokens include cache
counts once, and provider/API duration remains distinct from wall time. Parent review
added pending-checkpoint refresh, contradictory provider-envelope refusal and explicit
unknown coverage for imported legacy attempts. Missing legacy attempts cannot become a
complete total. Invalid-run spend remains in accounting while acceptance denominators
remain separate. Provider semantics are in `docs/prd-v8-usage-semantics.md`; native payload
validation remains part of the operational smoke, not an offline claim.

### T-106

All launched terminal paths use the same accounting, protocol observation, validation
and atomic publication path. Actual persisted outputs validate for success, rejection,
unavailable evaluation, caps, account/provider errors and evaluator exceptions. Clean
prelaunch refusals remain pending and resumable. A capped candidate is independently
evaluated; a coincident execution error remains an invalid experiment and stops further
prompts. Accounting, validation and write faults retain private raw evidence with a
separately validated diagnostic and block retries until explicit operator disposition.
Diagnostic-storage failure retains ownership. No automatic diagnostic repair is provided.

### T-109 — offline implementation, execution decisions pending

The read-only manifest inspector binds actual decisions, project bases, complete
execution inputs and retained evidence. Missing inputs produce specific pending reasons
before any execution side effect. Evidence freshness includes the complete execution
identity, with only the native-observation reference excluded to avoid self-reference.
Prepared brief and kit-install commits now use a fixed preparation date so the approved
base is reproducible across machines; candidate commits retain their normal behavior.

The allocation ledger reserves one session at a time, requires cell custody and a
durable launch intent, consumes once in the registered supervisor, and reconciles
retained usage before further admission. It rechecks prior accounting before launch;
unknown spend, orphaned payloads, changed records, unresolved custody, quota limits or
overspending stop admission. Measured launch requires completed T-102 and T-109 receipts.
Offline tests cannot supply those observation receipts. Expired authorization permits
accounting-only settlement with a separate validated grant; all launch paths remain
blocked. Current empty capture files are allowed only for the exact reserved intent.
Parent review also bound every later session to the prepared project base and retained
independent capped-candidate evaluation when accounting stops the allocation.

The checked-in study manifest stays pending: no final execution candidate, project
access/bases, reviewers, user-approved allocation or native smoke evidence is invented.
T-110 onward remain gated on actual observations and their prescribed order.
