#!/bin/bash
# PreToolUse guard for ticket lifecycle fields. The Node helper parses JSON,
# compares existing and proposed frontmatter for editing tools, and permits only
# exact pincer-ticket.sh lifecycle calls as shell writers.
command -v node >/dev/null 2>&1 || {
  echo 'Blocked by PINCER ticket guard: Node.js is required to parse hook input safely.' >&2
  exit 2
}
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/hook-policy.cjs" ticket
