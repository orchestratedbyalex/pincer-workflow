# PRD v8 usage measurement contract

Profile: `claude-code-result-modelusage-v1`. Measurement block schema: `1`.
This is the repaired collector's interpretation, frozen before study collection.
Actual payloads from the pinned native CLI still require inspection in the operational
smoke. Offline fixtures prove the collector's behavior, not provider billing accuracy.

## Provider fields

| Metric | Recognized source | Meaning and limitations |
| --- | --- | --- |
| Tokens | Every `modelUsage` entry's `inputTokens`, `outputTokens`, `cacheReadInputTokens`, `cacheCreationInputTokens` | Whole-tree usage, including delegated work; each field counted once. All four fields must be present as nonnegative safe integers. |
| Cost in USD | `total_cost_usd` | Finite nonnegative client estimate, not an invoice or a hard billing cap. |
| Provider minutes | `duration_api_ms / 60000` | API/provider time; distinct from session wall time and merged active intervals. |

Top-level `usage` does not establish whole-tree totals because it can exclude subagents.
It is never added to `modelUsage`. Cache detail breakdowns are not additional tokens.
`duration_ms` is not a fallback for provider time. Missing fields remain unknown.
Unrecognized payload/result shapes and unsafe numeric values produce sanitized reasons.
An execution-error payload may contain placeholder zero totals; those cannot prove a
free session. A recognized successful result with explicitly reported zero is different
from an absent observation. The adapter's supported terminal result shapes are tested.

Sources reviewed 19 September 2026:
[Claude Code cost tracking](https://code.claude.com/docs/en/agent-sdk/cost-tracking)
describes whole-tree model usage and client-estimated costs;
[Anthropic prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
distinguishes uncached, cache-creation and cache-read input tokens.

## Completeness and retained attempts

The collector reads each attempt's durable session ledger, including interrupted,
failed and discarded work. Each session contributes at most one final payload.
Missing, malformed or incomplete payloads do not disappear from the denominator.
Paths must remain within their recorded attempt, with no symlink redirection or duplicate
artifact aliases. Original captures remain protected local artifacts; report metadata
contains no secret values, private instruction text or secret-derived fingerprints.

Each metric has an independent total, measured subtotal, measured/expected session count,
completeness flag and per-session missing reasons. The total is null whenever any
expected session lacks that metric. The measured subtotal remains explicitly partial.
For example, a complete $1.25/120-token result followed by a missing payload gives null
cost and token totals, with $1.25 and 120 as measured subtotals. No observations differ
from complete, explicitly reported zero observations.

All attempted runs consume resources, including invalid experiments and rejected
candidates. Their measured spend is retained in aggregate accounting. Acceptance rates
use their stated validity denominator independently. Missing usage never erases an
independent candidate evaluation or turns a rejection into an acceptance.

## Readers and regeneration

The explicit measurement block versions these semantics independently of the schema 8
attempt envelope. Historical schema 7/8 records remain readable without rewriting their
payloads. Records without the new block carry explicit legacy measurement limitations;
their old totals cannot silently become complete totals under this profile. Regenerating
a legacy record from an explicit session list, or retaining an imported legacy attempt,
also records that its full attempt coverage is not proven by a durable ledger. Every
metric total stays null in that case, even if all listed payloads are complete; their
measured subtotals remain available. Old discarded log directories cannot silently
disappear behind a claim of complete accounting.

Report regeneration uses retained files only and makes no model call. Validation checks
session membership, metric summaries and the public reported/unavailable projections.
Mixed profiles or unknown legacy coverage must remain visible in aggregate limitations.
T-106 owns the common terminal finalizer, and T-109 owns live budget/readiness decisions.

## Native-login revision (T-120, 20 September 2026)

`claude-code-result-modelusage-v1` above remains the reader for every retained API-key
record; such records are labelled `legacy-api-estimate` and are never pooled with native
records. The replacement profile `claude-code-result-native-usage-v1`, specified in
[the native-tool contracts](prd-v8-native-tool-contracts.md) §3 and implemented by T-121,
keeps the token and provider-time rules unchanged and replaces the cost metric:

| Field | Meaning under the native profile |
| --- | --- |
| `estimate_usd` | The tool's `total_cost_usd`, an estimate at list price; mandatory capture for Claude Code, labelled estimate, never a charge. Codex research reports no estimate (`TOOL_REPORTS_NO_ESTIMATE`), but Codex records require a separate future schema and are rejected by this Claude profile. |
| `billing.mode` | `subscription` or `api`, declared by the user's authorization and cross-checked against the retained sanitized login status; anything else is `AMBIGUOUS_BILLING`. |
| `billing.attributable_charge_usd` | Under `subscription`: null with `SUBSCRIPTION_NOT_ATTRIBUTABLE`, an expected valid outcome. Under `api`: a number only with retained billing evidence, otherwise null with `CHARGE_EVIDENCE_MISSING`. Never derived from the estimate. |
| `account_limit` | A tool-reported session, weekly, model or spend limit; any value stops the allocation. |

A missing token count, provider time or login status record is `MISSING_REQUIRED_CAPTURE`
and makes the record incomplete exactly as a missing payload does today. Unavailable
subscription billing does not. Dollar comparisons follow the contract's admissibility rule;
the aggregate `cost_usd` total of the legacy profile has no native counterpart.

### Implemented reader (T-121, 20 September 2026)

`usage.cjs` selects the profile from `record.environment.measurement_profile`, which a
native-login cohort carries from the plan on (`effective.recordInputs`). Under the native
profile the metric keys are `tokens`, `estimate_usd`, `provider_minutes`; `measurement.billing`
is `{mode, attributable_charge_usd: null, charge_reason, charge_evidence: null}` derived from
the declared mode and never from a figure; `reported.cost_usd` stays `null` with
`unavailable.cost_usd` naming the billing reason, so the legacy cost column is never filled
from an estimate. `effort.report` adds `estimate_usd` and `billing`; `effort.aggregate` adds
an `estimate_usd` column and refuses to pool the two profiles. The allocator reserves and
settles by `estimate_usd` for native records, stops on a missing token or provider-time
capture (`ALLOCATION_CAPTURE_INCOMPLETE`), on an unknown estimate, on an account limit and on
a billing-mode disagreement with a retained record. All of this is exercised by fixtures in
`test/native-login-study.test.js`; no native payload has been read yet.
