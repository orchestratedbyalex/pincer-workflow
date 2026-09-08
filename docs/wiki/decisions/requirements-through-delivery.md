# Requirements carry through delivery; verification proves behavior; one approval rule

**Decided:** 2026-09-08, PRD v2 (R-01, R-02, R-05, R-06), tickets T-11, T-12, T-16, T-17.

## What

- **Requirement IDs.** The PRD template has a core `Requirements` section (`#### R-NN`
  with Scenario / Failure path / Preserve lines); IDs are assigned once and never
  renumbered. A supplied PRD keeps its meaning and IDs, with a `Requirement mapping`
  table when adapted. Narrow presents a requirement map (requirement · scenario ·
  ticket · check) and each ticket's Context says `Implements: R-NN`. Evaluate
  dispositions every ID as delivered / blocked / deferred; blocked blocks PASS;
  deferred needs recorded user authorization and re-evaluation.
- **Behavioral verification.** Each Verification section opens with `Proves:`. A check
  must fail when the behavior is wrong, not only when an identifier is renamed; a
  build, syntax check or grep alone is not proof; static assertions are primary
  evidence only for static contracts. Adequacy is never judged by word-matching
  (`grep`, `test`, runner names). Unavailable tools yield `unverified`, never
  fabricated evidence. `test/behavioral-verification.test.js` is the acceptance set:
  three controlled faults with identifiers retained, each in a fresh fixture.
- **Profile.** `profile: small | standard` in PRD frontmatter, validated by
  `validate_prd` (anything else is rejected), missing means standard, printed on the
  status PRD line. Small = bounded scope, low risk, known behavior, easy verification;
  few lines alone do not qualify. No hard ticket cap, no default timebox.
- **One authorization rule.** An identical `## Authorization rule` block sits at the end
  of plan, narrow, code and evaluate; `test/workflow.test.js` asserts byte equality.
- **Recovery.** Raw `git checkout`/`restore` of ticket paths stays blocked; failed
  verify says the failure was recorded and the prior receipt revoked; status prints
  each readiness problem once; the wall-clock elapsed line shows only with a ticket in
  progress or an explicit budget.

## Why

Dry-run findings 1, 3, 4 and 5–8: identifier greps passed while features were broken,
plan and narrow applied opposite approval rules, 115-line PRDs for CSS tweaks, and
misleading or duplicated status output. The improvement plan puts full traceability and
authenticated approval in M1/M2; this is the bounded bridge.

## Rejected

- A runtime check that inspects Verification commands for keywords (explicitly
  forbidden by R-02).
- A one-to-two-ticket cap for small PRDs.
- Allowing `git checkout` of ticket files when the target is HEAD: it revives an old
  passing receipt over a newer failure.

## Limits

Wording tests protect adapter contracts only; agent behavior is observed in trials
(`docs/trial-*.md`). Mapping completeness is a recorded reviewer judgment, not a
mechanical engine ([[candidate-evidence]], [[ticket-state-machine]]).
