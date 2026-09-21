# Native-tool execution plan — PRD v8 amendment

Decision date: 20 September 2026. Basis: the user's instruction that Pincer should be used through a CLI or GitHub Copilot, without API-key-based operation. See the [amended PRD](../.prd/prd-v8.md).

## Product boundary

Pincer supplies instructions, tickets, local runtime checks, and saved evidence inside Claude Code, Codex CLI, and GitHub Copilot. The coding tool handles its own account login and model requests. Pincer must not ask for provider API keys, extract OAuth tokens, proxy model traffic, or implement a model-provider client. A subscription or account entitlement may still be required by the host tool. This does not prohibit application credentials needed by software a user is building.

The installed workflow follows the host-tool approach. The historical maintainer benchmark required `apiKey` and injected `ANTHROPIC_API_KEY` into a fresh HOME/config environment. T-121 replaced that launch path with `claude-project-native-login-v1`; the historical profile remains readable but is refused for launch. Native login preservation still requires a real observation.

## Revised order

1. **T-120: define native-login contracts.** Inspect current official tool behavior; specify supported login, isolation, capture and subscription usage without assuming different tools expose identical capabilities.
2. **T-121: implement the replacement runner.** Exercise its real entry point with offline fixture tools; refresh the frozen cohort, package, effective-input proposals and candidate checks.
3. **T-109 and T-102: observe a bounded native smoke.** The user signs into the tool through its official flow. Separately settle project access, account usage/time limits, reviewers and execution authorization. Confirm actual authentication, configuration boundaries, captures and stop behavior.
4. **T-110/T-111: real journeys and file-only handoff.** Start with the existing Claude Code/Codex scope. Retain unavailable stages and intervention time. GitHub Copilot's IDE path should be exercised through its actual supported interface before claiming observed support; do not simulate it with an API client. A new Copilot live-study scope needs its own recorded breakdown.
5. **T-112 onward: reduce observed friction and measure benefit.** Keep the existing usability hypotheses conditional on findings. Human effort, reliable completion and recovery are central outcomes.

## Authentication and isolation

Use a documented host-supported sign-in mechanism. Prefer a dedicated study OS account or clean host where the user signs into the tool normally and establishes a known configuration. Whether this is feasible with the pinned tool and account must be checked; this document does not assert that changing HOME preserves login.

Do not copy keychains, account databases, tokens, or personal configuration into a scratch directory. Do not borrow subscription tokens for direct API calls. Never inspect secret values to prove login. Use supported nonsecret authentication status plus an actual native session as evidence.

Preserve isolation tests, synthetic canaries, retained failure evidence and manual permission boundaries. If authenticated isolation cannot be demonstrated, report the blocker. A controlled-host baseline must be explicitly described and approved as a methodology revision; it cannot claim stronger isolation than observed. A quiet canary still does not prove settings were absent.

Detect and refuse a conflicting provider-key/API-billing override before launching a task; do not print its value or mutate the user's shell/profile. A missing or expired login produces an actionable instruction to use the tool's own login flow, with no fallback to an API key.

## Subscription-aware measurement

| Observation | Treatment |
| --- | --- |
| Task accepted/rejected, regressions, recovery, interventions | Retain actual artifacts and outcomes |
| Elapsed time, command counts, human review time | Record units, boundaries and interruptions |
| Tokens or account usage exposed by the tool | Retain source and completeness; do not infer missing values |
| Actual attributable billed charge | Label as actual only when supported by billing evidence |
| Tool-reported or rate-card cost estimate | Label as estimate, never subscription charge |
| No per-task subscription dollar charge available | Record unavailable/not attributable, not zero; exclude from dollar-superiority claims |
| Unexpected missing mandatory capture | Invalid or incomplete under the declared schema; retain and stop as required |
| Account limit, uncertain billing mode, usage beyond the agreed envelope | Stop; no account rotation, automatic top-up, or API fallback |

Use explicit session/turn and wall-clock limits where the tool supports them, plus operator stop rules and agreed account usage. Do not promise hard enforcement of a tool/provider quota that the runner cannot enforce. Preserve incomplete historical API usage as incomplete: do not relabel old errors as ordinary subscription unavailability. New schema/profile identities distinguish the methods.

The 72-cell and competitive studies remain planned obligations, not authorized bulk runs. Check feasibility and account limits after the small smoke/pilots; propose an explicit scope revision if they cannot fit. Never silently reduce the sample or claim comparable monetary results across incompatible billing modes.

## Deliverables and completion limits

T-120 updates protocol, isolation, usage and readiness contracts, affected ticket wording, comparison criteria and support documentation. T-121 updates launcher, allocator, usage/finalization/reporting, readiness gates, environment construction, redaction, entry-point tests and execution artifacts. Remove API-key requirements from the active path while retaining historical artifacts under explicit old identities.

Each frozen-input edit requires a new cohort; the external study checkout and drafts must be refreshed. Existing management receipts and native acceptance checkboxes are not rewritten into passes. Use the pinned independent kit for verification. No template changes are implied by this planning amendment; if implementation changes templates, regenerate adapters and plugin.

The old smoke package is superseded by the [native-login execution package](prd-v8-artifacts/execution/T-121-native-smoke-execution-package.md). The runner is implemented and fixture-tested, including custody review corrections. Full regression on the corrected candidate and exact-candidate CI remain pending; packed-install parity passed. Refresh the external study checkout and drafts only after establishing the candidate. Native login, isolation and hook capture remain unobserved. No live session is authorized by this amendment.

## Official references checked for this revision

- [Claude Code with a Pro or Max plan](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan): account login is available; an `ANTHROPIC_API_KEY` environment override can select API charges instead of subscription use.
- [GitHub Copilot IDE configuration](https://docs.github.com/en/copilot/how-tos/configure-personal-settings/configure-in-ide): Copilot uses the user's GitHub sign-in.

Recheck exact tool versions and supported execution/capture contracts during T-120. Neither reference demonstrates that the current isolated launcher preserves native authentication.
