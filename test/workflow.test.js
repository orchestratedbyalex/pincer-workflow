import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { repo } from './helpers.js';

const read = relative => fs.readFileSync(path.join(repo, relative), 'utf8');
const plan = read('template/.claude/commands/pincer-plan.md');
const narrow = read('template/.claude/commands/pincer-narrow.md');
const code = read('template/.claude/commands/pincer-code.md');
const evaluate = read('template/.claude/commands/pincer-evaluate.md');
const release = read('template/.claude/commands/pincer-release.md');
const ticket = read('template/scripts/pincer-ticket.sh');
const codex = read('template/.codex/README.md');
const rootReadme = read('README.md');

assert.match(plan, /next unused .*prd-v\{N\}/i);
assert.match(plan, /concrete scope and architecture/i);
assert.doesNotMatch(plan, /Save to `\.prd\/prd-v1\.md`/);
assert.match(plan, /do not repeat an approval already given/i);

assert.match(narrow, /Ticket count and size follow/i);
assert.match(narrow, /greenfield.*walking skeleton/is);
assert.match(narrow, /brownfield.*characterization/is);
assert.doesNotMatch(narrow, /Target: 4[–-]7|Ticket 1 is always|never L/);
assert.match(narrow, /stage that PRD and the explicit new ticket paths/i);

assert.match(code, /Do not ask the user to reconfirm/i);
assert.match(code, /stage only the\s+explicit paths/i);
assert.match(code, /without printing values/i);
for (const source of [code, evaluate, ticket]) {
  assert.doesNotMatch(source, /git add -A|git log -p \| grep|git diff \| grep/i);
}
assert.match(release, /failure revokes readiness/i);

for (const source of [rootReadme, codex]) {
  assert.doesNotMatch(source, /Codex has no PreToolUse hooks/i);
  assert.match(source, /does not currently install a Codex hook adapter/i);
}
assert.match(rootReadme, /Node\.js 18\+/);

for (const name of ['narrow', 'code', 'release']) {
  const skill = read(`template/.agents/skills/pincer-${name}/SKILL.md`);
  assert.match(skill, /when omitted, use the playbook's documented default/i, `${name} keeps its optional-argument default`);
  assert.doesNotMatch(skill, /ask for it if there is none/i);
}
assert.ok(fs.existsSync(path.join(repo, 'plugin/hooks/hook-policy.cjs')), 'plugin ships structured hook parser');
assert.equal(read('plugin/hooks/hook-policy.cjs'), read('template/.claude/hooks/hook-policy.cjs'), 'plugin hook parser matches canonical source');

console.log('workflow contract tests passed');
