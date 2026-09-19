# PRD v8 execution protocol

Status: preparation draft. No live execution has been authorized or observed under
this protocol. This extends the retained [v7 protocol](prd-v7-protocol.md), with
[v8 contracts](prd-v8-contracts.md) taking precedence for repaired execution and
measurement. T-109 owns the completed readiness gate and operational smoke.

## Order and identities

1. Verify the repaired runner, fault controls, actual browser, packed distribution
   and candidate-wide CI. Commit the complete execution path before selecting its
   identity. A changed helper, model, configuration, browser, kit or cap requires
   a new effective manifest; existing measured cells retain their original identity.
2. Resolve project access, bases, reviewers, task schedule and actual user decisions
   on spending and elapsed time. Keep missing inputs explicitly pending.
3. Run the separately authorized operational smoke. Inspect actual isolation,
   tool/model identity, payload capture, browser observations, termination and
   offline report regeneration. These runs are operational evidence, never study cells.
4. Complete three K0/K1 baseline pairs (T-110), then decide the usability hypothesis.
   Guided authoring and proportionate workflow implementation must follow that decision.
5. Observe the file-only platform handoff, implement the justified improvements,
   and complete three K1/K2 pairs. Continue the existing 72-cell study and independent
   human reviews. The later 27-cell alternatives study has a separate allocation.

K0 is the released v0.6.0 kit at peeled commit
`694241cc684f2dd95a0cfe7ffa2827414683e84a`; its packed artifact digest must still be
resolved before use. The annotated tag object is not the kit commit. K1 is the prepared pre-v8-usability kit. K2 is the
prepared post-improvement kit. K1 and K2 are not selected yet. Management continues
through the independently extracted K0 runtime described in the progress journal.

## Planning and preflight

The execution-input document contains exact provider model and installed CLI version,
native executable, numeric session caps, immutable kit identity, isolated configuration,
and bundled browser adapter/runtime identities. Authentication is supplied separately
through a protected host mechanism. Never place secret values, secret-value hashes,
private instructions or complete environment dumps in tracked inputs or reports.

Preflight must check the actual bytes and capabilities before preparing a workspace.
An existing plan with changed effective inputs is refused without filling missing cells.
A browser label or installed executable alone is insufficient: require an observed
version, native input and screenshot capability. A synthetic adapter or session can
exercise offline controls but cannot satisfy a live readiness requirement.

The runner may use only a named isolation profile whose intended kit mechanisms remain
available. Suppressing personal configuration by suppressing the kit itself changes the
experiment. Unsupported authentication or an unverified host policy produces a specific
pending reason. No permission bypass is an acceptable repair.

## Proposed first allocation — not authorized

The first spending decision should cover only a short operational smoke, after offline
checks and native-launch configuration are ready. Proposed bounds are three fresh
sessions, one per arm, at most three turns, two minutes and a $1 client-side cost limit
per session: $3 aggregate allocation and six session-minutes. Setup and browser checks
have a separate ten-minute operator deadline. The manifest must contain the exact
prompts, kits, model and checks before this proposal is submitted for approval.

These numbers are proposed limits, not a forecast or an authorization. A client-side
limit is not a hard provider billing cap. The user may choose a different allocation;
the resulting manifest must bind the actual decision. No larger study inherits this
allocation. Failed, interrupted and discarded work consumes the same allocation.

Before every launch, account for all prior attempts and reserve the next session's
allocation. Missing cost data stops execution for review. Never replace unknown spend
with zero or infer budget from `--i-have-a-spending-cap`. Account exhaustion stops the
whole schedule. Resume requires a recorded disposition and sufficient remaining budget.

## Ownership and recovery

Only the exclusive owner of a cell may prepare, launch or publish it. Live or ambiguous
ownership is busy, regardless of elapsed time. A dead parent is insufficient when child
processes may survive. Explicit recovery preserves the original ownership decision,
checkpoints and raw artifacts; it never launches a second paid session by itself.

Persist a session launch intent before invocation and capture output as it arrives.
After indeterminate interruption, preserve the complete attempt and start a new clean
workspace with new attempt/session/event identities. The interrupted candidate must
not become the replacement's base. Terminal cells remain terminal; explicit reruns use
separate slots and retain their originals.

## Measurement and evidence

Every terminal path passes through the same validator and finalizer. Candidate quality
and measurement completeness are separate: a rejected candidate can be a valid result,
and missing usage does not erase an independent evaluation. A cap triggers evaluation
of usable committed work; missing browser observations cannot yield acceptance.

T-105 freezes provider-field semantics for the pinned tool before collection. Whole-tree
token counts must include delegated work and count cache usage once. Provider/API time
is distinct from session wall time. A metric missing from any incurred attempt makes
the aggregate unavailable with a reason; known subtotals remain explicitly labelled.
Original payloads stay in protected local storage, with sanitized artifact references
in tracked evidence. Reports regenerate without model calls.

The provider describes cost fields as client estimates and distinguishes top-level
usage from whole-tree per-model accounting; the implementation must preserve those
limits. See [cost and usage documentation](https://code.claude.com/docs/en/agent-sdk/cost-tracking)
and [cache token semantics](https://platform.claude.com/docs/en/build-with-claude/prompt-caching),
reviewed 19 September 2026. Actual pinned-tool smoke payloads are still required.

At least two non-implementing human reviewers follow the retained v7 rubric. Record
exposure/order, elapsed review time, decisions, missed faults and confidence. A validator
checks record consistency; it cannot establish that the human review happened.

## Readiness remains pending

No project bases, reviewer identities, live budget decision, smoke evidence or final
execution candidate have been supplied. The read-only T-109 gate must list these
specific missing inputs and fail `--require-ready`. It must not launch anything while
checking readiness. T-119 owns final evidence evaluation, preservation of historical
NOTES, and release audit; publication is a separate action.

## Read-only readiness interface (T-109)

The concrete pending manifest is
[`prd-v8-artifacts/execution/study.json`](prd-v8-artifacts/execution/study.json).
Inspect it without preparing workspaces, starting processes, changing a ledger or
launching a browser/model:

```sh
node scripts/delivery-benchmark-v7/readiness.cjs \
  --manifest docs/prd-v8-artifacts/execution/study.json --require-ready
```

The default purpose is `measured`. `--purpose operational-smoke` checks the earlier
admission phase; it cannot turn a measured decision into a smoke decision. Optional
`--input-root <directory>` locates the manifest and all referenced artifacts; the
manifest must be contained there. Optional `--session <id>` selects exactly one
approved scheduled session. The default input root is the current directory.

The result contains `ready`, `phase`, explicit `pending` reasons and allocation state.
`--require-ready` exits 2 while anything required remains pending; inspection without
that flag exits 0 after reporting the same pending reasons. Invalid arguments exit 2.
The current checked-in manifest is deliberately pending. This command verifies retained
records and their bytes; it cannot establish that an undocumented human decision or
native session actually happened.

### Manifest and evidence records

Schema 1 uses these explicit fields:

- `execution`: selected candidate SHA, a retained schema-2 effective-manifest reference,
  separate `observation_target` and `evidence_target`, complete current file references,
  `browser_runtime_root`,
  and the raw native-isolation observation reference when measured work is requested.
  Optional `source_root` names the repository directory relative to the input root;
  omitting it means the repository and input root are the same directory.
  References are `{ "ref": "relative/path", "digest": "sha256" }`. Current helpers,
  browser runtime, native-tool bytes and retained evidence are checked without running
  an executable. Safe internal browser-framework links retain their identities.
- `projects`: unique IDs, immutable base SHAs and `project-access-decision` references.
  The approved base is the deterministic prepared brief repository **before** the arm
  kit-install commit. All three arms use that same project base. The plain arm retains
  it directly; pincer/strict have exactly one kit-install commit over it, whose raw
  parent ID must match the approved base before model launch. Shallow exact-base
  reconstruction preserves this parent identity without restoring interrupted work.
- `kits`: K0/K1/K2 IDs, full commit SHAs and packed artifact references. Unselected kits
  stay pending; a scheduled kit must exist in this list.
- `schedule`: exact ordered `{ id, run, name, arm, purpose, project, kit, prompt_digest,
  effective_digest }` entries. `name` is S1, S2, etc.; runtime arm IDs are `plain`,
  `pincer` and `strict`. `effective_digest` means the effective manifest's complete
  **cohort**, not the JSON file digest. One manifest/allocation selects one effective
  cohort; a kit/model/configuration change requires separately resolved inputs and a
  separate allocation decision. Operational and measured purposes cannot share
  an authorization implicitly.
- `reviewers`: at least two unique independent reviewer IDs with participation decisions.
- `authorization`: a referenced `study-authorization` decision made by the user, binding
  purpose, exact canonical schedule digest, allocation ID, expiry and all numeric limits.
- `allocation`: ID, runs-root path, the same decision reference, `limit_usd`,
  `session_cap_usd`, `session_wall_minutes`, `max_elapsed_minutes` and `expires_at`.
  These values must match the decision; session caps also match the effective manifest.
- `stop_resume`: stop on unknown cost, account limit, exhausted allocation and changed
  inputs; resume requires an explicit recorded decision.
- `evidence`: retained `offline`, `browser`, `packed` and `ci` records; measured readiness
  additionally requires `native`, `smoke` and `report` records.

Decision documents have schema 1, the specific decision kind, `approved: true`, a
`decided_by` identity, timestamp and nonempty supporting artifact references. The study
spending decision must be attributed to `user`. References to invented decisions are
not authorization. Access decisions bind the project/base; participation decisions bind
reviewer independence. No secret value belongs in any of these documents.

Evidence summaries bind kind, candidate, full `evidence_target` as `execution_target`,
passing result, supporting
artifact references and a review decision by a listed independent reviewer. The review
decision names both candidate and evidence kind. Native and real-browser summaries
must explicitly declare `fixture: false`; this denotes actual observation even when
the tested page is a local fixture. Offline controlled faults may be labelled fixtures.
CI records cover Ubuntu/macOS × Node 22/24. Native summaries cover all three arms and
host policy, authentication, absence of personal configuration and intended kit behavior.
Smoke summaries cover actual payload capture, isolation, browser behavior, stop, cleanup
and offline report regeneration. Smoke evidence is labelled `operational-smoke`.

The raw native-isolation record also retains T-102's existing schema and evidence paths;
its digest must equal the value pinned in the effective configuration. Its target is
exactly `isolated-launch.observationTarget(effectiveManifest)`, which excludes the
observation-reference field and therefore avoids a self-referential digest.

### Closure and launch are different checks

Evidence sufficient to close T-109 must pass `--require-ready` while T-109 is still in
progress. The inspector therefore does not require T-109's own completed receipt.
Measured **launch** separately requires completed T-102 and T-109 runtime states. Native
observations can similarly complete T-102 before T-109's final smoke verification.

A static `launchGrant` is emitted only after current artifacts and concrete decisions
validate. It binds the manifest digest, purpose, exact sessions, execution cohort,
allocation and decision. It remains available when allocation accounting is blocked so
an existing reservation can be verified without a circular readiness requirement. A
grant by itself is not permission to spend: the allocator must validate remaining budget
and the existing claim, reserve/consume exactly once, and reconcile retained results.
The read-only inspector never creates that reservation. An existing unresolved launch
or any unknown incurred cost stops further admission; known subtotals do not repair it.


### Full evidence freshness target

The raw T-102 isolation observation uses the narrower `observation_target` described
above. It is insufficient to establish freshness of CI, browser, smoke or other study
evidence. Every retained summary therefore uses `execution.evidence_target`, computed
by the exported `readiness.evidenceTarget(effectiveManifest)` helper:

1. Clone the complete `effective` block and delete only
   `configuration.isolation_observation_digest`.
2. Copy the complete `inputs` mapping, replacing `inputs.effective` with the SHA-256
   of that normalized effective block and `inputs.configuration` with the SHA-256 of
   its normalized configuration. Preserve every other input and the exact `order`.
3. Hash the canonical `{ inputs, order }` object.

Changing browser bytes, caps, helpers, protocol, briefs, other configuration or any
other execution input invalidates retained summaries even when the candidate label or
narrow isolation target remains unchanged. Adding the reviewed raw isolation observation
alone does not create a self-reference. The grant carries both target identities.

### Settlement after expiry

Expiry blocks every new reservation, verification and consumption. If all retained
artifacts and decisions still validate, the inspector can return a separate
`settlementGrant` with `settlementOnly: true`, while `launchGrant` remains null and
readiness remains false. Only reconciliation accepts this grant. It records known
usage after process cleanup and retains the allocation stop; it cannot cancel,
refund, authorize resume or launch a session under expired authority. Unknown or
changed accounting still requires review.
