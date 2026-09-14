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
[ -d "$WORKSPACE" ] || { echo "live-driver: no workspace at $WORKSPACE" >&2; exit 4; }
[ -f "$PROMPT_FILE" ] || { echo "live-driver: no prompt file at $PROMPT_FILE" >&2; exit 4; }

# The prompt is the brief's own text, copied verbatim. The driver adds nothing to it: a
# driver that coaches is measuring itself rather than the workflow.
PROMPT="$(cat "$PROMPT_FILE")"

# `env -u CLAUDECODE` so a session started from inside a Claude Code session is still a
# fresh one; stdin from /dev/null so an interactive prompt fails rather than hangs.
exec env -u CLAUDECODE claude -p \
  --model "$MODEL" \
  --permission-mode bypassPermissions \
  --max-turns "$MAX_TURNS" \
  --output-format json \
  "$PROMPT" < /dev/null
