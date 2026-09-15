#!/usr/bin/env bash
# PRD v7 T-94 (R-08) — the live session driver.
#
# This is the one file in the v7 harness that spends money, and it is frozen like every
# other input: its digest is part of the cohort identity, so changing how a session is
# invoked starts a new cohort rather than quietly mixing two kinds of run in one table.
#
# It is NEVER reached by `npm test`. The offline suite drives the harness with controlled
# fixtures and a fake browser adapter; nothing in the default test path can invoke a
# model. Running this requires an explicit opt-in AND the execution prerequisites the
# protocol lists as outstanding (docs/prd-v7-protocol.md, section 9): the three projects,
# the access decision, a spending cap and a wall-clock cap. It refuses without them,
# because the failure mode here is not a broken run — it is an unbudgeted one.
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
usage: live-driver.sh --run <brief/rep-N/arm> --workspace <dir> --prompt-file <file> \
                      --model <id> --max-turns <n> --wall-clock-minutes <n> \
                      --cohort <64-hex> --i-have-a-spending-cap

Every flag is required. --i-have-a-spending-cap is the explicit opt-in: it asserts that a
concrete spending cap has been agreed and recorded in the run schedule. The driver does
not enforce the cap itself — no local flag can — it refuses to run without the assertion
so that spending is a decision someone made, never a default.
EOF
  exit 2
}

RUN=""; WORKSPACE=""; PROMPT_FILE=""; MODEL=""; MAX_TURNS=""; WALL_CLOCK=""; COHORT=""; OPT_IN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --run) RUN="${2:-}"; shift 2 ;;
    --workspace) WORKSPACE="${2:-}"; shift 2 ;;
    --prompt-file) PROMPT_FILE="${2:-}"; shift 2 ;;
    --model) MODEL="${2:-}"; shift 2 ;;
    --max-turns) MAX_TURNS="${2:-}"; shift 2 ;;
    --wall-clock-minutes) WALL_CLOCK="${2:-}"; shift 2 ;;
    --cohort) COHORT="${2:-}"; shift 2 ;;
    --i-have-a-spending-cap) OPT_IN=1; shift ;;
    *) echo "live-driver: unknown option $1" >&2; usage ;;
  esac
done

[ -n "$RUN" ] && [ -n "$WORKSPACE" ] && [ -n "$PROMPT_FILE" ] || usage
[ -n "$MODEL" ] && [ -n "$MAX_TURNS" ] && [ -n "$WALL_CLOCK" ] && [ -n "$COHORT" ] || usage

if [ "$OPT_IN" -ne 1 ]; then
  echo "live-driver: refused: no spending cap has been asserted for $RUN." >&2
  echo "live-driver: the 72-run schedule is substantive spending and must be costed before" >&2
  echo "live-driver: execution (docs/prd-v7-protocol.md, section 9). Pass --i-have-a-spending-cap" >&2
  echo "live-driver: only when a concrete cap is agreed and recorded in the run schedule." >&2
  exit 3
fi
case "$COHORT" in
  *[!0-9a-f]* | "") echo "live-driver: --cohort must be the 64-hex cohort identity" >&2; exit 4 ;;
esac
[ "${#COHORT}" -eq 64 ] || { echo "live-driver: --cohort must be the 64-hex cohort identity" >&2; exit 4; }
# The caps are arithmetic below, not decoration: a non-numeric or zero cap would compute a
# zero-second deadline and kill every session on the starting line.
case "$MAX_TURNS" in
  "" | 0 | *[!0-9]*) echo "live-driver: --max-turns must be a positive whole number" >&2; exit 4 ;;
esac
case "$WALL_CLOCK" in
  "" | 0 | *[!0-9]*) echo "live-driver: --wall-clock-minutes must be a positive whole number of minutes" >&2; exit 4 ;;
esac
[ -d "$WORKSPACE" ] || { echo "live-driver: no workspace at $WORKSPACE" >&2; exit 4; }
[ -f "$PROMPT_FILE" ] || { echo "live-driver: no prompt file at $PROMPT_FILE" >&2; exit 4; }

# The prompt is the brief's own text, copied verbatim. The driver adds nothing to it: a
# driver that coaches is measuring itself rather than the workflow. Read before the `cd`
# below, so a workspace-relative --prompt-file still resolves against the caller's cwd.
PROMPT="$(cat "$PROMPT_FILE")"

# The session runs IN the prepared workspace. Without this the session would inherit the
# caller's working directory and a bypassPermissions agent would edit whatever tree the
# operator happened to be standing in, while the frozen configuration recorded
# cwd_kind 'scratch' (docs/prd-v7-protocol.md, section 7) — a false record of where the
# run happened, which is worse than a crash.
cd -- "$WORKSPACE" || { echo "live-driver: cannot enter workspace $WORKSPACE" >&2; exit 4; }

# The wall-clock cap, enforced. This machine class has neither `timeout` nor `gtimeout`
# (macOS ships no GNU coreutils), so the driver is its own watchdog: the session runs in
# the background under job control — which gives it its own process group, so the cap
# reaps the tools the agent spawned and not just `claude` itself — and a sleeper ends it
# at the deadline. `set -m` must be in force when the session is backgrounded, and only
# then, so the watchdog's own subshell does not become a second job.
#
# A capped session exits 124, the status `timeout` uses and the one the v6 driver already
# recorded as an `operator` intervention (docs/prd-v6-artifacts/benchmark/session.cjs).
# The cap is a fact about the run, so it must be visible in the exit status: a session
# that ran out of clock and one that finished must never look alike to the harness.
CAP_SECONDS=$(( WALL_CLOCK * 60 ))
CAP_FLAG="${TMPDIR:-/tmp}/live-driver-cap.$$"
rm -f "$CAP_FLAG"

# `env -u CLAUDECODE` so a session started from inside a Claude Code session is still a
# fresh one; stdin from /dev/null so an interactive prompt fails rather than hangs.
set -m
env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT claude -p \
  --model "$MODEL" \
  --permission-mode bypassPermissions \
  --max-turns "$MAX_TURNS" \
  --output-format json \
  "$PROMPT" < /dev/null &
SESSION=$!
set +m
trap 'kill -TERM -"$SESSION" 2>/dev/null || kill -TERM "$SESSION" 2>/dev/null || true' INT TERM

# The watchdog's own output goes nowhere, and that is load-bearing rather than tidy: it
# outlives this script by whatever is left of its `sleep` when the session finishes early,
# and a sleeper still holding the caller's stdout keeps the pipe open long after the
# session has been read. A caller using a synchronous spawn would block on the cap even
# when the session returned in seconds.
(
  sleep "$CAP_SECONDS"
  kill -0 "$SESSION" 2>/dev/null || exit 0
  : > "$CAP_FLAG"
  kill -TERM -"$SESSION" 2>/dev/null || kill -TERM "$SESSION" 2>/dev/null || true
  sleep 10
  kill -KILL -"$SESSION" 2>/dev/null || kill -KILL "$SESSION" 2>/dev/null || true
) >/dev/null 2>&1 </dev/null &
WATCHDOG=$!

STATUS=0
wait "$SESSION" || STATUS=$?
kill -TERM "$WATCHDOG" 2>/dev/null || true
wait "$WATCHDOG" 2>/dev/null || true

if [ -e "$CAP_FLAG" ]; then
  rm -f "$CAP_FLAG"
  echo "live-driver: $RUN ended by the ${WALL_CLOCK}-minute wall-clock cap; record it as an operator intervention" >&2
  exit 124
fi
exit "$STATUS"
