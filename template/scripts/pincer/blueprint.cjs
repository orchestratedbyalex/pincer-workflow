'use strict';
// PINCER blueprint — the writer (docs/engine.md, "Blueprint"). Reads an answers
// file in the shape of harness.json, validates it, writes harness.json, renders
// the agreement from library/agreement.md between the markers in AGENTS.md and
// runs the generator. Everything outside the markers is left byte for byte.
const fs = require('node:fs');
const path = require('node:path');
const util = require('./util.cjs');
const harness = require('./harness.cjs');
const generate = require('./generate.cjs');

const AGREEMENT_START = '<!-- pincer:agreement:start -->';
const AGREEMENT_END = '<!-- pincer:agreement:end -->';
const AGENTS_FILE = 'AGENTS.md';
const { LIBRARY, libraryDir } = generate;
const TEMPLATE_FILE = 'agreement.md';
const SKELETON_FILE = 'agents-skeleton.md';
const CODE_GATE = 'passing check per ticket';

// {{slot}} and {{#each list}}…{{/each}} with {{.}} for the item; nothing else.
function fill(template, view) {
  const lookup = (key) => {
    if (!(key in view)) throw new Error(`${TEMPLATE_FILE}: unknown slot {{${key}}}`);
    return view[key];
  };
  const expanded = template.replace(/\{\{#each ([\w.]+)\}\}\n?([\s\S]*?)\{\{\/each\}\}\n?/g, (_, key, block) => {
    const items = lookup(key);
    if (!Array.isArray(items)) throw new Error(`${TEMPLATE_FILE}: {{#each ${key}}} needs a list`);
    return items.map((item) => block.replace(/\{\{\.\}\}/g, String(item))).join('');
  });
  return expanded.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    const value = lookup(key);
    if (Array.isArray(value)) throw new Error(`${TEMPLATE_FILE}: {{${key}}} is a list; use {{#each}}`);
    return String(value);
  });
}

const or = (value, fallback) => (typeof value === 'string' && value.trim() ? value.trim() : fallback);
const yesNo = (value) => (value ? 'yes' : 'no');

// The one-line pipeline: the stages that run, in order, each gate in bold.
function pipeline(h) {
  const who = harness.acceptors(h);
  const gates = {
    plan: or(h.stages.plan.gate, 'spec approved'),
    code: CODE_GATE,
    evaluate: h.stages.evaluate.evidence === false ? 'review done' : 'evidence saved',
    release: `accepted by ${who.length ? who.join(', ') : 'a person'}`,
  };
  return harness.STAGES.filter((name) => harness.stageOn(h, name))
    .map((name) => (gates[name] ? `${name} (**${gates[name]}**)` : name))
    .join(' → ');
}

// The slots of library/agreement.md from a normalized agreement.
function view(h) {
  const homes = harness.homes(h);
  const simplify = harness.OPTIONAL_STAGES.filter((name) => !harness.stageOn(h, name))
    .map((name) => `${name} is off${or(h.stages[name].reason, '') ? ` — ${h.stages[name].reason.trim()}` : ''}.`);
  const people = h.people.map((p) => `${p.name.trim()}${or(p.role, '') ? ` (${p.role.trim()})` : ''}${p.accepts === true ? ' — accepts results' : ''}`);
  const forge = { github: 'GitHub', none: 'none', other: 'other' }[h.systems.forge] || h.systems.forge;
  return {
    name: or(h.project.name, 'unnamed project'),
    kind: h.project.kind,
    kindReason: or(h.project.reason, '') ? ` — ${h.project.reason.trim()}` : '',
    forge,
    remote: or(h.systems.remote, 'none'),
    ci: yesNo(h.systems.ci),
    deploy: or(h.systems.deploy, 'none'),
    secrets: or(h.systems.secrets, 'not recorded'),
    pipeline: pipeline(h),
    spec: !harness.stageOn(h, 'plan') ? 'none (plan is off)' : h.stages.plan.spec === 'forge' ? 'forge' : `${homes.specs}/`,
    tickets: h.stages.narrow.tickets === 'forge' ? 'forge' : `${homes.tickets}/`,
    evidence: !harness.stageOn(h, 'evaluate') ? 'none (evaluate is off)' : h.stages.evaluate.evidence === false ? 'none' : `${homes.evidence}/`,
    simplify: simplify.length ? simplify : ['Every stage runs; nothing switched off.'],
    people: people.length ? people : ['nobody named yet'],
    branches: h.repo.branches === 'per-ticket' ? 'one branch per ticket' : 'commit to main',
    pr: yesNo(h.repo.pr),
    merge: h.repo.merge,
    protection: or(h.repo.protection, 'none'),
    checks: h.repo.checks.length ? h.repo.checks.join(', ') : 'none',
    open: h.open.length ? h.open : ['none'],
    firstJob: or(h.firstJob, 'not named yet'),
  };
}

// The agreement text, without the markers; ends with one newline.
function renderAgreement(h, { library } = {}) {
  const template = fs.readFileSync(path.join(library || libraryDir(process.cwd()), TEMPLATE_FILE), 'utf8');
  return `${fill(template, view(harness.normalize(h))).trimEnd()}\n`;
}

// AGENTS.md with the agreement between the markers. Markers present: the text
// between them is replaced. No markers: the block goes after a leading title,
// else at the top. One marker alone is a problem, nothing is changed.
function splice(text, agreement) {
  const block = `${AGREEMENT_START}\n${agreement}${AGREEMENT_END}`;
  const start = text.indexOf(AGREEMENT_START), end = text.indexOf(AGREEMENT_END);
  if (start === -1 && end === -1) {
    const title = /^# [^\n]*\n/.exec(text);
    const head = title ? title[0] : '';
    const rest = text.slice(head.length).replace(/^\n+/, '');
    return { text: `${head}${head ? '\n' : ''}${block}\n${rest ? `\n${rest}` : ''}` };
  }
  if (start === -1 || end === -1 || end < start) return { problem: `${AGENTS_FILE}: found one agreement marker without the other (${AGREEMENT_START} … ${AGREEMENT_END})` };
  return { text: `${text.slice(0, start)}${block}${text.slice(end + AGREEMENT_END.length)}` };
}

function write(root, { answers = harness.HARNESS_FILE, label, library } = {}) {
  const name = label || answers;
  const file = path.isAbsolute(answers) ? answers : path.join(root, answers);
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (error) {
    return { ok: false, exit: 3, problems: [`${name}: cannot read (${error.code === 'ENOENT' ? 'no such file' : error.message})`] };
  }
  let doc;
  try { doc = JSON.parse(raw); } catch (error) { return { ok: false, exit: 3, problems: [`${name}: invalid JSON (${error.message})`] }; }
  const problems = harness.validate(doc);
  if (problems.length) return { ok: false, exit: 3, problems: problems.map((p) => `${name}: ${p}`) };
  const normalized = harness.normalize(doc);
  const lib = libraryDir(root, library);
  const agreement = renderAgreement(normalized, { library: lib });
  const agentsFile = path.join(root, AGENTS_FILE);
  const current = fs.existsSync(agentsFile) ? fs.readFileSync(agentsFile, 'utf8') : fs.readFileSync(path.join(lib, SKELETON_FILE), 'utf8');
  const spliced = splice(current, agreement);
  if (spliced.problem) return { ok: false, exit: 1, problems: [spliced.problem] };
  util.atomicWrite(path.join(root, harness.HARNESS_FILE), `${JSON.stringify(normalized, null, 2)}\n`);
  util.atomicWrite(agentsFile, spliced.text);
  const generated = generate.generate(root, { harness: normalized, library: lib });
  return { ok: true, harness: normalized, agreement, generated, written: [harness.HARNESS_FILE, AGENTS_FILE] };
}

module.exports = { AGREEMENT_START, AGREEMENT_END, AGENTS_FILE, LIBRARY, write, renderAgreement, splice, fill, libraryDir };
