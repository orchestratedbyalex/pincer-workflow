#!/bin/bash
# PreToolUse guardrail for Bash commands. The Node helper parses the hook JSON
# before inspecting the actual command and recognizes the documented command
# forms without matching harmless strings elsewhere in the payload.
command -v node >/dev/null 2>&1 || {
  echo 'Blocked by PINCER guardrail: Node.js is required to parse hook input safely.' >&2
  exit 2
}
# The hook does not hand over to node: a hook that ends with any status but 2 lets
# the call run, so whatever node ends with that is not 0 (a crash, a signal, no
# memory left) is a refusal here.
node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/hook-policy.cjs" dangerous
status=$?
[ "$status" -eq 0 ] && exit 0
[ "$status" -eq 2 ] || echo "Blocked by PINCER guardrail: the hook ended without an answer (status $status), so the call is refused. Write the command more plainly or split it." >&2
exit 2
