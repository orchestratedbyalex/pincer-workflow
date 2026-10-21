---
owner: the session writes it in evaluate; scripts/pincer-evidence.cjs validates it
home: <homes.evidence>/<candidate>/manifest.json, next to checks/, review/ and visual/
readers: AI → AI (status and release run the validator) and AI → human (the audit reads the checks)
shape: evidence schema 1, the keys below, every artifact listed with its sha256
---
# Evidence manifest

Schema 1 is the only schema. The directory's name is the candidate's full commit id.
Top-level keys, all required: `schema`, `candidate`, `base`, `created`, `spec`,
`environment`, `checks`, `visual_review`, `artifacts`.

- `candidate`, `base`: full 40-character commit ids.
- `created`: UTC timestamp, `YYYY-MM-DDTHH:MM:SSZ`.
- `spec`: the spec path, which must exist.
- `environment`: `tools` (what ran) and `limitations` (what could not run), each a list of short strings.
- `checks`: one entry per check, `id` `C-NN`, `kind` `command`, `review` or `visual`, `required`, `result` `passed`, `failed` or `unverified`, `command` for a command check (the line as run), `log` naming an artifact, optional `note`. A required check must be `passed`. A tool that could not run is `unverified` with a note, never a fabricated result.
- `visual_review`: `applicable` true or false, `reason` required when not applicable.
- `artifacts`: `{path: sha256}` for every file in the directory the manifest refers to; digests from `node scripts/pincer-evidence.cjs digest <file>...`.

Validate with `node scripts/pincer-evidence.cjs validate <manifest> --candidate <sha>`;
it prints `ok <sha>` or one problem per line. It checks the record's consistency, not
that the commands ran: say so when asked.

## Example

```json
{
  "schema": 1,
  "candidate": "3f9c2a1d4e5b6c7f8091a2b3c4d5e6f708192a3b",
  "base": "8b1d0e4f5a6b7c8d9e0f1a2b3c4d5e6f70819203",
  "created": "2026-10-21T16:02:11Z",
  "spec": "specs/rate-limit-login.md",
  "environment": { "tools": ["node 22.10", "npm 10.9"], "limitations": ["no staging access from this session"] },
  "checks": [
    { "id": "C-01", "kind": "command", "required": true, "result": "passed", "command": "npm test", "log": "checks/C-01.log" },
    { "id": "C-02", "kind": "command", "required": true, "result": "passed", "command": "npm run lint", "log": "checks/C-02.log" },
    { "id": "C-03", "kind": "review", "required": true, "result": "passed", "log": "review/report.md" },
    { "id": "C-04", "kind": "command", "required": false, "result": "unverified", "command": "npm audit --omit=dev", "log": "checks/C-04.log", "note": "registry unreachable from this session" }
  ],
  "visual_review": { "applicable": false, "reason": "no user interface changed" },
  "artifacts": {
    "checks/C-01.log": "0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0",
    "checks/C-02.log": "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809",
    "checks/C-04.log": "2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a",
    "review/report.md": "3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b"
  }
}
```
