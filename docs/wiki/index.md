# Wiki index

## Decisions

- [[single-source-template]] — template/ is canonical; adapters and plugin are generated, committed, never hand-edited
- [[never-clobber-updates]] — sha256 manifest baseline; user-edited files get `.new` sidecars on update
- [[mechanical-done]] — ticket `done` is reachable only via a script-stamped verification receipt; hook makes the script the only door
- [[revocable-receipts]] — every verify attempt recorded in `last_check`; `done` re-runs the check; tickets and NOTES.md bound to a PRD revision (M0)
- [[release-audit-read-only]] — release reads `docs/release-checklist.md`, runs the gate directly, never calls the ticket script; fixes go through new tickets (M0)
- [[candidate-evidence]] — evidence schema 1 under `.prd/evidence/prd-vN/<candidate>/`; `notes_current` allows only NOTES.md + listed files after the candidate; legacy notes never release-ready; built commit precedes the candidate (PRD v2)
- [[requirements-through-delivery]] — stable `R-NN` IDs plan→narrow→evaluate, `Proves:` behavioral checks, `profile: small|standard`, one shared authorization rule, guarded ticket recovery (PRD v2)

## Systems

- [[cli-installer]] — bin/pincer.js: init/update/doctor, the .pincer.json manifest, copy logic
- [[template-kit]] — template/: the PINCER kit itself, its invariants, provenance
- [[distribution-channels]] — npm/npx, Claude plugin marketplace, raw files; release flow and enforcement parity
- [[ticket-state-machine]] — pincer-ticket.sh (start/verify/done + receipts), pincer-status.sh, ticket-guard.sh hook, the /pincer-status command
- [[evidence-validator]] — pincer-evidence.cjs: schema 1 fields, failure classes, CLI, callers, packaging
- [[github-pages-site]] — docs/index.html served by GitHub Pages from main:/docs; the 12-sheet walkthrough, provenance, sync rules

## Meta

- [[briefing]] — session-start orientation page (rewritten every `end`)
- [[open-threads]] — parked follow-ups
- [[log]] — append-only chronology
