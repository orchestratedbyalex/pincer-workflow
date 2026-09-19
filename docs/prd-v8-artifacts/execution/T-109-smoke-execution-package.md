# T-109 operational smoke — execution package

Prepared 19 September 2026 on `feat/prd-v8`; corrected the same day after review and
extended with the native-observation preparation (§12).
No paid session, study launch, external message, merge, publication or new project access
occurred. This package prepares the **first operational smoke** only; it authorizes nothing
and forecasts nothing.

Legend. **Verified**: checked in this session against bytes, commands or retained files.
**Proposed**: a recommendation that becomes binding only through a recorded decision.
**Decision**: the user (or a named reviewer) must decide; nothing here infers it.

The read-only inspector is the authority on readiness:
`node scripts/delivery-benchmark-v7/readiness.cjs --manifest … --purpose operational-smoke --require-ready`.
The checked-in [`study.json`](study.json) stays pending and lists the same gaps.

## 1. Execution identities

| Item | Value | Status |
| --- | --- | --- |
| Runner candidate | `feat/prd-v8` HEAD at handoff (SHA in the handoff report and the progress journal). The dry run below used `499fb6b`, the commit that graded hook evidence and separated the canary from demonstration (§12 items 4–5; `bffcfc8` added `--briefs`, `f504c80` the canary and hook capture); later commits are documentation only and leave the frozen inputs and helper closure unchanged. The reviewer pins the final SHA after CI runs on it. | Proposed |
| Study checkout | `/Users/Shared/pincer-v8-study/pincer-workflow`, a detached `git worktree` of the candidate; `execution.source_root` = `pincer-workflow`. | Proposed |
| CLI | Claude Code **2.1.273**, Mach-O arm64, 212 228 880 bytes, sha256 `953e9880dbcb0b70f31c1f508de6a3fd389753d131688557fd992da9184693fb`. Source: `~/.local/share/claude/versions/2.1.273` (the target of `~/.local/bin/claude`); copied byte-for-byte to `inputs/tool/claude-2.1.273` in the study root. The isolation profile `claude-project-isolated-v1` accepts exactly this version. The profile's full argument vector parses on this binary (`--version` probe; parse-level only, no session). | Verified |
| Model | `claude-sonnet-5`. Rationale: the v7 cohort pinned the `sonnet` alias, which the v8 contract no longer accepts; this is the current-generation resolution of that pin. Alternative: `claude-opus-5`. Reference prices (claude-api reference cached 2026-06-24, first-party API): Sonnet 5 $2/$10 per MTok in/out; Opus 5 $5/$25. The CLI must attest the same model string in its result payload or the session is unreportable; that attestation is a smoke finding, not a preparation fact. | Proposed / **Decision** |
| Browser | **Chrome for Testing 148.0.7778.97** (mac_arm), copied with links preserved from `~/.cache/puppeteer/chrome/mac_arm-148.0.7778.97/chrome-mac-arm64` to `inputs/browser/chrome-mac-arm64-148.0.7778.97`; 332 files, 5 internal links, runtime digest `2685936d99483c68ccf5d79373436e2164e8acb03a361ae3fe4763255f86e17d`; adapter `scripts/delivery-benchmark-v7/browser.cjs` (digest `c5687c608428c4883a60213e17787249f8172bb3605dcb00d997b008580baef7`). The real-browser gate (`test/benchmark-browser-live.test.js`) **passed today against this copy**; artifacts: `/Users/Shared/pincer-v8-study/evidence/browser-gate/pincer-browser-gate-T4HLFa`. Alternative: Google Chrome 153.0.8010.48 at `/Applications` (T-107's identity; 1.4 GB, auto-updating, so not pinnable in place). | Proposed / **Decision** |
| Kit K0 | v0.6.0 at peeled commit `694241cc684f2dd95a0cfe7ffa2827414683e84a`; artifact = npm registry tarball `pincer-workflow-0.6.0.tgz`, 244 142 bytes, sha256 `cb6c63f97b6cd780456807339e8d9d01dbc94ad3370594010dc1e4914c835009`, sha1 `a6bc2b6efa2a27164579b87ca12d3cf88b20e8a5` (equals the registry `dist.shasum`). `bin/`, `template/` and `package.json` are byte-identical to the commit; `README.md` differs (4 diff lines, the tag message explains why) and `LICENSE` exists only in the tarball. Copied to `inputs/kits/pincer-workflow-0.6.0.tgz`. K1 and K2 are not selected. | Verified (artifact acceptance is a **Decision**) |
| Platform | darwin 25.6.0 (macOS 26.6.2) arm64, Node v22.23.1; recorded by the resolver. | Verified |
| Management kit | `/tmp/pincer-v8-management-694241c/scripts`, 34 files byte-identical to `v0.6.0:template/scripts`; aggregate digest `c0354c6452d0f5605a7d5a28c385321df4fc7fe7b5fe46fd7d6284cfc1d35cb9` (sorted `scripts/<path>` + NUL + content). | Verified |
| Isolation configuration | `permission_mode: manual`, `cwd_kind: scratch`, `isolation_profile: claude-project-isolated-v1`; per-session `HOME`, `CLAUDE_CONFIG_DIR`, `TMPDIR` holding only the synthetic canary (§5); `--setting-sources project`, `--permission-prompts none`, explicit empty MCP, no Chrome integration, no session persistence; `--debug hooks --debug-file <session>/debug.log` for the hook capture (§5). Observation target `d53ff6f0…` (profile, tool, model, kit, platform). | Verified (code) |

### Study root layout (Proposed)

```
/Users/Shared/pincer-v8-study/           input root (--input-root / --study-input-root)
  pincer-workflow/                       source_root: detached worktree at the candidate
  inputs/tool/claude-2.1.273             CLI copy
  inputs/kits/pincer-workflow-0.6.0.tgz  K0
  inputs/browser/chrome-mac-arm64-148.0.7778.97/   browser runtime (browser_runtime_root)
  runs/smoke/                            allocation root (empty until the first reservation)
  evidence/                              retained gate artifacts and, later, smoke summaries
  decisions/                             decision documents, once made
  drafts/                                dry-run files; not evidence
```

Why not the repository or the home directory: the launcher refuses any workspace with a
`CLAUDE.md`, `CLAUDE.local.md` or `.claude` ancestor (`rejectAncestorInstructions`), which
excludes everything under this repository and under `/Users/alex`; the inspector requires
the allocation root and every referenced artifact inside the input root and refuses
symbolic links. `/Users/Shared` has no such ancestor and survives reboots (unlike `/tmp`).
Consequence: every `ref` in `study.json` is relative to the study root, so the inspector
must be run with `--input-root /Users/Shared/pincer-v8-study` (see §8 b).

## 2. Smoke sessions

Brief `ui-states` (one prompt, needs the browser, so the smoke exercises browser
preflight, session capture, the stop path and browser-backed independent evaluation).
Three sessions, one per arm, in the orchestrator's repetition-1 order.

| Order | Session id | Run | Arm | Prompt digest (sha256 of the delivered prompt) |
| --- | --- | --- | --- | --- |
| 1 | `smoke-1-pincer` | `ui-states/rep-1/pincer` | pincer | `152143dd60b7a98430464793178c3f349ed55eecfe7510dc9648e2cbd65307d8` |
| 2 | `smoke-1-strict` | `ui-states/rep-1/strict` | strict | `19ea7fde56f957de358f320fc341803c58dc2bff55b6645b41e504011d52a4d2` |
| 3 | `smoke-1-plain` | `ui-states/rep-1/plain` | plain | `e96d5cb31e05b762bf0af0d6d27e6cf1760f2d0296142becafcbc1020f553579` |

Project base (Verified, reproducible offline with the fixed preparation date):
`e5931061a4d3179302f96d4d3f15a09365f97b90`. Kit-install commit over it for both kit arms:
`4cbde1667dbb2cbb90370570d78ece07e4ca2f1c` (parent = base; 16 intended kit assets).

Exact prompts (delivered on stdin; the task itself is the workspace `BRIEF.md`, i.e.
`test/fixtures/delivery-benchmark-v7/briefs/ui-states/brief.md`):

- plain, verbatim:

  ```
  Read BRIEF.md in this repository and implement what it asks for, committing your work as
  you go. Work autonomously; when you are done, stop and summarize what you built.
  ```

- pincer: the line `This repository has the PINCER workflow kit installed. Use it for this work.`
  followed by a blank line, then the plain prompt.
- strict: the line `This repository has the PINCER workflow kit installed. Use it for this work, and adopt strict coverage for each change you make (`coverage adopt --preview`, then `coverage adopt --apply`) before you implement it.`
  followed by a blank line, then the plain prompt.

Tool invocation per session (from `isolated-launch.argumentsFor`), with `<model>` and the
caps taken from the effective manifest:

```
claude --print --model <model> --permission-mode manual --permission-prompts none
  --setting-sources project --settings <session>/settings.json --strict-mcp-config
  --mcp-config {"mcpServers":{}} --no-chrome --no-session-persistence
  --max-turns 3 --max-budget-usd 1 --debug hooks --debug-file <session>/debug.log
  --input-format text --output-format json
```

Environment: exactly `PATH`, `HOME`, `CLAUDE_CONFIG_DIR`, `TMPDIR`, `LANG`, `LC_ALL`,
`CLAUDE_PROJECT_DIR`, `ANTHROPIC_API_KEY`, `GIT_CONFIG_NOSYSTEM`, `GIT_CONFIG_GLOBAL`.
Nothing is inherited from the operator's shell.

Proposed schedule block (values from the dry run; `effective_digest` changes if any
decision differs from the proposal):

```json
[
  {"id":"smoke-1-pincer","run":"ui-states/rep-1/pincer","name":"S1","arm":"pincer","purpose":"operational-smoke","project":"ui-states","kit":"K0","prompt_digest":"152143dd60b7a98430464793178c3f349ed55eecfe7510dc9648e2cbd65307d8","effective_digest":"125350537812cae3cb7de548f578b4f510b5e85c12cb1015f68e0f419fd0d24b"},
  {"id":"smoke-1-strict","run":"ui-states/rep-1/strict","name":"S1","arm":"strict","purpose":"operational-smoke","project":"ui-states","kit":"K0","prompt_digest":"19ea7fde56f957de358f320fc341803c58dc2bff55b6645b41e504011d52a4d2","effective_digest":"125350537812cae3cb7de548f578b4f510b5e85c12cb1015f68e0f419fd0d24b"},
  {"id":"smoke-1-plain","run":"ui-states/rep-1/plain","name":"S1","arm":"plain","purpose":"operational-smoke","project":"ui-states","kit":"K0","prompt_digest":"e96d5cb31e05b762bf0af0d6d27e6cf1760f2d0296142becafcbc1020f553579","effective_digest":"125350537812cae3cb7de548f578b4f510b5e85c12cb1015f68e0f419fd0d24b"}
]
```

## 3. Caps, allocation and time limits (Proposed / **Decision**)

| Field | Proposed | Meaning in the implementation |
| --- | --- | --- |
| `caps.turns_per_session` | 3 | `--max-turns 3`; the provider ends the session with `error_max_turns` |
| `caps.wall_clock_minutes` | 2 | supervisor watchdog; exit 124 plus the cap marker |
| `caps.spend_usd` | 1 | `--max-budget-usd 1`; a client-side limit, not a provider billing cap |
| `allocation.id` / `root` | `v8-smoke-1` / `runs/smoke` | ledger at `runs/smoke/.allocation/state.json` |
| `allocation.limit_usd` | 3 | admission stops when known spend + 1 would exceed it |
| `allocation.session_cap_usd` | 1 | must equal `caps.spend_usd` |
| `allocation.session_wall_minutes` | 2 | must equal `caps.wall_clock_minutes` |
| `allocation.max_elapsed_minutes` | 20 | counted from the **first reservation**, covering all three sessions, their setup and evaluation, and operator inspection between invocations; the next session is refused when elapsed + 2 would exceed it |
| `allocation.expires_at` | decision timestamp + 7 days | after expiry only settlement is possible |

The protocol proposes "six session-minutes" plus "a separate ten-minute operator
deadline"; the manifest has one elapsed-time field, so 20 minutes is the proposed
combination (see §8 c). Failed, interrupted and discarded sessions consume the same
allocation. No cost forecast is made.

## 4. Launch procedure (exact commands; not to be run before every decision exists)

1. Inspect from the study root; it must print `ready: true`, `phase: offline-ready-for-smoke`:

   ```sh
   cd /Users/Shared/pincer-v8-study
   node pincer-workflow/scripts/delivery-benchmark-v7/readiness.cjs \
     --manifest pincer-workflow/docs/prd-v8-artifacts/execution/study.json \
     --input-root /Users/Shared/pincer-v8-study --purpose operational-smoke --require-ready
   ```

2. Plan the three cells (no session). It must print `3 cells, 3 newly planned` and leave
   exactly `ui-states/rep-1/{pincer,strict,plain}/record.json` under `runs/smoke`:

   ```sh
   cd /Users/Shared/pincer-v8-study/pincer-workflow
   node scripts/delivery-benchmark-v7/orchestrator.cjs \
     --runs /Users/Shared/pincer-v8-study/runs/smoke \
     --execution-inputs docs/prd-v8-artifacts/execution/smoke-execution-inputs.json \
     --input-root /Users/Shared/pincer-v8-study \
     --study-manifest docs/prd-v8-artifacts/execution/study.json \
     --study-input-root /Users/Shared/pincer-v8-study \
     --study-purpose operational-smoke --repetitions 1 --briefs ui-states --plan-only
   ```

   `--briefs` is required for an operational smoke: without it the command is refused
   (exit 2) and plans nothing. Before `bffcfc8` the entry point had no brief selection and
   this command planned all eight briefs (24 cells), which the allocation's unlisted-run
   guard would then have refused (§12). Verified against the study root with the proposed
   inputs into `drafts/plan-dry-run/` (a draft, not evidence; re-run at `499fb6b`): `cohort 12535053…`, three
   records, `order` 1 pincer, 2 strict, 3 plain; `runs/smoke` stays empty.

   (`smoke-execution-inputs.json` is the decided version of the
   [proposed inputs](smoke-execution-inputs.proposed.json).)

3. Launch one session per invocation. The operator supplies `ANTHROPIC_API_KEY` in that
   shell only, then runs the same command without `--plan-only` and with
   `--i-have-a-spending-cap`. An operational session finalizes its cell as an invalid
   operational record and **stops the schedule**, so the command exits 1 with
   `stopped at ui-states/rep-1/<arm>`; inspect the artifacts, then repeat for the next
   arm. The orchestrator re-runs readiness, accounting and reservation before each launch.

4. After the third session, regenerate the reports offline (§5) and write the smoke and
   native summaries for review.

## 5. Checks the smoke must show, and where each is observed

Evidence root: `runs/smoke/ui-states/rep-1/<arm>/` (`record.json`, `attempts/attempt-000001/{workspace,scratch,logs}`;
`logs/` holds `S1.json`, `S1.err` and the redacted hook log `S1.debug.log`).

| Check | Observed in | Judged by |
| --- | --- | --- |
| `payload_capture` | `logs/S1.json` (final provider result), `logs/S1.err`; `record.measurement` | a parsed `type: result` with `modelUsage`, `total_cost_usd`, `duration_api_ms`; cost/token/provider-minute totals complete; the key never appears in captures |
| `isolation` | `record.environment` (`env_names`, `isolation_profile`, `permission_mode`, requested vs attested model); session root removed after the run | only the ten profile variables; no personal settings, plugins or MCP; attested model equals the requested one |
| `browser` | preflight probe before the first paid cell; evaluation artifacts (PNG + JSON) under `scratch/`; `record.evaluation.checks[].observed` | version `148.0.7778.97`, native input and screenshot capability; the ui-states checks were observed in the real browser |
| `stop` | `record.events` intervention `S1:cap` (provider `error_max_turns`) or exit 124 with the wall-clock marker in `S1.err`; no second prompt; orchestrator exit 1 after each cell | one session per cell, ended by a predeclared cap or by natural completion within it |
| `cleanup` | `record.environment.cleanup_complete: true` (retained by the launcher since `bffcfc8`; before that the flag reached only the caller); `.allocation/state.json`: the reservation is `settled` with `actualUSD` and `stopped` is `null` or carries a code other than `ALLOCATION_CLEANUP_UNKNOWN`; `record.evaluation` present (an operational session is evaluated only when cleanup completed) | process group observed gone by the supervisor; ledger settled; no surviving `claude` process at inspection (operator check, not retained) |
| `report_regeneration` | offline recomputation from retained files only | the command below reproduces the stored measurement block and validates the record |

The four native observations separate what the launcher **configured** (retained at or
before launch, true regardless of what the session did) from what the session **showed**
(retained after it). Only the second column is observation; the first is construction.
Nothing personal is read: isolation is observed through a **synthetic canary** the
launcher plants and checks itself, and kit hooks through the CLI's own **hook debug log**,
retained redacted (`f504c80`, graded in `499fb6b`; `docs/prd-v8-agent-isolation.md`). The profile still keeps
`--output-format json`, so conversation content stays unobservable (§8 e); the two
additions do not depend on it.

| Native observation | Configured (retained at launch) | Observed (retained after the session) | Still not observable |
| --- | --- | --- | --- |
| `host_policy` | `record.environment.permission_mode: manual`, `permission_prompts: none`, `configuration` (the profile) and `env_names`; the argument vector is `isolated-launch.argumentsFor` | `logs/S1.json`: the result's `permission_denials` entries name tool uses the CLI denied automatically (the 2.1.273 help text: anything that would prompt is denied); the workspace commits and `record.evaluation` show what the session could still do; `S1.err` shows any refusal text the CLI printed | which tool calls were attempted, and whether a denial changed the session's course |
| `authentication` | `record.environment.authentication` (profile: key in memory only), `env_names` without any `ANTHROPIC_AUTH_TOKEN`/proxy variable (the key's own name is filtered from the list), a `CLAUDE_CONFIG_DIR` that holds only the canary, so no keychain or subscription login is reachable | a billed result (`total_cost_usd` > 0, `modelUsage`) obtained with that config dir, which only the launcher's key can have paid for; `grep -r 'sk-ant-' logs/` finds nothing, `[REDACTED]` at most | the Console usage line for the key's workspace (operator check; external, not retained) |
| `personal_configuration_absent` | `env_names` equals the ten profile variables with `HOME`/`CLAUDE_CONFIG_DIR`/`TMPDIR` under the session root that is removed after the run; `--setting-sources project`, empty MCP, `--no-chrome`, `--no-session-persistence`; the canary planted in both user-level locations: `settings.json` with a `SessionStart` hook that touches a marker, `CLAUDE.md` with a random per-session phrase | `record.environment.isolation_canary`: `leak_detected: false` with `user_hook_ran: false` in all three records **refutes nothing and demonstrates nothing by itself**; `user_settings_loaded` and `user_instructions_loaded` are `true` only on positive evidence (hook ran; phrase echoed to `S1.json`, `S1.err` or `S1.debug.log`) and otherwise `unknown`, because settings can load without their hook running and instructions can load without being echoed. A tripped canary (`leak_detected: true`) is unreportable, and the phrase then sits in the captures: the launcher writes none into the record, captures keep what the tool emitted. The operator's real `~/.claude` is never read, hashed or compared | whether user-level files were loaded when nothing echoed them. `personal_configuration_absent: true` in the reviewed observation needs more than an untriggered canary: the hook log's settings-source or matcher lines (format unverified), or a reviewer's explicit judgment; otherwise it stays open |
| `kit_mechanisms` | `attempt.configuration_digest` equals the intended arm inventory (`assetsFor`), checked before launch or `ARM_ASSETS_CHANGED` refuses; the retained workspace holds the installed `CLAUDE.md`, `.claude/commands`, `.claude/hooks` and `settings.json` hook registrations at the kit-install commit `4cbde166…` | **hooks**: `logs/S1.debug.log`, the CLI's hook log (`--debug hooks`), retained redacted; `record.environment.hook_capture { present, retained, file, bytes }` and `hook_evidence { status, required, missing }`. For a kit arm the retained log must name both `.claude/hooks/block-dangerous.sh` and `.claude/hooks/ticket-guard.sh` (`sufficient`); `missing`, `unreadable`, `unretained` or `insufficient` makes a measured session unreportable with the reason in `record.reason`; a retention failure preserves the raw or redacted log in the attempt's `scratch/` and stops the allocation (`ALLOCATION_EVIDENCE_UNRETAINED`) until a recovery decision. **Commands and instructions**: artifacts only kit commands write in the retained `workspace/` and its git history (`tickets/*.md` receipts, `.prd/`, evidence files, `coverage adopt` records for the strict arm) | the model's reasoning about the instructions; and, until the first session, whether the pinned CLI's `hooks` debug category names each executed hook command and status (documented behavior, not yet observed; `hook_evidence.status` other than `sufficient` would be the finding, and it blocks measured reportability by construction) |

The reviewed `native-isolation-observation` (T-102 format) is written from these retained
files: `personal_configuration_absent` only if `leak_detected: false` in all three
records **and** the reviewer finds positive evidence that user-level files were not loaded
(an untriggered canary alone leaves it `unknown`); `authentication_observed` from the
billed results; `host_policy_observed` from the permission posture and denials;
`evidence` lists the three `record.json`, `S1.json`, `S1.err` and `S1.debug.log` files
by digest, and each `hook_evidence.status` must be `sufficient`.

Offline regeneration (no model call):

```sh
node -e "const p=require('node:path'),fs=require('node:fs');const h='scripts/delivery-benchmark-v7';const effort=require('./'+h+'/effort.cjs'),usage=require('./'+h+'/usage.cjs');const home=process.argv[1];const r=JSON.parse(fs.readFileSync(p.join(home,'record.json')));const c=usage.collect(home,r);console.log(JSON.stringify({problems:effort.problems(r),report:effort.report(r),measurement:c.measurement.sessions.map(s=>({id:s.id,cost:s.metrics.cost_usd.value}))},null,2))" /Users/Shared/pincer-v8-study/runs/smoke/ui-states/rep-1/<arm>
```

Expected terminal state per cell: `status: invalid`, reason
`Operational smoke session: retained as operational evidence, never a study result.`
(or, if the attested model is missing, the attestation reason — a real finding), one
attempt with one session, an evaluation present, and `effort.problems(record)` empty.

## 6. Authentication prerequisites (no secret values here)

- An Anthropic **API key** for a workspace that can spend at least the allocation, exported
  as `ANTHROPIC_API_KEY` in the launching shell only. The launcher reads it from its own
  environment, passes it to the child, redacts it from captures, and never writes it.
  This session had no key (`ANTHROPIC_API_KEY` unset).
- Subscription/OAuth credentials are not used: each session runs with an empty
  `CLAUDE_CONFIG_DIR`, so the operator's keychain login is invisible by design.
- No key, key hash, private instruction text or environment dump may enter any tracked
  file; the inspector refuses secret-shaped content and protected paths.
- `gh` is authenticated on this host (used read-only to retrieve CI results).

## 7. Stop and resume rules, and where evidence lives

- Manifest `stop_resume`: unknown cost, account limit, exhausted allocation and changed
  inputs all **stop**; resume requires an explicit recorded decision. This is already set.
- Allocation ledger (`runs/smoke/.allocation/state.json`): a stop is recorded for unknown
  cost, provider account/quota limit, observed cost above the session cap, or unresolved
  process cleanup. A stopped or unresolved allocation admits nothing.
- Resume: a recovery decision document (`schema: 1`, `approved: true`, `allocation`,
  `manifestDigest`, `reservation`, `action: cancel|resume`) applied through
  `allocation.reconcile`; expired authority permits settlement only.
- Evidence: run records and captures under `runs/smoke/`; browser gate artifacts under
  `evidence/browser-gate/`; dry-run files under `drafts/` (never evidence); decision
  documents and evidence summaries under `decisions/` and `evidence/` once written; CI
  on GitHub (PR #6).

## 8. Sequencing conflicts and proposed protocol corrections (for review; not applied)

a. **Three-arm smoke before K2.** Executable: all three arms use K0 (the kit is installed
   in the pincer and strict workspaces; plain receives none). But the native observation
   target binds the kit identity and the evidence target binds the whole effective block,
   so this smoke closes T-109 and T-102's native criteria **for the K0 execution identity
   only**. K1 (T-110) and K2 (T-114/T-115) each need their own capped operational smoke
   and native observation under their own effective manifest and allocation. Smallest
   correction to `docs/prd-v8-protocol.md` §"Proposed first allocation": add "The first
   smoke uses K0 for all three arms. Every later kit cohort (K1, K2) requires its own
   separately authorized smoke and native observation before measured use; smoke evidence
   does not transfer across kits." (Editing the protocol re-freezes the cohort; do it
   before, not after, the effective manifest is minted.)
b. **Input root versus the ticket's verification command.** T-109's block runs the
   inspector from the repository with the default input root, which can never validate
   a launchable manifest (§1). The first proposed correction (adding `--input-root` while
   still naming this repository's `study.json`) was wrong: the manifest itself must be
   inside the declared root, so it fails with `PATH_INVALID` before reading anything
   (exercised 19 Sep 2026, exit 2). Corrected proposal, run from the repository root,
   naming the study checkout's copy of the manifest:

   ```sh
   node scripts/delivery-benchmark-v7/readiness.cjs \
     --manifest /Users/Shared/pincer-v8-study/pincer-workflow/docs/prd-v8-artifacts/execution/study.json \
     --input-root /Users/Shared/pincer-v8-study --purpose operational-smoke --require-ready
   ```

   Exercised 19 Sep 2026 with the worktree at `bffcfc8` (the tracked manifest is identical
   in both checkouts): exit 2, `phase: pending`, and exactly the actual gaps:
   `EXECUTION_IDENTITY_PENDING`, `PROJECT_ACCESS_PENDING`, `INDEPENDENT_REVIEWERS_PENDING`,
   `EXACT_SCHEDULE_PENDING`, `NUMERIC_ALLOCATION_PENDING`, `ACTUAL_AUTHORIZATION_PENDING`
   and `RETAINED_EVIDENCE_PENDING` for offline, browser, packed and ci. The
   `REQUIRED_ARTIFACT_UNAVAILABLE` that the default-root form reports for `kits` is gone,
   because K0's artifact is now resolved inside the declared root. Once the smoke evidence
   exists, drop `--purpose operational-smoke` for the measured gate. The ticket's block
   is unchanged pending the reviewer's decision (§10 item 11); re-verify through the
   pinned kit after the edit.
c. **Elapsed-time semantics.** The protocol names two deadlines; the manifest has one
   field measured from the first reservation. Proposed wording: "The allocation's single
   `max_elapsed_minutes` covers sessions, setup, evaluation and operator inspection."
d. **Smoke launch path.** Before this preparation the orchestrator accepted only the
   measured purpose and always planned three repetitions, so no in-tree command could
   launch the smoke and a three-session allocation would have refused every launch
   (`ALLOCATION_UNLISTED_RUN`). Commit `d43a6ce` adds `--study-purpose operational-smoke`
   and `--repetitions 1`, finalizes operational sessions with an explicit operational
   reason after independent evaluation, and stops after each. Commit `bffcfc8` adds
   `--briefs <id,...>` and requires it for an operational smoke, because the entry point
   had no brief selection and the documented command planned all eight briefs (§12). The
   protocol's readiness section could name those three options.
e. **Capture format.** The profile pins `--output-format json`, which retains only the
   final result object. Whether that suffices to observe host policy is a reviewer judgment; kit hook
   execution and personal-configuration absence no longer depend on it (§5: the hook
   debug log and the synthetic canary are captured separately); `stream-json` would retain
   every message but changes the frozen profile (new cohort) and must be decided before
   the effective manifest is minted.
f. **K0 artifact provenance.** The registry tarball was published from `566b553`; the
   K0 commit is `694241c`. Executable content is identical; README differs. Accept the
   registry tarball as K0's artifact, or repack from the commit (a different digest).

## 9. Readiness blockers (read-only inspector, this preparation)

From the study root with the honest draft (real facts, decisions null; regenerated 19 Sep
2026 against `499fb6b`, `drafts/study.draft.json`, dry-run effective cohort `12535053…`,
observation target `d53ff6f0…`),
purpose `operational-smoke`: the execution block and K0 validate; remaining pending reasons are
`PROJECT_ACCESS_PENDING`, `INDEPENDENT_REVIEWERS_PENDING`, `SCHEDULE_INPUT_UNBOUND`
(follows from the missing project), `NUMERIC_ALLOCATION_PENDING`,
`ACTUAL_AUTHORIZATION_PENDING` and `RETAINED_EVIDENCE_PENDING` for offline, browser,
packed and ci. Purpose `measured` adds the native observation and the native, smoke and
report summaries. From the repository with the tracked manifest, `execution`, `schedule`
and `allocation` are also pending and `kits` reports `REQUIRED_ARTIFACT_UNAVAILABLE`
because the artifact lives in the study root. Through the study checkout's copy of the
tracked manifest with `--input-root` (the corrected §8 b command), `kits` validates and the
pending list is the ten actual gaps listed there.

| Blocker | Resolvable by the agent | Needs user or reviewer |
| --- | --- | --- |
| execution identity | yes, once model, browser and caps are decided: resolve, retain the effective manifest, fill `execution` | model, browser runtime, caps |
| projects | base SHA computed | project-access decision document |
| reviewers | no | two independent reviewer ids and participation decisions |
| schedule | yes, once projects and execution exist | none beyond the above |
| allocation | yes, once numbers are decided | numbers and expiry |
| authorization | no | `study-authorization` decided by `user`, binding purpose, allocation and the canonical schedule digest |
| evidence.offline/packed | summaries can be drafted from the suite results | reviewer decision |
| evidence.browser | summary can be drafted from today's gate artifacts (identity-matched) | reviewer decision |
| evidence.ci | no run exists for the candidate yet | push the branch, wait for the matrix, reviewer decision |
| native / smoke / report | no | the authorized smoke itself, then review |

## 10. Decisions requested (bundle)

1. Model: `claude-sonnet-5` (proposed) or `claude-opus-5`.
2. Browser runtime: pinned Chrome for Testing 148.0.7778.97 (proposed) or a copy of Google Chrome 153.0.8010.48.
3. Caps 3 turns / 2 minutes / $1 per session; allocation $3, 20 elapsed minutes, expiry, ids as in §3.
4. Project access: a `project-access-decision` for `ui-states` at base `e5931061…`.
5. Reviewers: two independent reviewer ids and their participation decisions.
6. Authorization: a `study-authorization` decided by `user` for purpose `operational-smoke`.
7. K0 artifact: accept the registry tarball (§8 f).
8. Study root: `/Users/Shared/pincer-v8-study` (proposed).
9. Capture format: keep `json` or switch the profile to `stream-json` (§8 e).
10. Candidate pin and CI: push `feat/prd-v8`, then pin the SHA whose matrix passed.
11. Ticket verification command: **applied** in `07af4be` — the block now reads the study checkout's manifest with `--input-root` and keeps the measured `--require-ready` gate as the completion criterion (14 pending reasons today, including the native, smoke and report evidence). The reviewer confirms the wording.

Document shapes the inspector accepts (all `schema: 1`, `approved: true`, `decided_by`,
`decided_at`, nonempty `evidence: [{ref, digest}]`): `project-access-decision` adds
`project`, `base`; `reviewer-participation-decision` adds `reviewer`, `independent: true`;
`study-authorization` adds `purpose`, `allocation_id`, `limit_usd`, `session_cap_usd`,
`session_wall_minutes`, `max_elapsed_minutes`, `expires_at`, `schedule_digest` and must
be decided by `user`; `evidence-review-decision` adds `reviewer`, `candidate`,
`kind_reviewed`. Evidence summaries carry `kind`, `candidate`, `execution_target`,
`result: "passed"`, `fixture` (`false` for browser, native, smoke, report),
`evidence`, `review: {reviewer, decision}`, plus `matrix` for ci and `arms`/`checks`/
`purpose` for native and smoke.

## 11. Current evidence and whether it matches the proposed identity

| Kind | Current raw evidence | Matches proposed identity | Missing for a retained summary |
| --- | --- | --- | --- |
| offline | Focused suites after each harness change, all passed locally 19 Sep 2026 (after `499fb6b`: environment with the canary, hook-evidence, retention-fault and gate cases, allocation with the evidence stop, study-launch with the orchestration-path cases, delivery-benchmark-v7, execution-freeze, study-launch, orchestrator, effective-inputs, study-readiness, restart, terminal-records, readiness-contracts, allocation, prepared-bases, run-claims, browser, usage-completeness, effort-records). Full `npm test` result: see the progress journal. | yes (same tree) | summary bound to the candidate and evidence target; reviewer decision |
| browser | Real-browser gate passed 19 Sep 2026 on CfT 148.0.7778.97 (artifacts in the study root). T-107's earlier pass used Google Chrome 153.0.8010.48 at `/Applications` and does **not** match. | yes, for the proposed runtime | summary; reviewer decision |
| packed | `test/distribution.test.js` and `test/release-preparation.test.js` are part of the full suite. | yes (same tree) | summary; reviewer decision |
| ci | PR #6 runs `35447528639` and `35447527131` on `48df59c`: ubuntu/macos × Node 22/24, eight checks `SUCCESS`, completed 14:12–14:19Z. That commit **predates** the harness change. | no (older commit) | a run on the final candidate; summary; reviewer decision |
| native, smoke, report | none | — | the authorized smoke |

## 12. Corrections after review (19 September 2026)

An independent review of this package found three defects; all are fixed, none required
a decision.

1. **The launch command planned 24 cells, not three** (high). `orchestrator.cjs main()`
   never passed a brief list to the schedule, so `--repetitions 1` applied to all eight
   briefs; the suites missed it because they handed `ids` to the internal API. Fixed in
   `bffcfc8`: `--briefs <id,...>` selects briefs in schedule order and an operational smoke
   must name them (`effective.parseArgs`). `test/benchmark-study-launch.test.js` now spawns
   the documented command and asserts exactly `ui-states/rep-1` pincer, strict, plain in
   `order` 1, 2, 3, idempotent replanning, and that a refused invocation plans nothing.
   The frozen cohort moved `f09e4312…` → `d1e57a17…` (harness digest only); the dry-run
   effective cohort moved `976db3ee…` → `64325207…` (§2, §9). Zero paid runs exist.
2. **The proposed verification command failed with `PATH_INVALID`** (medium). The
   manifest must be inside the declared input root. §8 b now names the study checkout's
   manifest and records the exercised pending list.
3. **The evidence plan overstated retention** (medium). `cleanup_complete` was returned
   to the caller but not written anywhere durable; `bffcfc8` retains it in
   `record.environment`, and the ledger's stop code is named as the second source. §5
   now separates configured from observed evidence for each native observation and
   states what `json` capture cannot show, in particular kit hook execution.
4. **Native-observation preparation finished** (`f504c80`, `07af4be`). The earlier §5
   proposal to digest the operator's real `~/.claude` and compare captures against private
   instruction text is withdrawn: nothing personal is read. Instead the launcher plants a
   **synthetic canary** (user-level `settings.json` with a `SessionStart` hook touching a
   marker, and a `CLAUDE.md` with a random per-session phrase) in the per-session
   `HOME/.claude` and `CLAUDE_CONFIG_DIR`, and records `isolation_canary`; a tripped canary
   is unreportable (verdict shape corrected in item 5). For kit hooks
   the argv adds `--debug hooks --debug-file <session>/debug.log` and the launcher retains
   a redacted copy as `logs/S1.debug.log` with `hook_capture`;
   stdout, result parsing, accounting, redaction and interruption handling are unchanged.
   The environment suite exercises a compliant tool, a leaking tool, debug redaction and a
   recorded absence. Profile fields `home: per-session-synthetic-canary` and
   `hook_capture: debug-hooks-file` move the observation target `8af4d99d…` →
   `d53ff6f0…`; cohort `d1e57a17…` → `b0299e7e…`; dry-run effective cohort `64325207…` →
   `141a70da…`. The ticket's Verification block now reads the study checkout's manifest and
   keeps the measured gate. Open smoke findings, not preparation facts: whether the CLI's
   `hooks` debug category writes the executed hook commands and their status to the
   debug file (`hook_capture.present` and the log content), and whether `--debug-file`
   keeps stdout clean (result parsing would fail loudly otherwise and the session would
   finalize invalid; no further paid prompt follows).
5. **Two observation issues fixed** (`499fb6b`). (a) The canary verdict claimed too much:
   `ok: true` read as "isolation demonstrated" when it only meant "not triggered", and
   the earlier text here said "the phrase is never retained", which the leaking fixture
   contradicts (its captured stdout holds the phrase). Now `isolation_canary` records
   `leak_detected`, `user_hook_ran`, `user_settings_loaded` and `user_instructions_loaded`,
   the last two `true` on positive evidence and otherwise `unknown`; the launcher writes no
   phrase into the record, captures keep what the tool emitted. (b) Hook evidence was
   recorded but never gated: `hook_evidence.status` (`missing`, `unreadable`, `unretained`,
   `insufficient`, `sufficient`; a kit arm needs both hook scripts named) now feeds one
   `reportability()` gate whose every deficiency is a named reason written into
   `record.reason`; a retention failure preserves a redacted or, failing that, raw copy in
   the attempt's `scratch/`, and stops the allocation (`ALLOCATION_EVIDENCE_UNRETAINED`)
   until a recovery decision. Tested at the gate, through the fixture tool (compliant,
   leaking, partial-log, retention-fault), in the allocator, and through the orchestration
   path with the launcher's verdict as input. Cohort `b0299e7e…` → `fef7ffdc…`; dry-run
   effective cohort `141a70da…` → `12535053…`; observation target unchanged `d53ff6f0…`.
