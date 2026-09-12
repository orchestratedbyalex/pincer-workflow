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
// PRD v3 R-03: ask only the open part of a partly answered question; budget and design question stay.
assert.match(plan, /Never ask a question the brief already answers/);
assert.match(plan, /asked only for its open part, naming the settled part/);
assert.match(plan, /Do not add a question to fill the budget/);
assert.match(plan, /max 3–4 at once/);
assert.match(plan, /ask one design question/);
assert.match(plan, /already supplies design direction, record it\s+and ask only about what it leaves open/);

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
assert.match(evaluate, /NOTES\.md, the manifest, its listed artifacts and \(change records\) the\s+evaluation locator — and nothing else/);
assert.match(evaluate, /never reuse a manifest from a previous candidate/i);
assert.match(evaluate, /not that the commands ran/i);
// PRD v3 R-02: one check per command, command line as run; npm test stays aggregate.
assert.match(evaluate, /one check per command: `command` holds the command line as run/);
assert.match(evaluate, /only the tool that could not run is `unverified`/);
assert.match(evaluate, /such as `npm test` stays one aggregate check/);
assert.match(read('template/docs/dry-run-checklist.md'), /holds one command line as run/);
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
assert.doesNotMatch(narrow, /Once authorized/);
assert.match(narrow, /already authorized by the PRD: do not\s+ask whether to proceed/i);
assert.match(narrow, /as a report, not a question/i);
assert.match(evaluate, /review\/code-quality\.md/);
assert.match(evaluate, /a review that left no record cannot be audited/i);
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
assert.match(code, /naming a ticket path or a normalized\s+pathspec/i);
assert.match(code, /`git reset --hard\|--merge\|--keep`, `git stash`/);
assert.match(code, /Branch\s+switches and file-specific restores outside `tickets\/` stay allowed/);
assert.match(code, /safety net for documented mistake forms, not a complete shell\s+boundary/i);
assert.match(code, /not a measure\s+of active execution time/i);
// PRD v3 R-01: the one exception — tree back at the evaluated candidate, check passes directly.
assert.match(code, /tracked files other than the ticket file being restored match the evaluated candidate/);
assert.match(code, /the committed evaluation still describes the tree/);
assert.match(code, /do not run `verify`, refresh the receipt or commit anything/);
assert.match(code, /If the block fails on that clean tree,\s+the failure is real/);
assert.match(code, /does not authorize discarding source changes/);
// PRD v4 R-01 (before migration): the exception needs a since-reverted source change
// and the same execution context; an unexplained failure stays a failure.
assert.match(code, /explained by a working-tree change that has since been reverted/);
assert.match(code, /same execution context as `verify`/);
assert.match(code, /no substituted binary and no repair made first/);
assert.match(code, /A changed executable, runner, working directory or environment repair requires a\s+new recorded verification/);
assert.match(code, /An unexplained failure cannot be cleared by restoring a receipt/);
const statusPlaybook = read('template/.claude/commands/pincer-status.md');
assert.match(statusPlaybook, /Never restore a ticket file from git/i);
assert.match(statusPlaybook, /the user restores the ticket file, and nothing is verified or committed/);
assert.match(statusPlaybook, /explained by a since-reverted source\s+change and the block passes in the same execution context as `verify`/);
assert.match(read('template/docs/dry-run-checklist.md'), /keeps the failed `last_check`, names no restore command, does not\s+switch binaries or repair the environment itself/);
assert.match(read('template/docs/dry-run-checklist.md'), /same execution context as `verify`/);
assert.match(read('template/docs/dry-run-checklist.md'), /runs no\s+`verify`, and\s+commits nothing/);
assert.match(read('template/scripts/pincer-status.sh'), /wall-clock elapsed/);
const releaseChecklist = read('template/docs/release-checklist.md');
assert.match(releaseChecklist, /`evidence:` manifest/);
assert.match(releaseChecklist, /visual_review\.applicable: false/);
assert.match(releaseChecklist, /repaired no ticket, rewrote no evidence, changed no PRD state, and published nothing/);

// PRD v4 (T-39): runtime semantics in the playbooks, templates and checklists.
assert.match(code, /records an attempt with the\s+captured log under `\.pincer\/runtime\/` and writes no receipt into the ticket/);
assert.match(code, /`done` consumes the current passing attempt and does not re-run the check/);
assert.match(code, /Never restore a\s+ticket file or delete `\.pincer\/runtime` to obtain a green status; the legacy exception\s+above applies only before migration/);
assert.match(code, /pincer-runtime\.cjs recover/);
assert.match(code, /never edit or delete them by hand/);
assert.match(evaluate, /pincer-runtime\.cjs check C-NN --candidate <sha> -- <command>/);
assert.match(evaluate, /evidence export --candidate <sha> --base <base> --prd \.prd\/prd-vN\.md --draft <file>/);
assert.match(evaluate, /a `passed` or `failed` command result written by hand/);
assert.match(evaluate, /Legacy project \(no change binding\):\s+author the schema 1 manifest as follows/);
assert.match(release, /Provenance/);
assert.match(release, /local verification history\s+unavailable; saved candidate evidence validated only/);
assert.match(release, /Release never\s+runs `verify`, `check` or `done`/);
assert.match(statusPlaybook, /--json/);
assert.match(statusPlaybook, /pincer-runtime\.cjs recover/);
assert.match(narrow, /`timeout: <seconds>` frontmatter field \(default 600\)/);
assert.match(ticketTemplate, /^timeout: 600/m);
assert.match(ticketTemplate, /consumes the current passing attempt against the current source/);
const agentsRules = read('template/AGENTS.md');
assert.match(agentsRules, /Never\s+edit or delete `\.pincer\/` or `\.prd\/changes\/` by hand/);
assert.match(agentsRules, /pincer-runtime\.cjs status --json/);
assert.match(releaseChecklist, /`Provenance` line names the evidence schema/);
assert.match(releaseChecklist, /a current passing attempt after it \(`node scripts\/pincer-runtime\.cjs ready` exits 0\)/);
const dryRun = read('template/docs/dry-run-checklist.md');
for (const phrase of ['SOURCE_CHANGED', 'recover', 'already migrated', 'evidence export', 'local verification history unavailable', 'ready` exits 1']) assert.match(dryRun, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `dry-run cheat: ${phrase}`);

// PRD v4 (T-42): registration and migration are explicit steps in the workflow.
assert.match(narrow, /register --prd \.prd\/prd-vN\.md` writes the change\s+record/);
assert.match(narrow, /change authorize prd-vN --agreement <digest> --reference "<where the user said it>" --excerpt "<the user's approval, quoted>"/);
assert.match(narrow, /commit `\.prd\/changes\/` as `Authorize PRD vN`/);
assert.match(narrow, /never becomes an authorization/);
assert.match(narrow, /commit them\s+as `Register PRD vN`/);
assert.match(narrow, /running the command proves nothing by itself/);
assert.match(code, /migrate --preview --prd \.prd\/prd-vN\.md/);
assert.match(code, /ask once whether to\s+apply\. Apply only on\s+a yes/);
assert.match(code, /Never migrate silently/);
assert.match(statusPlaybook, /fresh project → `register`, legacy receipts → `migrate --preview`/);
assert.match(dryRun, /Register PRD vN/);
// T-44: the checklist labels legacy-only boxes; registration commits .gitignore too.
assert.match(dryRun, /legacy project only\s+\(no change binding\): `verified` receipts too/);
assert.match(dryRun, /Legacy project only, cheat: revert the source/);
assert.match(dryRun, /Legacy project only, cheat: with the tree at the candidate/);
assert.match(narrow, /stage\s+`\.prd\/changes\/` and `\.gitignore`/);
assert.match(code, /commit `\.prd\/changes\/` and `\.gitignore` as `Register PRD vN`/);
assert.match(read('template/docs/runtime-contracts.md'), /at most 2147483/);
assert.match(read('template/docs/runtime-contracts.md'), /is the target surface/);
assert.doesNotMatch(read('template/docs/runtime-contracts.md'), /Tested platforms are the CI matrix/);
assert.match(read('plugin/docs/runtime-contracts.md'), /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/pincer-runtime\//, 'plugin transform rewrites the module directory');
assert.match(dryRun, /nothing was\s+migrated silently/);

// PRD v5 (T-59): the change workflow in every playbook, the checklists and the guards.
assert.match(code, /run `node scripts\/pincer-runtime\.cjs resume` and follow its `Next`/);
assert.match(code, /change\s+select <id>`; selection is local metadata and touches no source/);
assert.match(code, /`change activate <id>`; refused until the user's authorization is recorded/);
assert.match(code, /## Changes: pausing, decisions and completion/);
assert.match(code, /change pause <id> --reason "<why>" --note "<handoff for the next session>"/);
assert.match(code, /do not ask the user to re-approve unchanged scope/);
assert.match(code, /change decide <id> --summary "<the question>"/);
assert.match(code, /--delegated --basis A-NN --explanation/);
assert.match(code, /refuses with\s+`AGREEMENT_CHANGED`/);
// T-62 (trial finding): an out-of-session agreement change is a decision, never approved by a continue instruction.
assert.match(code, /caused by an edit this session\s+did not make .* is a\s+consequential decision: raise it with `change decide <id> --summary "<what changed>"`/s);
assert.match(code, /A general instruction to continue,\s+resume or not re-ask never authorizes new scope/);
assert.match(code, /change complete <id>`\s+\(it refuses unfinished tickets/);
assert.match(code, /Completed means ready\s+for evaluation, not evaluated or released/);
assert.match(code, /complete the change first \(`change complete <id>`,\s+committed as `Complete PRD vN`\)/);
assert.match(code, /the v0\.5\.0 free text is\s+history only/);
assert.match(code, /`SELECTION_REQUIRED`,\s+`WRONG_CHANGE`, `LIFECYCLE_BLOCKED`, `BASE_MISMATCH`, `DECISION_REQUIRED`,\s+`AUTHORIZATION_REQUIRED` or `AGREEMENT_CHANGED` before anything runs or is written/);
assert.match(evaluate, /the `change complete` commit/);
assert.match(evaluate, /appends the evaluation to the change's\s+locator `\.prd\/evidence\/changes\/<id>\.json`/);
assert.match(release, /Release selects, activates and completes nothing/);
assert.match(release, /`AGREEMENT_CHANGED` as failures/);
assert.match(statusPlaybook, /`resume` is the\s+report; `change resume <id>` is the lifecycle operation/);
assert.match(statusPlaybook, /no selection → `change select <id>`/);
assert.match(sharedRule, /as\s+a `change authorize` record/);
assert.match(sharedRule, /read the `resume` report; an authorization\s+it reports as `current` needs no repeat approval/);
assert.match(agentsRules, /`change select <id>` picks the change this worktree works on\s+\(never the newest PRD\)/);
assert.match(agentsRules, /Selecting grants no approval/);
assert.match(releaseChecklist, /the selected change is `completed`, its authorization is `current`/);
assert.match(dryRun, /recorded with\s+`change authorize`/);
assert.match(dryRun, /run `resume` — the report names the change, the blocker and the next\s+command from files alone/);
assert.match(dryRun, /`change complete prd-vN` ran \(`Complete PRD vN` commit\)/);
assert.match(dryRun, /\| R-10 \| \|/);
assert.match(rootReadme, /change select/);
assert.match(rootReadme, /old free-text authorization never authorizes execution/);
assert.match(read('docs/index.html'), /resume<\/code> report/);
assert.match(read('template/.claude/hooks/hook-policy.cjs'), /'change', 'resume'\]/);
assert.match(read('template/.claude/hooks/hook-policy.cjs'), /evidence\[\\\\\/\]changes/);

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
