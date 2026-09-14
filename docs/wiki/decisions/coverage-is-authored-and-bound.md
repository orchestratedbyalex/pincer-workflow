# Coverage is authored and bound

**Decided 2026-09-12 (PRD v6, T-66..T-69).** How a change knows what it must cover, and
what stops that set from drifting.

## What was decided

1. **The PRD's own prose is the inventory.** A `##`..`####` heading `R-NN — Title` and
   bold `- **S-NN:** text` items under it are the definitions; everything else — prose
   mentions, tables, fenced examples, the Out of Scope list — defines nothing. There is
   no second file listing requirements.
2. **One authored map, `.prd/coverage/<change>.json`.** It holds the links (scenario →
   tickets and checks), the scope dispositions, the ticket roles and the full declaration
   of every candidate check. Humans edit exactly this file; everything else about coverage
   is computed from it.
3. **Both live inside the agreement digest.** The projection gained `inventory` and
   `coverage` lines, so editing a link, a scenario's text, a check's command or a
   disposition invalidates the authorization and has to be re-approved.
4. **Structure is computed; meaning is judged.** The runtime reports whether every
   in-scope scenario is linked and every disposition authorized. Whether a check actually
   establishes its scenario is the reviewer's `adequacy` verdict, recorded in the evidence
   manifest and never inferred.
5. **Adoption is explicit per change.** `coverage adopt --apply` is the only entry, it
   takes a backup, and it grants no authorization.

## Why

The failure this prevents is a requirement quietly leaving the set: deleted from the PRD,
dropped from a map, or "covered" by a check that was swapped for an easier one after the
fact. Deriving the inventory from the PRD means the obligation cannot be edited anywhere
else; binding it into the agreement means it cannot be edited without asking; making the
check declaration part of that same digest means a substituted command is a new agreement,
not a silent substitution. Deferring or removing a scenario needs a resolved decision *and*
an authorization naming that decision, because a generic "continue" is not approval of
revised scope — a point the live runs in [[delivery-benchmark]] tested on real sessions.

## Alternatives rejected

- **A separate requirements file.** Two sources drift, and the PRD stops being the thing
  reviewers read. Rejected: parse the PRD, refuse ambiguity loudly.
- **Inferring links from ticket prose** (`Implements: S-01`). Prose is a navigation aid;
  it cannot be validated, and a typo becomes silent non-coverage. The map is the only
  machine-readable authority.
- **Scoring coverage.** A percentage invites treating 90% as fine. Coverage is complete or
  it names what is missing.
- **Migrating every project.** Strict coverage would have broken existing records and
  evidence. Opt-in per change, with old runtimes refusing the new schemas outright rather
  than misreading them.
- **Letting the runtime judge adequacy.** It cannot. Pretending otherwise would turn a
  structural check into false assurance, which is worse than no check.

Implementation and gotchas: [[strict-coverage]]. Sits on [[explicit-change-lifecycle]];
the evidence side is [[candidate-evidence]] and [[evidence-validator]].
