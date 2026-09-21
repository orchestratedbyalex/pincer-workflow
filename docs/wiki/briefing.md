# Briefing

**pincer-workflow** — the public distribution of PINCER, a PRD-driven agentic
delivery workflow (Plan · Investigate · Narrow · Code · Evaluate · Release).
One repo, three channels: an npx installer ([[cli-installer]]), a Claude Code
plugin marketplace, and the raw kit files ([[template-kit]],
[[distribution-channels]]).

## Current state

PRD v8 on `feat/prd-v8` (draft PR #6). T-100, T-101, T-103–T-108 are done through the
pinned v0.6.0 management kit; T-102 has a verified implementation with its native
acceptance unchecked; T-109's offline gate is implemented and deliberately fails
`--require-ready`. Checkout/package metadata is 0.7.0; live registry availability was not confirmed in the latest network-blocked check. Packaged artifacts establish
installation, not observed live support; no paid session has run under v8.

The first operational smoke is packaged, not authorized:
`docs/prd-v8-artifacts/execution/T-109-smoke-execution-package.md` ([[study-readiness-gate]]).
An independent review found the documented launch command planned 24 cells (the CLI had no
brief selection); `bffcfc8` adds the required `--briefs` and retains `cleanup_complete`.
`f504c80` finishes the native-observation preparation: a synthetic isolation canary in the
per-session HOME/config and a redacted copy of the CLI's hook debug log
(`--debug hooks --debug-file`); nothing personal is read. `499fb6b` grades hook evidence
into one reportability gate with named reasons, separates "canary not triggered" from
"isolation demonstrated" (`unknown` where evidence is insufficient) and stops the
allocation on a retention failure. `07af4be` points T-109's verification at the study
checkout's manifest and keeps the measured gate. The study root is
`/Users/Shared/pincer-v8-study` (detached worktree at `499fb6b` + copied CLI, K0 and Chrome
for Testing). The external checkout and draft effective inputs are now stale for the direct review
correction over `5bbde21`. Refresh them before execution; decisions and reviewed evidence
summaries also remain pending.

The direct review correction requires recognized hook completion events with outcomes,
rejects registration-only text, and preserves the protected original directory when hook
logs cannot be read or copied. **T-121 (2026-09-20) implemented the native-login path**: the
runner signs in through the tool's own `claude auth login` in `<study root>/host/claude-config`,
refuses every provider-key/billing override by name, holds an exclusive journaled custody lock on
that directory, probes `auth status --json` before any workspace, measures under
`claude-code-result-native-usage-v1` (estimate, never a charge) and reads study manifest
schema 2. Frozen cohort after T-121: see `test/fixtures/delivery-benchmark-v7/frozen.json`
(`3284061a…` was the T-120 identity, `1027f120…` the API-key one). Nothing native has been
observed; the pinned CLI has never run under this profile.

## Active / next task

20 September user scope amendment: Pincer operates through coding CLIs or GitHub Copilot with native tool login, not provider API keys (`docs/prd-v8-native-tool-plan.md`). **T-120 authored and T-121 implemented** ([[native-tool-contracts]], [[study-readiness-gate]]): profile `claude-project-native-login-v1`, `login-custody.cjs`, native usage reader, manifest schema 2, `--i-agreed-the-usage-envelope`, replacement package `docs/prd-v8-artifacts/execution/T-121-native-smoke-execution-package.md`, suite `test/native-login-study.test.js`. **Next:** refresh the external study checkout (`/Users/Shared/pincer-v8-study/pincer-workflow`) to the T-121 commit; the user signs in under `host/claude-config` with the pinned CLI and writes the schema-2 decisions (billing mode, estimate caps, account-usage envelope, reviewers, project access); then T-102/T-109 run the bounded native smoke and observe `login_preserved`. No live support claim changes. Never ask the user for an API key.

## Recent decisions

- [[study-readiness-gate]] — T-121: custody of the shared login directory is one journaled lock
  held from the pre-workspace status probe through canary cleanup; changed files are preserved,
  never deleted, and recovery is an explicit recorded decision (2026-09-20)
- [[native-tool-contracts]] — the study signs in through the tool's own `claude auth login`
  in a study `CLAUDE_CONFIG_DIR`; unavailable subscription billing is expected and valid,
  a missing token/provider-time/status capture is not; dollar claims need evidenced API
  billing on every cell (T-120, 2026-09-20)
- [[study-readiness-gate]] — the smoke runs through the frozen orchestrator with
  `--study-purpose operational-smoke --repetitions 1`; an operational session is
  unreportable by purpose, is still evaluated, and stops the schedule (T-109, 2026-09-19)
- [[fix-the-driver-before-run-one]] — fix a frozen input and re-mint the cohort while
  zero runs exist; put the run loop in the tree so provenance describes what ran (T-98)
- [[read-only-projections]] — both v7 surfaces project computed state; the draft's
  *missing* `schema` key is what stops it being a map (T-90/T-91)

## Landmines

- **The study root cannot be this repository or anything under `$HOME`** (the launcher
  refuses `CLAUDE.md`/`.claude` ancestors); run the readiness inspector with
  `--input-root /Users/Shared/pincer-v8-study` **against the study checkout's manifest**,
  never this repo's copy (`PATH_INVALID`) ([[study-readiness-gate]]).
- The orchestrator CLI plans every brief unless `--briefs` is given; the smoke purpose
  requires it. Test the entry point by spawning it, not via `plan()` with `ids`.
- Changing any `PROFILE` field in `isolated-launch.cjs` moves the observation target; never
  observe isolation by reading the operator's real `~/.claude` (synthetic canary instead).
- `orchestrator.cjs`, `effective.cjs`, `readiness.cjs`, `allocation.cjs`,
  `isolated-launch.cjs`, `login-custody.cjs`, `effort.cjs` and the v8 protocol/isolation/usage/native-tool-contracts docs are in `SPEC.harness`:
  after editing any, regenerate `test/fixtures/delivery-benchmark-v7/frozen.json` (command
  at the top of `freeze-spec.cjs`). Append to `SPEC.harness`, never prepend.
- **Never add a file under `scripts/delivery-benchmark/`** (the v6 freeze digests the
  directory). V7/v8 tooling lives in `scripts/delivery-benchmark-v7/`.
- The repo's own tickets are verified with the pinned kit at
  `/tmp/pincer-v8-management-694241c/scripts` (digest `c0354c64…`, byte-identical to
  `v0.6.0:template/scripts`). Never export `CLAUDE_PROJECT_DIR`; never pipe `verify`/`done`
  or a test run through `tail` before a `git commit`.
- Never hand-edit `status`/`started`/`last_check`/`verified`/`finished`; the guard blocks
  `git checkout`/`restore`/`reset --hard`/`stash` touching `tickets/` and refuses a compound
  `git add <protected path> && git commit …` — split add and commit.
- Live runs need `--i-agreed-the-usage-envelope` (the old spending-cap flag is refused by
  name); it asserts a human agreed the estimate cap and the account-usage envelope and is
  not the agent's to pass. Numbers come from a `study-authorization` decided by `user`.
- The orchestrator refuses to run while any `ANTHROPIC_*`/`CLAUDE_CODE_*` credential or
  provider variable is set in its environment; unset them in the launching shell. It never
  reads their values. The login directory (`host/claude-config`) is never read, only its
  entry names; recovery after a custody fault is `login-custody.recover()` with a reason.
- `docs/prd-v7-artifacts/v6-preservation.json` digests 674 v6 files individually;
  `docs/prd-v6-review-packet.md`'s stale "(51 suites)" must **stay** stale.
- `npm test` is 78 suites and about fifteen minutes. CI is {ubuntu,macos} × Node {22,24}.
  Adding a suite means updating `package.json` **and** the packet rows that pin the count.
- **Every CLI write goes through `pincer-runtime/io.cjs`**; do not turn `process.exit(N)`
  into `process.exitCode = N` ([[runtime]]). Any report that renders a next action must
  consume `routing.cjs` ([[one-next-action-precedence]]).
- After editing `template/`, run BOTH generators; `test/distribution.test.js` compares the
  *plugin's* copy of `runtime-contracts.md`. `test/workflow.test.js` asserts the
  `## Authorization rule` block is byte-identical across plan/narrow/code/evaluate.
- `test/readiness-contracts.test.js` pins phrases in `docs/wiki/systems/v7-execution-gaps.md`,
  `docs/wiki/index.md` and this briefing (it must mention live support).
- **A backgrounded watchdog inherits the caller's stdout**; redirect it to `/dev/null`.
  A shell redirect onto a file a command also reads truncates it first — write via a temp
  file and `mv`.
- Check objects use `id`, not `name` (`evaluator-kit.cjs:26`). `SPEC.harness` in
  `freeze-spec.cjs` is a **file list**, not a directory digest.
- In the Bash sandbox, `node <script> <argv ≥ ~1 KB>` is SIGKILLed; `node -e` is not. zsh
  does not word-split an unquoted `$VAR`. Neither `timeout` nor `gtimeout` exists here.
- npm: 2FA; expired token shows as `E404 … PUT`; publish needs `--otp=<code>`; the user runs
  publish. `npm version` alone breaks the build: bump with `--no-git-tag-version`, run
  `scripts/build-plugin.sh`, then commit and tag by hand ([[distribution-channels]]).
- Codex channel = `.agents/skills/*/SKILL.md` invoked as `$pincer-*`.
