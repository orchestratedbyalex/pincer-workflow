# github-pages-site

The public website: https://orchestratedbyalex.github.io/pincer-workflow/
A twelve-sheet "drawing set" walkthrough (cover, why, general arrangement,
one sheet per command, safety, stress test, revisions, bill of materials,
installation). Linked from the README and set as the repo homepage.

## How it is served

- Source: `docs/index.html` on `main`, served by GitHub Pages with
  `build_type: legacy`, source `main:/docs`. Enabled via
  `gh api -X POST repos/.../pages` on 2026-09-02; first build took ~30s.
- `docs/.nojekyll` disables Jekyll so nothing in `docs/` is transformed.
  Side effect: the wiki markdown under `docs/wiki/` is also served raw at
  `/wiki/*.md` — acceptable, it is public in the repo anyway.
- `docs/` is NOT in package.json `files`, so the site never ships to npm.

## Provenance and invariants

- Origin: a Claude artifact (title "PINCER", 📐) created 2026-09-01. The
  Pages file is that artifact with the frame runtime stripped and a proper
  `<head>` (charset, viewport, description, canonical, emoji favicon,
  font preconnects). Fonts: B612 + B612 Mono from Google Fonts. The artifact
  is now stale relative to `docs/index.html` — treat the repo file as source.
- Single-theme (cyanotype drafting ground), keyboard/touch slide navigation,
  `#N` hash deep-links to sheet N. One authored motion (the delivery line on
  sheet 103 draws itself).
- Sheet 112 (installation) must track the README's install path (npx init,
  plugin alternative, update/doctor). It was rewritten from the old
  copy-the-folders instructions on 2026-09-02; keep them in sync.
- Command names on the site use the npx form (`/pincer-plan`), matching the
  README; the plugin form (`/pincer:plan`) is mentioned once on sheet 112.

Related: [[distribution-channels]], [[template-kit]].
