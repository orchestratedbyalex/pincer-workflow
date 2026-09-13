# Pincer assessment — 13 September 2026

Pincer has a credible engineering foundation and an increasingly clear product
purpose: preserve the agreement, show current evidence and make unfinished work
visible across sessions. It is ready for a focused reliability and usability phase.
I would fix the three reproduced issues below before signing off the current v6
candidate, then prioritize real strict-coverage use, lower overhead and observed
agent handoffs. Best-in-class delivery performance is not established by the data.

This assessment reviewed `feat/prd-v6` at `5b0358b` (package version still 0.5.0,
Node requirement now >=22). It is a technical/product assessment, not a formal
`/pincer-evaluate` result or a release authorization. No runtime code was changed.

## What was checked

- Current PRDs, ticket/review history, README, wiki, v6 trial report and benchmark
  protocol/evaluator implementation.
- Load-bearing inventory, coverage, disposition, impact, phase/readiness, check and
  CLI code, with their tests; installer and generated workflow instructions.
- The full `npm test` chain: **50 suites passed locally on Node v22.23.1/macOS**,
  including packed parity, both review replays, adoption, failure injection and
  benchmark/record validation. No new paid agent benchmark was run.
- [GitHub Actions run 34746497459](https://github.com/orchestratedbyalex/pincer-workflow/actions/runs/34746497459):
  all four jobs passed on this exact SHA (Ubuntu/macOS × Node 22/24). A second run
  also succeeded. The wiki's “CI not run” and Node 18 matrix notes are stale.
- Independently counted the 42 saved benchmark records: 36 valid runs, 18 per arm,
  17 accepted per arm. Recomputed totals from the records rather than relying only
  on narrative summaries.
- Three targeted failure reproductions beyond existing suite coverage.

This is not an exhaustive security audit, external user study or validation of
unobserved platforms. CI confirms its tested cases; the additional reproductions
show why it does not establish every product guarantee.

## Engineering strengths

**A real runtime under the playbooks.** Selection, lifecycle, authorization,
readiness and evidence have explicit representations. The shared transactional
writer, retained history and attempt lock provide a sound basis for reliable
continuation. T-63's revalidation, T-64's listed artifact policy and T-65's split
rollback procedures addressed substantive v5 review findings.

**V6 strengthens the central promise.** The PRD supplies the expected inventory;
the authored map binds work/check declarations to scenarios; strict check execution
uses declared commands; schema 3 evidence derives dispositions and reconciles them
with the candidate. This is materially stronger than accepting an agent-written
list of delivered requirements. Structural coverage and semantic adequacy are
correctly treated as different claims.

**Preservation and compatibility receive serious attention.** Explicit adoption,
backups, schema rejection, old-mode fixtures, worktree-local state and preservation
of unrelated edits are essential for brownfield adoption. Generated platform
adapters and packed-install tests reduce distribution drift.

**The project records inconvenient results.** Failed and invalid benchmark runs
were retained; the cost disadvantage and lack of acceptance advantage are explicit.
That practice is useful for deciding what to build next.

## Reproduced issues before candidate sign-off

### F-01 — P1: supported Node still truncates successful JSON output

Location: [pincer-runtime.cjs](../template/scripts/pincer-runtime.cjs), lines
594–599, with the same write-then-exit pattern in other report commands.

On Node v22.23.1, running `node template/scripts/pincer-runtime.cjs snapshot --json`
against the reviewed repository produced:

| Output destination | Bytes received | Valid JSON | Exit |
| --- | ---: | --- | ---: |
| Regular file | 237,472 | yes | 0 |
| Pipe consumed by Python `subprocess.communicate()` | 65,536 | no | 0 |

This is not confined to unsupported Node 18/20. The CLI calls `process.exit()`
immediately after an asynchronous stdout write. The minimum-version change only
made the previously observed sample small enough to pass. It does not guarantee
complete reports for larger projects or slower consumers.

Fix graceful output completion across CLI entry points and test large output,
piped/slow consumers, stdout/stderr and success/failure exits on supported systems.
Do not simply replace exit calls without restructuring control flow: many currently
serve as returns. Node explicitly documents this truncation hazard and recommends
letting pending writes finish with an appropriate exit code:
[Node process documentation](https://nodejs.org/api/process.html#processexitcode).
Keeping Node 22 as a support policy is a separate decision from fixing the bug.

### F-02 — P2: requirement-level changes do not propagate to affected work

Location: [impact.cjs](../template/scripts/pincer-runtime/impact.cjs), lines
99–112, where propagation begins with changed scenarios/links/checks/tickets.

In a strict fixture, I added “All parser diagnostics must now include the source
filename.” to the R-01 body while leaving scenario text untouched. `impact --json`
reported R-01's text changed, but returned:

```json
{"scenarios":[],"tickets":[],"checks":[],"dependents":[]}
```

for `affected`. The parent requirement is authored behavior and its children carry
the implementation links. Reporting an empty affected set is incomplete routing.
Authorization still becomes stale, so this reproduction is not a release-gate bypass.

Propagate changed parent requirement content conservatively to its scenarios and
linked work/checks with an explicit reason. Also test removal and changed links using
both baseline and current graphs so work formerly linked to removed obligations is
not silently lost from impact reporting. Those additional cases need tests; only the
parent-content case above was reproduced here.

### F-03 — P2: coverage recommends execution while paused

Location: [phases.cjs](../template/scripts/pincer-runtime/phases.cjs), lines
153–161. Implementation problems are routed before lifecycle state is considered.

With a valid, authorized strict map, an explicitly authorized S-03 deferral, open
T-01 and a paused change:

- `coverage --json` recommends `start T-01 → verify T-01 → done T-01`.
- `resume --json` correctly recommends `change resume prd-v1`.
- The suggested start exits 1 with `LIFECYCLE_BLOCKED`.

The guard is safe, but the reports disagree about the next usable action. Share
lifecycle/view/selection/running-attempt precedence with resume, and test the state
matrix including terminal changes and explicit inspection of a non-selected change.
Those latter cases are requested coverage, not additional reproduced failures.

## What the benchmark actually establishes

Source: [trial report](trial-prd-v6.md) and its saved run records. Totals independently
recomputed in this assessment:

| Measure, 18 valid runs per arm | Pincer | Plain agent |
| --- | ---: | ---: |
| Independent acceptance | 17/18 | 17/18 |
| Recorded cost | $43.3389 | $9.2002 |
| Active session minutes | 166.76 | 43.34 |
| Changed-scope protocol check | 3/3 | 2/3 |

The observed overhead is about **4.71× cost and 3.85× session time**, with no observed
aggregate acceptance advantage. Three pairs per brief cannot establish equivalence,
superiority or a reliable changed-scope effect. The UI miss in the Pincer arm was a
real acceptance miss even though its own checks passed.

Crucially, **no live run adopted strict coverage**. These results characterize the
workflow the agents actually used, not the complete v6 strict path. The benchmark
does include a two-session A/B handoff; descriptions calling every brief single-change
or saying there is no continuity are inaccurate. It is nevertheless a small, controlled
continuity task rather than a long-lived production project.

Setup time was recorded as zero for automated preparation and review time was not
measured. That leaves a major part of Pincer's potential value—human review effort—
unmeasured. The UI evaluator uses structural Node checks, not browser/assistive-tool
observation. Evaluators are held out from the implementation workspace but are still
project-authored. The harness was re-frozen mid-study and prior runs re-evaluated;
this is disclosed, but future experiments should freeze the complete evaluation path.

The benchmark's `evidence-binding` helper also accepts whole `.prd/evidence/`
directories after an ancestor candidate, unlike the runtime's stricter listed-artifact
rule. Treat that helper as a limited binding check, not an independent demonstration
that every runtime release invariant held. Add controlled unlisted-artifact faults
before using it to support stronger evidence-integrity claims.

## Product and maintainability assessment

| Dimension | Assessment | Next evidence needed |
| --- | --- | --- |
| Agreement/evidence architecture | Credible foundation with explicit ownership | Fix the report/output holes; keep adversarial tests |
| Strict-coverage usability | Mechanically exercised, not demonstrated live | Real adoption → revision → evaluation sessions |
| Small-task efficiency | Current measured overhead is high | Paired before/after runs plus workflow-step profiling |
| Human review value | Plausible, unmeasured | Timed independent reviews on identical candidate changes |
| Cross-agent delivery | Packaged parity, incomplete live evidence | Actual end-to-end runs and cross-agent handoffs |
| Release readiness | Green CI; findings and formal evaluation remain | Fixed candidate, final evaluation and explicit release |
| Documentation | Rich but drifting across summaries | Current support/release matrix and accurate onboarding |

The runtime now has 27 modules and several compatibility modes. This is manageable,
but every new policy path adds interactions to validate. The duplicated next-action
logic is a concrete example. Prefer one policy computation reused by multiple views
and small changes with meaningful counterexamples. Splitting fast invariant tests
from slower full benchmark/replay gates can improve feedback while keeping both
mandatory at the appropriate integration boundary.

The README's long update history obscures the first successful user journey and
current strict-coverage behavior. “Works immediately” is stronger than the recorded
live evidence for some adapters. A compact quickstart, clear adoption choice and an
observed capability matrix would better match the product's emphasis on honest claims.
Authorization remains local provenance; matching words or IDs must not be described
as authenticating a human decision.

## Recommended next sequence

1. **Close F-01..F-03 and evaluate the cumulative candidate.** Update documentation
   and version metadata before selecting the final candidate, so those changes do
   not invalidate evaluation later. V6 includes v5; a single cumulative next release
   is reasonable after explicitly deciding its scope and completing the release
   gates. This assessment performs none of those publishing actions.
2. **Run a small strict-coverage pilot before designing more state machinery.** Use
   one greenfield and two existing projects. Observe installation/adoption, a scope
   revision, paused work, fresh-session recovery and final schema 3 evidence. Include
   ordinary users/agents following the shipped instructions rather than operator
   coaching around failures. Record every manual repair and repeated approval.
3. **Next PRD: “Make trusted delivery easier and cheaper.”** Improve map/check
   scaffolding with reviewable previews, concise context/reporting and shared next
   actions. Preserve explicit decisions and current source/evidence validation.
   Measure redundant commands, repeated context reads, avoidable checks and human
   review time before choosing optimizations; do not weaken conservative invalidation
   merely to make a benchmark faster.
4. **Validate the agent-independent promise.** Run a full strict journey on each
   claimed surface and at least one real cross-agent handoff. Start with the two
   surfaces users actually use most, and label others accurately until observed.
5. **Re-run matched delivery comparisons.** Separate plain agent, default Pincer and
   strict Pincer. Keep the old short tasks to detect friction, and add realistic
   longer-lived changes to measure continuity and review value. Suggested engineering
   target: halve Pincer's current overhead on the short-task set without reducing
   acceptance or weakening invariants; treat it as a proposed target, not a prediction.

Defer dashboards, automatic parallel worktree orchestration, broad integrations and
additional approval machinery until pilot results show they solve a material problem.
The next competitive advantage should be measurable confidence and saved human effort
with less ceremony. There is enough foundation to pursue that now, once the reproduced
reliability gaps are closed.
