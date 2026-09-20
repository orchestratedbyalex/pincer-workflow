# PRD v5 review packet — preserve changes, authorization, and resume context

Prepared for the implementation check requested in `.prd/prd-v5.md` section 8.
Everything here is reproducible from the branch; nothing below claims an observation
that was not made. Rows marked `outstanding` are not passed gates. Preparing this packet
completes no ticket other than T-61, evaluates nothing, merges nothing, bumps no version
and publishes nothing; evaluation and release remain separate actions.

## 1. Implementation reference

- Branch: `feat/prd-v5`, base `9bcf8df` (main after v0.5.0 was published; the commit
  the PRD was written against). The PRD was ticketed as `b133da2` (T-47..T-61,
  `docs/prd-v5-ticket-map.md`); T-62 was added from a trial finding, T-63..T-65 from
  the user's review of the built branch at `1a5cbc5` (three findings, all fixed; the
  fixes are follow-up tickets, never edits to done tickets). Ticket commits:
  T-47 `04c49a2`, T-48 `381231d`, T-49 `7d376ab`, T-50 `e07b813`, T-51 `43b1016`,
  T-52 `57a88fd`, T-53 `216e9dd`, T-54 `32418b5`, T-55 `5a0a7bc`, T-56 `9f01884`,
  T-57 `7c587c6`, T-58 `ec216d2`, T-59 `a302735`, T-62 `6e37294`, T-60 `c0bb7e9`,
  T-61 `473bfee` (this packet), T-63 `d43168c`, T-64 `7d94c58`, T-65 `dcbcfbe`.
- Candidate commit: not chosen by this packet. This repository stays in legacy mode
  (PRD section 7: its own tickets are managed with the pinned released v0.5.0 kit), so
  `/pincer-evaluate` records the candidate in `NOTES.md` and a schema 2 manifest under
  `.prd/evidence/prd-v5/<candidate>/` after the PRD is `built`. The packet, the trial
  record and the authored docs are finalized before that candidate so a later
  evaluation commit is evidence-only and cannot invalidate itself.
- Changed behavior, in one paragraph: the runtime keeps one schema 2 change record
  per change under `.prd/changes/` (identity, agreement history, authorizations,
  decisions, lifecycle events, evaluation references), written only inside journaled
  transactions with a manifest commit point and explicit `recover`. Every worktree
  selects the change it works on (`change select`, metadata only, never inferred
  from a branch or the newest PRD). An agreement is the exact projection of the PRD
  revision, the ticket texts and the resolved decisions; a `user` authorization
  records the user's actual instruction against that digest, a `delegated` one names
  its basis, and an open decision blocks. Execution commands are gated in a fixed
  order (records → selection → wrong change → lifecycle → base → decision →
  authorization) and refuse before any side effect. Attempts and candidate checks are
  keyed by change; evaluations are retained per change in a locator. `resume` prints
  a fresh-session report with one computed next action. Legacy and v0.5.0 (migrated)
  projects keep their behavior until `migrate --apply` converts them in one backed-up
  transaction. Playbooks, adapters, guards, installer, doctor and the plugin ship the
  same runtime.
- PRD revisions during implementation: none. Contract clarifications and approved
  deviations are listed in section 10.

## 2. Traceability

Deterministic suites run under `npm test`; "trial" means a live agent observation
recorded in `docs/trial-prd-v5.md` (T-60). Each scenario's test block is tagged with
its `S-NN` in the test source, so `grep -n "S-NN" test/<suite>` lands on the block.

| Requirement | Scenarios | Implementation | Evidence | Disposition |
| --- | --- | --- | --- | --- |
| R-01 retain every change record | S-01, S-02, S-03 | `changes.cjs` registry and validation, `register` (T-49) | `test/change-registry.test.js`, `test/runtime-identity.test.js` | delivered |
| R-02 explicit per-worktree selection, no wrong-change execution | S-04, S-05, S-06 | `.pincer/runtime/selection.json`, `change select`, `gates.cjs` (T-50, T-54) | `test/change-selection.test.js`, `test/change-command-gates.test.js`; trial S-30 (`change select` in every resume session) | delivered |
| R-03 lifecycle with retained history | S-07, S-08, S-09, S-10 | `transitions.cjs`, lifecycle events, `change pause/resume/complete/reopen/cancel/supersede` (T-53) | `test/change-lifecycle.test.js`; trial S-30 (pause with note, resume, complete) | delivered |
| R-04 authorization bound to the agreement digest | S-11, S-12, S-13 | `agreement.cjs` projection and snapshots, `authorization.cjs` verdicts (T-51, T-52) | `test/change-agreement.test.js`, `test/change-authorization.test.js`, `test/change-command-gates.test.js`; trial S-30 (A-01 retained across sessions, no re-approval) | delivered |
| R-05 revisions and decisions dispositioned explicitly | S-14, S-15, S-16 | `change revise`, `change decide`, `--delegated --basis`, verdict order (T-52, T-54) | `test/change-authorization.test.js`, `test/change-command-gates.test.js`; trial S-31 changed scope (block held; agent finding 1 fixed in T-62 and re-run) | delivered; agent-side residual disclosed (trial finding 1) |
| R-06 fresh-session resume from the repository alone | S-17, S-18, S-19 | `resume.cjs` report and next-action precedence, authored handoff labeled (T-57) | `test/change-resume.test.js`; trial S-30 both project types, S-31 interruption | delivered |
| R-07 change-scoped evidence and evaluations | S-20, S-21, S-22, S-23 | attempt schema 2 with `context.agreement`, change-keyed candidate keys, `locator.cjs`, followers computed from validated listed artifacts (T-55, T-56; review finding 2 fixed in T-64) | `test/change-evidence-context.test.js`, `test/change-evaluations.test.js`, `test/runtime-evidence.test.js` | delivered |
| R-08 atomic transactions, recovery, running attempts | S-24, S-25, S-26 | `transaction.cjs` journal and manifest, `recover`, `ATTEMPT_RUNNING`, gates re-evaluated under the attempt lock (T-48, T-53; review finding 1 fixed in T-63) | `test/change-transactions.test.js`, `test/change-lifecycle.test.js`, `test/change-command-gates.test.js`, `test/runtime-state.test.js`; trial S-31 interruption (`recover` finalized the killed attempt) | delivered |
| R-09 explicit migration, preserved installs, packed parity | S-27, S-28, S-29 | `migrate.cjs` (legacy and binding sources, backups, one rollback procedure per source), doctor, installer, plugin build (T-58, T-59; review finding 3 fixed in T-65) | `test/change-migration.test.js`, `test/runtime-migrate.test.js`, `test/change-distribution.test.js`, `test/distribution.test.js`, `test/installer.test.js` | delivered |
| R-10 live observation with honest baseline | S-30, S-31, S-32 | T-60 trials, `docs/trial-prd-v5.md`, artifacts | `test/change-trial-record.test.js` (completeness only); the trial record and `docs/prd-v5-artifacts/trial-logs/` | delivered on one surface (Claude Code `-p`, Sonnet, macOS); other surfaces untested |

Scenario table (one row per S-NN):

| Scenario | Where it is exercised | Disposition |
| --- | --- | --- |
| S-01 register A then B; both retained with identity and history | `test/change-registry.test.js` S-01 | delivered |
| S-02 duplicate ids, duplicate PRD ownership, malformed and unresolved records refused | `test/change-registry.test.js` S-02 | delivered |
| S-03 v0.5.0 `--replace` refused with select/supersede guidance | `test/change-registry.test.js` S-03; trial S-32 (the baseline needed it twice) | delivered |
| S-04 selecting with dirty work changes only the pointer; execution against the wrong change refused | `test/change-selection.test.js` S-04, `test/change-command-gates.test.js` S-04; replay `wrong-change` | delivered |
| S-05 fresh clone requires selection even with one record; missing or invalid selection named | `test/change-selection.test.js` S-05; replay `no-selection` | delivered |
| S-06 linked worktrees keep independent selections and attempts | `test/change-selection.test.js` S-06 | delivered |
| S-07 pause/resume retains progress, attempts, authorization and reason | `test/change-lifecycle.test.js` S-07; trial S-30; replay `aba` | delivered |
| S-08 complete refuses unfinished, unchecked, stale or red work | `test/change-lifecycle.test.js` S-08, `test/change-command-gates.test.js` S-08 | delivered |
| S-09 terminal changes execute nothing; self and cyclic supersession refused | `test/change-lifecycle.test.js` S-09, `test/change-command-gates.test.js` S-09 | delivered |
| S-10 reopen keeps the completion; evidence goes stale, not revived | `test/change-lifecycle.test.js` S-10 | delivered |
| S-11 the exact earlier instruction, recorded once, is reused without asking | `test/change-authorization.test.js` S-11, `test/change-command-gates.test.js` S-11; trial S-30 | delivered |
| S-12 missing, foreign and unmatched authorizations block; same-filename PRD edit blocks | `test/change-authorization.test.js` S-12, `test/change-command-gates.test.js` S-12 | delivered |
| S-13 lifecycle fields, ticks, attempts and source edits never change the agreement | `test/change-agreement.test.js` S-13, `test/change-command-gates.test.js` S-13 | delivered |
| S-14 same-filename PRD revision blocks until its disposition | `test/change-command-gates.test.js` S-14; replay `revision`; trial S-31 changed scope | delivered |
| S-15 delegated check improvement needs fresh verification, no new user approval | `test/change-authorization.test.js` S-15, `test/change-command-gates.test.js` S-15; replay `delegated`; trial G1 (delegated narrowing recorded) | delivered |
| S-16 an open consequential decision blocks; inspection and recovery still work | `test/change-authorization.test.js` S-16, `test/change-command-gates.test.js` S-16; trial B5/B6 (D-01 raised, resolved) | delivered |
| S-17 a fresh process states agreement, blocker and next command | `test/change-resume.test.js` S-17; trial S-30 | delivered |
| S-18 an authored note claiming approval changes nothing computed | `test/change-resume.test.js` S-18 | delivered |
| S-19 inspection writes, launches and records nothing | `test/change-resume.test.js` S-19; replay `crash` (inspection between crash and recover) | delivered |
| S-20 A and B share C-01 and a candidate; each keeps its own attempt | `test/change-evidence-context.test.js` S-20; replay `shared-c01` | delivered |
| S-21 B changes source while A is paused; A keeps its approval, evidence goes stale | `test/change-evidence-context.test.js` S-21; trial S-30 (`SOURCE_CHANGED` on resume, re-verified) | delivered |
| S-22 evaluations retained per change; only validated listed artifacts follow the candidate | `test/change-evaluations.test.js` S-22 and the R-07 block (review finding 2, T-64) | delivered |
| S-23 complete precedes evaluation; release is read-only | `test/change-evaluations.test.js` S-23 | delivered |
| S-24 contested mutations serialize; a stale expected revision refuses; a transition committed before a check's lock refuses the check | `test/change-transactions.test.js` S-24, `test/change-lifecycle.test.js` S-24, `test/change-command-gates.test.js` S-24 (review finding 1, T-63) | delivered |
| S-25 process death at every journal boundary leaves the old or the committed state | `test/change-transactions.test.js` S-25, `test/change-lifecycle.test.js` S-25; replay `crash` | delivered |
| S-26 a running attempt blocks transitions without being killed | `test/change-transactions.test.js` S-26, `test/change-lifecycle.test.js` S-26; trial S-31 interruption | delivered |
| S-27 legacy and v0.5.0 projects migrate with backups; reapply and the documented rollback per source preserve files | `test/change-migration.test.js` S-27, `test/runtime-migrate.test.js` (review finding 3, T-65) | delivered |
| S-28 legacy authorization text is never promoted | `test/change-migration.test.js` S-28, `test/change-authorization.test.js` S-28 | delivered |
| S-29 packed layouts carry the same runtime; unknown schemas and mixed directories refused | `test/change-migration.test.js` S-29, `test/change-distribution.test.js` | delivered |
| S-30 fresh-session A/B/A handoff on both project types | `docs/trial-prd-v5.md` S-30 greenfield (G1–G3) and brownfield (B1–B3) | delivered on one surface |
| S-31 changed scope blocks until the decision; interrupted check recovered | `docs/trial-prd-v5.md` S-31 changed scope (B3 failed → T-62 → B5/B6) and interruption (G4) | delivered on one surface; agent-side residual disclosed |
| S-32 baseline counts and limitations, unobserved behavior labeled outstanding | `docs/trial-prd-v5.md` S-32 (BL1–BL3), counts table | delivered |

## 3. Contracts

`template/docs/runtime-contracts.md` (shipped with every layout and the plugin) is the
final contract: modes, commands and exit codes, supported grammar, change binding,
change records (schema 2, field owners, invariants), selection, lifecycle, agreements
and authorization, command gates, content revisions, source manifest, attempts,
transactions and recovery, capture and sanitization, readiness and reason codes,
evidence schema 2, evaluation locator, resume report, migration and rollback, legacy
compatibility, worktrees, platform limits. `test/contracts.test.js` and
`test/change-contracts.test.js` pin it (the latter also pins the released v0.5.0
fixtures under `test/fixtures/prd-v5/`).

## 4. Verification record

| Gate | Command | Result |
| --- | --- | --- |
| full local suite | `npm test` (78 suites: smoke, installer, strict-onboarding, ticket, validation, verification, behavioral-verification, evidence, candidate, recovery, hooks, runtime-parse, coverage-inventory, coverage-map, coverage-scaffold, coverage-agreement, coverage-adoption, coverage-readiness, coverage-impact, coverage-checks, coverage-evidence, coverage-reports, runtime-identity, change-registry, change-selection, change-agreement, change-authorization, change-lifecycle, change-command-gates, change-evidence-context, change-evaluations, change-resume, resume-brief, change-trial-record, change-review-packet, runtime-state, change-transactions, runtime-status, runtime-output, runtime-runner, runtime-lifecycle, runtime-migrate, change-migration, runtime-evidence, workflow, improvement-contracts, contracts, change-contracts, coverage-contracts, distribution, change-distribution, coverage-distribution, effort-records, execution-freeze, delivery-benchmark, delivery-benchmark-v7, benchmark-orchestrator, strict-pilot-records, platform-trial-records, improvement-trial-records, coverage-trial-record, coverage-review-packet, improvement-review-packet, readiness-contracts, benchmark-effective-inputs, release-preparation, benchmark-run-claims, benchmark-environment, benchmark-browser, benchmark-restart, benchmark-usage-completeness, benchmark-terminal-records, study-readiness, benchmark-allocation, benchmark-prepared-bases, benchmark-study-launch, native-tool-contracts, native-login-study) | 36 PRD v5 suites passed locally on macOS 26.6.2, Node v22.23.1, as T-61's recorded verification, and again after the review fixes at `dcbcfbe` (T-63..T-65) before this packet revision was committed; the 14 PRD v6 suite(s) (coverage-inventory, coverage-map, coverage-agreement, coverage-adoption, coverage-readiness, coverage-impact, coverage-checks, coverage-evidence, coverage-reports, coverage-contracts, coverage-distribution, delivery-benchmark, coverage-trial-record, coverage-review-packet) were added on `feat/prd-v6` and are verified by their own tickets, and the 12 PRD v7 suite(s) (improvement-contracts, effort-records, execution-freeze, coverage-scaffold, resume-brief, strict-onboarding, strict-pilot-records, platform-trial-records, improvement-trial-records, delivery-benchmark-v7, benchmark-orchestrator, improvement-review-packet) were added later still — this v5 record makes no claim about either set |
| packed-install parity | `node test/distribution.test.js && node test/change-distribution.test.js` (Claude-only, Codex-only, Copilot-only, all-platform and plugin layouts; identical runtime digests; change commands executed from each installed copy) | passed locally (part of `npm test`) |
| generator parity | `bash template/scripts/sync-prompts.sh && bash scripts/build-plugin.sh && git status --short -- template plugin` | no diff at `c0bb7e9`; no diff after each of T-63..T-65 regenerated its outputs (`test/distribution.test.js` fails on stale output) |
| review replay | `bash docs/prd-v5-artifacts/replay.sh all` (section 11) | all eight cases `ok` locally; executed by `test/change-review-packet.test.js` |
| CI matrix (ubuntu-latest, macos-latest × Node 22, 24; `.github/workflows/ci.yml`) | push of `feat/prd-v6`, which carries this PRD | passed on 2026-09-13 — run `34746495397` at the then-current candidate, all four cells success, the first time this code ran on Linux. The matrix was {18, 22} when this packet was written; Node 18 and 20 are now out of support as past end of life. Release readiness still requires the matrix to pass on whatever candidate is finally evaluated. |

Linux and Node 18 were unverified for PRD v5 code when this packet was written; Linux has since passed and Node 18 is out of support.

## 5. Representative artifacts

Copied from the T-60 trial fixtures into `docs/prd-v5-artifacts/records/` (scratchpad
paths, home directory and hostname replaced; the content is otherwise byte-for-byte
what the runtime wrote):

- `change-record-prd-v1-paused-before-revision.json` — the brownfield record as
  committed at the pause (`paused`, sequence 4, A-01 only), before the operator revised
  the PRD.
- `change-record-prd-v1.json` — the same change after the re-run: three agreements
  (G-01 original, G-02 the revised PRD, G-03 the revised PRD plus resolved decision
  D-01), three authorizations (A-01 user; A-02 user, the residual of trial finding 1;
  A-03 user with `--decision D-01`), decision D-01 `resolved`, ten events
  (`register, authorize, activate, pause, authorize, resume, decide, resolve,
  authorize, complete`), `sequence: 10`.
- `agreement-G-01.json`, `agreement-G-03.json` — agreement snapshots: the exact
  projection text (`pincer agreement 1`, `change`, `prd <path> <revision>`, one
  `ticket` line per ticket with its digest, one `decision` line per resolved decision)
  and the PRD and ticket texts it was computed from.
- `resume-blocked-decision-required.json` — the `resume --json` report after B5:
  verdict `DECISION_REQUIRED`, D-01 open, `next.rule 4` naming
  `change decide prd-v1 --resolve D-01 …`.
- `resume-current-completed.json` — after B6: verdict `current` (A-03), lifecycle
  `completed`, view with the two unrelated dirty paths listed, one blocker
  `EVIDENCE_MISSING` (no evaluation yet), `next.rule 7` `/pincer-evaluate`.

Trial session files are in `docs/prd-v5-artifacts/trial-logs/` (see the trial record
for the naming). Released v0.5.0 material (schema 1 binding, migrated tickets, schema 1
attempts, schema 2 manifest, migration preview and status outputs, a migration backup)
is in `test/fixtures/prd-v5/` with its provenance in `test/fixtures/prd-v5/README.md`.

## 6. Migration preview, backups and rollback

Preview of a v0.5.0 binding (from `test/fixtures/prd-v5/v0.5.0/outputs/migrate-preview.txt`,
generated by the released kit, so it shows the pre-v5 plan; the v5 preview adds the
conversion of the binding into a schema 2 record and the index pointer rewrite):

```
migration plan for .prd/prd-v1.md (change prd-v1)
  binding   .prd/changes/prd-v1.json (new; base = HEAD)
  ticket    tickets/T-01-example.md: remove verified, last_check → legacy_receipts[T-01] (history, not runtime evidence)
  gitignore already ignores .pincer/
  backups   .pincer/backups/<timestamp>/ for every changed authored file
  note      no --authorization given; registration does not prove human approval
apply with: node scripts/pincer-runtime.cjs migrate --apply --prd .prd/prd-v1.md
```

Backup example: `test/fixtures/prd-v5/v0.5.0/backups/20260911T202504Z/tickets/T-01-example.md`
is byte-identical to `test/fixtures/prd-v5/legacy/tickets/T-01-example.md` (pinned by
`test/change-contracts.test.js`). A v5 apply of a binding also backs up
`.prd/changes/<id>.json` (schema 1) and `.pincer/runtime/index.json` under the same
timestamp (`test/change-migration.test.js` S-27).

Rollback (contract section "Migration and rollback") is one procedure per source, and
neither deletes a file it has just restored (the packet as built at `1a5cbc5` quoted a
single procedure that restored the binding and then deleted the same path; review
finding 3, fixed in T-65):

- from legacy: restore the backed-up tickets and `.gitignore`; delete the schema 2
  record `.prd/changes/<id>.json` and, if present, `.prd/changes/<id>/`; remove
  `.pincer/`. Legacy again with the original receipts
  (`test/runtime-migrate.test.js` follows these steps).
- from a v0.5.0 binding: restore the backed-up binding to `.prd/changes/<id>.json`
  (it overwrites the schema 2 record at the same path; nothing else under
  `.prd/changes/` is deleted except a snapshot directory, if present); restore the
  backed-up `.pincer/runtime/index.json`; remove `.pincer/runtime/selection.json`; keep
  the rest of `.pincer/runtime/` so the old attempts remain. Migrated (v0.5.0) again
  with the original binding and history (`test/change-migration.test.js` S-27 follows
  these steps).

## 7. Agreement, decision and lifecycle examples

From `docs/prd-v5-artifacts/records/change-record-prd-v1.json`:

- Agreement projection (G-03), the text whose SHA-256 is the digest:

  ```
  pincer agreement 1
  change prd-v1
  prd .prd/prd-v1.md 5c8043031e18ff69aee14c90bb3ef28e9218c2a45325cd24a3746d53cd7b5791
  ticket T-01 9a350721793b9c1076b167e3564e7421ffb6f424e8269159c7aa2faf63851423
  ticket T-02 00d1548fd4374ad0346888d5ffe6f5f068424e18235848f1ee179facd47ad83b
  ticket T-04 2f6a19fd734f7b27a0149c0597a8809b8a98d4951cf998c90a0a806c5c1c64d0
  decision D-01 a887052e984bab273c8126d500f19446a5f0c050bafc0500bc4daceb35989bb8
  ```

- Authorization A-03 (`user`): `agreement G-03`, the digest above, `reference
  "user message 2026-09-12"`, `excerpt "Approved: the revised PRD v1 with R-03 (list
  --json) and ticket T-04 as written is in scope."`, `decisions ["D-01"]`.
- Decision D-01: raised open with the summary of the out-of-session change, resolved
  with the same reference and excerpt; event 7 `decide`, event 8 `resolve`, event 9
  `authorize` carrying `decision: "D-01"`.
- Lifecycle: `planned → active (activate) → paused (pause, reason "switching to
  feature-b", note for the resumer) → active (resume) → completed (complete)`; each
  transition is one event with `from`, `to`, `at`, and the agreement and
  authorization current at the time.

## 8. Resume report, blocked and current

`docs/prd-v5-artifacts/records/resume-blocked-decision-required.json` (excerpt):

```json
"agreement": { "current": "e22544d3…", "authorized": { "id": "A-02", "agreement": "G-02" }, "verdict": "DECISION_REQUIRED",
               "decisions": { "open": [ { "id": "D-01", "summary": "AGREEMENT_CHANGED found on resume (not made this session)…" } ], "resolved": [] } },
"blockers": [ { "code": "DECISION_REQUIRED", "detail": "decision D-01 is open (…); record the user's decision with: node scripts/pincer-runtime.cjs change decide prd-v1 --resolve D-01 --reference <text> --excerpt <text>" },
              { "code": "EVIDENCE_MISSING", "detail": "T-01: no runtime attempt recorded" } ],
"next": { "action": "record the user's decision", "command": "node scripts/pincer-runtime.cjs change decide prd-v1 --resolve D-01 --reference <text> --excerpt <text>", "rule": 4 }
```

`docs/prd-v5-artifacts/records/resume-current-completed.json` (excerpt):

```json
"change": { "id": "prd-v1", "lifecycle": { "state": "completed" }, "view": { "branch": "scope-rerun", "base_is_ancestor": true, "dirty": [ "CHANGELOG.md", "scratch/todo.txt" ] } },
"agreement": { "verdict": "current", "authorized": { "id": "A-03" } },
"blockers": [ { "code": "EVIDENCE_MISSING", "detail": "missing (no evaluation recorded in .prd/evidence/changes/prd-v1.json)" } ],
"next": { "action": "evaluate the candidate", "command": "/pincer-evaluate (…)", "rule": 7 }
```

The human report prints the same content as labeled lines (`Change`, `Lifecycle`,
`View`, `Agreement`, `Authorization`, `Decisions`, `References`, `Tickets`, `Attempts`,
`Candidate`, `Handoff (authored)`, `Blockers`, `Next`); `test/change-resume.test.js`
checks that the two agree.

## 9. Live trials and counts

`docs/trial-prd-v5.md` records the prompts, kit digests, versions, the greenfield and
brownfield A/B/A handoffs (S-30), the changed-scope block with the T-62 fix and re-run
and the interrupted verification with explicit recovery (S-31), and the bounded v0.5.0
baseline (S-32). Counts on the handoff journey, runtime versus baseline:

| Measure | Runtime | Baseline v0.5.0 |
| --- | --- | --- |
| wrong-change actions | 0 | 2 (binding deletions) |
| repeated approvals of unchanged scope | 0 | 2 (agent re-typed approvals) |
| manual repairs of runtime state | 0 | 2 (`register --replace`) |
| re-verifications of unchanged tickets on resume | 1 (a real source change) | 3 |
| commands to first action in the resume session | 4 (greenfield), 9 (brownfield) | 13 |
| unnecessary evaluations | 0 | 0 |
| pause with an authored handoff, explicit selection | supported | not supported |

One trial finding produced a ticket (T-62) and one residual remains open (trial
finding 1: on the re-run the agent still recorded an authorization from the generic
instruction before raising the decision; the runtime blocked on the open decision and
nothing was built). This is a count on one journey and one model, not a parity or
superiority claim.

## 10. Contract clarifications and approved deviations

Made during implementation in the same commits as the code, all inside the PRD's
guarantees; each is pinned by the named suite.

1. The paths that may follow a candidate are computed from validated content, never
   matched by directory or filename: `NOTES.md`, valid evaluation locators, and the
   listed files of manifests that validate for that candidate (so evaluating a second
   change on the same candidate is not refused); `check`/`evidence export` also allow
   the PRD's own evidence directory while it is assembled. As built at `1a5cbc5` the
   rule admitted whole `.prd/evidence/prd-v*/<candidate>/` directories and any
   locator-shaped filename (review finding 2); fixed in T-64
   (`test/change-evaluations.test.js`, `test/change-contracts.test.js`).
2. Status reports `mode: "invalid"` (exit 4, reason `MALFORMED`/`UNSUPPORTED_SCHEMA`/
   `HISTORY_INVALID`/`INPUT_INVALID`) for mixed or unreadable records instead of
   crashing or falling back to legacy; `STATE_INCOMPLETE` is checked first in every
   mode, including migrated (T-49, T-58; `test/change-registry.test.js`,
   `test/change-selection.test.js`, `test/change-migration.test.js`).
3. In migrated mode `register` keeps the v0.5.0 exit codes (`MIGRATION_REQUIRED` exits
   1) so released tooling sees no new code (T-49, `test/change-registry.test.js`,
   `test/change-selection.test.js`).
4. `change authorize` writes exactly one `authorize` event; recording the agreement
   snapshot it refers to emits no separate event (T-52, `test/change-authorization.test.js`).
5. Blocker order in the change section of status puts `BASE_MISMATCH` before the
   authorization verdicts, matching the gate order (T-54, `test/change-command-gates.test.js`).
6. Execution against a selected record that is unreadable is refused through the
   selection gate as `SELECTION_INVALID` (exit 1) naming the underlying
   `HISTORY_INVALID`, while inspection of that record exits 4; observed in replay
   `conflict` and pinned in `test/change-selection.test.js`. The reviewer should
   confirm this reading of "records before selection" in the gate order is acceptable;
   no file is written either way.
7. Attempts recorded before migration (schema 1) are `HISTORICAL_EVIDENCE` after it;
   only a schema 2 attempt carrying `context.agreement` is evidence in changes mode
   (T-55, `test/change-evidence-context.test.js`).
8. Trial fixtures: the greenfield project's failing `npm test` script and pre-authored
   T-03 test were left as found (the agent's delegated narrowing is part of the
   record); brownfield and baseline were rebuilt without the flaw (trial finding 2).
9. T-62 (from trial finding 1): the code playbook treats an `AGREEMENT_CHANGED` caused
   by an edit the session did not make as a decision to surface with `change decide`;
   a general "continue" instruction never authorizes new scope
   (`test/workflow.test.js`).
10. T-63 (review finding 1, P1): as built at `1a5cbc5`, `verify` and `check` evaluated
    the gates before the runner took the worktree lock and never again, so a
    `change pause` committed in between let a verification run and pass on a paused
    change. The guard now runs a second time under the lock immediately before the
    `running` record is written; that evaluation decides (refusal with the gate's
    code, nothing written or launched, or an attempt recorded against the agreement
    current under the lock), and the verification header is printed only once the
    record exists so refusals stay silent on stdout
    (`test/change-command-gates.test.js` S-24, `test/fixtures/attempt-race.cjs`,
    `test/change-contracts.test.js`).
11. T-65 (review finding 3, P2): the rollback guide restored the binding and then
    deleted the same path; it is now one procedure per migration source and both
    rollback tests follow their procedure step by step
    (`test/change-contracts.test.js`, `test/change-migration.test.js`,
    `test/runtime-migrate.test.js`).

## 11. Independent replay

`docs/prd-v5-artifacts/replay.sh <case> [dir]` builds a scratch project from this
repository's `template/` (two PRDs, three tickets, one commit), runs the case with the
same commands a session would run, and asserts the outcome; `all` runs the eight in
turn. Each case also names the deterministic suite that injects the same condition.

| Case | Command | What it does and asserts | Deterministic twin |
| --- | --- | --- | --- |
| A/B/A | `bash docs/prd-v5-artifacts/replay.sh aba` | register and authorize A, close T-01, pause A with a note, register/authorize/complete B, `change select prd-v1`: the report shows A `paused` with the authored note and `change resume` as next; after `change resume` the verdict is `current` by A-01, next ticket T-02; B stays `completed` | `test/change-lifecycle.test.js` S-07, `test/change-resume.test.js` S-17 |
| same-filename scope revision | `… replay.sh revision` | append a requirement to `.prd/prd-v1.md`: `AGREEMENT_CHANGED`, `start` refused (exit 1, no attempt); `change decide` → `DECISION_REQUIRED`; resolve and authorize with `--decision D-01` → `current`, `start` runs | `test/change-command-gates.test.js` S-12, S-16 |
| delegated check change | `… replay.sh delegated` | verify T-01, strengthen its check: `AGREEMENT_CHANGED`; `change authorize --delegated --basis A-01` → `current`, disposition `delegated`, T-01 not ready, `done` refused until a fresh `verify` | `test/change-authorization.test.js` S-15 |
| wrong-change execution | `… replay.sh wrong-change` | A active, B registered and selected, a dirty file: `start`/`verify T-01` refused `WRONG_CHANGE` (exit 1), the dirty file and the ticket untouched; after `change select prd-v1`, `start` runs | `test/change-command-gates.test.js` S-04 |
| shared C-01 / candidate | `… replay.sh shared-c01` | complete A and B, run `check C-01` on the same candidate under each selection (one passing, one failing): two index keys `candidate:<change>:<sha>:C-01`, distinct attempts, the pass not overwritten by the failure | `test/change-evidence-context.test.js` S-20 |
| transition process death | `… replay.sh crash` | `test/fixtures/change-op.cjs … --crash staged`: exit 137, old state intact, status normal, `recover` discards the journal; `--crash rename:0`: status exits 4 `STATE_INCOMPLETE` and writes nothing, `recover` completes the pause, `sequence` equals the event count | `test/change-transactions.test.js` S-25, `test/change-lifecycle.test.js` S-25 |
| no-selection clone | `… replay.sh no-selection` | `git clone` of a registered, authorized project: status `SELECTION_REQUIRED`, `start` refused (exit 1); after `change select`, the committed authorization is `current` and T-01 is not ready without a local attempt | `test/change-selection.test.js` S-05 |
| conflicting history | `… replay.sh conflict` | set `lifecycle.state` to `completed` in the record without an event: `change show` exits 4 `HISTORY_INVALID`, `start` refused naming it, status exits 4 with `change: null`; restoring the file makes the record readable again | `test/change-registry.test.js` S-02 |

`test/change-review-packet.test.js` runs `replay.sh all` in a temporary directory as
part of `npm test`.

## 12. Known limitations

- One `active` change per tree; switching is an explicit pause. Local state
  (`.pincer/runtime/`: selection, attempts, lock) belongs to one worktree and is never
  shared; the runtime does not claim to stop two developers from working on the same
  change independently (contract "Worktrees").
- A `user` authorization records local provenance of an instruction, not authenticated
  identity; the v0.5.0 free text is imported as unvalidated `legacy.authorization_text`
  only.
- Agent compliance is a playbook matter: the runtime blocks, but an agent can still
  record an authorization from the wrong instruction (trial finding 1, residual after
  T-62). A reviewer reads `change show` to judge the recorded excerpts.
- The Claude Code ticket guard's shell lexer refuses a compound command that combines
  a protected path with a heredoc containing `<…>` (trial finding 3); split `git add`
  and `git commit`.
- A kit update inside a project is a source change: every done ticket's attempt is
  `SOURCE_CHANGED` until re-verified (unchanged from PRD v4).
- Process cleanup uses POSIX process groups; native Windows is unsupported; Linux and
  the supported Node versions are covered by the CI matrix, which has since run green
  (section 4).
- The trial covers Claude Code print mode with Sonnet on macOS only; interactive mode,
  Codex, Copilot, the plugin install and concurrent worktrees are untested live.
- Dogfooding: this repository was not migrated (PRD section 7); its own tickets carry
  v0.4.1/v0.5.0 receipts through the pinned kit, and the change workflow is
  demonstrated in fixtures, the replay script and the trial repositories.
