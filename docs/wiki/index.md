# Wiki index

## Decisions

- [[single-source-template]] — template/ is canonical; adapters and plugin are generated, committed, never hand-edited
- [[never-clobber-updates]] — sha256 manifest baseline; user-edited files get `.new` sidecars on update

## Systems

- [[cli-installer]] — bin/pincer.js: init/update/doctor, the .pincer.json manifest, copy logic
- [[template-kit]] — template/: the PINCER kit itself, its invariants, provenance
- [[distribution-channels]] — npm/npx, Claude plugin marketplace, raw files; release flow and enforcement parity

## Meta

- [[briefing]] — session-start orientation page (rewritten every `end`)
- [[open-threads]] — parked follow-ups
- [[log]] — append-only chronology
