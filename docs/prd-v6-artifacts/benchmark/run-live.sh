#!/bin/bash
# Live driver for the T-77 benchmark runs.
#
#   bash docs/prd-v6-artifacts/benchmark/run-live.sh <runs-root> <kit.tgz> schedule [from] [to]
#   bash docs/prd-v6-artifacts/benchmark/run-live.sh <runs-root> <kit.tgz> rerun [run-id ...]
#
# `schedule` walks the frozen schedule in order, one run at a time. `rerun` repeats the
# named invalid runs (default: every invalid run that has no valid rerun yet) at the next
# free pair number above the schedule, recording which run each replaces.
#
# For each run: prepare (kit for the pincer arm), the scripted sessions with the operator
# step between them, usage capture, effort fields, evaluation. Every session is
# `claude -p` (model sonnet, bypassPermissions, --max-turns 150, JSON output) with a
# 30-minute wall-clock cap, stdin from /dev/null, CLAUDECODE unset. The driver adds
# nothing to the prompts; the only operator steps are the scripted `stage` ones, the cap
# notes and the invalidations below.
#
# A session that fails on an account usage or rate limit is not data: the run is marked
# invalid with that reason and the driver stops immediately, so a limit cannot silently
# turn the rest of the schedule into one-turn failures. Resume with the same command once
# the limit resets; `rerun` then repeats the invalidated runs.
#
# Progress lines go to stdout; per-run files land under <runs-root>/<brief>/pair-N/<arm>/logs/.
set -u
REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
HERE="$REPO/docs/prd-v6-artifacts/benchmark"
RUNS=$1; KIT=$2; MODE=${3:-schedule}
BM="node $REPO/scripts/delivery-benchmark/benchmark.cjs"
BRIEFS="$REPO/test/fixtures/delivery-benchmark/briefs"
MODEL=sonnet; TURNS=150; WALL_MIN=30
TOOLV=$(claude --version | awk '{print $1}')
LIMIT_RE='usage limit|session limit|rate limit|quota'
say() { echo "[$(date -u +%FT%TZ)] $*"; }
mkdir -p "$RUNS"

# next_pair <brief> <arm> — the lowest pair number above the schedule with no record yet
next_pair() {
  local brief=$1 arm=$2 p
  for p in 4 5 6 7 8 9; do
    [ -f "$RUNS/$brief/pair-$p/$arm/record.json" ] || { echo "$p"; return; }
  done
  echo ""
}

# drive_run <run-id> <brief> <arm> <label> [replaces-run-id]
drive_run() {
  local RUN=$1 BRIEF=$2 ARM=$3 LABEL=$4 REPLACES=${5:-}
  local DIR="$RUNS/$RUN" WS="$RUNS/$RUN/workspace" LOGS="$RUNS/$RUN/logs"
  say "$LABEL $RUN prepare"
  local KITARG=(); [ "$ARM" = pincer ] && KITARG=(--kit "$KIT")
  local RERUNARG=(); [ -n "$REPLACES" ] && RERUNARG=(--rerun "$REPLACES")
  if ! $BM prepare --runs "$RUNS" --run "$RUN" --model $MODEL --tool claude-code --tool-version "$TOOLV" \
       --cap turns_per_session=$TURNS --cap wall_clock_minutes=$WALL_MIN \
       ${KITARG[@]+"${KITARG[@]}"} ${RERUNARG[@]+"${RERUNARG[@]}"} > "$RUNS/prepare.out" 2>&1; then
    say "$LABEL $RUN PREPARE FAILED: $(tail -1 "$RUNS/prepare.out")"; return 1
  fi
  mkdir -p "$LOGS"; mv "$RUNS/prepare.out" "$LOGS/prepare.out"
  local N; N=$(node -e "console.log(require('$DIR/record.json').sessions.length)")
  local i S RC TURNS_USED SID RESULT
  for ((i=1; i<=N; i++)); do
    S="S$i"
    if node -e "const b=require('$BRIEFS/$BRIEF/base.cjs');process.exit(b.between&&b.between['$S']?0:1)"; then
      $BM stage --runs "$RUNS" --run "$RUN" --name "$S" >> "$LOGS/stage.out" 2>&1 || say "$LABEL $RUN STAGE $S FAILED"
    fi
    node -e "process.stdout.write(require('$DIR/record.json').sessions[$i-1].prompt)" > "$LOGS/$S.prompt.txt"
    $BM session --runs "$RUNS" --run "$RUN" --name "$S" --start > /dev/null
    say "$LABEL $RUN $S start"
    node "$HERE/session.cjs" "$WS" $MODEL "$LOGS/$S.prompt.txt" "$LOGS/$S.json" "$LOGS/$S.err" $((WALL_MIN*60*1000)) $TURNS; RC=$?
    $BM session --runs "$RUNS" --run "$RUN" --name "$S" --end --exit $RC --transcript "logs/$S.json" > /dev/null
    (cd "$WS" && git log --format='%H %ci %s' > "$LOGS/$S.git-log.txt" 2>&1; git status --short > "$LOGS/$S.git-status.txt" 2>&1)
    SID=$(node -e "try{const j=JSON.parse(require('fs').readFileSync('$LOGS/$S.json','utf8'));process.stdout.write(j.session_id||'')}catch{}")
    [ -n "$SID" ] && node "$HERE/extract-commands.cjs" "$SID" "$LOGS/$S.commands.txt" > /dev/null 2>&1
    TURNS_USED=$(node -e "try{const j=JSON.parse(require('fs').readFileSync('$LOGS/$S.json','utf8'));process.stdout.write(String(j.num_turns??''))}catch{}")
    RESULT=$(node -e "try{const j=JSON.parse(require('fs').readFileSync('$LOGS/$S.json','utf8'));process.stdout.write(j.is_error?String(j.result||''):'')}catch{}" | head -c 300)
    say "$LABEL $RUN $S end exit $RC turns ${TURNS_USED:-?}"
    if echo "$RESULT" | grep -qiE "$LIMIT_RE"; then
      $BM mark --runs "$RUNS" --run "$RUN" --status invalid --reason "account limit during $S: $(echo "$RESULT" | tr '\n' ' ' | head -c 150)" > /dev/null
      say "$LABEL $RUN INVALID — account limit reached; stopping the driver. Resume with: bash $0 $RUNS $KIT rerun"
      return 2
    fi
    [ $RC -eq 124 ] && $BM intervene --runs "$RUNS" --run "$RUN" --session "$S" --type operator --note "session ended by the $WALL_MIN-minute wall-clock cap (exit 124)" > /dev/null
    if [ -n "$TURNS_USED" ] && [ "$TURNS_USED" -ge $TURNS ]; then
      $BM intervene --runs "$RUNS" --run "$RUN" --session "$S" --type operator --note "session reached the $TURNS-turn cap" > /dev/null
    fi
  done
  node "$HERE/effort.cjs" "$RUNS" "$RUN" > "$LOGS/effort.out" 2>&1 || say "$LABEL $RUN EFFORT FAILED"
  $BM evaluate --runs "$RUNS" --run "$RUN" > "$LOGS/evaluate.out" 2>&1
  say "$LABEL $RUN $(head -1 "$LOGS/evaluate.out")"
  return 0
}

case "$MODE" in
  schedule)
    FROM=${4:-1}; TO=${5:-36}
    $BM schedule --json | node -e "const s=JSON.parse(require('fs').readFileSync(0,'utf8'));for(const r of s) if(r.order>=$FROM&&r.order<=$TO) console.log(r.order,r.run,r.brief,r.arm)" > "$RUNS/.plan"
    while read -r ORDER RUN BRIEF ARM; do
      [ -f "$RUNS/$RUN/record.json" ] && { say "#$ORDER $RUN already recorded — skipping"; continue; }
      drive_run "$RUN" "$BRIEF" "$ARM" "#$ORDER"; RC=$?
      [ $RC -eq 2 ] && { rm -f "$RUNS/.plan"; exit 2; }
    done < "$RUNS/.plan"
    rm -f "$RUNS/.plan"
    ;;
  rerun)
    shift 3
    if [ $# -gt 0 ]; then printf '%s\n' "$@" > "$RUNS/.plan"
    else
      node -e '
        const fs=require("fs"), path=require("path");
        const lib=require(process.argv[1]+"/scripts/delivery-benchmark/lib.cjs");
        const runs=process.argv[2];
        const all=lib.walk(runs).filter(r=>r.endsWith("/record.json")).map(r=>JSON.parse(fs.readFileSync(path.join(runs,r),"utf8")));
        const replaced=new Set();
        for (const r of all) for (const i of r.interventions) { const m=/replacing the invalid run (\S+)/.exec(i.note||""); if (m && r.status!=="invalid") replaced.add(m[1]); }
        for (const r of all) if (r.status==="invalid" && !replaced.has(r.run)) console.log(r.run);
      ' "$REPO" "$RUNS" > "$RUNS/.plan"
    fi
    while read -r OLD; do
      [ -z "$OLD" ] && continue
      BRIEF=${OLD%%/*}; ARM=${OLD##*/}
      P=$(next_pair "$BRIEF" "$ARM")
      [ -z "$P" ] && { say "no free rerun pair for $BRIEF/$ARM (limit 9) — $OLD stays outstanding"; continue; }
      drive_run "$BRIEF/pair-$P/$ARM" "$BRIEF" "$ARM" "rerun-of-$OLD" "$OLD"; RC=$?
      [ $RC -eq 2 ] && { rm -f "$RUNS/.plan"; exit 2; }
    done < "$RUNS/.plan"
    rm -f "$RUNS/.plan"
    ;;
  *) echo "usage: $0 <runs-root> <kit.tgz> schedule [from] [to] | rerun [run-id ...]" >&2; exit 2 ;;
esac
say "driver finished ($MODE)"
