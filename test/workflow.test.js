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
assert.match(release, /Any failure\s+blocks PASS/i);
assert.match(release, /candidate-wide release gate/i);
assert.match(release, /docs\/release-checklist\.md/);
assert.doesNotMatch(release.split('## Steps')[0], /docs\/dry-run-checklist\.md/);
assert.match(release, /Do not call `pincer-ticket\.sh` from Release/i);
assert.doesNotMatch(release, /pincer-ticket\.sh verify/);
assert.match(evaluate, /through a new ticket associated with/i);
assert.doesNotMatch(evaluate, /commit as `review: fixes`/i);

// R-01: requirement IDs and scenarios travel from plan through narrow to evaluate.
const prdTemplate = read('template/.claude/references/prd-template.md');
const ticketTemplate = read('template/.claude/references/ticket-template.md');
assert.match(prdTemplate, /### \d\. Requirements/);
assert.match(prdTemplate, /#### R-01 — /);
assert.match(prdTemplate, /never renumbered/i);
assert.match(prdTemplate, /Scenario:.*\n.*Failure path:.*\n.*Preserve:/s);
assert.match(prdTemplate, /Requirement mapping/);
assert.match(prdTemplate, /Preserve or link the\s+original brief/i);
assert.match(plan, /stable `R-NN` IDs/);
assert.match(plan, /never renumbers/i);
assert.match(plan, /supplied a PRD.*keep its meaning and existing requirement\s+IDs/is);
assert.match(plan, /mapping table/i);
assert.match(narrow, /requirement map/i);
assert.match(narrow, /Implements: R-NN/);
assert.match(narrow, /explicit review method/i);
assert.match(narrow, /states its purpose/i);
assert.match(narrow, /before implementation/i);
assert.match(ticketTemplate, /Implements: R-0?1/);
assert.match(evaluate, /`delivered`.*`blocked`.*`deferred`/s);
assert.match(evaluate, /blocks PASS/);
assert.match(evaluate, /do not relabel/i);
assert.match(evaluate, /explicit user authorization/i);
assert.match(evaluate, /evaluate the revised\s+candidate/i);
assert.match(evaluate, /not a mechanical traceability engine/i);
for (const source of [plan, narrow, code, evaluate, release, prdTemplate, ticketTemplate]) {
  assert.doesNotMatch(source, /guarantees? (full|complete) traceability/i);
}

// R-02: verification exercises behavior and discloses what it establishes.
assert.match(ticketTemplate, /^Proves: /m);
assert.match(ticketTemplate, /fail\s+when the behavior is wrong, not only when a name is renamed/i);
assert.match(ticketTemplate, /identifier grep alone does not prove/i);
assert.match(ticketTemplate, /static contracts/i);
assert.match(ticketTemplate, /explicit `unverified`, never fabricated/i);
assert.match(narrow, /`Proves:`/);
assert.match(narrow, /never a word match/i);
assert.match(narrow, /nor insufficient for lacking them/i);
assert.match(narrow, /explicit `unverified` result, never fabricated/i);
assert.match(code, /not behavioral proof/i);
assert.match(code, /explicit `unverified` result/i);

// R-03/R-04: the built transition precedes the candidate; evaluate persists validated evidence.
assert.match(code, /commit that change on its own \(`PRD vN: built`\)/);
assert.match(code, /never moved into a later evidence-only commit/i);
assert.match(evaluate, /`git status --short` must be\s+empty before review/i);
assert.match(evaluate, /do not review a dirty tree/i);
assert.match(evaluate, /\.prd\/evidence\/prd-vN\/<candidate>\//);
assert.match(evaluate, /pincer-evidence\.cjs validate .*--candidate <candidate> --prd/);
assert.match(evaluate, /pincer-evidence\.cjs digest/);
assert.match(evaluate, /^\s*evidence: \.prd\/evidence\/prd-vN\/<candidate>\/manifest\.json$/m);
assert.match(evaluate, /`result: unverified`.*never a\s+fabricated artifact/is);
assert.match(evaluate, /visual_review: \{applicable: false, reason\}/);
assert.match(evaluate, /NOTES\.md, the manifest and its listed artifacts — and nothing else/);
assert.match(evaluate, /never reuse a manifest from a previous candidate/i);
assert.match(evaluate, /not that the commands ran/i);
assert.match(release, /does\s+not repair tickets, rewrite evidence, change PRD state, or publish/i);
assert.match(release, /mutates\s+the candidate invalidates the audit/i);
assert.match(release, /`Evidence` line `ok`/);
assert.match(release, /Do not re-implement evidence checks/i);
assert.match(release, /durable runtime-owned release record is later work/i);
assert.match(release, /verdict naming the candidate/i);
// R-05: planning profile and one authorization rule shared verbatim by four playbooks.
assert.match(prdTemplate, /`profile: small \| standard`/);
assert.match(prdTemplate, /Few changed lines alone do not qualify/);
assert.match(prdTemplate, /implementation code must\s+not substitute for requirements/i);
assert.match(plan, /record why it fits/i);
assert.match(plan, /there is no default timebox/i);
assert.match(plan, /never silently cuts requirements/i);
assert.match(narrow, /no hard\s+one-to-two-ticket cap/i);
assert.match(narrow, /needs no second approval/i);
const authorizationBlock = source => {
  const match = source.match(/## Authorization rule \(shared by plan, narrow, code and evaluate\)\n[\s\S]*?(?=\n## |\s*$)/);
  assert.ok(match, 'playbook carries the shared authorization rule');
  return match[0].trim();
};
const sharedRule = authorizationBlock(plan);
for (const source of [narrow, code, evaluate]) assert.equal(authorizationBlock(source), sharedRule, 'authorization rule is identical across playbooks');
assert.match(sharedRule, /not authenticated human approval/);
assert.match(sharedRule, /do not invent it/);
for (const source of [plan, narrow, code, evaluate, release]) assert.doesNotMatch(source, /within the timebox/i);

// R-06: recovery never revives stale success; status wording.
assert.match(code, /## Recovering a ticket file/);
assert.match(code, /preserve the malformed contents/i);
assert.match(code, /hand the repair to the user, who\s+performs it in their own terminal/i);
assert.match(code, /fresh verification; a restored receipt is\s+never evidence/i);
assert.match(code, /Do not recommend restoring source files or unrelated edits/i);
assert.match(code, /not a measure\s+of active execution time/i);
const statusPlaybook = read('template/.claude/commands/pincer-status.md');
assert.match(statusPlaybook, /Never restore a ticket file from git/i);
assert.match(read('template/scripts/pincer-status.sh'), /wall-clock elapsed/);
const releaseChecklist = read('template/docs/release-checklist.md');
assert.match(releaseChecklist, /`evidence:` manifest/);
assert.match(releaseChecklist, /visual_review\.applicable: false/);
assert.match(releaseChecklist, /repaired no ticket, rewrote no evidence, changed no PRD state, and published nothing/);

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
assert.equal(
  read('plugin/docs/release-checklist.md').replaceAll('${CLAUDE_PLUGIN_ROOT}/', ''),
  read('template/docs/release-checklist.md'),
  'plugin ships the transformed general release checklist',
);

console.log('workflow contract tests passed');
