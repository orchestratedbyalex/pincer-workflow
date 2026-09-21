# PRD v8 contracts — T-100

Status: authored implementation contract, not evidence of implemented v8 behavior.
See the [current obligation overlay](prd-v8-obligation-map.md) and
[PRD v8](../.prd/prd-v8.md). T-101–T-119 must supply their own behavioral or
observational evidence. `node test/readiness-contracts.test.js` checks this authored
contract, its references, negative document mutations and frozen assets; it does not
prove launches, concurrency, browser behavior, human review or release readiness.

## Preservation boundary

The complete [v7 preservation matrix](prd-v7-preservation.md) remains normative,
including its named regression suites and counterexamples. No efficiency target
weakens a gate. Legacy, migrated, changes and strict modes retain agreement identity,
explicit revised-scope decisions, worktree-local selection, source mutation detection,
conservative source freshness, latest-failure precedence, installed attempt locking,
transaction recovery, unrelated tracked/untracked user work, secret handling, complete
piped output through `io.cjs`, shared routing, generated parity and the exact
post-candidate artifact allowlist. No schema or default CLI change is implied.

The v6 files listed in `docs/prd-v7-artifacts/v6-preservation.json` remain byte-for-byte
unchanged in T-100, including NOTES.md and old evidence. Current corrections live in this
overlay. A later candidate evaluation may replace root NOTES.md only with an explicit
preservation disposition retaining the historical v6 record; it must not silently
rewrite the frozen manifest or historical evidence. T-119 owns that boundary.
Old ticket dependencies, lifecycle receipts and raw observations are historical records.
Measurement schema changes use versioned readers; old cohorts remain readable under
original inputs and are never silently re-evaluated or pooled with changed execution.

| Guarantee | Deliberate counterexample | Existing regression reference / new owner |
| --- | --- | --- |
| Agreement, decisions and selection | Edit the map after approval; generic continue; select another worktree | `test/coverage-agreement.test.js`, `test/change-authorization.test.js`, `test/change-selection.test.js`; T-112/T-113 |
| Failure and source freshness | Fail after a pass; mutate source during or after verification | `test/runtime-runner.test.js`, `test/runtime-lifecycle.test.js`; T-113 |
| Recovery and unrelated work | Kill a transaction; recover while unrelated edits exist | `test/change-transactions.test.js`, `test/recovery.test.js`; T-113/T-117 |
| Evidence containment | Add an unlisted file or version bump after candidate selection | `test/candidate.test.js`, `test/coverage-evidence.test.js`; T-108/T-119 |
| Modes, output and generation | Change default JSON; truncate a pipe; edit generated output alone | `test/contracts.test.js`, `test/runtime-output.test.js`, `test/distribution.test.js`; T-112/T-113 |
| Frozen history | Alter a v6 file, remove it or change its recorded digest | `test/improvement-contracts.test.js`; T-100 |

## Effective execution identity — T-101/T-102/T-107

Native-login revision, 20 September 2026: the [native-tool contracts](prd-v8-native-tool-contracts.md) (T-120) supersede the API-key authentication assumption in this section for future execution. Authentication is the host tool's own sign-in in a study configuration directory; the runner refuses provider-key overrides; usage records declare a billing mode. Retained API-key fixture records keep their historical identities.

Scheduling correction, 19 September 2026: verified T-102 implementation is sufficient
for offline T-106 work after T-105. T-109's separately authorized operational smoke
supplies native observations; it is not a measured run. Both T-102 and T-109 must be
complete before T-110 or any measured session. Missing, synthetic or incompatible
native evidence prevents measured readiness. Every original acceptance scenario remains
required. This corrects current v8 dependencies only; historical v7 receipts are unchanged.

Resolve one canonical effective manifest before planning, workspace preparation or
launch. Include resolved model, actual tool/version, numeric turn/spend/wall-clock
caps, kit commit and artifact digest, protocol/briefs, evaluator/browser implementation
and pinned dependencies, driver, collector and every execution/scoring helper including
new sibling modules. Capture actual OS/platform/Node, effective permission posture and
allowlisted isolated configuration. A shared personal configuration is not isolation.
Authentication stays in protected host mechanisms; no secret values, secret-value hashes,
private instruction text or environment dumps enter records or fingerprints.

Any relevant input mutation changes cohort identity or is refused. Existing-plan drift
must be refused before any workspace, record or session mutation. Unknown provenance,
escaping inputs or symlinked ancestors, unknown/nested configuration, unresolved model
aliases, malformed flags and missing/nonfinite/nonpositive caps fail
closed. Validate every existing cell of a partially populated plan before writing missing
cells; validate browser provenance before loading code that could have side effects.
History remains readable. Mutation cases: model-A/10 versus model-B/20; swapped
kit/browser; new imported helper; synthetic personal hook; secret canary. These require
actual runner controls in T-101/T-102/T-107, not this static suite.

## Exclusive ownership and attempts — T-103/T-104

Claim a cell atomically before preparing or launching it. Exactly one concurrent
claimant may launch; the loser returns busy and changes no workspace or artifacts.
Different cells have independent mutable state. Allocate rerun slots and publish records
under ownership; a live or unverifiable owner is never reclaimed as dead. Abandoned
ownership has an explicit recoverable disposition, not an automatic second paid run.

Use unique run/attempt/session/event identities and append-preserved artifacts. Recovery
retains all logs and checkpointed setup/session events, labels missing in-flight payloads,
and starts a clean disposable workspace at the original base, excluding the interrupted
candidate commit. Terminal cells cannot silently rerun. Inject concurrent writers and
real stand-in process kills before/after claim, setup, session start/end, checkpoint and
publication. Validate the resulting records, not merely authored fixtures.

## Complete measurement and terminal outcomes — T-105/T-106

Count usage from completed, failed, discarded and restarted attempts exactly once.
A missing, malformed or metric-incomplete payload makes that aggregate null with a
specific reason; a measured subtotal is separately labelled and never presented as a
total. Explicit provider zero, all-null and absent fields remain distinguishable.
Reject negative, nonfinite, inconsistent and unsupported fields. Keep provider duration
separate from wall-clock and merged active intervals; avoid double-counting cache usage.
Stored sanitized payloads must support report regeneration without model calls.

One finalization contract covers accepted, rejected, unavailable, invalid, interrupted,
account-limit, ambiguous-exit and evaluator-exception paths. Every terminal record has
its reason, evaluation availability and complete-or-unavailable metrics and passes the
versioned validator. Missing independent evaluation or strict adoption never yields
acceptance. Mutation cases include $1.25/120 tokens plus truncated JSON, archived paid
attempts, a thrown evaluator and account exhaustion. T-106 drives actual terminal paths.

## Guided authoring — T-112

Grammar: `coverage guide --change <id> [--scenario <id>] [--proposal <path>] [--json]`.
Require an explicit valid change. Without `--scenario`, choose the first unresolved
scenario in numeric inventory order; with it, require a scenario in that change.
Report relevant authored requirement/scenario text and ticket/check text with file
references, without inventing mappings or commands. An empty unresolved set has a null
focus and an explicit empty list. Identical inputs produce byte-identical output.

A proposal is a complete authored schema-1 coverage map, validated by the existing map,
inventory and check contracts, not executable output. Reject duplicate keys/mappings,
missing mappings, undeclared checks, wrong-change references and unsupported schemas.
Resolve proposal paths inside the project; reject traversal and symlink escapes.
The context digest binds the PRD, ticket/check text, current map (including absence),
change identity and proposal content. Reviewers must compare that digest before using a
proposal; changed inputs invalidate earlier review context. No timestamp enters it.

Freeze the successful JSON envelope below. `guide` deliberately replaces a map's top-level
`schema`: saving this report as a coverage map must fail. `context` contains `prd`,
`tickets` and `checks` with authored text and relative file references; `unresolved` is
an ordered list of scenario/code objects; `focus` is a scenario ID or null. `proposal`
is null without a proposal, otherwise `{path, valid: true, diff}`. The diff is a sorted
array of `{op, path, before, after}`: op is add/remove/replace, path is a JSON Pointer,
and absent before/after is null. It includes all additions, removals and replacements
against the current map (an absent map is empty). This is structural diff, not adequacy.
`next` consumes existing shared routing, without overriding its blockers.

```json
{
  "guide": 1,
  "kind": "coverage-guide",
  "change": "example",
  "context_digest": "<sha256>",
  "focus": null,
  "context": {"prd": null, "tickets": [], "checks": []},
  "unresolved": [],
  "proposal": null,
  "next": null
}
```

Exit 0 means a complete read-only report, including unresolved work; it grants no
readiness. Exit 2 means CLI usage error. Exit 4 means invalid/unreadable authored input,
selection/change/proposal. The grammar accepts no prior digest token: comparing review
context is the reviewer’s responsibility; the existing adoption/agreement gates enforce
freshness when the authored map is used. Errors under `--json` use
`{guide: 1, kind: "coverage-guide", ok: false, code, problems}` with no partial proposal;
problems are ordered `{code, message, path}` objects, with null path when inapplicable.
Human output states the same issue and remediation. All output goes through `io.cjs`.

Guide writes no map, selection, authorization, attempt, lifecycle state or cache and
executes no proposed check. The agent authors the accepted map; existing reviewed
adoption and agreement authorization remain separate. Snapshot the whole tree on success
and every failure; mutate sources between review and reuse; ensure a report cannot be
adopted as a map. Default/scaffold/brief schemas and output stay compatible. T-110's real
baseline and hypothesis decision must precede implementation of T-112/T-113.

## Release preparation and ordering — T-108/T-119

Grammar: `node scripts/prepare-release.cjs --version <semver> --preview|--apply`.
Exactly one mode and a valid version are required. Preview writes nothing. Apply first
validates in scratch, then changes only declared version/generated paths; it reports
exact touched paths, errors and partial effects, preserves unrelated work and never
stages, commits, tags, merges or publishes. Template changes regenerate both adapters
and plugin. This maintainer tool adds no installed dependency or lifecycle state.

Order: final authored docs/version metadata → generated outputs and parity → committed
candidate selection → full regression/browser/packed parity/CI for that candidate →
evaluation → read-only release audit. No post-candidate version exception or broader
artifact allowlist is permitted. Later source/version changes stale evidence normally.
Test preparation followed by candidate evaluation, scratch failure, repeated apply,
unrelated work and post-candidate mutation. Merge, tagging and publication require their
own actual authorization; this contract grants none.
