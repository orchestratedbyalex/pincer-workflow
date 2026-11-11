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
# The hook does not hand over to node: a hook that ends with any status but 2 lets
# the call run, so whatever node ends with that is not 0 (a crash, a signal, no
# memory left) is a refusal here.
node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/hook-policy.cjs" ticket
status=$?
[ "$status" -eq 0 ] && exit 0
[ "$status" -eq 2 ] || echo "Blocked by PINCER ticket guard: the hook ended without an answer (status $status), so the call is refused. Write the command more plainly or split it." >&2
exit 2
