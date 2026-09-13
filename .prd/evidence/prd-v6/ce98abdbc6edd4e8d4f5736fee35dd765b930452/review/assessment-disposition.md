# Disposition of the 13 September assessment

`docs/pincer-assessment-2026-09-13.md` is an external technical and product assessment
of `feat/prd-v6`, received 2026-09-13 and committed to this branch unmodified. It
raised three reproduced findings. Each was independently reproduced during this
evaluation rather than accepted, and two of the three verdicts differ from the
assessment's own.

## F-01 — piped output truncates while exiting 0 — ACCEPTED, and widened

Confirmed and larger than reported. The assessment scoped the loss to "not confined to
unsupported Node 18/20" and measured 65,536 bytes delivered on Node 22.23.1. It
reproduces identically on Node 24.21.0 — the current Active LTS and the other half of
the CI matrix — and the boundary is the pipe buffer rather than any Node version:
65,536 bytes arrive and 65,537 do not, on 18, 20, 22 and 24 alike.

The candidate's own framing was therefore wrong in a way the assessment did not reach:
commit `5b0358b` diagnosed the macOS x Node 18 CI failure as a Node defect, raised
`engines` to >=22 and dropped Node 18 from the matrix on that basis. The original CI
failure was `SyntaxError: Unexpected end of JSON input` in `coverage-agreement` reading
a truncated `change show --json` — this defect, not a version defect. At 14,334 bytes
the macOS pipe buffer starts at 8 KiB and grows, which is why Node 18 truncated where
22 did not on that one sample; it proves nothing about either version.

Fixed in T-79. The floor and the {22, 24} matrix are kept, justified by end of life.

## F-02 — `impact` does not propagate a requirement-body edit — REFUTED as a defect

The behaviour reproduces exactly as described, and is correct by design. The contract
frozen in T-66 (`98235f6`), before the T-71 implementation, already defines `affected`
as scenario-derived; `test/coverage-impact.test.js:84` asserts it verbatim; and PRD v6
R-04's own freshness clause is the compensating control, which R-04 states is not the
`affected` set's job.

"Propagates to nothing" is also false at the system level. The same edit was run in a
fixture: it changes the agreement digest, flips authorization to `AGREEMENT_CHANGED`,
refuses `verify` and `change complete` with real exit 1, and leaves the linked ticket
`REVISION_CHANGED`/`SOURCE_CHANGED` even after re-authorization.

No ticket. The assessment is left as written; this is the record of why.

## F-03 — `coverage` recommends execution on a paused change — ACCEPTED, and widened

Confirmed, and one state became six. `phases.nextAction` tested implementation problems
before lifecycle state, so the lifecycle branch was unreachable whenever work was
unfinished — exactly when it mattered. Beyond the reported paused case: planned,
cancelled and superseded changes were routed to execution, which PRD v5 R-06 forbids
explicitly ("Historical changes route to inspection or a replacement change, never to
execution"); a cancelled change with a resolved cancel decision was routed to
`change authorize`, which is itself refused, so the report never converged; a running
attempt was ignored, and following the report started a second concurrent verification.

Fixed in T-80, by making the precedence exist once rather than twice.

## The assessment's other observations

The maintainability point about duplicated next-action logic is the same defect as F-03
and is addressed by the shared `routing.cjs`. The observation that the benchmark's
`evidence-binding` helper is laxer than the runtime's listed-artifact rule was confirmed
independently and is recorded as a limitation of that helper, not fixed: it is a
benchmark check, not a release gate.
