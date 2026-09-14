// PRD v7 T-92 (R-06, S-16..S-18): the documented first-use journey actually works from
// a packed install. The walkthrough follows the README and the playbooks command for
// command — install, register, select, scaffold, author, adopt, authorize, work, pause,
// resume --brief — on a disposable project, and asserts that the two places a user can
// be misled refuse instead: an unresolved map never reads as coverage, and an agreement
// that moved after authorization never carries the old approval forward. S-17 checks
// that unchanged authorized work is not re-approved and that a changed scope still is.
// S-18 checks the document order: the journey comes before the migration history, kit
// pinning is written down, and no installation check is presented as a live trial.
//
// What this proves is that the documented commands work and refuse correctly. It does
// not prove that an agent reading these documents behaves well — that is a live
// observation (T-93) and nothing here stands in for it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { repo, tempDir, run, write, read } from './helpers.js';

function passes(result, label) {
  assert.equal(result.error, undefined, `${label}: process completed`);
  assert.equal(result.status, 0, `${label}: ${result.stdout}${result.stderr}`);
  return result.stdout;
}
function refuses(result, label, pattern) {
  assert.notEqual(result.status, 0, `${label}: expected a refusal, got 0\n${result.stdout}`);
  assert.match(result.stdout + result.stderr, pattern, label);
  return result;
}

const fx = path.join(repo, 'test/fixtures/prd-v6');
const readme = read(repo, 'README.md');

// --- The packed artifact, installed the way a user installs it ----------------------
const packed = tempDir();
const npmCache = tempDir();
const npmOptions = { env: { ...process.env, npm_config_cache: npmCache } };
const packData = JSON.parse(passes(run(repo, 'npm', ['pack', '--json', '--pack-destination', packed], npmOptions), 'npm pack'))[0];
const tarball = path.join(packed, path.basename(packData.filename));
const home = tempDir();
write(home, 'package.json', '{"private":true}\n');
passes(run(home, 'npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], npmOptions), 'install packed artifact');
const installer = path.join(home, 'node_modules/pincer-workflow/bin/pincer.js');
assert.ok(fs.existsSync(installer), 'the packed CLI installed');

// A disposable project, initialised through the packed installer exactly as the README
// says: `npx pincer-workflow init`.
function project() {
  const dir = tempDir();
  passes(run(dir, process.execPath, [installer, 'init', '--platform', 'claude']), 'pincer init');
  write(dir, '.prd/prd-v1.md', read(fx, 'strict/prd-v1.md'));
  for (const f of fs.readdirSync(path.join(fx, 'strict/tickets'))) write(dir, `tickets/${f}`, read(fx, `strict/tickets/${f}`));
  write(dir, 'value.txt', 'good\n');
  for (const [k, v] of [['init', '-q'], ['config', 'user.email'], ['config', 'user.name'], ['config', 'commit.gpgsign']]) void k, v;
  run(dir, 'git', ['init', '-q', '-b', 'main']);
  run(dir, 'git', ['config', 'user.email', 't@example.invalid']);
  run(dir, 'git', ['config', 'user.name', 'Walkthrough']);
  run(dir, 'git', ['config', 'commit.gpgsign', 'false']);
  run(dir, 'git', ['add', '-A']);
  run(dir, 'git', ['commit', '-q', '-m', 'base']);
  return dir;
}
const rt = (dir, ...args) => run(dir, process.execPath, [path.join(dir, 'scripts/pincer-runtime.cjs'), ...args]);
const commit = (dir, message) => { run(dir, 'git', ['add', '-A']); run(dir, 'git', ['commit', '-q', '-m', message]); };
// The agreement the runtime computes now — the digest `change authorize` requires.
const currentAgreement = dir => JSON.parse(passes(rt(dir, 'resume', '--json'), 'resume --json')).agreement.current;

// The map a reviewer authors from the draft. Every live scenario is linked, so no scope
// disposition and no decision are involved: this is the plain path the README documents.
const AUTHORED_MAP = `${JSON.stringify({
  schema: 1,
  change: 'prd-v1',
  prd: '.prd/prd-v1.md',
  scenarios: {
    'S-01': { tickets: ['T-01'], checks: ['C-01'] },
    'S-02': { tickets: ['T-01', 'T-02'], checks: ['C-01', 'C-02'] },
    'S-03': { tickets: ['T-02'], checks: ['C-01'] },
  },
  scope: {},
  tickets: {
    'T-01': { role: 'implements', rationale: null },
    'T-02': { role: 'implements', rationale: null },
    'T-03': { role: 'enables', rationale: 'shared fixture harness used by C-01 and C-02; implements no scenario' },
  },
  checks: {
    'C-01': { kind: 'command', required: true, command: 'test "$(cat value.txt)" = good', timeout: 60, cwd: null, obligation: null, note: null },
    'C-02': { kind: 'review', required: true, command: null, timeout: null, cwd: null, obligation: 'read the diagnostic wording of S-02 against the PRD', note: null },
  },
}, null, 2)}\n`;

// --- S-16: the walkthrough reaches strict adoption and resumes through the brief -----
{
  const dir = project();
  // The installer shipped the runtime the README's journey calls.
  for (const f of ['scripts/pincer-runtime.cjs', 'scripts/pincer-runtime/scaffold.cjs', 'scripts/pincer-runtime/resume.cjs', 'docs/runtime-contracts.md']) {
    assert.ok(fs.existsSync(path.join(dir, f)), `the packed install ships ${f}`);
  }

  // Step 2 of the journey.
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'), 'register');
  passes(rt(dir, 'change', 'select', 'prd-v1'), 'change select');

  // Step 3: the draft. It must show the work that is still to do, not hide it.
  const draftOut = passes(rt(dir, 'coverage', 'scaffold', '--change', 'prd-v1'), 'coverage scaffold');
  const draft = JSON.parse(passes(rt(dir, 'coverage', 'scaffold', '--change', 'prd-v1', '--json'), 'coverage scaffold --json'));
  assert.equal(draft.draft, 1);
  assert.deepEqual(Object.keys(draft.scenarios), ['S-01', 'S-02', 'S-03'], 'every live scenario is listed for the author');
  assert.ok(draft.unresolved.length >= 3, 'and what is unauthored is listed as unresolved');
  assert.match(draftOut, /This is a draft, not a coverage map/, 'the draft says what it is not');
  // The draft writes nothing: the map does not exist yet.
  assert.ok(!fs.existsSync(path.join(dir, '.prd/coverage/prd-v1.json')), 'scaffolding wrote no map');

  // An unresolved map never reads as coverage. Saving the draft in the map's place is
  // the most plausible mistake a reader could make, and adoption refuses it by name.
  write(dir, '.prd/coverage/prd-v1.json', `${JSON.stringify(draft, null, 2)}\n`);
  refuses(rt(dir, 'coverage', 'adopt', '--preview', '--change', 'prd-v1'), 'a draft is refused as a map', /COVERAGE_INVALID/);
  // A genuinely incomplete map is refused with the IDs still missing, which is the
  // actionable part: it names what to author, not merely that something is wrong.
  const partial = JSON.parse(AUTHORED_MAP);
  delete partial.scenarios['S-03'];
  write(dir, '.prd/coverage/prd-v1.json', `${JSON.stringify(partial, null, 2)}\n`);
  const incomplete = refuses(rt(dir, 'coverage', 'adopt', '--preview', '--change', 'prd-v1'), 'an incomplete map is refused', /COVERAGE_INCOMPLETE/);
  assert.match(incomplete.stdout + incomplete.stderr, /S-03/, 'and it names the scenario that is missing');
  // The draft now carries the authored rows forward and leaves only S-03 unresolved,
  // which is the loop the playbook describes.
  const second = JSON.parse(passes(rt(dir, 'coverage', 'scaffold', '--change', 'prd-v1', '--json'), 'scaffold again'));
  assert.equal(second.scenarios['S-01'].state, 'authored', 'authored links survive into the next draft');
  assert.equal(second.scenarios['S-03'].state, 'unresolved');
  assert.ok(second.unresolved.some(u => u.id === 'S-03'));

  // Step 4/5: the reviewed map adopts.
  write(dir, '.prd/coverage/prd-v1.json', AUTHORED_MAP);
  commit(dir, 'author the coverage map');
  passes(rt(dir, 'coverage', 'adopt', '--preview', '--change', 'prd-v1'), 'adopt --preview');
  const applied = passes(rt(dir, 'coverage', 'adopt', '--apply', '--change', 'prd-v1'), 'adopt --apply');
  assert.match(applied, /adopted strict coverage/);
  // Adoption grants no approval — the README says so and the runtime enforces it.
  refuses(rt(dir, 'change', 'activate', 'prd-v1'), 'adoption alone cannot activate', /AUTHORIZATION_REQUIRED/);
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentAgreement(dir), '--reference', 'the user said so in chat', '--excerpt', 'go ahead and build it'), 'change authorize');
  passes(rt(dir, 'change', 'activate', 'prd-v1'), 'change activate');
  commit(dir, 'adopt strict coverage');

  // Step 6: work.
  passes(rt(dir, 'start', 'T-01'), 'start T-01');
  write(dir, 'tickets/T-01-parse.md', read(dir, 'tickets/T-01-parse.md').replace('- [ ] expected behavior', '- [x] expected behavior'));
  passes(rt(dir, 'verify', 'T-01'), 'verify T-01');
  passes(rt(dir, 'done', 'T-01'), 'done T-01');
  commit(dir, 'T-01');

  // Step 7: pause, then resume from the brief in what is effectively a fresh session.
  passes(rt(dir, 'change', 'pause', 'prd-v1', '--reason', 'end of session', '--note', 'T-02 next'), 'change pause');
  commit(dir, 'pause');
  const brief = passes(rt(dir, 'resume', '--brief'), 'resume --brief');
  const briefJson = JSON.parse(passes(rt(dir, 'resume', '--brief', '--json'), 'resume --brief --json'));
  const fullJson = JSON.parse(passes(rt(dir, 'resume', '--json'), 'resume --json'));
  // The brief is the same answer, smaller, with a route to everything it grouped.
  assert.deepEqual(briefJson.next, fullJson.next, 'the brief gives the full report\'s next action');
  assert.ok(brief.length < passes(rt(dir, 'resume'), 'resume').length, 'and is smaller than the full report');
  assert.match(brief, /paused/, 'the brief reports the paused lifecycle');
  assert.match(briefJson.detail.command, /resume --change prd-v1/, 'and names the command that prints the rest');
  passes(rt(dir, 'change', 'resume', 'prd-v1'), 'change resume');
  commit(dir, 'resume');

  // Stale authorization: the PRD moves after the approval was recorded. The journey
  // must explain a usable next step rather than claim the coverage still holds.
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('## 7. Out of Scope', '- **S-04:** A scenario added after the approval.\n\n## 7. Out of Scope'));
  const stale = JSON.parse(passes(rt(dir, 'resume', '--brief', '--json'), 'resume --brief --json after the edit'));
  assert.equal(stale.agreement.verdict, 'AGREEMENT_CHANGED', 'the moved agreement is reported, not carried forward');
  assert.match(stale.next.command, /change authorize/, 'and the next action is to record a disposition');
  assert.ok(stale.blockers.categories.some(c => c.code === 'AGREEMENT_CHANGED'), 'the blocker category survives the projection');
  // The draft reports the new scenario as unresolved rather than covering it.
  const afterEdit = JSON.parse(passes(rt(dir, 'coverage', 'scaffold', '--change', 'prd-v1', '--json'), 'scaffold after the edit'));
  assert.equal(afterEdit.scenarios['S-04'].state, 'unresolved', 'the draft never claims the new scenario is covered');
  // ...and execution is refused until the disposition is recorded.
  refuses(rt(dir, 'start', 'T-02'), 'execution is refused on a changed agreement', /AGREEMENT_CHANGED/);
}

// --- S-17: unchanged authorized work is not re-approved; changed scope is -----------
{
  const dir = project();
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'), 'register');
  passes(rt(dir, 'change', 'select', 'prd-v1'), 'select');
  write(dir, '.prd/coverage/prd-v1.json', AUTHORED_MAP);
  commit(dir, 'map');
  passes(rt(dir, 'coverage', 'adopt', '--apply', '--change', 'prd-v1'), 'adopt');
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentAgreement(dir), '--reference', 'chat', '--excerpt', 'go ahead'), 'authorize');
  passes(rt(dir, 'change', 'activate', 'prd-v1'), 'activate');
  commit(dir, 'adopted');

  // Continuing unchanged authorized work asks for nothing. Repeated reads agree, and
  // none of them reports a decision or an authorization as outstanding.
  for (let i = 0; i < 3; i++) {
    const j = JSON.parse(passes(rt(dir, 'resume', '--brief', '--json'), `resume --brief --json #${i}`));
    assert.equal(j.agreement.verdict, 'current', 'the recorded authorization stays current across repeated reads');
    assert.ok(!j.blockers.categories.some(c => ['AUTHORIZATION_REQUIRED', 'DECISION_REQUIRED', 'AGREEMENT_CHANGED'].includes(c.code)),
      `no duplicate decision is requested (saw ${j.blockers.categories.map(c => c.code).join(', ')})`);
    assert.match(j.next.command, /pincer-ticket\.sh start T-01|start T-01/, 'the next action is the work, not an approval');
  }
  // Pausing and resuming — the session boundary — does not reopen the approval either.
  passes(rt(dir, 'change', 'pause', 'prd-v1', '--reason', 'end of session'), 'pause');
  passes(rt(dir, 'change', 'resume', 'prd-v1'), 'resume');
  assert.equal(JSON.parse(passes(rt(dir, 'resume', '--json'), 'resume --json')).agreement.verdict, 'current', 'resuming reuses the existing authorization');

  // A changed scope does need its own decision, and a generic continue is not one.
  write(dir, 'tickets/T-04-extra.md', '---\nticket: T-04\nstatus: open\nsize: S\nprd: .prd/prd-v1.md\ndepends_on: []\n---\n\n## Objective\nWork nobody authorized.\n\n## Acceptance Criteria\n- [x] behaves as specified\n\n## Verification\n```bash\ntrue\n```\n');
  const changed = JSON.parse(passes(rt(dir, 'resume', '--json'), 'resume --json after the new ticket'));
  assert.equal(changed.agreement.verdict, 'AGREEMENT_CHANGED', 'added work changes the agreement');
  refuses(rt(dir, 'start', 'T-01'), 'and execution is refused until it is dispositioned', /AGREEMENT_CHANGED/);
  // Re-recording the *old* digest is refused: continuing does not authorize the change.
  // The report drops `authorized` once the verdict moves off `current`, so the digest
  // that *was* approved is read from the record's own authorization history.
  const record = JSON.parse(read(dir, '.prd/changes/prd-v1.json'));
  const old = record.authorizations.at(-1).digest;
  refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', old, '--reference', 'chat', '--excerpt', 'continue'),
    'the previous agreement cannot be re-recorded to cover new scope', /AGREEMENT_CHANGED/);
  // Only an authorization of the current agreement clears it.
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentAgreement(dir), '--reference', 'chat', '--excerpt', 'yes, add T-04'), 'authorize the revised scope');
  assert.equal(JSON.parse(passes(rt(dir, 'resume', '--json'), 'resume --json')).agreement.verdict, 'current');

  // The rule the agent reads says the same thing, in the canonical source and in every
  // generated adapter: a continue instruction authorizes nothing.
  const agents = read(repo, 'template/AGENTS.md');
  assert.match(agents, /a generic "continue" authorizes no revised\s+scope/);
  const codePlaybook = read(repo, 'template/.claude/commands/pincer-code.md');
  assert.match(codePlaybook, /A general instruction to continue,\s+resume or not re-ask never authorizes new scope/);
  assert.match(codePlaybook, /do not ask the user to re-approve unchanged scope/);
}

// --- S-17: canonical and generated instructions agree, and updates preserve rules ----
{
  // The two new commands must reach every channel, not only the canonical playbooks.
  const narrow = read(repo, 'template/.claude/commands/pincer-narrow.md');
  const status = read(repo, 'template/.claude/commands/pincer-status.md');
  assert.match(narrow, /coverage scaffold --change/, 'the narrow playbook names the scaffold');
  assert.match(status, /resume --brief/, 'the status playbook leads with the brief');
  for (const [name, source] of [['narrow', narrow], ['status', status]]) {
    const skill = read(repo, `template/.agents/skills/pincer-${name}/SKILL.md`);
    const prompt = read(repo, `template/.github/prompts/pincer-${name}.prompt.md`);
    const needle = name === 'narrow' ? 'coverage scaffold --change' : 'resume --brief';
    assert.match(skill, new RegExp(needle), `the Codex skill for ${name} carries "${needle}"`);
    assert.match(prompt, new RegExp(needle), `the Copilot prompt for ${name} carries "${needle}"`);
    assert.match(read(repo, `plugin/commands/${name}.md`), new RegExp(needle), `the plugin command for ${name} carries "${needle}"`);
  }
  // The contract the playbooks point at ships with the install and in the plugin.
  const contracts = read(repo, 'template/docs/runtime-contracts.md');
  assert.match(contracts, /### Coverage draft/);
  assert.match(contracts, /### Brief resume/);
  assert.match(read(repo, 'plugin/docs/runtime-contracts.md'), /### Coverage draft/);

  // Repeated install and update preserve a project's own rules, including after the
  // kit gained these commands.
  const existing = tempDir();
  write(existing, 'AGENTS.md', 'EXISTING TEAM CONVENTIONS\n');
  passes(run(existing, process.execPath, [installer, 'init', '--platform', 'all']), 'init over existing rules');
  assert.equal(read(existing, 'AGENTS.md'), 'EXISTING TEAM CONVENTIONS\n', 'init preserved the project\'s own rules');
  for (let i = 0; i < 3; i++) passes(run(existing, process.execPath, [installer, 'update']), `update #${i}`);
  assert.equal(read(existing, 'AGENTS.md'), 'EXISTING TEAM CONVENTIONS\n', 'repeated update preserved them too');
  assert.ok(fs.existsSync(path.join(existing, 'scripts/pincer-runtime/scaffold.cjs')), 'and the update delivered the new module');
}

// --- S-18: the journey comes first, kit pinning is documented, claims are labelled ---
{
  const journey = readme.indexOf('## Your first change, end to end');
  const update = readme.indexOf('## Update');
  const install = readme.indexOf('## Install');
  assert.ok(journey > 0, 'the README carries a first-use journey');
  assert.ok(update > 0, 'and still carries the update history');
  assert.ok(journey < update, `the first-use journey precedes the migration history (${journey} < ${update})`);
  assert.ok(install < journey, 'and install precedes the journey');
  // The journey is the documented commands, in order, not a summary of them.
  const section = readme.slice(journey, readme.indexOf('### Claude Code'));
  for (const step of ['pincer-workflow init', 'register --prd', 'change select', 'coverage scaffold --change', 'coverage adopt --preview', 'coverage adopt --apply', 'change authorize', 'change activate', 'resume --brief', '/pincer-evaluate', '/pincer-release']) {
    assert.ok(section.includes(step), `the journey names "${step}"`);
  }
  assert.match(section, /Adoption grants no approval/, 'and says adoption is not approval');

  // Baseline-mode preservation: the default path still works without adopting.
  assert.match(section, /Default is fine: tickets, checks and evidence work without/, 'the default coverage mode is preserved and documented');

  // Kit pinning is written down where a maintainer will find it.
  const pinning = readme.slice(readme.indexOf('### Pinning a management kit'), readme.indexOf('### Claude Code'));
  assert.ok(pinning.length > 100, 'the README documents management-kit pinning');
  assert.match(pinning, /outside the tree|outside the repository/, 'and says to pin it outside the tree');
  assert.match(pinning, /digest/, 'and to record its digest');

  // Installation-tested and live-observed are separate claims, and neither is inflated.
  const support = readme.slice(readme.indexOf('## Platform support'), readme.indexOf('## Claude Code plugin'));
  assert.ok(support.length > 200, 'the README carries a support matrix');
  assert.match(support, /Installation-tested/, 'which names the installation claim');
  assert.match(support, /Live-observed/, 'and the live claim');
  assert.match(support, /An\s+installation check is not a platform trial/, 'and keeps them apart explicitly');
  assert.match(support, /No live platform trial has been observed for the current release/, 'and does not claim a live trial that has not happened');
  // The old unqualified claim is gone from the platform sections.
  const platforms = readme.slice(readme.indexOf('### Claude Code'), readme.indexOf('## Platform support'));
  assert.doesNotMatch(platforms, /Works immediately/, 'no platform section claims it simply works');
  // Windows is not claimed at all.
  assert.match(support, /Windows.*\|\s*no\s*\|\s*no\s*\|/, 'Windows is claimed neither tested nor observed');
}

console.log('strict onboarding tests passed (packed walkthrough, authorization reuse, document order)');
