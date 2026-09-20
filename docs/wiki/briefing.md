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
logs cannot be read or copied. Frozen cohort after T-120: `a6a6d474…` (`1027f120…` is the superseded API-key identity). The current sandbox denies
`ps`; allocation custody verification must be rerun on a host that permits it.

## Active / next task

20 September user scope amendment: Pincer operates through coding CLIs or GitHub Copilot with native tool login, not provider API keys (`docs/prd-v8-native-tool-plan.md`). **T-120 is authored** ([[native-tool-contracts]]): `docs/prd-v8-native-tool-contracts.md` fixes the host-login profile `claude-project-native-login-v1`, the sanitized `claude auth status` record, the billing-mode-aware usage profile and the comparison rule; the user still has to review it for feasibility and honesty. **Next: T-121** implements it (profile, usage reader, manifest schema 2, override refusal, `--i-agreed-the-usage-envelope`, replacement smoke package, fixture entry-point suite), then the external study checkout is refreshed and T-102/T-109 collect native observations. No live support claim changes. The checked-in launcher still requires an API key; do not ask the user for one or execute the superseded package.

## Recent decisions

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
  `isolated-launch.cjs` and the v8 protocol/isolation/usage/native-tool-contracts docs are in `SPEC.harness`:
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
- Live runs need `--i-have-a-spending-cap`; that flag asserts a human agreed a cap and is
  not the agent's to pass. Numeric budgets come from a `study-authorization` decided by
  `user`, never from the flag.
- `docs/prd-v7-artifacts/v6-preservation.json` digests 674 v6 files individually;
  `docs/prd-v6-review-packet.md`'s stale "(51 suites)" must **stay** stale.
- `npm test` is 77 suites and about fifteen minutes. CI is {ubuntu,macos} × Node {22,24}.
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
