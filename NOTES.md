---
prd: .prd/prd-v1.md
base: d3aae87270004a1b88524a990d7578c0c2c71d33
candidate: 9caca17941f21cfe0b3756d571a2fd524743b509
---

# M0 trust repairs

## What was built

Pincer now preserves local installer changes through repeated updates and legacy
manifests, revokes stale verification after failed or interrupted checks, validates
the supported ticket format before transitions, and binds tickets and evaluation
notes to explicit PRD revisions and Git candidates.

The Claude hook adapter parses JSON structurally with Node.js 18+, covers documented
destructive command forms, and protects lifecycle fields across Edit, Write,
MultiEdit, and common shell mutations. The playbooks preserve existing authorization,
use scoped staging, select PRD versions dynamically, and scale planning and ticket
shape to greenfield or brownfield work.

The release gate now runs all regression suites, regenerates adapters and the plugin
in a temporary copy to prove parity, packs the npm artifact, and exercises Claude,
Codex, Copilot, and all-platform installs in both clean and existing repositories.
GitHub Actions runs the same gate on Linux and macOS with Node 18 and 22.

## Evaluation

The final candidate is `9caca17941f21cfe0b3756d571a2fd524743b509`,
reviewed from base `d3aae87270004a1b88524a990d7578c0c2c71d33`.
An independent review found two lower-severity readiness inconsistencies: an Edit
with `replace_all` could evade lifecycle simulation through an earlier prose match,
and status could advertise a cross-PRD dependency that start would refuse. T-07
fixed both and added regression coverage. No high-confidence findings remain.

`npm test` passes the installer, lifecycle, validation, verification, recovery,
116 hook-payload, workflow-contract, generation-parity, and packed-install checks.
The package has no runtime dependencies, and no tracked environment files were
found. The updated documentation served successfully over local HTTP. A browser
surface was unavailable in this environment, so the text-only website changes did
not receive a visual browser pass.

## Scope and known limitations

Nothing from the approved M0 scope was cut. Full source-bound attestation, atomic
runtime state, authenticated approval identities, multi-change coordination, native
Windows support, and Codex/Copilot hook adapters remain in later milestones. The
Claude hooks cover documented mistake patterns and are not a complete shell security
boundary. Live end-to-end agent sessions remain separate platform validation work.

## Next steps

Run `/pincer-release` for the pass/fail artifact audit. If that passes, prepare a
maintenance version and release notes; publishing remains a separate authorized
action. Continue with M1 only through a new PRD.

## Handover

Start with `.prd/prd-v1.md`, then `docs/pincer-improvement-plan.md` and the seven
ticket files. `template/` is canonical. After changing it, run
`template/scripts/sync-prompts.sh`, `scripts/build-plugin.sh`, and `npm test`.

There are no third-party runtime or development dependencies. Node.js provides the
installer, tests, and structured Claude hook parser; Bash remains the compatibility
interface for ticket and status commands. The riskiest aging assumption is that agent
hook payloads and supported Markdown/frontmatter stay within the deliberately small
formats tested here. Generator parity and payload fixtures should fail first when a
platform contract changes; live Copilot/Codex/Claude sessions are the least-tested path.
