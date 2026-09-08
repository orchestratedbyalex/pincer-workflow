#!/bin/bash
# Generates the Claude Code plugin (plugin/) from template/ — the single
# source of truth. Run after editing the template, then commit the result.
#
# Transforms applied:
#   /pincer-plan …        ->  /pincer:plan …          (plugin command namespace)
#   .claude/agents/…      ->  ${CLAUDE_PLUGIN_ROOT}/agents/…
#   .claude/references/…  ->  ${CLAUDE_PLUGIN_ROOT}/references/…
#   .claude/commands/…    ->  ${CLAUDE_PLUGIN_ROOT}/commands/…
#   docs/*.md             ->  ${CLAUDE_PLUGIN_ROOT}/docs/*.md
#   scripts/pincer-*.sh   ->  ${CLAUDE_PLUGIN_ROOT}/scripts/pincer-*.sh (and pincer-evidence.cjs)
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
rm -rf plugin
mkdir -p plugin/.claude-plugin plugin/commands plugin/agents plugin/references plugin/docs plugin/hooks plugin/scripts

xform() {
  # slash-command rename only where /pincer- is a command mention (not inside a
  # file path like commands/pincer-plan.md — those are preceded by a word char)
  perl -pe 's{(?<![\w/.])/pincer-}{/pincer:}g' "$1" |
    perl -pe '
      s{\.claude/agents/}{\${CLAUDE_PLUGIN_ROOT}/agents/}g;
      s{\.claude/references/}{\${CLAUDE_PLUGIN_ROOT}/references/}g;
      s{\.claude/commands/}{\${CLAUDE_PLUGIN_ROOT}/commands/}g;
      s{docs/((?:release|dry-run)-checklist\.md)}{\${CLAUDE_PLUGIN_ROOT}/docs/$1}g;
      s{(?<![\w/])scripts/(pincer-(?:ticket|status)\.sh|pincer-evidence\.cjs)}{\${CLAUDE_PLUGIN_ROOT}/scripts/$1}g;
    '
}

for f in template/.claude/commands/pincer-*.md; do
  short=$(basename "$f" .md)
  xform "$f" > "plugin/commands/${short#pincer-}.md"
done
for f in template/.claude/agents/*.md; do xform "$f" > "plugin/agents/$(basename "$f")"; done
for f in template/.claude/references/*.md; do xform "$f" > "plugin/references/$(basename "$f")"; done
for f in template/docs/*.md; do xform "$f" > "plugin/docs/$(basename "$f")"; done

cp template/.claude/hooks/block-dangerous.sh template/.claude/hooks/ticket-guard.sh template/.claude/hooks/hook-policy.cjs plugin/hooks/
cp template/scripts/pincer-ticket.sh template/scripts/pincer-ticket-lib.sh template/scripts/pincer-status.sh template/scripts/pincer-evidence.cjs plugin/scripts/
chmod +x plugin/hooks/*.sh plugin/scripts/*.sh

cat > plugin/hooks/hooks.json <<EOF
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"\${CLAUDE_PLUGIN_ROOT}\"/hooks/block-dangerous.sh"
          }
        ]
      },
      {
        "matcher": "Edit|Write|MultiEdit|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"\${CLAUDE_PLUGIN_ROOT}\"/hooks/ticket-guard.sh"
          }
        ]
      }
    ]
  }
}
EOF

cat > plugin/.claude-plugin/plugin.json <<EOF
{
  "name": "pincer",
  "description": "PINCER — PRD-driven agentic delivery workflow: /pincer:plan → /pincer:narrow → /pincer:code → /pincer:evaluate → /pincer:release (+ /pincer:status)",
  "version": "$VERSION",
  "author": { "name": "Alexander" }
}
EOF

echo "Built plugin/ v$VERSION ($(find plugin -type f | wc -l | tr -d ' ') files)"
