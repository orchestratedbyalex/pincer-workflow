#!/bin/bash
# PreToolUse guardrail for Bash commands. Blocks destructive or pipe-to-shell
# patterns regardless of permission mode — these are never auto-approved; a
# human runs them in their own terminal if truly intended.
# Exit 2 blocks the tool call; stderr goes back to the agent.

input=$(cat)

if printf '%s' "$input" | grep -qE \
  -e 'rm -rf?( -[a-z]+)* +(/|~|\$HOME)' \
  -e 'git push[^|;&]*(--force|-f)( |$)' \
  -e '(curl|wget)[^|;&]*\|[[:space:]]*(sudo )?(ba|z)?sh' \
  -e 'chmod( -R)? +777' \
  -e '--dangerously-skip-permissions' \
  -e 'git reset --hard[^|;&]*origin/'; then
  echo "Blocked by PINCER guardrail: destructive or pipe-to-shell command. If this is genuinely intended, the user runs it manually in their own terminal." >&2
  exit 2
fi

exit 0
