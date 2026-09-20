# The v8 study readiness gate: inspector, allocator, launcher

How PRD v8 admits a paid session (T-101–T-109), and where the first operational smoke is
prepared. Related: [[v7-execution-gaps]], [[delivery-benchmark]],
[[fix-the-driver-before-run-one]]. The package for the first smoke is
`docs/prd-v8-artifacts/execution/T-109-smoke-execution-package.md`; the pending manifest
is `study.json` beside it.

**Superseded for execution (2026-09-20):** the API-key profile below is historical. The
replacement host-login design is [[native-tool-contracts]] (T-120), implemented by T-121
before any T-109 smoke.

## Pieces (all under `scripts/delivery-benchmark-v7/`)

- `readiness.cjs` — `inspectStudy({manifestPath, inputRoot, purpose, nextSessionId})`,
  read-only. Validates the schema-1 study manifest: execution identity (retained schema-2
  effective manifest, complete input inventory, frozen inputs and helper closure recomputed
  from `source_root`, browser runtime tree, tool bytes), projects/access decisions, kits,
  reviewers, exact schedule, numeric allocation, `study-authorization` decided by `user`,
  stop/resume, and reviewed evidence summaries. Returns explicit `pending` reasons, a
  `launchGrant` only when nothing is pending, or a `settlementGrant` after expiry.
- `allocation.cjs` — one unresolved reservation at a time; `reserve` → `consume` (only the
  registered supervisor) → `reconcile` (settle, stop, or apply a recovery decision).
  `lifecycle(purpose)` reads ticket receipts from the checkout the orchestrator runs in:
  smoke needs T-101, T-103–T-108 done and T-102 verified; measured adds T-102 and T-109 done.
- `isolated-launch.cjs` — profile `claude-project-isolated-v1`, pinned to CLI **2.1.273**,
  explicit ten-variable environment, per-session HOME/config holding only a **synthetic
  canary** (user-level `settings.json` with a `SessionStart` hook touching a marker, and a
  `CLAUDE.md` with a random phrase; `environment.isolation_canary {leak_detected,
  user_hook_ran, user_settings_loaded, user_instructions_loaded}` after the run, the
  `loaded` fields `true` only on positive evidence and otherwise `unknown`),
  `--permission-prompts none`, empty MCP, and `--debug hooks --debug-file
  <session>/debug.log` whose redacted copy is retained as `logs/<S>.debug.log`
  (`hook_capture {present, retained, file, bytes}`, graded by `hook_evidence {status,
  required, missing}`; a kit arm needs recognized completion records with exit outcomes for both hooks). `reportability()` is the
  one gate: attestation, cleanup, capture, canary and hook evidence each a named reason the
  orchestrator writes into `record.reason`. A retention failure preserves the log in the
  attempt's scratch and stops the allocation (`ALLOCATION_EVIDENCE_UNRETAINED`).
  `observationTarget` = profile + tool bytes/version + model + kit + platform, so a PROFILE
  field change moves it (`8af4d99d…` → `d53ff6f0…` on 2026-09-19). A session is
  `reportable` only for the measured purpose with an attested model, complete cleanup and
  an untripped canary; a smoke session is unreportable by purpose.
- `orchestrator.cjs` — `studyFor` resolves the grant before any workspace work; per prompt:
  reserve → intent → launch → reconcile → evaluate → finalize. `--study-purpose
  operational-smoke`, `--repetitions 1` and `--briefs ui-states` (all added 2026-09-19) are
  how the smoke runs through the same frozen loop; an operational session stops the
  schedule after each cell. `--briefs` is required for the smoke purpose: the internal API
  takes `ids` from its caller, and until `bffcfc8` the CLI passed none, so the documented
  command planned all eight briefs. The launch suite now spawns the documented command.

## Invariants worth knowing

- `evidence_target` is the effective block minus only `isolation_observation_digest`, so
  smoke evidence carries into the measured cohort **with the same kit**; a different kit
  (K1, K2) invalidates every retained summary and the native observation. One manifest =
  one kit = one cohort.
- The allocation's `max_elapsed_minutes` is measured from the first reservation and covers
  setup, evaluation and operator pauses; there is no separate operator deadline field.
- Prepared bases are reproducible across machines (`harness.PREPARATION_DATE`):
  `ui-states` base `e5931061…`, K0 install commit `4cbde166…`.

## Landmines

- **The study root cannot be this repository or anything under `$HOME`.** The launcher
  refuses a workspace with a `CLAUDE.md`, `CLAUDE.local.md` or `.claude` ancestor, and
  the inspector needs the allocation root inside the input root with no symlinks. The
  prepared root is `/Users/Shared/pincer-v8-study` with the source as a detached worktree
  at `pincer-workflow/`; every `ref` in `study.json` is relative to that root, so the
  inspector must be run with `--input-root`, **and the manifest itself must be inside that
  root**: naming this repository's `study.json` with the study root fails `PATH_INVALID`.
  Point it at the study checkout's copy
  (`/Users/Shared/pincer-v8-study/pincer-workflow/docs/prd-v8-artifacts/execution/study.json`).
  The T-109 ticket's default-cwd verification command can therefore never pass a
  launchable manifest (corrected proposal in the package, §8 b).
- `plan()` materialises three repetitions of **every brief** unless `--repetitions` and
  `--briefs` limit it, and any planned record outside the approved schedule makes the
  allocator refuse every launch (`ALLOCATION_UNLISTED_RUN`). Test the operator entry point
  by spawning it; a suite that hands `ids` to `plan()` proves nothing about the CLI.
- `orchestrator.cjs` and `effective.cjs` are in `SPEC.harness`: after editing either,
  regenerate `test/fixtures/delivery-benchmark-v7/frozen.json` (command at the top of
  `freeze-spec.cjs`). Cohort moved `4113e10b…` → `f09e4312…` → `d1e57a17…` → `b0299e7e…`
  → `fef7ffdc…` on 2026-09-19 for the smoke launch path, `--briefs`, the canary and hook
  capture, then the graded hook evidence;
  zero paid runs existed. The dry-run effective cohort in the study root's `drafts/` moves
  with it (`976db3ee…` → `64325207…` → `141a70da…` → `12535053…`)
  and the honest draft must be regenerated (script pattern: recompute `effective.resolve`
  from the study checkout, refresh `execution.{candidate,effective.digest,
  observation_target,evidence_target,inputs[].digest}` and `schedule[].effective_digest`).
- The profile pins `--output-format json`, which captures only the final result object;
  switching to `stream-json` is a profile change and a new cohort. Kit **hook** firing no
  longer depends on it: the CLI's own hook debug log is captured (`f504c80`). Whether the
  pinned CLI's `hooks` debug category actually names each executed hook command and status
  is a smoke finding (`hook_capture.present` and the log content). `cleanup_complete` is
  retained in `record.environment` since `bffcfc8`; the ledger's `ALLOCATION_CLEANUP_UNKNOWN`
  stop is the second durable source.
- **Never observe isolation by reading the operator's real configuration.** The withdrawn
  proposal to digest `~/.claude` and grep captures for private text is replaced by the
  synthetic canary; the environment suite's hostile-home fixtures already prove the
  launcher inherits nothing from the operator's process.
- **An untriggered canary is not a demonstration.** Only a hook that ran or a phrase that
  was echoed is evidence (of a leak); "not loaded" needs positive evidence a reviewer finds
  elsewhere, else it stays `unknown`. Captures keep whatever the tool emitted, phrase
  included, so never claim "the phrase is never retained".
- **A fixture's `reportable: false` proves nothing about the gate.** Test `reportability()`
  directly and drive the orchestrator with the launcher's verdict (`unreportable`,
  `evidence_retention_failed`) as input.
- The real-browser gate defaults to `/Applications/Google Chrome` at 153.0.8010.48; point
  it at the pinned runtime with `PINCER_BROWSER_EXECUTABLE` and `PINCER_BROWSER_VERSION`.
  Google Chrome auto-updates, so T-107's pass on it is not evidence for a pinned copy.
- `claude --help` does not list `--max-turns`, but 2.1.273 accepts it (checked with a
  `--version` probe, parse-level only).

Review correction: unreadable or uncopyable hook evidence now preserves the original
protected session directory. Registration-only logs cannot pass. Historical external
study drafts must be refreshed for the corrected execution code before launch.
