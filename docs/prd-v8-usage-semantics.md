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
