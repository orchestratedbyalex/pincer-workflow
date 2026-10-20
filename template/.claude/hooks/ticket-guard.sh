#!/bin/bash
# PreToolUse guard for the ticket lifecycle fields (status, started, last_check,
# verified, finished, accepted, accepted_by, accepted_words). The Node helper
# parses JSON, compares existing and proposed frontmatter for editing tools, and
# permits only exact pincer-ticket.sh calls (start, verify, done, accept) as
# shell writers of ticket files. It guards T-NN-*.md under any tickets/ directory
# and does not read harness.json.
command -v node >/dev/null 2>&1 || {
  echo 'Blocked by PINCER ticket guard: Node.js is required to parse hook input safely.' >&2
  exit 2
}
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/hook-policy.cjs" ticket
