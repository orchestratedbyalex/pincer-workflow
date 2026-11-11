# 1.0.1 stabilization

Authorized by the repository owner on 2026-11-11 after the isolated Codex smoke.
These are distribution-maintenance work items, not imported historical PRD tickets.

| Work item | Scope | Verification |
| --- | --- | --- |
| ST-01 — Accurate guidance | Codex-only dollar mentions, draft-spec approval guidance, correct argument Markdown | Status and generator regression suites |
| ST-02 — Acceptance commit | Separate read-only audit, human acceptance, acceptance-only commit and clean final checks; preserve evaluated candidate identity | Library contract checks and packed lifecycle test |
| ST-03 — Reproducible workflow | Pack and install Codex kit in isolated Git repo; behavioral failure/recovery, evidence, synthetic acceptance; fresh native discovery/review | Workflow integration suite, complete test chain, native observation and CI |

The original test-codex-pincer repository is a local smoke artifact, not a dependency or submodule. Real human acceptance must never be replaced with synthetic test data. Automated fixtures label their acceptance as synthetic. A fresh native run must distinguish skill discovery from agent dispatch, and retain host failures honestly.

Release: update version, README, changelog and Pages; test the packed candidate; run Ubuntu/macOS × Node22/24 CI on that commit; publish the tested tarball and matching GitHub release; verify registry bytes and Pages. Record observed results separately from this plan.
