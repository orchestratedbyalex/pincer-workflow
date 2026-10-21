---
owner: the blueprint stage writes it through scripts/pincer-blueprint.cjs write; the person confirms every value
home: harness.json at the repository root
readers: every stage skill (its gate, artifacts and roster), scripts/pincer-status.sh, the ticket script's stage gate, the generator
shape: one JSON object, schema 1, the fields below; the writer fills the defaults
---
# harness.json

The machine-readable agreement. The answers file the blueprint collects has the same
shape: `write` validates it, fills the defaults and writes it back. Every field:

| Field | Values | Meaning |
|---|---|---|
| `schema` | `1` | the only schema |
| `project.name` | text | the project's name, shown in the agreement and the status line |
| `project.kind` | `greenfield` or `brownfield` | what recon decided and the person confirmed |
| `project.reason` | text | why, in the person's words |
| `people[]` | `{name, role, accepts}` | everyone who works here; at least one has `accepts: true` |
| `systems.forge` | `github`, `none`, `other` | where issues and PRs would live |
| `systems.remote` | URL or empty | the remote, without credentials |
| `systems.ci` | true or false | whether CI runs |
| `systems.deploy` | text | what deploys and what triggers it; empty when nothing deploys |
| `systems.secrets` | text | where secrets live |
| `repo.branches` | `per-ticket` or `main` | one branch per ticket, or commits to the main branch |
| `repo.pr` | true or false | every change through a pull request |
| `repo.merge` | `merge`, `squash`, `rebase` | how branches integrate |
| `repo.protection` | text | what protects the main branch; empty when nothing does |
| `repo.checks` | list of commands | the checks that gate a merge; evaluate runs them |
| `homes.specs`, `homes.tickets`, `homes.evidence` | relative paths | where the artifacts live; defaults `specs`, `tickets`, `evidence` |
| `stages.plan` | `{on, spec, gate, reason}` | `spec` is `file` or `forge`; `gate` is the approval's text |
| `stages.narrow` | `{on, tickets, reason}` | `tickets` is `file` or `forge` |
| `stages.code` | `{on, implementer, reason}` | `implementer: true` dispatches the implementer agent per ticket |
| `stages.evaluate` | `{on, where, evidence, reason}` | `where` is `local` or `pr`; `evidence` keeps the manifest |
| `stages.release` | `{on, audit, reason}` | `audit` is `tree` (a clean tree) or `pr` (the merged PR) |
| `roster.<stage>` | lists of agent names | for plan, narrow, code, evaluate |
| `models.stages.<stage>` | a tier, or `{tier, effort}` | the tier and effort a stage runs on; `plan`, `narrow`, `code`, `evaluate`, `release` only |
| `models.agents.<name>` | a tier, or `{tier, effort}` | the tier and effort a roster agent runs on; unset falls back to the library's default |
| `models.map.<platform>.<tier>` | a model name | overrides the library table's entry for `claude`, `codex` or `copilot` |
| `open` | list of text | what the interview left open, written as open |
| `firstJob` | text | the first real job agreed on |

`blueprint` and `status` never appear under `stages` or `models.stages`: they are
always on, and the validator rejects an entry for them. Tiers are `strong`,
`standard`, `fast` or `inherit`; effort is `low`, `medium` or `high`; the empty
string means not set. A `reason` on a stage that is off appears under
Simplify in the agreement. Unknown keys are kept but ignored.

## Example

```json
{
  "schema": 1,
  "project": { "name": "widgets", "kind": "brownfield", "reason": "two years of history and a live site" },
  "people": [
    { "name": "Alex", "role": "owner", "accepts": true },
    { "name": "Sam", "role": "reviewer", "accepts": false }
  ],
  "systems": { "forge": "github", "remote": "https://github.com/acme/widgets.git", "ci": true, "deploy": "Vercel, on merge to main", "secrets": "Vercel project settings; .env.example lists the names" },
  "repo": { "branches": "per-ticket", "pr": true, "merge": "squash", "protection": "required checks and one review on main", "checks": ["npm test", "npm run lint"] },
  "homes": { "specs": "specs", "tickets": "tickets", "evidence": "evidence" },
  "stages": {
    "plan": { "on": true, "spec": "file", "gate": "Alex says the spec is approved" },
    "narrow": { "on": true, "tickets": "file" },
    "code": { "on": true, "implementer": false },
    "evaluate": { "on": true, "where": "pr", "evidence": true },
    "release": { "on": false, "audit": "pr", "reason": "acceptance happens in the PR review; the merge is the release" }
  },
  "roster": {
    "plan": ["codebase-explorer"],
    "narrow": ["codebase-explorer"],
    "code": [],
    "evaluate": ["code-quality-reviewer", "silent-failure-hunter", "security-reviewer", "history-reviewer"]
  },
  "models": {
    "stages": { "evaluate": "strong" },
    "agents": { "security-reviewer": { "tier": "strong", "effort": "high" }, "codebase-explorer": "standard" },
    "map": {}
  },
  "open": ["Who rotates the deploy key?"],
  "firstJob": "Fix the flaky checkout test so that npm test is green on main"
}
```
