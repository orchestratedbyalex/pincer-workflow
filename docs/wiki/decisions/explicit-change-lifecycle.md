# Explicit change lifecycle, agreements and authorization (PRD v5)

**Decided 2026-09-11/12 on `feat/prd-v5` (T-47..T-62).** See [[runtime]] for the
modules and [[runtime-owned-verification]] for the PRD v4 base it extends.

## What was decided

- **Every change is a retained record** (`.prd/changes/<id>.json`, schema 2): identity
  (`prd`, `base`, `registered`), agreements `G-NN`, authorizations `A-NN`, decisions
  `D-NN`, lifecycle events, evaluation references. The projection is replayed from the
  events; a disagreement is `HISTORY_INVALID`, never repaired silently. v0.5.0's single
  binding and `register --replace` are refused in migrated mode (`MIGRATION_REQUIRED`).
- **Selection is explicit and local** (`.pincer/runtime/selection.json` per worktree):
  a fresh clone requires `change select` even with one record; nothing is inferred from
  a branch, the newest PRD or the only record. Selecting is metadata only and grants no
  authorization.
- **An agreement is an exact text** (`pincer agreement 1` + PRD revision + one line per
  ticket digest + one per resolved decision), hashed; snapshots are stored and
  re-verified on load. Ticks, ticket state, attempts and source edits never change it;
  editing the PRD or a ticket's text does.
- **Authorization is the user's actual instruction against a digest** (`user`:
  reference + excerpt; `delegated`: `--basis A-NN` + explanation, for check
  improvements only). Verdict order `DECISION_REQUIRED → AUTHORIZATION_REQUIRED →
  AGREEMENT_CHANGED → current`. v0.5.0 free text is imported as unvalidated
  `legacy.authorization_text`. A general "continue" instruction never authorizes new
  scope; an out-of-session agreement change is raised as a decision (T-62).
- **One active change per tree**; pause/resume/complete/reopen/cancel/supersede are
  single journaled transactions (lock, staging, `manifest.json` commit point,
  `recover`). Completed means ready for evaluation, not released.
- **Evidence is change-scoped**: attempt schema 2 carries `context.agreement`; candidate
  keys are `candidate:<change>:<sha>:<C-NN>`; evaluations are retained per change in
  `.prd/evidence/changes/<id>.json`.
- **`resume` is the handoff**: one computed next action (rules 1–8); authored pause
  notes are displayed, labeled, never inputs.

## Alternatives rejected

- Inferring the change from the branch name or the highest PRD (silent wrong-change
  execution in the v0.5.0 baseline trial: two binding deletions and two re-typed
  approvals on one A/B/A journey).
- Treating a PRD status flip, a passing check or registration as approval.
- Letting the runtime kill a running attempt to allow a transition (it refuses with
  `ATTEMPT_RUNNING` instead).
- Migrating this repository during implementation (it stays legacy; the pinned v0.5.0
  kit drives its tickets).

## Evidence

`docs/prd-v5-review-packet.md`, `docs/trial-prd-v5.md`, `docs/prd-v5-artifacts/`.
