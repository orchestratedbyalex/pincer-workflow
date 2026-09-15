# PRD v7 platform support

What has actually been seen to work, on which surface, at which version — and, just as
importantly, what has not. [PRD v7](../.prd/prd-v7.md) R-07 asks for a live strict
journey on Claude Code and on Codex plus one real cross-agent handoff, with every
claim linked to versioned evidence.

**Nothing in this matrix is observed yet.** T-93 is open and its prerequisites are
outstanding ([protocol](prd-v7-protocol.md), section 9). This document is the frozen
shape those observations will fill in, and the levels below exist so that filling it
in cannot quietly turn an installation check into a live trial.

## The three support levels

| Level | What it means | What it may never be read as |
| --- | --- | --- |
| **observed** | A real session on that surface did this, and the row names the artifact and the exact tool/model version that show it | — |
| **installed** | The package installed on that surface and its checks passed. A real thing, and not a journey: nothing is claimed about an agent following the instructions | a live trial |
| **unobserved** | Not seen, with the reason recorded | unsupported; it means unmeasured |

The distinction that matters: **packaged parity is an installation check and never a
live observation.** `test/distribution.test.js` proves the adapters and plugin are
generated from the template without drift, and `test/installer.test.js` proves a packed
tarball installs and preserves existing project rules. Neither says anything about
whether an agent reading those instructions behaves correctly. A support row whose
basis is packaged parity is `installed`; `scripts/delivery-benchmark-v7/observations.cjs`
refuses it as `observed` (`SUPPORT_SUBSTITUTED`), and
`test/platform-trial-records.test.js` drives that refusal.

## Matrix

| Surface | Capability | Level | Basis / what is missing |
| --- | --- | --- | --- |
| Claude Code | Full strict journey: install, adopt, authorize, implement, revise under authorization, pause, fresh-session recovery, schema 3 evaluation | `unobserved` | T-93 has not run: no spending or wall-clock cap has been supplied |
| Claude Code | Package installs and its documented commands run | `installed` | `test/installer.test.js`, `test/strict-onboarding.test.js` — a scripted packed-install walkthrough, not an agent session |
| Codex | Full strict journey | `unobserved` | T-93 has not run; the CLI itself is pinned at `codex-cli 0.153.4`, authenticated and verified on the supported host (T-98), which is installation and not a journey |
| Codex | Adapters generated from the template without drift | `installed` | `test/distribution.test.js`, `test/change-distribution.test.js`, `test/coverage-distribution.test.js` |
| Claude Code → Codex | Cross-agent handoff: work started on one surface resumed on the other from files, with no conversational recap | `unobserved` | T-93 has not run |
| Copilot | Full strict journey | `unobserved` | no Copilot account is available for this study; prompts are generated and parity-checked, nothing more |
| Copilot | Prompts generated from the template without drift | `installed` | `test/distribution.test.js` |
| Plugin-only | Bootstrap of project artifacts from the plugin alone | `unobserved` | not exercised as a journey; `test/distribution.test.js` checks the plugin's parity with the template |
| Windows (native) | Any journey | `unobserved` | the runtime and the check runner are untested on native Windows; the supported shell environment is documented in the README |

## What each observed row will have to carry

When T-93 runs, every row that moves to `observed` must name:

- the exact tool version and model, recorded in the run's own record;
- the artifact a reviewer can open — a session record, an evaluator output, or a named
  private capture that says where it is and why it is not committed;
- the stage-by-stage journey, with failures and repairs retained rather than replaced
  by the repaired result.

A row cannot move to `observed` because a suite passed. The suite
(`test/platform-trial-records.test.js`) checks record *properties*: that references
resolve, that a repaired stage kept its original failure, that a handoff did not use a
conversational recap, that an observed row names its evidence. Whether the agent
actually complied is read from those artifacts by a person.

## Records

`docs/prd-v7-artifacts/platforms/` holds one record per surface. Both are currently
`observed: false`, `status: outstanding`, with the reason they have not run. A record
marked `fixture: true` can never be `observed: true` — a synthetic record is not
evidence however it is labelled, and the validator refuses the combination
(`FIXTURE_MISLABELLED`).
