# Wiki index

## Decisions

- [[single-source-template]] — template/ is canonical; adapters and plugin are generated, committed, never hand-edited
- [[never-clobber-updates]] — sha256 manifest baseline; user-edited files get `.new` sidecars on update
- [[mechanical-done]] — ticket `done` is reachable only via a script-stamped verification receipt; hook makes the script the only door

## Systems

- [[cli-installer]] — bin/pincer.js: init/update/doctor, the .pincer.json manifest, copy logic
- [[template-kit]] — template/: the PINCER kit itself, its invariants, provenance
- [[distribution-channels]] — npm/npx, Claude plugin marketplace, raw files; release flow and enforcement parity
- [[ticket-state-machine]] — pincer-ticket.sh (start/verify/done + receipts), pincer-status.sh, ticket-guard.sh hook, the /pincer-status command
- [[github-pages-site]] — docs/index.html served by GitHub Pages from main:/docs; the 12-sheet walkthrough, provenance, sync rules

## Meta

- [[briefing]] — session-start orientation page (rewritten every `end`)
- [[open-threads]] — parked follow-ups
- [[log]] — append-only chronology
