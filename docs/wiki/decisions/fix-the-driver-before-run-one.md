# Fix the driver and re-mint the cohort before run #1, not after

**Decided:** 2026-09-14, T-98, after PRD v7 merged and before any live run existed.

The v7 benchmark edition shipped with a driver that could neither place nor cap a
session, and with no orchestrator at all. Both were found by reviewing the merged edition
against the question "what would actually happen if someone ran this", not by a failing
test — nothing in the suite could fail, because the defects are invisible in source.

## The three defects

`live-driver.sh` validated `--workspace` and never used it: no `cd`, no `--add-dir`, so
a `bypassPermissions` session ran in whatever tree the operator was standing in, while
the frozen configuration recorded `cwd_kind: 'scratch'`. It required
`--wall-clock-minutes` and never enforced it: no timeout in the exec line, and the
supported host has neither `timeout` nor `gtimeout`. And it unset `CLAUDECODE` but not
`CLAUDE_CODE_ENTRYPOINT`, which the v6 driver did — a session launched from inside a
session was not fully fresh.

A fourth was found by the new suite rather than by reading: the cap watchdog's `sleep`
inherited the caller's stdout, so a **successful** session's pipe never closed. Any
synchronous caller — which the orchestrator is — would have blocked for the full cap on
every run. The study would have been unrunnable, and no amount of source review finds
that one.

## Why the orchestrator has to live in the tree

v7 shipped libraries and a one-session driver. Whoever ran the schedule would have
written the loop, and the loop is where the working directory, the caps, the retries and
the kit install live — exactly what `provenance.driver` and `provenance.configuration`
claim to describe. `effort.problems` validates those fields for 64-hex *shape* alone, so
a record could name the frozen driver truthfully while an unfrozen script decided
everything that mattered, and nothing in the repository could notice. That is the most
likely way a v7 record validates while being untrue.

So `orchestrator.cjs` is named in `freeze-spec.cjs`. Editing it starts a new cohort, the
same as editing a brief.

## Re-minting openly was free, and only now

Editing the driver and adding a named input both change the cohort — that is the
mechanism working, not a problem to route around. With zero runs on disk, nothing is
re-evaluated and no record changes cohort: `eef74402…` → `6de061ec…`, with exactly
`protocol`, `harness` and `driver` moving. After run #1 the same fix would have meant
either two cohorts in one table or the re-freeze-and-re-evaluate path that
[[v7-measured-friction]] exists to remove.

## What was ported from v6, and what was not

v6's `run-live.sh` already had stop-on-limit, reruns, a wall-clock wrapper and per-arm
kit install; none of it reached v7. The orchestrator carries all four, plus per-cell
checkpointing that v6 lacked, and it judges a cap-terminated session on what it
committed — a rule v6 stated and then broke once, writing off a 55-turn run that had
committed code and been evaluated on the merits.

Not ported: v6's naive summed effort. v7 merges intervals instead.

Related: [[v7-measured-friction]], [[delivery-benchmark]], [[read-only-projections]].
