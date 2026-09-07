#!/bin/bash
# PreToolUse guardrail for Bash commands. The Node helper parses the hook JSON
# before inspecting the actual command and recognizes the documented command
# forms without matching harmless strings elsewhere in the payload.
command -v node >/dev/null 2>&1 || {
  echo 'Blocked by PINCER guardrail: Node.js is required to parse hook input safely.' >&2
  exit 2
}
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/hook-policy.cjs" dangerous
