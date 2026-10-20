#!/bin/bash
# PINCER ticket lifecycle — the ONLY writer of a ticket's lifecycle fields
# (docs/engine.md, "Ticket fields and receipts"). On Claude Code a PreToolUse
# hook (.claude/hooks/ticket-guard.sh) blocks hand edits of those fields, so
# "done" is reached only through a passing check and acceptance only through
# a named person's words.
#
#   scripts/pincer-ticket.sh start  T-03   open -> in_progress; refuses while a depends_on ticket is not done and verified
#   scripts/pincer-ticket.sh verify T-03   runs the ticket's Verification block and stamps the receipt on exit 0
#   scripts/pincer-ticket.sh done   T-03   closes the ticket on a current passing check with every criterion ticked
#   scripts/pincer-ticket.sh accept T-03 --by "<name>" --words "<what they said>"   records the person's acceptance
#
# Exit codes: 0 ok, 1 refused, 2 usage, 3 no agreement or stage off, 130 interrupted.
command -v node >/dev/null 2>&1 || {
  echo 'pincer-ticket: Node.js 22+ is required — the engine is scripts/pincer/cli.cjs' >&2
  exit 1
}
case "${1:-}" in
  start|verify|done|accept) ;;
  *) sed -n '8,11p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2 ;;
esac
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/pincer/cli.cjs" ticket "$@"
