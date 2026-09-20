# Wiki index

Current state: [v8 obligation overlay](../prd-v8-obligation-map.md) and
[v8 contracts](../prd-v8-contracts.md). Historical pages retain their dated evidence.

## Decisions
- [[read-only-projections]] — the two v7 surfaces are projections of computed state; the draft's missing `schema` key is the guard
- [[one-next-action-precedence]] — rules 2 and 3 of the next-action precedence in one module; two views of the same state drift, so delete one (T-80, 2026-09-13)
- [[coverage-is-authored-and-bound]] — one authored map, the PRD prose as the inventory, both inside the agreement digest; structure computed, adequacy judged (PRD v6)
- [[explicit-change-lifecycle]] — PRD v5 (2026-09-12): retained change records, explicit per-worktree selection, agreement digests with user/delegated authorization, journaled lifecycle transitions, change-scoped evidence, `resume`
- [[runtime-owned-verification]] — PRD v4 (2026-09-11): a Node runtime records source-bound attempts, exports evidence schema 2, migrates explicitly; done consumes the attempt

- [[single-source-template]] — template/ is canonical; adapters and plugin are generated, committed, never hand-edited
- [[never-clobber-updates]] — sha256 manifest baseline; user-edited files get `.new` sidecars on update
- [[mechanical-done]] — ticket `done` is reachable only via a script-stamped verification receipt; hook makes the script the only door
- [[revocable-receipts]] — every verify attempt recorded in `last_check`; `done` re-runs the check; tickets and NOTES.md bound to a PRD revision (M0)
- [[release-audit-read-only]] — release reads `docs/release-checklist.md`, runs the gate directly, never calls the ticket script; fixes go through new tickets (M0)
- [[candidate-evidence]] — evidence schema 1 under `.prd/evidence/prd-vN/<candidate>/`; `notes_current` allows only NOTES.md + listed files after the candidate; legacy notes never release-ready; built commit precedes the candidate (PRD v2)
- [[requirements-through-delivery]] — stable `R-NN` IDs plan→narrow→evaluate, `Proves:` behavioral checks, `profile: small|standard`, one shared authorization rule, guarded ticket recovery (PRD v2)

## Systems
- [[native-tool-contracts]] — PRD v8 T-120: host-login study profile, sanitized status, billing-mode-aware usage and comparison rules; what remains unobserved
- [[strict-coverage]] — PRD v6: the PRD as inventory, the authored map, agreement binding, declared checks, evidence schema 3, the coverage and impact reports
- [[v7-measured-friction]] — the v7 measurement tooling, what the baseline measured, and what an operator-driven measurement cannot show
- [[study-readiness-gate]] — PRD v8: the read-only readiness inspector, the allocation ledger, the isolated launcher and the operational-smoke path; the study root landmine
- [[v7-execution-gaps]] — the five verified gaps between the v7 execution path and a reportable study, and why they must close before run #1
- [[delivery-benchmark]] — six frozen briefs, held-out evaluators, the run harness and what the 36 paired runs showed
- [[runtime]] — template/scripts/pincer-runtime.cjs + pincer-runtime/: modules, commands, exit codes, gotchas

- [[cli-installer]] — bin/pincer.js: init/update/doctor, the .pincer.json manifest, copy logic
- [[fix-the-driver-before-run-one]] — the v7 driver placed and capped nothing and the edition had no run loop; fixed and the cohort re-minted while zero runs existed (T-98)
- [[template-kit]] — template/: the PINCER kit itself, its invariants, provenance
- [[distribution-channels]] — npm/npx, Claude plugin marketplace, raw files; release flow and enforcement parity
- [[ticket-state-machine]] — pincer-ticket.sh (start/verify/done + receipts), pincer-status.sh, ticket-guard.sh hook, the /pincer-status command
- [[evidence-validator]] — pincer-evidence.cjs: schema 1 fields, failure classes, CLI, callers, packaging
- [[github-pages-site]] — docs/index.html served by GitHub Pages from main:/docs; the 12-sheet walkthrough, provenance, sync rules

## Evaluated and released as 0.6.0

Both PRDs were evaluated as one change on one candidate, `ce98abd` — v5 was never
released and v6 builds directly on it. The record is `NOTES.md` plus
`.prd/evidence/prd-v6/ce98abd…/`, which is historical evidence already in the reviewed checkout. It does not evaluate
the later v7/v8 implementation ([[open-threads]]).

- [PRD v6](../../.prd/prd-v6.md) — complete requirement coverage, structural change impact and the independent delivery benchmark; T-66..T-78 plus fixes T-79..T-86, reviewed in [the v6 packet](../prd-v6-review-packet.md) and [the v6 trial](../trial-prd-v6.md)
- [PRD v5](../../.prd/prd-v5.md) — change records, authorization and resume; T-47..T-65, reviewed in [the v5 packet](../prd-v5-review-packet.md); its dispositions are in NOTES.md rather than a manifest of its own

## Meta

- [[briefing]] — session-start orientation page (rewritten every `end`)
- [[open-threads]] — parked follow-ups
- [[log]] — append-only chronology
