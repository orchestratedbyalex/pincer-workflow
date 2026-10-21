#!/bin/bash
# Regenerates the project copies, Codex skills and Copilot prompts from the library and harness.json (scripts/pincer/cli.cjs generate).
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/pincer/cli.cjs" generate "$@"
