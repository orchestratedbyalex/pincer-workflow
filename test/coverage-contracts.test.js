// PRD v6 T-66: the strict coverage contract is a static contract. Every section,
// schema version, command, reason code, grammar rule, JSON shape and fixture must be
// present and internally consistent, and the PRD v5 compatibility records must keep
// their recorded format and provenance. This pins the agreement, not runtime
// behavior: T-67..T-75 implement it, and nothing here claims a runtime observation.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { repo, tempDir, write } from './helpers.js';

const require = createRequire(import.meta.url);
const parse = require(path.join(repo, 'template/scripts/pincer-runtime/parse.cjs'));
const read = relative => fs.readFileSync(path.join(repo, relative), 'utf8');
const doc = read('template/docs/runtime-contracts.md');
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Phrases are pinned; the document's line wrapping is not: a space or a newline in a
// pattern matches either (an escaped \\n, a literal backslash-n in the text, is kept).
const loosen = source => source.replace(/(?<!\\)\\n/g, ' ').replace(/ +/g, '\\s+');
const has = (pattern, label) => assert.match(doc, new RegExp(loosen(pattern.source), pattern.flags), label);
const rowsOf = (first, second) => doc.split('\n').filter(line => line.startsWith(`| ${first} |`) && (second === undefined || line.includes(`| ${second} |`)));
const section = doc.slice(doc.indexOf('\n## Strict coverage\n'), doc.indexOf('\n## Legacy compatibility\n'));
assert.ok(section.length > 10000, 'the strict coverage section is present and substantial');

// --- Sections and frozen versions --------------------------------------------------
for (const heading of ['## Strict coverage', '### Requirement inventory', '### Coverage map', '### Strict change records', '### Scope dispositions', '### Phase-specific coverage', '### Declared candidate checks', '### Evidence schema 3', '### Adoption and rollback', '### Coverage and impact commands']) {
  has(new RegExp(`^${escape(heading)}$`, 'm'), `section ${heading}`);
}
assert.doesNotMatch(section, /\b(TBD|TODO|unsettled|to be decided|open question|final spelling may change)\b/i, 'no unsettled decision is left in the strict coverage contract');
has(/change records `schema: 3` \(`runtime: 3`\), attempts\n`schema: 3` \(`runtime: 3`\), evidence manifests `schema: 3`, status JSON `schema: 3`\n\(changes mode\), resume JSON `schema: 2`, agreement projection `pincer agreement 2`,\nagreement snapshots `schema: 2`, coverage map `schema: 1`, inventory projection\n`pincer inventory 1`/, 'every schema and projection version is frozen in one place');
has(/refuse every new schema as `UNSUPPORTED_SCHEMA` \(records, evidence\) or as an\nincomplete record \(`ATTEMPT_ERROR` for attempts\)/, 'older runtimes reject the new formats');
has(/This runtime keeps reading schema 2\nrecords, schema 2 attempts and schema 2 evidence exactly as documented above/, 'old schemas stay readable');
has(/Strict coverage \(PRD v6, "Strict coverage"\) adds change records `schema: 3`/, 'the introduction names the new versions');
has(/never a second editable source/, 'no second editable requirement inventory');
has(/Semantic adequacy[\s\S]*?remains a named reviewer judgment \(`adequacy`\) and is never computed/, 'adequacy is a judgment');

// --- Commands, exit conventions, reason codes -----------------------------------------
for (const command of ['coverage', 'impact', 'coverage adopt']) assert.ok(rowsOf(`\`${command}\``).length >= 2, `command ${command} has a row in the command table and in the strict section (${rowsOf(`\`${command}\``).length})`);
has(/\| `coverage` \| `\[--change <id>\] \[--json\]` \| nothing \|/, 'coverage is read-only');
has(/\| `impact` \| `\[--change <id>\] \[--from G-NN \\\| A-NN\] \[--json\]` \| nothing \|/, 'impact is read-only');
has(/\| `coverage adopt` \| `--preview \\\| --apply --change <id> \[--agreement <digest>\]` \| apply: a backup, the schema 3 record, the adoption snapshot \|/, 'adopt writes are enumerated');
has(/\| `check` \| `C-NN --candidate <sha>` \(strict\) \| an attempt \| the declared command; `--timeout` and `-- <command>` are `CHECK_UNDECLARED` in a strict change \|/, 'strict check form');
has(/exit 0 when the report was computed \(complete or not\), 4 when the inputs cannot be read/, 'inspection exit convention');
has(/exit 0 when computed \(`unchanged`, `changed` or `unavailable`\), 4 on invalid input/, 'impact exit convention');
has(/`coverage` and `impact` launch no check, record no approval, change no selection and\nwrite no file; repeated runs are byte-identical apart from `generated`/, 'reports are pure');
const NEW_CODES = ['INVENTORY_INVALID', 'COVERAGE_INVALID', 'COVERAGE_INCOMPLETE', 'OBLIGATION_MISSING', 'SCOPE_UNAUTHORIZED', 'CHECK_UNDECLARED', 'REVIEW_MISSING', 'ADEQUACY_REQUIRED', 'HISTORY_UNAVAILABLE', 'COVERAGE_UNVERIFIED'];
const reasonSection = doc.slice(doc.indexOf('## Readiness and reason codes'), doc.indexOf('## Evidence schema 2'));
for (const code of NEW_CODES) {
  const row = reasonSection.split('\n').find(line => line.startsWith(`| \`${code}\` |`));
  assert.ok(row, `reason code row ${code}`);
  assert.equal(row.split('|').length, 5, `reason code ${code} has meaning and next action`);
}
has(/`COVERAGE_UNVERIFIED` \| label only, never a blocker/, 'unverified is a label');
has(/`INPUT_INVALID`\/`INVENTORY_INVALID`\/`COVERAGE_INVALID`\/`MALFORMED`\/… first/, 'gate order places the input codes first');
has(/4\. agreement, decision or coverage gap \(`DECISION_REQUIRED`, `AUTHORIZATION_REQUIRED`, `AGREEMENT_CHANGED`; in a strict change also `COVERAGE_INVALID`, `COVERAGE_INCOMPLETE`, `OBLIGATION_MISSING`, `SCOPE_UNAUTHORIZED`/, 'resume precedence keeps the v5 order and adds the coverage codes inside rule 4');

// --- Grammar ------------------------------------------------------------------------
has(/`\[A-Z\]\[A-Z0-9\]\{0,7\}-\[0-9\]\{1,6\}`/, 'identifier grammar');
has(/nothing is\n  renumbered, padded or generated/, 'IDs are kept verbatim');
has(/an ATX heading of level 2, 3 or 4 whose text is an ID,\n  a separator \(` — `, ` – `, ` - ` or `: `\) and a nonempty title/, 'requirement definition form');
has(/a list item inside a requirement section whose text is a\n  bold ID, optionally followed by a colon inside or after the bold, then nonempty\n  text/, 'scenario definition form');
has(/an optional checkbox mark \(`\[ \]`, `\[x\]`, `\[X\]`\) may\n  precede the bold ID/, 'checkbox marks are allowed and normalized');
has(/A fence still open at the end of the file is\n  `INVENTORY_INVALID` \(`unclosed fence opened at line N`\)/, 'unclosed fence');
has(/A tilde fence line is\n  `INVENTORY_INVALID`/, 'tilde fences unsupported');
has(/a line whose first non-blank character is `\|` or `>` is a\n  reference context: it is prose and defines nothing/, 'tables and quotes are references');
for (const rule of ['duplicate definition of an ID', 'orphan scenario S-NN at line N', 'requirement R-NN at line N has no scenario', 'no\n  requirement definitions', 'empty definition S-NN at line N', 'unsupported requirement definition syntax at line N', 'unsupported scenario definition syntax at line N']) has(new RegExp(escape(rule)), `grammar refusal: ${rule.replace('\n', ' ')}`);
has(/each definition records `\{ line, end \}` \(1-based, inclusive\)/, 'source locations');
has(/requirement `SHA-256\("requirement <ID>\\n<text>\\n"\)`, scenario\n  `SHA-256\("scenario <ID>\\n<text>\\n"\)`/, 'definition digests');
const inventoryProjection = doc.match(/```\n  pincer inventory 1\n([\s\S]*?)```/);
assert.ok(inventoryProjection, 'the inventory projection is an exact text');
assert.match(inventoryProjection[1], /^  prd <\.prd\/prd-vN\.md>\n  requirement <ID> <digest>/m);
assert.match(inventoryProjection[1], /^  scenario <ID> <owner ID> <digest>/m);
has(/requirements and scenarios each sorted by ID \(prefix\n  in byte order, then numerically\)/, 'projection order');
has(/Reordering sections changes `prd_revision` but not the inventory digest/, 'reorder does not change the inventory');
has(/label such a\nchange `coverage: unverified`, and inventory diagnostics for it are informational,\nnever blockers/, 'non-strict changes are labeled, never blocked');

// The grammar example in the contract is itself a valid inventory per the frozen rules.
const example = doc.match(/````markdown\n([\s\S]*?)````/);
assert.ok(example, 'a Markdown example of a valid PRD body');
const exampleInventory = structuralInventory(example[1]);
assert.deepEqual(exampleInventory.requirements, { 'R-01': ['S-01', 'S-02'], 'R-02': ['S-03'] }, 'the contract example defines exactly R-01 (S-01, S-02) and R-02 (S-03)');
assert.deepEqual(exampleInventory.problems, [], 'the contract example has no grammar problem');

// --- Coverage map -----------------------------------------------------------------------
const fences = [...doc.matchAll(/```json\n([\s\S]*?)```/g)].map(m => JSON.parse(m[1]));
const mapExample = fences.find(d => d.schema === 1 && 'scenarios' in d && 'checks' in d && 'scope' in d);
assert.ok(mapExample, 'a coverage map example');
assertMapShape(mapExample);
assert.deepEqual(Object.keys(mapExample), ['schema', 'change', 'prd', 'scenarios', 'scope', 'tickets', 'checks'], 'map keys in the documented order');
assert.equal(mapExample.scope['S-04'].disposition, 'removed'); assert.match(mapExample.scope['S-04'].prior, /^G-\d{2}$/, 'a removed tombstone names its prior agreement');
assert.equal(mapExample.scope['S-03'].prior, null, 'a deferral has no prior');
assert.equal(mapExample.tickets['T-05'].role, 'enables'); assert.ok(mapExample.tickets['T-05'].rationale, 'an enabling ticket has a rationale');
assert.ok(mapExample.scenarios['S-02'].checks.includes('C-01') && mapExample.scenarios['S-01'].checks.includes('C-01'), 'a shared check');
has(/a JSON object with a duplicate key anywhere, a file\nlarger than 1 MiB/, 'strict JSON parsing');
has(/Every scenario of the live\n  inventory appears exactly once, in `scenarios` or in `scope`/, 'exactly-once membership');
has(/`tickets` lists every ticket of the change[\s\S]*?exactly once with `role` `implements`[\s\S]*?or `enables` \(referenced by none, with a nonempty `rationale`\)/, 'ticket classification');
has(/A declared check may be referenced by several scenarios or by none; a check\n  referenced by a scenario must be declared\. A declaration is never an observed\n  result/, 'declarations are not results');
has(/a `command` check's is `SHA-256\("<command>\\ntimeout=<timeout>\\n"\)`\n  — exactly the check digest an attempt records/, 'definition digest equals the attempt check digest');
has(/a `review`\/`visual` check's is\n  `SHA-256\("<kind>\\n<obligation>\\n"\)`/, 'review definition digest');
has(/The map digest is SHA-256 over the normalized map text: the parsed object\n  serialized as JSON with object keys sorted/, 'map digest normalization');
has(/`COVERAGE_INVALID` means the file cannot be interpreted; `COVERAGE_INCOMPLETE` means\nit is interpretable but the graph it describes is incomplete/, 'invalid vs incomplete');
has(/The map module exposes one validated graph[\s\S]*?no consumer keeps a\npolicy copy, and validation writes no file/, 'one graph for every consumer');

// --- Records, agreement projection 2, snapshots, attempts ------------------------------
has(/\| `coverage` \| `coverage adopt --apply` \| `\{ map: "\.prd\/coverage\/<id>\.json", adopted: <timestamp>, agreement: "G-NN" \}`/, 'record schema 3 field owner');
has(/Exactly one `adopt` event exists in a schema 3 record/, 'one adopt event');
has(/A\nschema 3 record without `coverage`, with `coverage: null`, or with no `adopt` event\nis `MALFORMED`/, 'the capability cannot be removed by editing a flag');
has(/a schema 2 record carrying a\n`coverage` key or an `adopt` event is `MALFORMED` under this runtime and under the\nPRD v5 runtime alike/, 'downgrade refuses');
has(/Schema 2 and schema 3 records coexist in one `\.prd\/changes\/`\ndirectory/, 'per-change adoption');
const projection2 = doc.match(/```\npincer agreement 2\n([\s\S]*?)```/);
assert.ok(projection2, 'the agreement projection 2 is an exact text');
assert.match(projection2[1], /^change <change id>\nprd <\.prd\/prd-vN\.md> <prd_revision>\ninventory <inventory digest>\ncoverage <\.prd\/coverage\/<id>\.json> <map digest>\nticket <T-NN> <ticket_digest>/m, 'projection 2 lines');
assert.match(projection2[1], /^decision <D-NN> <decision digest>/m);
has(/editing a scenario's text, a link, a declared command or timeout, a\nscope disposition or a tombstone changes the agreement and invalidates the\nauthorization \(`AGREEMENT_CHANGED`\), while the PRD `status` line, ticket lifecycle\nfields and ticket checkbox marks, attempts, generated reports and evidence do not/, 'S-07 inputs and exclusions');
has(/checkbox mark on a scenario line keeps the inventory digest but is a PRD body edit/, 'PRD checkbox marks are PRD revisions');
has(/An incomplete map still yields an agreement:\ncompleteness is a coverage gate/, 'incomplete maps are authorizable');
const snapshot2 = fences.find(d => d.schema === 2 && 'projection' in d && 'inventory' in d);
assert.ok(snapshot2, 'a snapshot schema 2 example');
assert.deepEqual(Object.keys(snapshot2), ['schema', 'change', 'agreement', 'digest', 'projection', 'prd', 'inventory', 'coverage', 'tickets', 'decisions', 'recorded'], 'snapshot 2 keys');
assert.deepEqual(Object.keys(snapshot2.inventory), ['digest', 'projection', 'requirements', 'scenarios']);
assert.deepEqual(Object.keys(snapshot2.coverage), ['path', 'digest', 'text']);
has(/Attempt schema 3 \(strict changes\): every schema 2 field, plus `context\.inventory`\nand `context\.coverage`/, 'attempt schema 3');
has(/a pointed-at schema 2 record \(recorded before adoption\) is\n`HISTORICAL_EVIDENCE`/, 'old attempts are history after adoption');

// --- Scope dispositions and deletion detection -------------------------------------------
has(/It\nis never inferred from a failing check, a missing ticket, a `blocked` requirement or\nfree text/, 'dispositions are never inferred');
has(/Requires a resolved decision `D-NN` of this change whose `summary` or\n  `excerpt` names the scenario ID as a whole token/, 'decision names the ID');
has(/an applicable user authorization covers it: an\nauthorization `A-NN` of this record with disposition `user` that lists the decision\nin its `decisions`, such that an authorization binding the current agreement \(any\none the `current` verdict accepts\) is `A-NN` itself or a `delegated` authorization\nwhose `basis` chain reaches `A-NN`/, 'applicable user authorization');
has(/but it can never create the scope decision: `authorized_by` free text\nand `--constraints` text are never consulted/, 'delegation cannot waive scope');
has(/deleting the prose and the map row together erases nothing/, 'S-09 deletion detection');
has(/A first adoption can\nonly establish its reviewed starting inventory: no baseline exists before the\nadoption agreement/, 'first adoption baseline');
has(/reverting the PRD and the map to an earlier authorized digest cannot bypass a\nretained open decision/, 'revert cannot bypass an open decision');

// --- Phases -----------------------------------------------------------------------------
for (const field of ['structure', 'implementation', 'candidate']) assert.ok(rowsOf(`\`${field}\``).length === 1, `phase row ${field}`);
has(/none implies another, and a linked check, a passing syntax check\nor a done ticket never implies candidate delivery/, 'phases are separate');
has(/`change complete` of a\nstrict change requires `structure` and `implementation` complete[\s\S]*?it never demands\ncandidate evidence, which cannot exist before the candidate/, 'S-14 completion before candidate');
has(/never prints `delivered` or `release-ready` for a\nchange whose evidence is missing, stale or judged inadequate/, 'S-15');

// --- Declared checks, evidence schema 3, adoption -----------------------------------------
has(/an arbitrary supplied command therefore cannot\nbecome evidence for a declared check by reusing its ID/, 'S-16');
has(/a changed declaration whose agreement was\nre-authorized meanwhile refuses with `CHECK_UNDECLARED`/, 'S-17 under-lock declaration check');
has(/so another change's `C-01` is never borrowed/, 'no cross-change borrowing');
has(/A required review obligation that is missing from the draft, `unverified`,\n`failed` or without an artifact is `REVIEW_MISSING`/, 'S-18');
has(/Passing every command check creates no review result and no adequacy judgment/, 'syntax checks are not adequacy');
has(/neither carries a digest\n  of the manifest, so no digest refers to itself/, 'no self-referential snapshot digest');
has(/`delivery`: `\{ original, agreed \}`/, 'delivery distinguishes original from agreed');
has(/Dispositions are derived, never authored/, 'derived dispositions');
has(/the inventory recomputed from `git show\n<candidate>:<prd>` and the map digest from `git show <candidate>:\.prd\/coverage\/<id>\.json`\nmust equal `coverage\.inventory` and `coverage\.map`/, 'S-19/S-21 independent reconciliation');
has(/Outside a repository \(`pincer-evidence\.cjs validate` on copied files\) that\nreconciliation is skipped and printed as a limitation, never claimed/, 'fresh-copy limitation');
has(/a draft `requirements`\nkey is refused/, 'export derives dispositions');
has(/a declared\ncheck missing from the draft \(`an unused failing required check cannot be omitted`\)\nand an undeclared entry are refused naming the ID/, 'all declared checks are exported');
has(/Two changes evaluated on one candidate keep distinct locators,\nmanifests and attempt keys/, 'S-20');
has(/migration never\nadopts/, 'migration does not adopt');
has(/no authorization is created, inferred from the record's history, or copied from an\nearlier one/, 'adoption grants nothing');
has(/Repeated apply\nreports `already adopted` and writes nothing/, 'idempotent adoption');
has(/Rollback from adoption restores the backed-up `\.prd\/changes\/<id>\.json` — it\noverwrites the schema 3 record at the same path, so nothing under `\.prd\/changes\/` is\ndeleted/, 'adoption rollback deletes no restored file');
has(/The map\n\(authored\), `\.pincer\/runtime\/` \(attempts, index, selection\) and the evidence are kept/, 'rollback keeps local state');

// --- JSON shapes and playbook rules ------------------------------------------------------
has(/Coverage JSON schema 1:\n\n```\n\{ schema: 1, runtime: 3, generated, root, mode, change: <id> \| null,\n  strict: boolean, label: "strict" \| "unverified"/, 'coverage JSON shape');
has(/Impact JSON schema 1[\s\S]*?verdict: "unchanged" \| "changed" \| "unavailable"/, 'impact JSON shape');
has(/`unavailable` is reported with its reason when the baseline\nagreement has no inventory snapshot/, 'S-11 unavailable history');
has(/verdict is then `changed` with the detail `unscoped PRD change requiring review`,\nnever `unchanged`/, 'S-11 unscoped changes');
has(/`dependents` lists tickets that `depends_on` an affected ticket, separately\nfrom direct links/, 'S-10 dependents');
has(/`SOURCE_CHANGED` keeps invalidating attempts by whole-source identity regardless of\nhow narrow the report is/, 'S-12 freshness');
has(/Status JSON schema 3 \(changes mode\) keeps every schema 2 field and adds\n`coverage`/, 'status JSON 3');
has(/Resume JSON\nschema 2 keeps every schema 1 field and adds the same `coverage` object/, 'resume JSON 2');
has(/Routine\nresume never records or requests authorization/, 'S-26');
has(/a generic "continue" is\nnever an authorization of revised scope/, 'S-27 rule');

// --- Fixtures: strict inputs --------------------------------------------------------------
const fx = 'test/fixtures/prd-v6';
const readme = read(`${fx}/README.md`);
assert.match(readme, /commit `00aad6d` on `feat\/prd-v5`/, 'fixture provenance names the fixed v5 source');
assert.match(readme, /never regenerated by the new\nruntime/);
const strictPrd = read(`${fx}/strict/prd-v1.md`);
assert.ok(parse.validateMetadata(strictPrd).ok, 'the strict PRD keeps the old metadata format (readable by the v5 parser)');
const expected = JSON.parse(read(`${fx}/strict/expected.json`));
const inv = structuralInventory(strictPrd);
assert.deepEqual(inv.problems, [], 'the strict PRD fixture has no grammar problem');
assert.deepEqual(inv.requirements, expected.requirements, 'the strict PRD defines exactly the expected requirements and scenarios');
for (const id of expected.not_definitions) assert.ok(!inv.all.has(id) && strictPrd.includes(id), `${id} is mentioned but not defined`);
const map = JSON.parse(read(`${fx}/strict/coverage/prd-v1.json`));
assertMapShape(map);
assert.equal(map.change, 'prd-v1'); assert.equal(map.prd, '.prd/prd-v1.md');
assert.deepEqual([...Object.keys(map.scenarios), ...Object.keys(map.scope)].sort(), Object.keys(expected.scenarios).sort(), 'the map resolves every fixture scenario exactly once');
const ticketFiles = fs.readdirSync(path.join(repo, fx, 'strict/tickets')).sort();
assert.deepEqual(ticketFiles.map(f => f.slice(0, 4)), Object.keys(map.tickets).sort(), 'every fixture ticket is classified');
for (const file of ticketFiles) assert.ok(parse.validateTicket(file, read(`${fx}/strict/tickets/${file}`)).ok, `${file} validates`);
for (const [id, t] of Object.entries(map.tickets)) {
  const referenced = Object.values(map.scenarios).some(s => s.tickets.includes(id));
  assert.equal(referenced, t.role === 'implements', `${id}: role ${t.role} agrees with the links`);
}
for (const s of Object.values(map.scenarios)) for (const c of s.checks) assert.ok(map.checks[c], `check ${c} is declared`);

// --- Fixtures: invalid inputs -------------------------------------------------------------
const prdExpected = JSON.parse(read(`${fx}/invalid/prd/expected.json`));
assert.equal(prdExpected.code, 'INVENTORY_INVALID');
const prdFiles = fs.readdirSync(path.join(repo, fx, 'invalid/prd')).filter(f => f.endsWith('.md')).sort();
assert.deepEqual(prdFiles, Object.keys(prdExpected.files).sort(), 'every invalid PRD fixture has an expected diagnostic and vice versa');
for (const [file, detail] of Object.entries(prdExpected.files)) {
  const text = read(`${fx}/invalid/prd/${file}`);
  assert.ok(parse.validateMetadata(text).ok, `${file} keeps valid metadata (the grammar, not the frontmatter, is what fails)`);
  const line = detail.match(/line (\d+)/);
  if (line) {
    const row = text.split('\n')[Number(line[1]) - 1];
    const id = (detail.match(/[A-Z]-\d{2}/) || [])[0];
    assert.ok(row !== undefined && (!id || row.includes(id) || /fence|~~~/.test(detail)), `${file}: the named line ${line[1]} carries the problem (${JSON.stringify(row)})`);
  }
  const problems = structuralInventory(text).problems;
  assert.ok(problems.length > 0, `${file} is structurally invalid under the frozen grammar`);
  assert.ok(problems.some(p => p === detail), `${file}: the independent structural check reports "${detail}" (got ${JSON.stringify(problems)})`);
}
const mapExpected = JSON.parse(read(`${fx}/invalid/coverage/expected.json`));
const mapFiles = fs.readdirSync(path.join(repo, fx, 'invalid/coverage')).filter(f => f.endsWith('.json') && f !== 'expected.json').sort();
assert.deepEqual(mapFiles, [...Object.keys(mapExpected.COVERAGE_INVALID), ...Object.keys(mapExpected.COVERAGE_INCOMPLETE)].sort(), 'every invalid map fixture has an expected diagnostic and vice versa');
for (const [file, detail] of Object.entries(mapExpected.COVERAGE_INVALID)) {
  const text = read(`${fx}/invalid/coverage/${file}`);
  assert.ok(detail.length > 0);
  if (file === 'malformed-json.json') assert.throws(() => JSON.parse(text), `${file} does not parse`);
  else if (file === 'duplicate-json-key.json') assert.match(text, /"schema": 1, "schema": 1/, 'the duplicate-key fixture repeats a key JSON.parse would swallow');
  else assert.doesNotThrow(() => JSON.parse(text), `${file} parses (its problem is structural)`);
}
for (const [file, detail] of Object.entries(mapExpected.COVERAGE_INCOMPLETE)) {
  const doc2 = JSON.parse(read(`${fx}/invalid/coverage/${file}`));
  assertMapShape(doc2);
  assert.ok(detail.length > 0, `${file} expected detail`);
}

// --- Fixtures: PRD v5 records and the pinned v5 readers ------------------------------------
const kit = f => require(path.join(repo, fx, 'v5-kit/scripts/pincer-runtime', `${f}.cjs`));
const v5changes = kit('changes'), v5agreement = kit('agreement'), v5state = kit('state'), v5evidence = kit('evidence');
const kitReadme = read(`${fx}/v5-kit/README.md`);
assert.match(kitReadme, /byte-identical copies[\s\S]*?at commit `00aad6d`/, 'the v5 kit names its provenance');
const available = spawnSync('git', ['-C', repo, 'cat-file', '-e', '00aad6d^{commit}'], { encoding: 'utf8' }).status === 0;
if (available) {
  for (const f of ['changes', 'agreement', 'parse', 'transaction', 'state', 'fsutil', 'evidence']) {
    const original = spawnSync('git', ['-C', repo, 'show', `00aad6d:template/scripts/pincer-runtime/${f}.cjs`], { encoding: 'utf8' });
    assert.equal(original.status, 0);
    assert.equal(read(`${fx}/v5-kit/scripts/pincer-runtime/${f}.cjs`), original.stdout, `v5-kit ${f}.cjs is byte-identical to 00aad6d`);
  }
} else console.log('note: commit 00aad6d is not available here; the v5-kit byte comparison was skipped');
const record = JSON.parse(read(`${fx}/v5/changes/prd-v1.json`));
assert.equal(record.schema, 2); assert.equal(record.runtime, 2);
assert.equal(v5changes.validateRecord(record, '.prd/changes/prd-v1.json'), null, 'the v5 record validates under the pinned v5 reader');
assert.deepEqual(Object.keys(record), v5changes.RECORD_KEYS, 'schema 2 keys as recorded');
assert.equal(record.lifecycle.state, 'completed'); assert.equal(record.agreements.length, 1); assert.equal(record.authorizations[0].disposition, 'user');
assert.ok(!('coverage' in record) && !record.events.some(e => e.kind === 'adopt'), 'no strict coverage capability in a v5 record');
{
  const dir = tempDir();
  write(dir, '.prd/changes/prd-v1/agreements/G-01.json', read(`${fx}/v5/changes/prd-v1/agreements/G-01.json`));
  const snap = v5agreement.readSnapshot(dir, record, record.agreements[0]);
  assert.ok(!snap.code, `the v5 snapshot recomputes under the pinned v5 reader (${snap.problem || 'ok'})`);
  assert.equal(snap.snapshot.schema, 1);
  assert.match(snap.snapshot.projection, /^pincer agreement 1\n/, 'projection version 1');
}
const locator = JSON.parse(read(`${fx}/v5/evidence/changes/prd-v1.json`));
assert.equal(locator.schema, 1); assert.deepEqual(Object.keys(locator.evaluations[0]), ['candidate', 'base', 'prd', 'prd_revision', 'agreement', 'manifest', 'recorded']);
assert.equal(locator.evaluations[0].agreement, record.agreements[0].digest, 'the locator names the authorized agreement');
const index = JSON.parse(read(`${fx}/v5/runtime/index.json`));
assert.equal(index.schema, 1); assert.deepEqual(index.running, []);
assert.deepEqual(Object.keys(index.current), ['ticket:prd-v1:T-01', `candidate:prd-v1:${locator.evaluations[0].candidate}:C-01`], 'v5 context keys (candidate key change-scoped)');
for (const [key, id] of Object.entries(index.current)) {
  const attempt = JSON.parse(read(`${fx}/v5/runtime/attempts/${id}.json`));
  assert.equal(attempt.schema, 2); assert.equal(attempt.runtime, 2);
  assert.equal(v5state.validateAttempt(attempt, key, id), null, `v5 attempt ${id} validates as schema 2 for ${key}`);
  assert.equal(attempt.context.agreement, record.agreements[0].digest);
  assert.ok(!('inventory' in attempt.context) && !('coverage' in attempt.context), 'schema 2 attempts carry no coverage identity');
  assert.equal(attempt.outcome, 'passed');
  for (const stream of ['stdout', 'stderr']) {
    const data = fs.readFileSync(path.join(repo, fx, 'v5/runtime', `attempts/${id}/${stream}.log`));
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), attempt.artifacts[stream].sha256, `${stream} log digest of ${id}`);
  }
  assert.equal(attempt.owner.host, 'fixture-host.example', 'host name replaced for privacy only');
}
assert.equal(JSON.parse(read(`${fx}/v5/runtime/selection.json`)).change, 'prd-v1');
{
  const dir = tempDir();
  const candidate = locator.evaluations[0].candidate;
  fs.cpSync(path.join(repo, fx, 'v5/evidence'), path.join(dir, '.prd/evidence'), { recursive: true });
  write(dir, '.prd/prd-v1.md', read(`${fx}/v5/prd/prd-v1.md`));
  const manifest = path.join(dir, `.prd/evidence/prd-v1/${candidate}/manifest.json`);
  assert.deepEqual(v5evidence.validate(manifest, { candidate, prd: '.prd/prd-v1.md', base: locator.evaluations[0].base }, dir), [], 'the v5 schema 2 evidence validates under the pinned v5 validator');
  const m = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  assert.equal(m.schema, 2); assert.equal(m.change.id, 'prd-v1');
  assert.ok(!('coverage' in m) && !('scenarios' in m) && !('adequacy' in m) && !('delivery' in m), 'no strict coverage fields in schema 2 evidence');
  assert.deepEqual(v5evidence.validate(manifest, { candidate, prd: '.prd/prd-v1.md' }, dir), [], 'validates without a base too');
  // The pinned v5 validator refuses the frozen schema 3 number before reading anything else.
  fs.writeFileSync(manifest, JSON.stringify({ ...m, schema: 3 }));
  assert.deepEqual(v5evidence.validate(manifest, { candidate }, dir), ['unknown evidence schema 3 — this runtime validates schemas 1 and 2'], 'the v5 validator refuses schema 3');
}
assert.equal(v5changes.validateRecord({ ...record, schema: 3, runtime: 3 }, '.prd/changes/prd-v1.json').code, 'UNSUPPORTED_SCHEMA', 'the v5 reader refuses a schema 3 record');
assert.equal(v5changes.validateRecord({ ...record, coverage: { map: '.prd/coverage/prd-v1.json', adopted: '2026-09-12T00:00:00Z', agreement: 'G-01' } }, '.prd/changes/prd-v1.json').code, 'MALFORMED', 'the v5 reader refuses a schema 2 record carrying the capability');
assert.match(v5state.validateAttempt({ ...JSON.parse(read(`${fx}/v5/runtime/attempts/${index.current['ticket:prd-v1:T-01']}.json`)), schema: 3, runtime: 3 }, 'ticket:prd-v1:T-01', index.current['ticket:prd-v1:T-01']), /incomplete or malformed: schema/, 'the v5 reader refuses a schema 3 attempt');
const statusJson = JSON.parse(read(`${fx}/v5/outputs/status.json`));
assert.equal(statusJson.schema, 2); assert.equal(statusJson.mode, 'changes'); assert.equal(statusJson.candidate.notes, 'current'); assert.ok(!('coverage' in statusJson));
const resumeJson = JSON.parse(read(`${fx}/v5/outputs/resume.json`));
assert.equal(resumeJson.schema, 1); assert.equal(resumeJson.next.rule, 8); assert.ok(!('coverage' in resumeJson));
assert.match(read(`${fx}/v5/outputs/status.txt`), /^Runtime  changes · selected prd-v1 · completed · agreement [0-9a-f]{12} \(G-01\) · authorization current \(A-01\) · base [0-9a-f]{7}$/m, 'v5 status line');
assert.doesNotMatch(read(`${fx}/v5/outputs/status.txt`), /^Coverage /m, 'no Coverage line in v5 output');
assert.equal(read(`${fx}/v5/gitignore`), '.pincer/\n');
assert.equal(read(`${fx}/v5/prd/prd-v1.md`).includes('- **S-01:**'), true, 'the v5 fixture PRD already uses the definition form, so it can be adopted later');

// The contract ships in the plugin like the rest of the document.
assert.equal(read('plugin/docs/runtime-contracts.md').replaceAll('${CLAUDE_PLUGIN_ROOT}/', '').replaceAll('/pincer:', '/pincer-'), doc, 'plugin copy is current');
console.log('coverage contract tests passed');

// --- An independent structural reading of the frozen grammar -------------------------------
// Deliberately small and separate from the runtime (which does not exist yet at T-66):
// it recognizes definitions, references and the refusal cases exactly as the contract
// words them, so the fixtures and the contract example are checked against the same
// rules the implementation must satisfy.
function structuralInventory(text) {
  const ID = '[A-Z][A-Z0-9]{0,7}-[0-9]{1,6}';
  const rows = text.split('\n'); if (rows.at(-1) === '') rows.pop();
  const problems = [], requirements = {}, all = new Map();
  let i = 0;
  if (rows[0] === '---') { i = 1; while (i < rows.length && rows[i] !== '---') i++; i++; }
  let fence = null, current = null, currentLevel = 0, currentLine = 0, lastScenario = null;
  const define = (kind, id, line) => { if (all.has(id)) { problems.push(`duplicate definition ${id} at line ${line}`); return false; } all.set(id, { kind, line }); return true; };
  for (; i < rows.length; i++) {
    const line = rows[i], n = i + 1;
    if (fence !== null) { if (/^[ \t]*```/.test(line)) fence = null; continue; }
    if (/^[ \t]*~~~/.test(line)) { problems.push(`tilde fences are unsupported (line ${n})`); continue; }
    if (/^[ \t]*```/.test(line)) { fence = n; lastScenario = null; continue; }
    if (/^[ \t]*[|>]/.test(line)) { lastScenario = null; continue; }
    const heading = line.match(/^(#{1,6})[ \t]+(.*?)[ \t]*$/);
    if (heading) {
      lastScenario = null;
      const level = heading[1].length, textOf = heading[2];
      const def = textOf.match(new RegExp(`^(${ID})(?:[ \\t]+(?:—|–|-)[ \\t]+|:[ \\t]+)(.+)$`));
      const looksLike = textOf.match(new RegExp(`^(${ID})(?![A-Z0-9-])`));
      if (def && level >= 2 && level <= 4 && def[2].trim()) {
        if (current && !requirements[current].length) problems.push(`requirement ${current} at line ${currentLine} has no scenario`);
        current = null;
        if (define('requirement', def[1], n)) { current = def[1]; currentLevel = level; currentLine = n; requirements[current] = []; }
      } else if (looksLike) { problems.push(`unsupported requirement definition syntax at line ${n}; use "### R-NN — Title"`); }
      else if (current && level <= currentLevel) { if (!requirements[current].length) problems.push(`requirement ${current} at line ${currentLine} has no scenario`); current = null; }
      continue;
    }
    const item = line.match(/^[ \t]*([-+*]|[0-9]+[.)])[ \t]+(.*)$/);
    if (item) {
      lastScenario = null;
      const body = item[2].replace(/^\[[ xX]\][ \t]+/, '');
      const numbered = /^[0-9]/.test(item[1]);
      const def = body.match(new RegExp(`^\\*\\*(${ID})(:?)\\*\\*(:?)(?:[ \\t]+(?:—|–|-)[ \\t]+|[ \\t]+|$)(.*)$`));
      if (def && !numbered) {
        if (!def[4].trim()) { problems.push(`empty definition ${def[1]} at line ${n}`); continue; }
        if (!current) { problems.push(`orphan scenario ${def[1]} at line ${n}`); continue; }
        if (define('scenario', def[1], n)) { requirements[current].push(def[1]); lastScenario = def[1]; }
        continue;
      }
      if (new RegExp(`^(\\*\\*)?${ID}[:.]`).test(body) || new RegExp(`^\\*\\*${ID}\\*\\*[ \\t]*$`).test(body) || (def && numbered)) problems.push(`unsupported scenario definition syntax at line ${n}; use "- **S-NN:** text"`);
      continue;
    }
    if (line.trim() === '' || !/^([ ]{2,}|\t)/.test(line)) lastScenario = null;
  }
  if (fence !== null) problems.push(`unclosed fence opened at line ${fence}`);
  if (current && !requirements[current].length) problems.push(`requirement ${current} at line ${currentLine} has no scenario`);
  if (!Object.keys(requirements).length && !problems.length) problems.push('no requirement definitions');
  return { requirements, problems, all };
}

function assertMapShape(m) {
  assert.deepEqual(Object.keys(m).sort(), ['change', 'checks', 'prd', 'scenarios', 'schema', 'scope', 'tickets'], 'map keys');
  assert.equal(m.schema, 1);
  for (const [id, s] of Object.entries(m.scenarios)) {
    assert.match(id, /^[A-Z][A-Z0-9]{0,7}-[0-9]{1,6}$/); assert.deepEqual(Object.keys(s), ['tickets', 'checks'], `${id} keys`);
    assert.ok(Array.isArray(s.tickets) && Array.isArray(s.checks));
  }
  for (const [id, s] of Object.entries(m.scope)) {
    assert.deepEqual(Object.keys(s), ['disposition', 'decision', 'prior', 'note'], `${id} scope keys`);
    assert.ok(['deferred', 'removed'].includes(s.disposition)); assert.match(s.decision, /^D-[0-9]{2,6}$/);
  }
  for (const [id, t] of Object.entries(m.tickets)) { assert.match(id, /^T-[0-9]{2,6}$/); assert.deepEqual(Object.keys(t), ['role', 'rationale']); assert.ok(['implements', 'enables'].includes(t.role)); }
  for (const [id, c] of Object.entries(m.checks)) {
    assert.match(id, /^C-[0-9]{2,6}$/); assert.deepEqual(Object.keys(c), ['kind', 'required', 'command', 'timeout', 'cwd', 'obligation', 'note'], `${id} check keys`);
    assert.ok(['command', 'review', 'visual'].includes(c.kind)); assert.equal(typeof c.required, 'boolean');
  }
}
