# Stabilization validation

2026-11-11. Work items ST-01, ST-02 and ST-03 are implemented. This is a bounded
compatibility check, not a comparative productivity or universal stability claim.

## Automated coverage

`npm test` includes 15 suites. The new workflow-integration suite packs the actual
kit, installs the Codex variant in an isolated Git repository and tests behavioral
failure/recovery, completion gates, evidence integrity and a separate acceptance
commit. Its human identity and acceptance words are explicitly synthetic test data.
Status regressions cover Codex-only versus other installations, draft approval
(including a later change after accepted work), disabled narrow and shell paths.
The generator regression covers code-wrapped argument placeholders.

## Native Codex observation

Codex CLI 0.167.0 was launched as a fresh process inside the local test project,
using the existing account, workspace-write sandbox and on-request approvals.
The native session discovered pincer-status metadata before opening its skill,
reported the dollar-style next command and dispatched the generated
code-quality-reviewer as a native custom agent. It reviewed the greeting task
without findings above its confidence threshold. The actual application passed
17 subprocess tests (valid input, invalid input, Unicode boundaries and literal
shell-looking input).

The first attempt used ephemeral mode: skill discovery worked but native reviewer
dispatch failed with the host's "no rollout found" error. A normal persistent
session succeeded. Prefer a normal session when testing custom subagents.

The final release phase used the owner's actual acceptance of the greeting result,
with the evaluated candidate kept separate from the acceptance commit. Detailed
local artifacts remain in test-codex-pincer; they are not distributed with the kit.

## Limits and release checks

No fresh native Claude Code or Copilot model session ran. Automated installation
and generation tests cover those adapters. The native run exercised the common
Codex route; synthetic tests cover the edge cases. The last two reviewed changes
(later-draft routing and evidence-off wording) are covered by automated tests;
they do not alter the native smoke's exercised route.

Before publishing, require the full Ubuntu/macOS × Node 22/24 CI matrix on the
release commit, verify the packed install, and publish those exact tarball bytes.
Registry integrity, GitHub release assets and deployed Pages are checked after
publication and reported in the release handoff.
