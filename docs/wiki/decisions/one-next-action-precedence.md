# one-next-action-precedence

**Decided 2026-09-13** (T-80 on `feat/prd-v6`, closing review finding F-03 and the
four defects found with it). Narrows [[explicit-change-lifecycle]]: the precedence
that page describes is now owned by one module instead of by each report that
renders it.

## What

The head of the next-action precedence — `docs/runtime-contracts.md` rules 2 and 3 —
lives in `template/scripts/pincer-runtime/routing.cjs` and nowhere else:

1. `preface()` answers rule 2 (a running or dead attempt outranks everything) and
   rule 3 (a terminal change is inspectable but not executable; a change whose base
   this worktree does not carry needs a checkout) — or `null`, meaning the caller
   should go on to rule 4.
2. `lifecycleAction()` answers rule 3 again after the agreement gap is closed: a
   `planned` change must be activated and a `paused` one resumed before any ticket
   command will run.
3. `qualify()` prefixes `change select <id>` onto a ticket command whose change this
   worktree has not selected, because the command would otherwise be refused with
   `WRONG_CHANGE`.

`resume.decide()` and `coverage` both consume it. **Any new report that renders a
next action must consume it too, rather than deciding for itself.**

## Why

`resume` and `coverage` each carried their own copy, and the copies drifted. On six
lifecycle states — paused, planned, cancelled, superseded, busy, and a change whose
base is absent — `coverage` recommended a command the gates then refused: `start
T-01` on a paused change, execution on a cancelled one. A report that tells you to
run a command the runtime will reject is worse than a report that says nothing,
because the user believes the report.

The second defect was ordering inside one copy: `phases.nextAction()` tested
implementation problems before lifecycle state, which made the lifecycle branch
unreachable *exactly* when there was unfinished work — the case it existed for.

The general shape is worth remembering: **two views of the same state drift.** The
fix is not to synchronise them but to delete one.

## Rejected

- Leaving the duplication and adding a test that the two agree: the test pins today's
  agreement, not tomorrow's third report.
- Moving the whole precedence (rules 1–8) into the module: rules 4–8 are already
  computed from data the individual reports hold, and lifting them would have meant
  passing each report's whole world in. Rules 2 and 3 are the ones that outrank
  everything and so the ones that must not disagree.

## Limits

The module owns the *head* of the precedence only; a report still decides rules 4–8
for itself, so a fourth report could still drift below rule 3. `qualify()` recognises
ticket commands by regex (`start|verify|done T-`), so a future ticket verb has to be
added to it by hand.
