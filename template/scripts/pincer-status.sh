#!/bin/bash
# PINCER status — where the work stands, read from harness.json and the
# artifacts on disk (docs/engine.md, "Stage gate"). Read-only. Every stage
# skill runs the gate first; /pincer-status wraps the report.
#
#   scripts/pincer-status.sh                  stages, specs, every ticket, warnings, and the next command
#   scripts/pincer-status.sh --json           the same report as JSON
#   scripts/pincer-status.sh --stage <name>   the gate: prints "on" and exits 0, or the reason and exits 3
#
# Exit codes: 0 ok, 2 usage, 3 no agreement, invalid harness.json or stage off.
command -v node >/dev/null 2>&1 || {
  echo 'pincer-status: Node.js 22+ is required — the engine is scripts/pincer/cli.cjs' >&2
  exit 1
}
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/pincer/cli.cjs" status "$@"
