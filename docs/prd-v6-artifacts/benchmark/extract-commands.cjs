#!/usr/bin/env node
'use strict';
// Extracts the commands a session ran from its Claude Code transcript (the jsonl under
// ~/.claude/projects/), for the transcript review of T-77:
//   node extract-commands.cjs <session_id> <out.txt>
// Prints one line per tool use: Bash commands, file writes/edits (paths only), other tools by name.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const [sessionId, outFile] = process.argv.slice(2);
const root = path.join(os.homedir(), '.claude', 'projects');
let file = null;
for (const dir of fs.readdirSync(root)) { const p = path.join(root, dir, `${sessionId}.jsonl`); if (fs.existsSync(p)) { file = p; break; } }
if (!file) { fs.writeFileSync(outFile, `transcript ${sessionId} not found under ${root}\n`); process.exit(1); }
const lines = [];
for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
  if (!raw.trim()) continue;
  let j; try { j = JSON.parse(raw); } catch { continue; }
  const content = j.message && Array.isArray(j.message.content) ? j.message.content : [];
  for (const c of content) {
    if (c.type !== 'tool_use') continue;
    const i = c.input || {};
    if (c.name === 'Bash') lines.push(`Bash: ${String(i.command || '').replace(/\s+/g, ' ').slice(0, 400)}`);
    else if (c.name === 'Write' || c.name === 'Edit' || c.name === 'MultiEdit' || c.name === 'NotebookEdit') lines.push(`${c.name}: ${i.file_path || i.notebook_path || ''}`);
    else if (c.name === 'Read') lines.push(`Read: ${i.file_path || ''}`);
    else lines.push(`${c.name}`);
  }
}
fs.writeFileSync(outFile, `${lines.length} tool uses (transcript ${path.basename(file)})\n${lines.join('\n')}\n`);
