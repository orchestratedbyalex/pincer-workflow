// Smoke test for the pincer CLI: init → edit → update → doctor, in a temp dir.
// Run with: npm test
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'pincer.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pincer-smoke-'));
const run = (...args) => execFileSync('node', [bin, ...args], { cwd: dir, encoding: 'utf8' });
// runs a command expected to exit non-zero; returns its combined output
const runFail = (...args) => {
  try {
    run(...args);
  } catch (err) {
    return `${err.stdout ?? ''}${err.stderr ?? ''}`;
  }
  throw new assert.AssertionError({ message: `expected \`pincer ${args.join(' ')}\` to fail` });
};

try {
  // init installs the full kit and writes the manifest
  const out = run('init', '--platform', 'all');
  assert.match(out, /wrote\s+\d+ file/);
  for (const f of ['AGENTS.md', 'CLAUDE.md', '.pincer.json', '.claude/settings.json', '.codex/README.md', '.github/copilot-instructions.md', 'scripts/sync-prompts.sh']) {
    assert.ok(fs.existsSync(path.join(dir, f)), `missing ${f}`);
  }
  for (const f of ['.claude/hooks/block-dangerous.sh', '.claude/hooks/ticket-guard.sh', 'scripts/pincer-ticket.sh', 'scripts/pincer-status.sh']) {
    assert.ok(fs.statSync(path.join(dir, f)).mode & 0o100, `${f} not executable`);
  }
  assert.match(fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8'), /ticket-guard\.sh/);
  // Codex dropped custom prompts (openai/codex#16115); it loads skills from .agents/skills/ in the repo
  for (const n of ['plan', 'narrow', 'code', 'evaluate', 'release', 'status']) {
    const skill = fs.readFileSync(path.join(dir, `.agents/skills/pincer-${n}/SKILL.md`), 'utf8');
    assert.match(skill, new RegExp(`^---\\nname: pincer-${n}\\ndescription: `));
    assert.doesNotMatch(skill, /\$ARGUMENTS/);
  }
  assert.ok(!fs.existsSync(path.join(dir, '.codex/prompts')), '.codex/prompts should no longer ship');
  assert.match(out, /\$pincer-plan/);
  assert.match(out, /\$pincer-status on Codex/);
  // a Codex-only install still needs the canonical playbooks, rubrics and templates the skills point at,
  // but none of Claude Code's own wiring
  const codexDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pincer-codex-'));
  assert.match(execFileSync('node', [bin, 'init', '--platform', 'codex'], { cwd: codexDir, encoding: 'utf8' }), /\(also \$pincer-status\)/);
  for (const f of ['.claude/commands/pincer-plan.md', '.claude/agents/codebase-explorer.md', '.claude/references/ticket-template.md', '.claude/references/prd-template.md']) {
    assert.ok(fs.existsSync(path.join(codexDir, f)), `codex-only install missing ${f}`);
  }
  for (const f of ['CLAUDE.md', '.claude/settings.json', '.claude/hooks/ticket-guard.sh']) {
    assert.ok(!fs.existsSync(path.join(codexDir, f)), `codex-only install should not ship ${f}`);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(codexDir, '.agents/skills/pincer-code/SKILL.md'), 'utf8'), /CLAUDE\.md/);
  assert.doesNotMatch(out, /~\/\.codex\/prompts/);

  // second init refuses
  assert.match(runFail('init', '--platform', 'all'), /already has PINCER/);

  // update preserves a local edit as .new and leaves the edit in place
  fs.appendFileSync(path.join(dir, 'AGENTS.md'), '\n- local edit\n');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.pincer.json'), 'utf8'));
  manifest.files['AGENTS.md'] = 'stale-hash-simulating-template-change';
  fs.writeFileSync(path.join(dir, '.pincer.json'), JSON.stringify(manifest));
  const up = run('update');
  assert.match(up, /CONFLICT AGENTS\.md/);
  assert.doesNotMatch(up, /~\/\.codex\/prompts/);
  assert.ok(fs.existsSync(path.join(dir, 'AGENTS.md.new')));
  assert.match(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), /local edit/);

  // doctor flags the unmerged .new file, passes once merged
  assert.match(runFail('doctor'), /AGENTS\.md\.new/);
  fs.rmSync(path.join(dir, 'AGENTS.md.new'));
  assert.match(run('doctor'), /All good/);

  console.log('smoke test passed');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
