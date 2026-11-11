# Changelog

## 1.0.1 — 2026-11-11

- Codex-only status and missing-agreement hints use `$pincer-*`; draft specs stay
  at approval, and disabled narrowing routes directly to code.
- Generated Codex argument descriptions no longer nest Markdown code spans.
- Release separates its read-only audit from actual human acceptance and an
  acceptance-only commit, preserving the evaluated candidate identity.
- A packed workflow integration test exercises real CLI checks, failure/recovery,
  evidence integrity and a clearly synthetic acceptance commit.


## 1.0.0 — 2026-11-11

PINCER becomes a harness builder: a project-specific agreement drives the coding
workflow across Claude Code, Codex CLI and GitHub Copilot.

- Blueprint inspects the project and interviews the owner before writing
  `harness.json` and the agreement in `AGENTS.md`.
- Configurable plan, narrow, code, evaluate and release stages; blueprint and
  status remain always available.
- Script-owned ticket verification receipts, completion and named human acceptance.
- Evidence manifest validation and status that names the next command.
- Generated platform adapters and model tiers for stages and review agents.
- Dependency-free Node core; installer preserves edits using `.new` sidecars.

### Breaking changes and upgrade guidance

Node.js 22 or newer is required. The 0.7 runtime, its migration paths and fixed PRD
workflow are retired. PRD v8 and its open study work are superseded, not completed
by this release. The wiki is historical and the Claude plugin channel is paused.

Try the release tarball in a separate project or checkout first. Back up or commit
your current project before updating. Inspect installer output and resolve `.new`
sidecars deliberately; do not overwrite customized instructions blindly. Run
`doctor`, then blueprint to create and review the new agreement. Keep historical
tickets and evidence separate: old verification and acceptance are not migrated
into the new lifecycle automatically. Do not delete historical artifacts to make
status appear clean.

Available on npm as `pincer-workflow@1.0.0` and as a GitHub release
tarball. This release has automated fixture and packaged-install validation;
it makes no comparative productivity or best-in-class claim.
