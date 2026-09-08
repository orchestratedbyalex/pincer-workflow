# Trial 2026-09-08: greenfield, Claude Code print mode, Sonnet

Acceptance trial for PRD v2 (T-19) on the assembled kit, run non-interactively:
one `claude -p --model sonnet --permission-mode bypassPermissions --max-turns 120`
session per stage, so every stage after plan resumed with no conversational
context (the "authorized resume" scenario by construction). Fixture: an empty
git repository plus `pincer init --platform claude` from the packed tarball.

- Brief: "Build a tiny Node.js CLI called greet with no dependencies:
  `node greet.js <name>` prints `Hello, <name>!`; an empty or missing name exits 1
  with `greet: a name is required` on stderr; `--shout` prints the greeting in
  upper case. Use node:test with `npm test`. This is a small, low-risk change:
  use profile small if it fits and say why. Decisions on file layout and test
  structure are delegated to you; do not ask me questions, make sensible choices
  and record assumptions. If implementing --shout would need a second ticket, you
  are authorized to defer it and record that deferral with my authorization."
- Base: `2680fca5a3c459ed15577ed5e3289fdf0fe86f2c` (empty repo + kit)
- Versions: pincer-workflow 0.3.0 at commit 8649e83 (T-18 state, unpublished
  tarball) · Claude Code 2.1.263, model `sonnet` · Node v22.23.1 · macOS 26.6.2
- Artifacts: PRD `.prd/prd-v1.md` (`profile: small` with rationale, R-01..R-03,
  brief quoted, assumptions and the unused deferral authorization recorded) ·
  ticket `T-01` · commits `Add PRD v1` → `Narrow PRD v1 into T-01` → `T-01: greet
  cli` → `PRD v1: built` → `evaluate: PRD v1 candidate b03df72` · evidence
  `.prd/evidence/prd-v1/b03df72de454f066d4d60c83b10334a516822122/manifest.json`
  with seven command logs · `NOTES.md` with `evidence:` · release verdict
  `PASS — candidate b03df72…`
- Results, by dry-run checklist section:
  - Plan: pass. `profile: small` justified (one script, one flag, no
    dependencies, no auth or data boundary); three requirements with scenarios,
    failure paths and preserved behavior; no questions asked; PRD committed alone.
  - Narrow, first pass: **fail on the approval rule.** The agent produced one S
    ticket, the requirement map and an adequacy judgment, then ended with "Ready
    to proceed on this single-ticket breakdown, or would you like it split
    further?" without setting the PRD to `ticketed` or committing (playbook step 5
    opens with "Once authorized"). The following `/pincer-code` session correctly
    refused to invent authorization and asked; evaluate and release then reported
    the stalled state (release: FAIL with every item named). See finding 1.
  - Narrow, second pass (intervention 1): pass. Given the authorization text, it
    finalized the same ticket, set `ticketed`, committed PRD and ticket.
  - Code: pass. `start` → `verify` → `done`; `Proves:` line names the observable
    contract (stdout, stderr, exit code per scenario, driven as a subprocess);
    scoped ticket commit; `PRD v1: built` committed on its own.
  - Evaluate: pass. Clean built candidate accepted; manifest with R-01..R-03
    `delivered`, six required command checks `passed`, `npm audit` recorded as a
    non-required `unverified` check with a reason (no lockfile), `visual_review
    applicable: false` with a reason; validator `ok`; one `evaluate:` commit with
    NOTES.md and the listed files; status `Notes current`, `Evidence ok`.
  - Release: pass. Ran status and `npm test` directly; tree clean before and
    after; verdict named the candidate; the one skipped item was named first.
- Interventions: (1) a second `/pincer-narrow` session carrying the sentence "I
  authorize the one-ticket breakdown exactly as you presented it … do not ask
  again", after the first pass stalled. Nothing else.
- Untested: Codex CLI, GitHub Copilot, interactive Claude Code sessions with a
  human answering questions, Windows, Node 18 on this fixture. No deferral
  occurred (the agent shipped `--shout` in scope), so "deferral requires
  authorization" was not observed live; no UI, so no visual path. One trial on
  one surface establishes nothing about the others.

| Requirement | Observed evidence or `outstanding` |
| --- | --- |
| R-01 | Stable R-01..R-03 in the PRD; requirement map with owner and check per scenario; every ID dispositioned `delivered` in the manifest. |
| R-02 | `Proves:` disclosed what the subprocess tests establish; the seven test cases mirror the seven acceptance scenarios including both reject paths; no identifier greps used. |
| R-03 | Manifest under `.prd/evidence/prd-v1/<candidate>/` validated `ok`; unavailable tool (`npm audit`) recorded as `unverified`, not fabricated or waived; non-UI reason recorded. |
| R-04 | `PRD v1: built` preceded the candidate; evidence-only follow-up commit; status `current (b03df72…)`; release left the tree clean. |
| R-05 | `profile: small` justified; no ticket cap or default timebox; the delegated architecture was not re-asked. The breakdown *was* re-asked in narrow's first pass (finding 1); resume across sessions worked without re-approval once authorization existed. Deferral scenario `outstanding`. |
| R-06 | Not exercised live (no failed verification or hand edit); covered by `test/recovery.test.js`. `outstanding` for live observation. |

## Findings

1. Narrow asked for approval of a breakdown that followed the PRD, contradicting
   its own new rule. The cause is inside the playbook: step 5 still begins "Once
   authorized, update the selected PRD frontmatter to `status: ticketed`", and the
   paragraph above it says "Present the concrete breakdown and build order". In a
   print-mode session there is nobody to answer, so the chain stalls at `draft`.
   The brownfield trial with the same kit did not ask, so the wording is
   ambiguous rather than wrong every time. Follow-up: make step 5 unconditional
   when the breakdown follows the PRD, and reserve asking for a newly discovered
   consequential choice.
2. Print-mode `/pincer-code` printed a stdin warning ("no stdin data received in
   3s") — harmless, caused by the driver, not the kit.
3. Status output during the trial matched R-06: no build elapsed line on the
   finished PRD; `T-01 done S started 14:57 · finished 14:57 (0m)`.
