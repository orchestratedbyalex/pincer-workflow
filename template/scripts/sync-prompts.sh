#!/bin/bash
# Generates the Codex CLI and GitHub Copilot adapters from the canonical
# PINCER playbooks in .claude/commands/. The playbooks are the single source
# of truth: edit them, re-run this script, commit the result.
#
#   .codex/prompts/pincer-*.md          — Codex CLI custom prompts
#                                         (install: cp .codex/prompts/*.md ~/.codex/prompts/)
#   .github/prompts/pincer-*.prompt.md  — VS Code Copilot prompt files
#                                         (enable: "chat.promptFiles": true)
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p .codex/prompts .github/prompts

count=0
for src in .claude/commands/pincer-*.md; do
  name=$(basename "$src" .md)
  desc=$(sed -n 's/^description: *"\{0,1\}\([^"]*\)"\{0,1\}$/\1/p' "$src" | head -1)
  body=$(awk 'flag; /^---$/ { if (++c == 2) flag = 1 }' "$src")

  # Codex: plain markdown prompt; $ARGUMENTS is supported natively.
  {
    printf '<!-- Generated from %s by scripts/sync-prompts.sh — edit the source, not this file -->\n\n' "$src"
    printf '%s\n' "$body"
  } > ".codex/prompts/$name.md"

  # Copilot: prompt-file frontmatter; $ARGUMENTS becomes an input variable.
  {
    printf -- '---\nmode: agent\ndescription: "%s"\n---\n' "$desc"
    printf '<!-- Generated from %s by scripts/sync-prompts.sh — edit the source, not this file -->\n\n' "$src"
    printf '%s\n' "$body" | sed 's/\$ARGUMENTS/${input:request:Task brief or arguments (optional)}/g'
  } > ".github/prompts/$name.prompt.md"

  count=$((count + 1))
done

echo "Synced $count playbooks -> .codex/prompts/ and .github/prompts/"
