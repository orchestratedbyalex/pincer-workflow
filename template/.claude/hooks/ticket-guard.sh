#!/bin/bash
# PreToolUse guard for ticket state. A ticket's state fields — status
# (in_progress / done), started, verified, finished — are written only by
# scripts/pincer-ticket.sh, whose `done` needs a passing verification receipt.
# This hook makes that script the only door on Claude Code: editing tools may
# not write those fields into tickets/T-*.md, and Bash may not sed/echo them in.
# Creating a ticket with `status: open` and ticking acceptance boxes stay allowed.
# Exit 2 blocks the tool call; stderr goes back to the agent.
#
# A guard against carelessness, not an adversary: the agent could still route
# around it, but it can no longer do so by accident or habit.

input=$(cat)

field() { # dotted path into the hook JSON, e.g. tool_input.file_path
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$input" | jq -r ".$1 // empty" 2>/dev/null
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$input" | python3 -c '
import json, sys
d = json.load(sys.stdin)
for k in sys.argv[1].split("."):
    d = d.get(k, "") if isinstance(d, dict) else ""
print(d if isinstance(d, str) else json.dumps(d))' "$1" 2>/dev/null
  else # crude fallback: last path segment, first match, no unescaping
    printf '%s' "$input" | grep -oE "\"${1##*.}\"[[:space:]]*:[[:space:]]*\"([^\"\\\\]|\\\\.)*\"" | head -1 | sed -E 's/^"[^"]*"[[:space:]]*:[[:space:]]*"//; s/"$//'
  fi
}

tool=$(field tool_name)
# `status: open` is fine; these are the fields only the script may write.
PROTECTED='(^|\\n|[[:space:]])(status:[[:space:]]*(in_progress|done)|started:|verified:|finished:)'
TICKET='(^|/)tickets/T-[0-9]+[^/]*\.md$'

block() {
  echo "Blocked by PINCER ticket guard: $1 Use pincer-ticket.sh (path in the /pincer-code playbook): 'verify T-NN' writes the receipt when the check passes, 'done T-NN' flips the status. Ticking acceptance boxes and editing the body are fine." >&2
  exit 2
}

case "$tool" in
  Edit|Write|MultiEdit)
    file=$(field tool_input.file_path)
    printf '%s' "$file" | grep -qE "$TICKET" || exit 0
    case "$tool" in
      Edit)  new=$(field tool_input.new_string) ;;
      Write) new=$(field tool_input.content) ;;
      *)     new=$(field tool_input.edits) ;;
    esac
    [ -n "$new" ] || new=$input
    if printf '%s' "$new" | grep -qE "$PROTECTED"; then
      block "ticket state fields (status in_progress/done, started, verified, finished) are never written by hand."
    fi
    ;;
  Bash)
    cmd=$(field tool_input.command)
    [ -n "$cmd" ] || cmd=$input
    printf '%s' "$cmd" | grep -q 'pincer-ticket.sh' && exit 0
    if printf '%s' "$cmd" | grep -qE 'tickets/|T-[0-9][0-9]' &&
       printf '%s' "$cmd" | grep -qE 'status:[[:space:]]*(in_progress|done)|started:|verified:|finished:' &&
       printf '%s' "$cmd" | grep -qE '(sed|perl)[[:space:]]+(-[a-zA-Z]*i|-i)|>|tee[[:space:]]|python|node|ruby'; then
      block "that command writes ticket state fields from the shell."
    fi
    ;;
esac

exit 0
