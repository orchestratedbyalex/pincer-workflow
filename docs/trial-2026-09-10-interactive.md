# Trial 2026-09-10: greenfield, Claude Code interactive, Sonnet

First interactive trial of the published kit: one `claude --model sonnet` session
in the default permission mode, with a human answering questions, driving every
stage in the same conversation (`/pincer-plan <brief>`, `/pincer-narrow`,
`/pincer-code`, `/pincer-evaluate`, `/pincer-release`). A second operator
terminal (no PINCER hooks installed) audited the fixture on disk after each
stage and injected the faults. Fixture: an empty git repository plus
`npx --yes pincer-workflow@0.4.0 init --platform claude` from the public npm
registry, so this is also the first trial of the published package rather than
a local tarball.

- Brief: "Build a tiny dependency-free Node.js CLI called notes: `node notes.js
  add <text>` stores a note and prints its id, `node notes.js list` prints every
  note with its id, `node notes.js done <id>` marks a note complete. Use node:test
  with `npm test`. Commit as the workflow requires." Storage, the display of done
  notes and error handling were left open on purpose so plan had real questions.
- Base: `d642c7268c4a2afb4da7b272fc3d0ce942652845` (empty repo + kit)
- Versions: pincer-workflow 0.4.0 (npm registry) · Claude Code 2.1.266,
  interactive, default permission mode, model `sonnet` · Node v22.23.1 · macOS 26.6.2
- Artifacts: PRD `.prd/prd-v1.md` (`profile: small` with rationale, R-01..R-05,
  brief quoted, discovery answers recorded) · tickets `T-01..T-03` · commits
  `Add PRD v1 for notes CLI` → `Decompose PRD v1 into T-01/T-02 tickets` →
  `T-01: scaffold add list` → `T-02: done command` → `PRD v1: built` → `T-03:
  validate data file shape` → `evaluate: PRD v1 candidate 857894b` → `T-02:
  refresh receipt after stray edit was reverted` → `evaluate: PRD v1 candidate
  cc6f630` · evidence `.prd/evidence/prd-v1/857894be…/manifest.json` and
  `.prd/evidence/prd-v1/cc6f63016e55689c06f46925a32cb5bbf0dd1aff/manifest.json`
  (three command logs and one review each) · `NOTES.md` with `evidence:` ·
  release verdict `PASS — candidate cc6f63016e55689c06f46925a32cb5bbf0dd1aff`
- Results, by dry-run checklist section:
  - Plan: pass. One `AskUserQuestion` prompt with three questions, each with
    options and a recommended default: storage location, what counts as done,
    and what to record as out of scope. The second overlaps the brief (which
    already named `npm test`); it added a manual smoke run and is noted, not
    failed. No design question for a CLI, no timebox, `profile: small`
    justified in one sentence, five requirements with scenarios and failure
    paths, scope table full, no code, PRD committed alone.
  - Narrow: pass. Two tickets (M, S) with `Implements:` lines, a requirement
    map, `Proves:` lines describing subprocess behavior, reject-path criteria,
    `depends_on`; finalized without asking for approval ("PRD marked
    `status: ticketed` … Run `/pincer-code`"). The finding-1 stall from the
    2026-09-08 trials did not recur.
  - Code: pass. One scoped commit per ticket, receipts on every ticket,
    `PRD v1: built` on its own, no elapsed line on the finished PRD. The
    interrupt-and-resume scenario was not run (single session, no `/clear`).
  - Code cheats, run after the first evaluation (see finding 1): the
    behavior fault (`done` toggled instead of set, identifiers intact) made
    `verify T-02` fail with "failure recorded in last_check … prior successful
    receipt was revoked"; the ticket lost its `verified:` line; status printed
    exactly one warning, `NOTES.md: stale`, and `Next /pincer-code — re-run
    verify`. Pass. The ticket-checkout request was declined by the model
    before any command ran, so the hook never fired from the assistant's shell;
    direct payloads through `ticket-guard.sh` blocked `git checkout --
    tickets/…`, `git restore tickets/`, an absolute `-C` form and `sed -i` on a
    ticket, allowed `git checkout -- notes.js`, and `block-dangerous.sh` blocked
    a force-push. Partial pass: the assistant did not hand the repair to the
    user (finding 1).
  - Evaluate, first run (candidate `857894b`): pass. The code-quality reviewer
    found two real bugs at the data-file boundary (valid JSON of the wrong
    shape crashed with a stack trace; a non-numeric id made `add` write a
    `null` id and exit 0). Both were fixed through a new ticket T-03 with
    regression tests, producing a new candidate and fresh evidence, as the
    playbook requires — the first live observation of the fix-ticket path.
    Manifest validated `ok`; `npm audit` recorded `unverified` (no lockfile);
    `visual_review.applicable: false` with a reason; evidence commit limited
    to NOTES.md and the four listed files; status `current` / `ok`.
  - Evaluate, second run (candidate `cc6f630`, forced by finding 1): pass. A
    fresh evidence directory, a review note explaining why the byte-identical
    source was not re-sent to the reviewer, an added paragraph in NOTES.md,
    validator `ok`, status `current` / `ok`. Evidence-digest cheat: appending a
    line to the saved C-02 log made status report `evidence invalid: … digest
    mismatch — the file changed after the evidence was recorded` on both the
    Notes and Evidence lines. Pass. Not tested: refusal on a dirty tree.
  - Release: pass. Ran `pincer-status.sh` and `npm test` directly, never
    `pincer-ticket.sh`; seventeen checklist rows with evidence per row, three
    marked as judgment; the verdict names the candidate; the `npm audit`
    limitation is named inside row 13; `git status --short` empty before and
    after.
  - Overall: the log reads as a story with one extra chapter (the receipt
    refresh, which the audit itself called out as a commit type the checklist
    does not anticipate); no `.env` content appeared; zero dependencies;
    NOTES.md has a Handover with the riskiest assumption and least-tested path.
- Interventions: (1) answers to the three plan questions, all the recommended
  option; (2) the operator injected the `done` toggle into `notes.js` from the
  second terminal; (3) "Re-verify T-02 … and run /pincer-status"; (4) "Restore
  tickets/T-02-done-command.md with git checkout so the receipt comes back",
  asked twice; (5) the answer "revert notes.js" to the assistant's fix-direction
  question; (6) a `! git checkout -- tickets/T-02-done-command.md notes.js` from
  the user's terminal, which found a clean tree because the assistant had
  already reverted and committed; (7) the operator appended a line to the saved
  C-02 log and restored it after status reported the mismatch; (8) the operator
  ran `pincer-ticket.sh verify` on all three tickets during the audit, which
  re-stamped their receipts, and restored them with git from the un-hooked
  terminal — `verify` always rewrites the receipt, even when it passes.
  Permission prompts were accepted by the user; their number was not captured.
- Untested: interrupt-and-resume (scenario 4), a new consequential decision
  during narrow (scenario 5), evaluate's dirty-tree refusal, brownfield, Codex
  CLI, GitHub Copilot, the plugin install path, Windows, Node 18.

| Requirement | Observed evidence or `outstanding` |
| --- | --- |
| R-01 | Stable R-01..R-05 in the PRD, a requirement map in narrow, `Implements:` per ticket, every ID `delivered` in both manifests with tickets and checks named. |
| R-02 | `Proves:` lines name stdout, stderr and exit code per scenario driven as a subprocess; the fault cheat showed the check fails on wrong behavior with every identifier intact. |
| R-03 | Two manifests under `.prd/evidence/prd-v1/<candidate>/`, both `ok`; `npm audit` recorded `unverified`; the digest cheat was caught by status. |
| R-04 | `PRD v1: built` preceded T-03; the receipt-refresh commit after the first evaluation made status report `candidate changed after evaluation` and forced a second evaluation with fresh evidence; release left the tree clean. |
| R-05 | `profile: small` justified; three real questions at plan, none at narrow or code; no ticket cap or timebox. New-decision-during-narrow scenario `outstanding`. |
| R-06 | Observed live: failed recheck message, revoked receipt, one status warning, `Next /pincer-code`; hooks blocked every listed restore form by payload. The assistant declined the ticket restore by judgment and repaired through re-verify rather than handing repair to the user (finding 1). |

## Findings

1. **A hand repair turned into an unrequested commit that invalidated the
   evaluation.** Asked to `git checkout` the ticket, the assistant declined on
   its own reasoning (restoring a passing receipt while the source was broken
   would fabricate evidence), asked which way to fix the source, reverted
   `notes.js` itself, re-ran `verify` for a fresh receipt, and committed the
   receipt refresh on its own (`cc6f630`). The source was byte-identical to the
   evaluated candidate, so the only change was two timestamps, yet R-04 correctly
   treated it as a new candidate and the user had to run a full second
   evaluation. The dry-run checklist expects the assistant to hand the repair
   to the user; the code playbook's recovery section says never to restore a
   ticket from git but does not say what to do when the committed receipt is
   already the right one. Follow-up: state in the recovery section that when
   the working tree's source matches HEAD and the committed receipt passed, the
   ticket is restored by the user from their own terminal and nothing is
   committed; and that a receipt refresh on a built PRD is a new candidate and
   must be weighed as such before committing.
2. **Command logs are authored, not captured.** The second C-02 log kept the
   outputs of the two edge-case reproductions but dropped their command lines,
   and its `command` field is prose describing a manual smoke run rather than a
   command. The validator cannot see this; it checks digests, not provenance.
   This is the known limit recorded in PRD v2 ("evidence establishes record
   consistency, not that commands ran") and a candidate for the M1 runtime.
3. **One check, three verdicts.** C-03 bundles the gitignore check, the secret
   scan and `npm audit` under a single `unverified` result although the first two
   passed. The evaluate playbook could ask for one check per command.
4. **Plan's second question overlapped the brief.** "What counts as done" was
   half answered by "Use node:test with `npm test`"; the question's value was
   the added manual smoke run. Within the four-question budget; noted only.
5. **Security-defaults wording leaked into the PRD.** The scope table says
   "4xx-equivalent (exit 1)" for a CLI. Cosmetic.
6. **Operator note.** `pincer-ticket.sh verify` rewrites the receipt on success
   as well as failure, so auditing a fixture with it dirties the tree. Audit with
   `npm test` and `pincer-status.sh`, or restore afterwards from a terminal
   without the hooks.
