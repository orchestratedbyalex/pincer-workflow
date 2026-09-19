# PRD v8 current state and v7 obligation overlay

Snapshot reviewed 2026-09-19: `c7cb6bc9906ecd418e9edddfc08d3bdd353f8aab`.
This is the pre-T-100 implementation baseline, not the eventual v8 candidate or a
claim about future HEAD. Sources: [readiness assessment](pincer-readiness-2026-09-15.md),
[historical v7 packet](prd-v7-review-packet.md), [v8 ticket map](prd-v8-ticket-map.md).
The old packet remains a dated record; this overlay corrects its current interpretation.

## Current account

- Registry: `npm view pincer-workflow version` returned **0.6.0 on 2026-09-19**.
  The reviewed checkout's package metadata also says **0.6.0**, but main contains
  scaffold/brief and runner changes beyond released tag `v0.6.0` (`694241c`).
  Implemented on main does not mean published to npm.
- Historical NOTES/evidence candidate: `ce98abdbc6edd4e8d4f5736fee35dd765b930452`,
  selected PRD `.prd/prd-v6.md`, manifest
  `.prd/evidence/prd-v6/ce98abdbc6edd4e8d4f5736fee35dd765b930452/manifest.json`.
  That evidence is stale for current source. No v7/v8 evaluated candidate is claimed.
- At the reviewed baseline, v7 done: T-87, T-88, T-94, T-98, T-99. V7 open:
  **T-89, T-90, T-91, T-92, T-93, T-95, T-96, T-97**. Implementation in an open
  ticket is not a lifecycle receipt. All T-100–T-119 were open at that baseline;
  T-100 is now being implemented. Current ticket files govern subsequent lifecycle.
- The 2026-09-15 readiness assessment records four CI jobs passing on `380555449df504e9a1b6a44a2df3624710600ccf`.
  This is historical CI, not a test result for the v8 candidate. Read the current
  `package.json` chain for suite inventory; no historical suite count defines coverage.
- No carried live pilots, strict platform journey/handoff, 72-cell comparison or
  independent timed reviews have completion evidence in this snapshot. Installed
  Claude Code/Codex/Copilot/plugin artifacts and fixture parity establish installation
  only. Live strict support remains unobserved; no Copilot/plugin/Windows live-support
  expansion is claimed. Earlier bounded Claude sessions remain their own observations.
- Management stays legacy with an independent pinned released kit outside this tree.
  Existing user guide/diagram work is not absorbed by this contract. No access,
  spending, human-review identity, merge, publication or live migration is inferred.

## Complete v7 scenario carry-forward

Every scenario has an explicit successor owner below, including mechanical work that
only needs preservation/review. “Preserve” records the old packet's mechanical evidence,
not a new behavioral observation or unconditional endorsement. Owners provide the
missing work and T-119 assembles the final disposition. Old lifecycle fields stay intact.

| V7 scenario | V7 ticket | V8 owner | Current disposition / evidence needed |
| --- | --- | --- | --- |
| S-01 | T-87 | T-100 | Preserve protocol; current contracts and outstanding decisions explicit |
| S-02 | T-87 | T-100 | Preserve matrix and counterexamples; no weaker gates |
| S-03 | T-87 | T-100 | Current reconciliation overlay; immutable v6 evidence |
| S-04 | T-88 | T-105 | Preserve event/interval semantics; complete repeated-attempt usage |
| S-05 | T-88 | T-106 | Repair terminal records; actual output-to-validator cases |
| S-06 | T-88 | T-101 | Effective-input provenance repair, T-102 isolation support |
| S-07 | T-89 | T-110 | Outstanding: three real K0/K1 project pairs |
| S-08 | T-89 | T-110 | Outstanding: retained real stages, failures and interventions |
| S-09 | T-89 | T-100 | Historical temporal deviation; proposed disposition below, T-119 records decision |
| S-10 | T-90 | T-112 | Preserve implemented scaffold inventory behavior |
| S-11 | T-90 | T-112 | Preserve scaffold invalid-input refusal and no writes |
| S-12 | T-90 | T-112 | Preserve draft rejection and reviewed adoption boundaries |
| S-13 | T-91 | T-113 | Preserve implemented brief/full next-action equivalence |
| S-14 | T-91 | T-113 | Preserve complete brief references and read-only behavior |
| S-15 | T-91 | T-111 | Mechanical evidence exists; fresh-session use outstanding |
| S-16 | T-92 | T-113 | Preserve packed first-use walkthrough; benefit unmeasured |
| S-17 | T-92 | T-111 | CLI mechanical evidence exists; actual agent behavior outstanding |
| S-18 | T-92 | T-113 | Preserve onboarding order and support distinctions |
| S-19 | T-93 | T-111 | Outstanding: both exact-version strict platform journeys |
| S-20 | T-93 | T-111 | Outstanding: Claude-to-Codex file-only handoff |
| S-21 | T-93 | T-111 | Matrix exists; observed support requires real retained stages |
| S-22 | T-94 | T-107 | Preserve controls; supply actual browser, retain fault limitations |
| S-23 | T-94 | T-115 | Account 72 scheduled cells; T-101/T-102 pin actual equal inputs |
| S-24 | T-94 | T-101 | Distinct effective cohorts; T-103–T-106 retain attempts/usage |
| S-25 | T-95 | T-115 | Outstanding: one 72-cell obligation; paired pilots T-110/T-114 |
| S-26 | T-95 | T-116 | Outstanding: two independent human reviewers, real timed records |
| S-27 | T-95 | T-114 | Outstanding: targets reported met/missed; T-116 review target |
| S-28 | T-96 | T-119 | Existing packet mechanical references; assemble actual dispositions |
| S-29 | T-96 | T-119 | Historical CI is not current candidate CI; require full matrix |
| S-30 | T-96 | T-119 | T-108 preparation then candidate/evaluation/read-only audit |

T-97's mode-aware revision remedy is implemented but dependency-blocked: T-113 owns
preservation and T-110 observations inform disposition. T-98/T-99 remain historical
done receipts; new findings are owned by T-101 (F-01), T-102 (isolation), T-103
(exclusive claim), T-104 (F-02), T-105 (F-03), T-106 (terminal paths) and T-107
(real browser). These later repairs do not change what earlier receipts proved.

### S-09 temporal obligation and proposed historical disposition

V7 required pilot findings before T-90/T-91 optimization. The packet called S-09
“delivered (mechanical + judgment)” based on operator-driven command/byte measurements.
Those measurements are not the required agent pilots. The original temporal obligation
is **unsatisfied**: later pilots cannot retroactively make observations precede code.
Proposed disposition: retain the old implementation and receipts, record a build-order
deviation, and assess its benefit through genuinely later K0/K1 pilots. This proposal
is **not a recorded user decision**, waiver or permission to close old tickets.
T-119 must link any actual scope decision; until then the temporal exception remains
unresolved. T-110 must precede the new T-112/T-113 usability work, or a separately
recorded scope revision is required. No fixture may settle an observation criterion.

K0 is released v0.6.0; K1 is a pinned/evaluated pre-v8-usability kit; K2 follows the new
usability work. Three K0/K1 pairs (T-110) and three K1/K2 pairs (T-114) answer different
questions. Reuse requires predeclared equivalence/exposure rules and stage references.
T-115 continues 8 × 3 × 3 = 72 cells, not another 72. T-118's separately authorized
27-cell alternatives study and T-109's operational smoke cannot replace missing cells.
Missing access/caps/reviewers leaves live work unfinished, while offline work can proceed.

## Secondary findings: evidence-based dispositions

These are triage decisions within T-100, not assertions of fixes. A reproduced product
defect needs a linked fix ticket before implementation; none is silently added to v8 scope.

| Finding | Evidence and confidence | Disposition | Follow-up owner / reopening condition |
| --- | --- | --- | --- |
| Runtime stale-lock race | `docs/wiki/open-threads.md` records unsuccessful 20×8 and 25×32 concurrency probes; `template/scripts/pincer-runtime/state.cjs` has rename/recheck reclaim logic. Readiness calls the race unproven. | Defer speculative fix; not reproduced by the recorded probes, not proof of absence. Study claims T-103 are a different lock. | T-119 carries the unresolved risk; require a deterministic interleaving reproduction and linked fix ticket before modifying installed locking. |
| Hook heredoc false positive | `docs/wiki/open-threads.md` records a compound git-add/git-commit heredoc with an email-like angle bracket refused as a redirect near a protected path; T-81 fixed the real redirection hole, not this report. No fresh reproduction is claimed here. | Defer repair pending a minimal retained hook input/output; separate add/commit is the documented workaround, not a bypass or fix claim. | T-113 checks whether the supported journey encounters it; if reproduced, open a linked fix ticket preserving malicious-redirection refusal; T-119 retains disposition. |
| Obsolete installed-file cleanup | `docs/wiki/open-threads.md` records old `pincer-ticket-lib.sh` surviving update; absence from current template does not prove safe deletion of user-edited old copies. | Defer deletion policy and fix; reproduce a packed old-to-new update with unchanged and user-edited copies first. Preserve user work. | T-113 installation/update review owns reproduction decision; linked fix ticket required for cleanup, T-119 reports any remaining limitation. |

The static suite checks complete owners and dispositions plus references. It does not
reproduce these secondary reports. No new installed-runtime bypass or live success is
asserted. T-119 must distinguish a released subset with explicit scope disposition from
completion of all required observations in this programme.
