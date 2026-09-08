# Trial 2026-09-08: brownfield, Claude Code print mode, Sonnet

Acceptance trial for PRD v2 (T-19) on the assembled kit, run non-interactively:
one `claude -p --model sonnet --permission-mode bypassPermissions --max-turns 120`
session per stage (`/pincer-plan <brief>`, `/pincer-narrow`, `/pincer-code`,
`/pincer-evaluate`, `/pincer-release`), so every stage after plan resumed with
no conversational context. Fixture: a small static "price widget" (`index.html`,
`app.js` with `formatPrice`, three `node --test` cases, an existing `AGENTS.md`
with two project rules), then `pincer init --platform claude` from the packed
tarball; the installer preserved `AGENTS.md` and wrote `AGENTS.md.new`, which
the operator merged by hand before the trial (one intervention, expected).

- Brief: supplied PRD with its own IDs — "keep its requirement IDs as they are:
  REQ-1 `formatPrice` accepts an optional third argument `locale` ('en' default,
  'de'); 'de' renders a comma decimal separator (`formatPrice(1999, 'EUR', 'de')`
  → `'19,99 €'`). REQ-2 unknown locale throws a RangeError naming the locale.
  REQ-3 all existing behavior and tests keep passing unchanged. REQ-4
  `index.html` gets a second paragraph showing the price in German format. Use
  the existing `node --test` suite. Decisions delegated; record assumptions
  instead of asking. If you cannot open the page in a browser, record the
  visual check as unverified rather than skipping it."
- Base: `7e76e466a277fc69e7c8139c3aef6250de383c0c` (fixture + kit + merged rules)
- Versions: pincer-workflow 0.3.0 at commit 8649e83 (T-18 state, unpublished
  tarball) · Claude Code 2.1.263, model `sonnet` · Node v22.23.1 · macOS 26.6.2
- Artifacts: PRD `.prd/prd-v1.md` (`profile: small`, REQ-1..REQ-4 kept, brief
  quoted in the PRD) · ticket `T-01` · commits `Add PRD v1` → `Narrow PRD v1 into
  T-01` → `T-01: german locale formatprice` → `PRD v1: built` → `evaluate: PRD v1
  candidate 0c6123f` · evidence
  `.prd/evidence/prd-v1/0c6123fcc206712e9e275baa3020573a5660fcf9/manifest.json`
  with four command logs and two screenshots · `NOTES.md` with `evidence:` ·
  release verdict `PASS — candidate 0c6123f`
- Results, by dry-run checklist section:
  - Plan: pass. `profile: small` with a rationale; the supplied IDs were kept
    verbatim as `#### REQ-1..REQ-4`; brief preserved; assumptions recorded; no
    questions asked; PRD committed alone.
  - Narrow: pass. One M ticket with `Implements: REQ-1..REQ-4`, a requirement
    map, a `Proves:` line that separates the behavioral `node --test` from the
    static `grep` checks on `index.html` and pre-declares the browser check as
    `unverified` if no browser is available. No second approval was requested;
    PRD set to `ticketed` and committed with the ticket.
  - Code: pass. `start` → `verify` → `done` with a receipt; scoped ticket commit;
    `PRD v1: built` committed on its own before evaluation; the three original
    tests kept verbatim (REQ-3); no dependency added; `AGENTS.md` project rules
    still in place.
  - Evaluate: pass. Refused nothing (tree was clean and built). Wrote the schema-1
    manifest: REQ-1..REQ-4 all `delivered`, C-01..C-04 command checks, C-05 visual
    check with scenario, viewport, observed result and two PNGs; `visual_review
    applicable: true`; validator printed `ok`; NOTES.md plus listed files committed
    as one `evaluate:` commit; status reported `Notes current` and `Evidence ok`.
    The agent found a pre-existing `file://` module-loading limitation, served the
    page over HTTP to verify, and recorded it as a known issue rather than a
    regression.
  - Release: pass. Ran status and `node --test` directly, never the ticket
    script; tree clean before and after; verdict named the candidate; one skipped
    item named before the verdict (see findings).
- Interventions: merged `AGENTS.md.new` into `AGENTS.md` before the trial (the
  installer's expected brownfield behavior). No other human action.
- Untested: Codex CLI, GitHub Copilot, interactive Claude Code sessions with a
  human answering questions, Windows, Node 18 on this fixture. The visual tool was
  available (chrome-devtools MCP), so the "unavailable browser → unverified"
  path was not exercised here; the greenfield trial covers unavailability only
  for `npm audit`. One trial on one surface establishes nothing about the others.

| Requirement | Observed evidence or `outstanding` |
| --- | --- |
| R-01 | Supplied IDs preserved in the PRD and tickets; requirement map presented; every ID dispositioned in the manifest. Gap: the manifest had to rename REQ-n to R-0n because the validator only accepts `R-NN` (finding 2). |
| R-02 | `Proves:` line disclosed what `node --test` proves and what the static greps do not; original tests reused unchanged; the check would fail on wrong behavior (subprocess-free unit assertions on `formatPrice`). Controlled-fault injection was not repeated in this trial (covered by `test/behavioral-verification.test.js`). |
| R-03 | Manifest under `.prd/evidence/prd-v1/<candidate>/`, validated `ok` by the helper, status and release read it; screenshots saved with scenario/viewport/observed. |
| R-04 | `PRD v1: built` committed before the candidate; evidence-only follow-up commit; status `current (0c6123f…)`; release left the tree clean. |
| R-05 | `profile: small` justified; no ticket cap or default timebox appeared; delegated decisions were not re-asked; no consequential new decision surfaced in this brief, so that branch is `outstanding`. |
| R-06 | Not exercised (no failed verification or hand edit occurred); covered by `test/recovery.test.js`. `outstanding` for live observation. |

## Addendum: evaluate with no browser tool (same day)

Re-ran `/pincer-evaluate` alone on a fresh clone at the built candidate `0c6123f`
with `--strict-mcp-config --mcp-config <empty>` so no browser or screenshot tool
was available (still Sonnet, print mode, same kit build). Observed:

- The agent recorded the dynamic render check as `unverified` with the reason
  "no browser or screenshot automation tool available", listed the limitation in
  `environment.limitations`, and did not fabricate an image or claim a pass. The
  review-kind check was recorded `unverified` too (no artifact saved; pre-T-20 kit).
- It set `visual_review.applicable: false` with that reason rather than recording
  a required `visual` check as `unverified`, because the pre-T-21 schema demanded an
  image on every visual check; that made the manifest validate `ok` and NOTES.md
  `current`, i.e. a UI change reached release-ready without a visual result. T-21
  changed the rule: an image is required only for a `passed` visual check, so an
  `unverified` required visual check is representable and blocks readiness.
- It again renamed REQ-n to R-0n in the manifest (pre-T-20 validator).

This covers the "unavailable visual tool → unverified" scenario T-19 required, on
the surface named above only.

## Findings

1. Release (correctly) could not verify the claim that the code-quality-reviewer
   subagent ran: the manifest has no artifact for reviewer output. Candidate
   follow-up: evaluate saves the reviewer transcript or a "no findings" record as
   a `review` check artifact.
2. The evidence schema requires `R-NN` requirement IDs, so a supplied PRD that
   keeps `REQ-n` cannot be referenced verbatim in the manifest; the agent renamed
   them without a recorded mapping. Either accept the PRD's own IDs in the
   validator or require a `Requirement mapping` entry in the manifest.
3. Status printed `T-01 done M started 14:55 · finished 14:56 (1m)` and no build
   elapsed line on the finished PRD, as intended.
