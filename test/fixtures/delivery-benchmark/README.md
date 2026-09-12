# Delivery benchmark fixtures

Six frozen task briefs for the independent delivery benchmark (PRD v6, R-10; protocol
in `docs/delivery-benchmark.md`). Each `briefs/<id>/` holds the brief, the base
repository generator, the held-out evaluator and the control implementations. Only the
base repository and `BRIEF.md` reach an implementation workspace; `evaluator/`,
`controls.cjs` and `base.cjs` never do. `frozen.json` pins every file's digest; edit a
brief only together with `node scripts/delivery-benchmark/benchmark.cjs freeze`, and
never between the live runs of one benchmark.
