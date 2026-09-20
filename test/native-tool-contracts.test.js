// PRD v8 T-120 (R-21, S-61/S-62/S-63): the native-tool study contracts.
//
// Static assertions about an AUTHORED contract. The rules below restate what
// docs/prd-v8-native-tool-contracts.md declares, and the examples in that document are
// checked against them, then mutated so that each named rejection path is exercised:
// ambiguous billing, a missing mandatory observation, an incompatible profile. Nothing
// here signs in, launches a tool, spends, or observes native behavior; T-121 implements
// these rules in the runner and T-102/T-109 observe them.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const contract = read('docs/prd-v8-native-tool-contracts.md');
const flat = contract.replace(/\s+/g, ' ');

// --- Declared identities ------------------------------------------------------------------
const HISTORICAL_ISOLATION = 'claude-project-isolated-v1';
const NATIVE_ISOLATION = 'claude-project-native-login-v1';
const HISTORICAL_USAGE = 'claude-code-result-modelusage-v1';
const NATIVE_USAGE = 'claude-code-result-native-usage-v1';
const BILLING_MODES = ['subscription', 'api'];
const SURFACES = ['claude-code', 'codex'];
const CREDENTIAL_ENV = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_PROFILE', 'ANTHROPIC_FEDERATION_RULE_ID', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY', 'OPENAI_API_KEY', 'CODEX_API_KEY', 'COPILOT_GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN'];
const STATUS_RETAINED = ['checked', 'logged_in', 'auth_method', 'api_provider', 'subscription_type'];
const STATUS_FORBIDDEN = ['email', 'orgId', 'org_id', 'orgName', 'org_name', 'configDirectory', 'config_directory', 'projectsDirectory', 'projects_directory'];
const SHA = /^[a-f0-9]{64}$/;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const metric = m => object(m) && Object.keys(m).sort().join(',') === 'reason,value' && (m.value === null ? typeof m.reason === 'string' && m.reason.length > 0 : finite(m.value) && m.reason === null);

// --- The declared rules (§3.1) ------------------------------------------------------------
function recordProblems(r) {
  const problems = [];
  const add = code => { if (!problems.includes(code)) problems.push(code); };
  if (!object(r) || r.schema !== 1 || r.kind !== 'native-session-record') return ['RECORD_INVALID'];
  // Incompatible profiles.
  if (r.isolation_profile !== NATIVE_ISOLATION) add('PROFILE_INCOMPATIBLE');
  if (r.measurement_profile !== NATIVE_USAGE) add('PROFILE_INCOMPATIBLE');
  if (!SURFACES.includes(r.tool_surface)) add('SURFACE_UNSUPPORTED');
  if (!Array.isArray(r.env_names) || r.env_names.some(name => CREDENTIAL_ENV.includes(name) || /KEY|TOKEN|SECRET|PASSWORD/i.test(name))) add('PROFILE_INCOMPATIBLE');
  // Mandatory observations.
  const a = r.authentication;
  if (!object(a) || Object.keys(a).sort().join(',') !== STATUS_RETAINED.slice().sort().join(',') || a.checked !== true || a.logged_in !== true) add('MISSING_REQUIRED_CAPTURE');
  if (object(a) && STATUS_FORBIDDEN.some(key => Object.hasOwn(a, key))) add('STATUS_RECORD_UNSANITIZED');
  const m = r.metrics;
  if (!object(m) || Object.keys(m).sort().join(',') !== 'estimate_usd,provider_minutes,tokens' || !Object.values(m).every(metric)) add('MISSING_REQUIRED_CAPTURE');
  else {
    if (m.tokens.value === null || m.provider_minutes.value === null) add('MISSING_REQUIRED_CAPTURE');
    if (r.tool_surface === 'claude-code' && m.estimate_usd.value === null) add('MISSING_REQUIRED_CAPTURE');
    if (r.tool_surface === 'codex' && (m.estimate_usd.value !== null || m.estimate_usd.reason !== 'TOOL_REPORTS_NO_ESTIMATE')) add('PROFILE_INCOMPATIBLE');
  }
  // Billing.
  const b = r.billing;
  if (!object(b) || Object.keys(b).sort().join(',') !== 'attributable_charge_usd,charge_evidence,charge_reason,mode' || !BILLING_MODES.includes(b.mode)) add('AMBIGUOUS_BILLING');
  else {
    const charge = b.attributable_charge_usd;
    if (charge !== null && !finite(charge)) add('AMBIGUOUS_BILLING');
    if (b.mode === 'subscription' && (charge !== null || b.charge_evidence !== null || b.charge_reason !== 'SUBSCRIPTION_NOT_ATTRIBUTABLE')) add('AMBIGUOUS_BILLING');
    if (b.mode === 'api') {
      const evidence = b.charge_evidence;
      const evidenced = object(evidence) && Object.keys(evidence).sort().join(',') === 'digest,ref' && typeof evidence.ref === 'string' && evidence.ref.length > 0 && SHA.test(evidence.digest || '');
      if (charge !== null && !evidenced) add('AMBIGUOUS_BILLING');
      if (charge === null && b.charge_reason !== 'CHARGE_EVIDENCE_MISSING') add('AMBIGUOUS_BILLING');
      if (charge !== null && b.charge_reason !== null) add('AMBIGUOUS_BILLING');
      if (object(a) && a.auth_method === 'claude.ai') add('BILLING_MODE_MISMATCH');
    }
    if (b.mode === 'subscription' && object(a) && a.auth_method !== 'claude.ai') add('BILLING_MODE_MISMATCH');
    // An estimate copied into the charge field is a fabricated bill.
    if (object(m) && metric(m.estimate_usd) && charge !== null && charge === m.estimate_usd.value && !object(b.charge_evidence)) add('AMBIGUOUS_BILLING');
  }
  if (!(r.account_limit === null || (object(r.account_limit) && ['session', 'weekly', 'model', 'spend', 'unknown'].includes(r.account_limit.kind) && Number.isFinite(Date.parse(r.account_limit.at))))) add('ACCOUNT_LIMIT_INVALID');
  return problems;
}

// --- The declared authorization rules (§3.2) ---------------------------------------------
function authorizationProblems(d) {
  const problems = [];
  const add = code => { if (!problems.includes(code)) problems.push(code); };
  if (!object(d) || d.schema !== 1 || d.kind !== 'study-authorization' || d.approved !== true) return ['DECISION_INVALID'];
  if (d.decided_by !== 'user') add('AUTHORIZATION_NOT_USER');
  if (!Number.isFinite(Date.parse(d.decided_at)) || !Number.isFinite(Date.parse(d.expires_at))) add('DECISION_INVALID');
  if (!['operational-smoke', 'measured'].includes(d.purpose)) add('DECISION_INVALID');
  if (!BILLING_MODES.includes(d.billing_mode)) add('BILLING_MODE_PENDING');
  const positive = v => finite(v) && v > 0;
  if (!Number.isSafeInteger(d.session_turns) || d.session_turns <= 0 || !Number.isSafeInteger(d.session_wall_minutes) || d.session_wall_minutes <= 0 || !positive(d.session_estimate_cap_usd) || !positive(d.limit_estimate_usd) || d.session_estimate_cap_usd > d.limit_estimate_usd) add('NUMERIC_ALLOCATION_PENDING');
  for (const legacy of ['limit_usd', 'session_cap_usd', 'api_key', 'apiKey']) if (Object.hasOwn(d, legacy)) add('LEGACY_FIELD_REFUSED');
  const u = d.account_usage;
  if (!object(u) || Object.keys(u).sort().join(',') !== 'agreed,max_elapsed_minutes,max_sessions' || u.agreed !== true || !Number.isSafeInteger(u.max_sessions) || u.max_sessions <= 0 || !positive(u.max_elapsed_minutes)) add('ACCOUNT_USAGE_PENDING');
  if (!SHA.test(d.schedule_digest || '')) add('DECISION_INVALID');
  if (!Array.isArray(d.evidence) || !d.evidence.length || !d.evidence.every(e => object(e) && typeof e.ref === 'string' && SHA.test(e.digest || ''))) add('SUPPORTING_EVIDENCE_MISSING');
  const text = JSON.stringify(d);
  if (/sk-ant-|sk-[A-Za-z0-9]{20,}|ANTHROPIC_API_KEY|OPENAI_API_KEY/.test(text)) add('SECRET_REFUSED');
  return problems;
}

// --- The declared comparison rule (§3.4) --------------------------------------------------
function comparisonProblems(c) {
  if (!object(c) || !Array.isArray(c.cells) || c.cells.length < 2) return ['COMPARISON_INVALID'];
  if (c.claim !== 'dollar-superiority') return [];
  const problems = [];
  for (const cell of c.cells) {
    if (cell.billing_mode !== 'api' || cell.charge_evidence !== true || !finite(cell.attributable_charge_usd) || cell.tool_surface !== 'claude-code') { problems.push('COST_COMPARISON_INCOMPATIBLE'); break; }
  }
  return problems;
}

// --- Examples from the document ------------------------------------------------------------
const blocks = [...contract.matchAll(/```json ([a-z-]+)\n([\s\S]*?)\n```/g)].map(m => ({ kind: m[1], value: JSON.parse(m[2]) }));
const records = blocks.filter(b => b.kind === 'native-session-record').map(b => b.value);
const authorizations = blocks.filter(b => b.kind === 'study-authorization').map(b => b.value);
const comparisons = blocks.filter(b => b.kind === 'comparison-admissibility').map(b => b.value);
assert.equal(records.length, 2, 'one subscription and one api example record');
assert.equal(authorizations.length, 1, 'one authorization example');
assert.equal(comparisons.length, 1, 'one comparison example');
const [subscription, api] = records;
assert.equal(subscription.billing.mode, 'subscription');
assert.equal(api.billing.mode, 'api');
for (const r of records) assert.deepEqual(recordProblems(r), [], `example record validates: ${r.billing.mode}`);
assert.deepEqual(authorizationProblems(authorizations[0]), []);
assert.deepEqual(comparisonProblems(comparisons[0]), []);
// The subscription example carries no charge and says why; the api example carries evidence.
assert.equal(subscription.billing.attributable_charge_usd, null);
assert.equal(subscription.billing.charge_reason, 'SUBSCRIPTION_NOT_ATTRIBUTABLE');
assert.equal(subscription.metrics.estimate_usd.value, 1.25, 'an estimate is retained as an estimate under a subscription');
assert.ok(SHA.test(api.billing.charge_evidence.digest));
assert.notEqual(api.billing.attributable_charge_usd, api.metrics.estimate_usd.value, 'the api example does not pass the estimate off as the charge');

const clone = v => JSON.parse(JSON.stringify(v));
const rejects = (label, value, mutate, code, validate = recordProblems) => {
  const copy = clone(value); mutate(copy);
  const problems = validate(copy);
  assert.ok(problems.includes(code), `${label}: expected ${code}, got [${problems.join(', ')}]`);
};

// --- Ambiguous billing is rejected ---------------------------------------------------------
rejects('mode absent', subscription, r => { delete r.billing.mode; }, 'AMBIGUOUS_BILLING');
rejects('mode unknown', subscription, r => { r.billing.mode = 'unknown'; }, 'AMBIGUOUS_BILLING');
rejects('mode mixed', subscription, r => { r.billing.mode = 'subscription-or-api'; }, 'AMBIGUOUS_BILLING');
rejects('subscription with a charge', subscription, r => { r.billing.attributable_charge_usd = 1.25; r.billing.charge_reason = null; }, 'AMBIGUOUS_BILLING');
rejects('subscription charge set to zero', subscription, r => { r.billing.attributable_charge_usd = 0; r.billing.charge_reason = null; }, 'AMBIGUOUS_BILLING');
rejects('subscription without the expected reason', subscription, r => { r.billing.charge_reason = null; }, 'AMBIGUOUS_BILLING');
rejects('api charge without evidence', api, r => { r.billing.charge_evidence = null; }, 'AMBIGUOUS_BILLING');
rejects('api charge with malformed evidence', api, r => { r.billing.charge_evidence = { ref: 'x', digest: 'not-a-digest' }; }, 'AMBIGUOUS_BILLING');
rejects('api unknown charge without reason', api, r => { r.billing.attributable_charge_usd = null; r.billing.charge_evidence = null; }, 'AMBIGUOUS_BILLING');
rejects('estimate copied into the charge', api, r => { r.billing.attributable_charge_usd = r.metrics.estimate_usd.value; r.billing.charge_evidence = null; }, 'AMBIGUOUS_BILLING');
rejects('negative charge', api, r => { r.billing.attributable_charge_usd = -1; }, 'AMBIGUOUS_BILLING');
rejects('subscription login declared api', api, r => { r.authentication.auth_method = 'claude.ai'; }, 'BILLING_MODE_MISMATCH');
rejects('console login declared subscription', subscription, r => { r.authentication.auth_method = 'console'; }, 'BILLING_MODE_MISMATCH');

// --- Missing mandatory observations are rejected ------------------------------------------
rejects('tokens missing', subscription, r => { r.metrics.tokens = { value: null, reason: 'Provider field missing or invalid.' }; }, 'MISSING_REQUIRED_CAPTURE');
rejects('provider minutes missing', subscription, r => { r.metrics.provider_minutes = { value: null, reason: 'Provider field missing or invalid.' }; }, 'MISSING_REQUIRED_CAPTURE');
rejects('claude estimate missing', subscription, r => { r.metrics.estimate_usd = { value: null, reason: 'absent' }; }, 'MISSING_REQUIRED_CAPTURE');
rejects('metric null without a reason', subscription, r => { r.metrics.tokens = { value: null, reason: null }; }, 'MISSING_REQUIRED_CAPTURE');
rejects('authentication absent', subscription, r => { delete r.authentication; }, 'MISSING_REQUIRED_CAPTURE');
rejects('authentication unchecked', subscription, r => { r.authentication.checked = false; }, 'MISSING_REQUIRED_CAPTURE');
rejects('not logged in', subscription, r => { r.authentication.logged_in = false; }, 'MISSING_REQUIRED_CAPTURE');
rejects('status record carries email', subscription, r => { r.authentication.email = 'someone@example.com'; }, 'STATUS_RECORD_UNSANITIZED');
rejects('status record carries org id', subscription, r => { r.authentication.orgId = 'org'; }, 'STATUS_RECORD_UNSANITIZED');
rejects('status record carries config path', subscription, r => { r.authentication.configDirectory = '/Users/x/.claude'; }, 'STATUS_RECORD_UNSANITIZED');
rejects('account limit malformed', subscription, r => { r.account_limit = { kind: 'quota' }; }, 'ACCOUNT_LIMIT_INVALID');
{
  const limited = clone(subscription); limited.account_limit = { kind: 'weekly', at: '2026-09-20T00:00:00Z' };
  assert.deepEqual(recordProblems(limited), [], 'an account-limit stop is a valid, recorded outcome');
}

// --- Incompatible profiles are rejected -----------------------------------------------------
rejects('historical isolation profile with a subscription', subscription, r => { r.isolation_profile = HISTORICAL_ISOLATION; }, 'PROFILE_INCOMPATIBLE');
rejects('historical usage profile on a native record', subscription, r => { r.measurement_profile = HISTORICAL_USAGE; }, 'PROFILE_INCOMPATIBLE');
rejects('unknown isolation profile', subscription, r => { r.isolation_profile = 'claude-project-native-login-v2'; }, 'PROFILE_INCOMPATIBLE');
for (const name of CREDENTIAL_ENV) rejects(`credential variable ${name} in env_names`, subscription, r => { r.env_names.push(name); }, 'PROFILE_INCOMPATIBLE');
rejects('secret-looking variable in env_names', subscription, r => { r.env_names.push('MY_PROVIDER_SECRET'); }, 'PROFILE_INCOMPATIBLE');
rejects('copilot surface has no profile', subscription, r => { r.tool_surface = 'copilot'; }, 'SURFACE_UNSUPPORTED');
{
  const codex = clone(subscription); codex.tool_surface = 'codex';
  assert.ok(recordProblems(codex).includes('PROFILE_INCOMPATIBLE'), 'codex with a dollar estimate is incompatible');
  codex.metrics.estimate_usd = { value: null, reason: 'TOOL_REPORTS_NO_ESTIMATE' };
  assert.deepEqual(recordProblems(codex), [], 'codex with the declared absent estimate validates');
}

// --- Authorization: no inferred numbers, no legacy API fields, no secrets -------------------
const auth = authorizations[0];
assert.equal(auth.decided_by, 'user');
rejects('authorization not by the user', auth, d => { d.decided_by = 'agent'; }, 'AUTHORIZATION_NOT_USER', authorizationProblems);
rejects('billing mode missing', auth, d => { delete d.billing_mode; }, 'BILLING_MODE_PENDING', authorizationProblems);
rejects('billing mode ambiguous', auth, d => { d.billing_mode = 'either'; }, 'BILLING_MODE_PENDING', authorizationProblems);
rejects('account usage missing', auth, d => { delete d.account_usage; }, 'ACCOUNT_USAGE_PENDING', authorizationProblems);
rejects('account usage not agreed', auth, d => { d.account_usage.agreed = false; }, 'ACCOUNT_USAGE_PENDING', authorizationProblems);
rejects('session estimate cap above the limit', auth, d => { d.session_estimate_cap_usd = d.limit_estimate_usd + 1; }, 'NUMERIC_ALLOCATION_PENDING', authorizationProblems);
rejects('zero turns', auth, d => { d.session_turns = 0; }, 'NUMERIC_ALLOCATION_PENDING', authorizationProblems);
rejects('legacy limit_usd field', auth, d => { d.limit_usd = 3; }, 'LEGACY_FIELD_REFUSED', authorizationProblems);
rejects('legacy session_cap_usd field', auth, d => { d.session_cap_usd = 1; }, 'LEGACY_FIELD_REFUSED', authorizationProblems);
rejects('api key field', auth, d => { d.api_key = 'present'; }, 'LEGACY_FIELD_REFUSED', authorizationProblems);
rejects('secret-shaped content', auth, d => { d.evidence[0].ref = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789'; }, 'SECRET_REFUSED', authorizationProblems);
rejects('no supporting evidence', auth, d => { d.evidence = []; }, 'SUPPORTING_EVIDENCE_MISSING', authorizationProblems);

// --- Comparison: dollar claims need evidenced api billing on every cell --------------------
const comparison = comparisons[0];
rejects('subscription cell in a dollar claim', comparison, c => { c.cells[1] = { billing_mode: 'subscription', attributable_charge_usd: null, charge_evidence: false, tool_surface: 'claude-code' }; }, 'COST_COMPARISON_INCOMPATIBLE', comparisonProblems);
rejects('mixed modes', comparison, c => { c.cells.push({ billing_mode: 'subscription', attributable_charge_usd: null, charge_evidence: false, tool_surface: 'claude-code' }); }, 'COST_COMPARISON_INCOMPATIBLE', comparisonProblems);
rejects('api cell without evidence', comparison, c => { c.cells[0].charge_evidence = false; }, 'COST_COMPARISON_INCOMPATIBLE', comparisonProblems);
rejects('codex cell', comparison, c => { c.cells[0].tool_surface = 'codex'; }, 'COST_COMPARISON_INCOMPATIBLE', comparisonProblems);
{
  const nonDollar = clone(comparison); nonDollar.claim = 'elapsed-time'; nonDollar.cells[1].billing_mode = 'subscription'; nonDollar.cells[1].attributable_charge_usd = null; nonDollar.cells[1].charge_evidence = false;
  assert.deepEqual(comparisonProblems(nonDollar), [], 'time and operation comparisons are allowed across billing modes');
}

// --- The contract text says what the rules say ---------------------------------------------
for (const phrase of [
  'requires no model-provider API key',
  'implements no model client',
  'never reads, copies, hashes, forwards or logs',
  'never switches billing',
  HISTORICAL_ISOLATION, NATIVE_ISOLATION, HISTORICAL_USAGE, NATIVE_USAGE,
  'Never retained:', 'LOGIN_REQUIRED', 'BILLING_OVERRIDE_PRESENT', 'PROFILE_HOST_DIRTY', 'NATIVE_LOGIN_NOT_PRESERVED',
  'SUBSCRIPTION_NOT_ATTRIBUTABLE', 'CHARGE_EVIDENCE_MISSING', 'AMBIGUOUS_BILLING', 'MISSING_REQUIRED_CAPTURE', 'BILLING_MODE_MISMATCH', 'COST_COMPARISON_INCOMPATIBLE', 'TOOL_REPORTS_NO_ESTIMATE',
  'BILLING_MODE_PENDING', 'ACCOUNT_USAGE_PENDING', 'LOGIN_STATUS_CONTRACT_PENDING',
  'A quiet canary', 'does not', 'demonstrate isolation',
  'declared controlled-host baseline',
  'is never a fallback the runner selects on its own, and an API key is never a fallback',
  'Copilot has', 'no study profile', 'live behavior is unobserved',
  'expected, valid, not a failure',
  'never a charge',
  'is not the agent\'s to pass',
  'None of these pages demonstrates',
]) assert.ok(flat.includes(phrase), `contract text missing: ${phrase}`);
for (const variable of CREDENTIAL_ENV.filter(v => !v.startsWith('COPILOT') && !/^GH_|^GITHUB_/.test(v))) assert.ok(contract.includes(`\`${variable}\``), `refusal list names ${variable}`);
for (const forbidden of ['email', 'orgId', 'orgName', 'configDirectory', 'projectsDirectory']) assert.ok(contract.includes(`\`${forbidden}\``), `status contract names the excluded key ${forbidden}`);
// Versions actually checked are recorded; the pinned study copy stays 2.1.273.
assert.match(contract, /Claude Code CLI \| 2\.1\.278 installed help; 2\.1\.273 is the pinned study copy/);
assert.match(contract, /Codex CLI \| 0\.155\.1 installed/);
assert.match(contract, /GitHub Copilot CLI \| not installed on this host; version unobserved/);
// No live observation is claimed anywhere in the surface table.
for (const row of contract.split('\n').filter(l => /^\| (Claude Code CLI|Codex CLI|GitHub Copilot CLI) \|/.test(l))) assert.match(row, /\*\*None\.\*\*/, `no observed live behavior claimed: ${row.slice(0, 40)}`);
assert.doesNotMatch(flat, /Copilot (is|was) observed/i);
// Every local link resolves; official references are listed with the date they were read.
for (const match of contract.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) if (!match[1].includes('://')) assert.ok(fs.existsSync(path.resolve(root, 'docs', match[1])), `missing document: ${match[1]}`);
assert.match(contract, /Read 20 September 2026/);
for (const url of ['https://code.claude.com/docs/en/authentication', 'https://code.claude.com/docs/en/costs', 'https://learn.chatgpt.com/docs/auth', 'https://learn.chatgpt.com/docs/non-interactive-mode', 'https://docs.github.com/en/copilot/concepts/billing/copilot-requests']) assert.ok(contract.includes(url), `official reference listed: ${url}`);

// --- The frozen documents and affected tickets carry the amendment -------------------------
const protocol = read('docs/prd-v8-protocol.md').replace(/\s+/g, ' ');
for (const phrase of ['Native-login amendment', 'prd-v8-native-tool-contracts.md', 'No provider API key', 'billing_mode', 'never a charge', 'COST_COMPARISON_INCOMPATIBLE', 'does not transfer across kits', 'covers sessions, setup, evaluation and operator inspection']) assert.ok(protocol.includes(phrase), `protocol missing: ${phrase}`);
const isolation = read('docs/prd-v8-agent-isolation.md').replace(/\s+/g, ' ');
for (const phrase of [NATIVE_ISOLATION, 'historical', 'host-login-config-dir', 'prd-v8-native-tool-contracts.md', 'not the execution path of any future session']) assert.ok(isolation.includes(phrase), `isolation doc missing: ${phrase}`);
const usage = read('docs/prd-v8-usage-semantics.md').replace(/\s+/g, ' ');
for (const phrase of [NATIVE_USAGE, 'SUBSCRIPTION_NOT_ATTRIBUTABLE', 'estimate at list price', 'prd-v8-native-tool-contracts.md', 'legacy-api-estimate']) assert.ok(usage.includes(phrase), `usage doc missing: ${phrase}`);
const prd = read('.prd/prd-v8.md');
for (const id of ['R-21', 'S-61', 'S-62', 'S-63', 'R-22', 'S-64', 'S-65', 'S-66']) assert.ok(prd.includes(`**${id}`) || prd.includes(`### ${id}`), `PRD names ${id}`);
assert.match(prd, /Unavailable marginal dollar cost is explicitly unavailable, never zero/);
for (const ticket of ['T-102-isolate-study-agent-configuration', 'T-105-account-for-partial-study-usage', 'T-109-gate-study-execution-readiness', 'T-110-observe-baseline-strict-journeys', 'T-111-observe-file-only-agent-handoff', 'T-114-measure-guided-workflow-benefit', 'T-115-complete-three-arm-delivery-study', 'T-116-measure-independent-review-effort', 'T-118-compare-pinned-workflow-alternatives']) {
  assert.ok(read(`tickets/${ticket}.md`).includes('prd-v8-native-tool-contracts.md'), `${ticket} references the native-tool contract`);
}
const t120 = read('tickets/T-120-define-native-tool-study-contracts.md');
assert.match(t120, /^status: (in_progress|done)$/m);
assert.ok(!/^- \[x\]/m.test(t120) || /Human review must assess/.test(t120), 'ticked criteria keep the human-review caveat');
const smokePackage = read('docs/prd-v8-artifacts/execution/T-109-smoke-execution-package.md');
assert.match(smokePackage, /Superseded for execution/);
assert.ok(smokePackage.includes('prd-v8-native-tool-contracts.md'), 'the superseded package points at the replacement contract');
assert.match(read('README.md'), /requires no model-provider API key/);
// The contract is a frozen input: the harness list names it, appended, and the frozen
// manifest was regenerated with it.
const spec = read('scripts/delivery-benchmark-v7/freeze-spec.cjs');
assert.ok(spec.includes("'docs/prd-v8-native-tool-contracts.md'"), 'freeze spec names the contract');
const harness = spec.match(/harness: \[([^\]]*)\]/)[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
assert.equal(harness[harness.length - 1], 'docs/prd-v8-native-tool-contracts.md', 'appended, never prepended');
const frozen = JSON.parse(read('test/fixtures/delivery-benchmark-v7/frozen.json'));
{
  // The committed cohort is the freeze of this tree with the contract in the harness list,
  // and the contract's bytes contribute: dropping it from the list moves the harness digest.
  const require = createRequire(import.meta.url);
  const freeze = require(path.join(root, 'scripts/delivery-benchmark-v7/freeze.cjs'));
  const { REPO, SPEC } = require(path.join(root, 'scripts/delivery-benchmark-v7/freeze-spec.cjs'));
  assert.equal(REPO, root);
  assert.ok(SPEC.harness.includes('docs/prd-v8-native-tool-contracts.md'));
  const current = freeze.compute(REPO, SPEC);
  assert.equal(current.cohort, frozen.cohort, 'frozen manifest regenerated with the contract in the harness');
  const without = freeze.compute(REPO, { ...SPEC, harness: SPEC.harness.filter(rel => rel !== 'docs/prd-v8-native-tool-contracts.md') });
  assert.notEqual(without.inputs.harness, current.inputs.harness, 'the contract document is a frozen input');
}
// The suite is part of the normal chain.
assert.ok(JSON.parse(read('package.json')).scripts.test.includes('node test/native-tool-contracts.test.js'), 'this suite runs under npm test');
assert.ok(exists('test/native-tool-contracts.test.js'));
console.log('native-tool contracts: ok');
