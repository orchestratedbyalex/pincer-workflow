'use strict';
// PINCER engine — harness.json, the machine-readable agreement every stage
// reads (docs/engine.md, "harness.json"). Schema 1. Dependency-free.
const fs = require('node:fs');
const path = require('node:path');
const { stripUserinfo } = require('./util.cjs');

const HARNESS_FILE = 'harness.json';
const STAGES = ['blueprint', 'plan', 'narrow', 'code', 'evaluate', 'release', 'status'];
const ALWAYS_ON = ['blueprint', 'status'];
const OPTIONAL_STAGES = STAGES.filter((name) => !ALWAYS_ON.includes(name));
const ROSTER_STAGES = ['plan', 'narrow', 'code', 'evaluate'];
const AGENT_NAMES = [
  'codebase-explorer', 'implementer', 'code-quality-reviewer', 'silent-failure-hunter', 'security-reviewer',
  'test-coverage-reviewer', 'history-reviewer', 'standards-reviewer', 'accessibility-reviewer', 'fix-agent',
];
const KINDS = ['greenfield', 'brownfield'];
const MISSING_MESSAGE = 'no agreement yet: run /pincer-blueprint';
// Model tiers: what the agreement says about which model a role runs on. The
// empty string is "not set" (the library's default, else inherit).
const TIERS = ['strong', 'standard', 'fast', 'inherit'];
const MAP_TIERS = ['strong', 'standard', 'fast'];
const EFFORTS = ['low', 'medium', 'high'];
const PLATFORMS = ['claude', 'codex', 'copilot'];
const MODEL_ENTRY = { tier: '', effort: '' };

const DEFAULT_STAGES = {
  plan: { on: true, spec: 'file', gate: '' },
  narrow: { on: true, tickets: 'file' },
  code: { on: true, implementer: false },
  evaluate: { on: true, where: 'local', evidence: true },
  release: { on: true, audit: 'tree' },
};
const DEFAULTS = {
  project: { name: '', reason: '' },
  person: { name: '', role: '', accepts: false },
  systems: { forge: 'none', remote: '', ci: false, deploy: '', secrets: '' },
  repo: { branches: 'main', pr: false, merge: 'merge', protection: '', checks: [] },
  homes: { specs: 'specs', tickets: 'tickets', evidence: 'evidence' },
  models: { stages: {}, agents: {}, map: {} },
};
// Allowed values per field; a field not listed here is a string.
const RULES = {
  'systems.forge': ['github', 'none', 'other'],
  'systems.ci': 'boolean',
  'repo.branches': ['per-ticket', 'main'],
  'repo.pr': 'boolean',
  'repo.merge': ['merge', 'squash', 'rebase'],
  'repo.checks': 'strings',
  'stages.plan.spec': ['file', 'forge'],
  'stages.narrow.tickets': ['file', 'forge'],
  'stages.code.implementer': 'boolean',
  'stages.evaluate.where': ['local', 'pr'],
  'stages.evaluate.evidence': 'boolean',
  'stages.release.audit': ['tree', 'pr'],
};

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const obj = (value) => (isObject(value) ? value : {});
const trimSlash = (value) => (typeof value === 'string' ? value.replace(/\/+$/, '') : value);

function check(problems, label, value) {
  const rule = RULES[label] || 'string';
  if (Array.isArray(rule)) { if (!rule.includes(value)) problems.push(`${label} must be ${rule.join(' or ')}`); }
  else if (rule === 'boolean') { if (typeof value !== 'boolean') problems.push(`${label} must be true or false`); }
  else if (rule === 'strings') { if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) problems.push(`${label} must be a list of strings`); }
  else if (typeof value !== 'string') problems.push(`${label} must be a string`);
}
function checkSection(problems, doc, section, defaults) {
  if (doc[section] === undefined) return;
  if (!isObject(doc[section])) { problems.push(`${section} must be an object`); return; }
  for (const [key, value] of Object.entries(doc[section])) if (key in defaults) check(problems, `${section}.${key}`, value);
}
function homeProblem(value) {
  if (typeof value !== 'string' || !value.trim()) return 'must be a relative path';
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value) || value.split(/[\\/]/).includes('..')) return 'must be a relative path inside the repository (no leading / or ..)';
  return null;
}

// models.stages.<name> and models.agents.<name>: a tier word or { tier, effort }.
function checkModelEntry(problems, label, value) {
  const tierProblem = `${label}.tier must be strong, standard, fast or inherit`;
  if (typeof value === 'string') { if (value !== '' && !TIERS.includes(value)) problems.push(tierProblem); return; }
  if (!isObject(value)) { problems.push(`${label} must be a tier or an object`); return; }
  if ('tier' in value && (typeof value.tier !== 'string' || (value.tier !== '' && !TIERS.includes(value.tier)))) problems.push(tierProblem);
  if ('effort' in value && (typeof value.effort !== 'string' || (value.effort !== '' && !EFFORTS.includes(value.effort)))) problems.push(`${label}.effort must be low, medium or high`);
}
function checkModels(problems, doc) {
  if (doc.models === undefined) return;
  if (!isObject(doc.models)) { problems.push('models must be an object'); return; }
  const { stages, agents, map } = doc.models;
  if (stages !== undefined) {
    if (!isObject(stages)) problems.push('models.stages must be an object');
    else {
      for (const [name, value] of Object.entries(stages)) {
        if (ALWAYS_ON.includes(name)) { problems.push(`models.stages.${name}: ${name} is always on and runs on the session's model`); continue; }
        if (!OPTIONAL_STAGES.includes(name)) { problems.push(`models.stages.${name} is not a stage (stages: ${OPTIONAL_STAGES.join(', ')})`); continue; }
        checkModelEntry(problems, `models.stages.${name}`, value);
      }
    }
  }
  if (agents !== undefined) {
    if (!isObject(agents)) problems.push('models.agents must be an object');
    else {
      for (const [name, value] of Object.entries(agents)) {
        if (!AGENT_NAMES.includes(name)) { problems.push(`models.agents.${name}: unknown agent (agents: ${AGENT_NAMES.join(', ')})`); continue; }
        checkModelEntry(problems, `models.agents.${name}`, value);
      }
    }
  }
  if (map !== undefined) {
    if (!isObject(map)) problems.push('models.map must be an object');
    else {
      for (const [platform, row] of Object.entries(map)) {
        if (!PLATFORMS.includes(platform)) { problems.push(`models.map.${platform} is not a platform (${PLATFORMS.join(', ')})`); continue; }
        if (!isObject(row)) { problems.push(`models.map.${platform} must be an object`); continue; }
        for (const [tier, value] of Object.entries(row)) {
          if (!MAP_TIERS.includes(tier)) { problems.push(`models.map.${platform}.${tier} is not a tier (${MAP_TIERS.join(', ')})`); continue; }
          if (typeof value !== 'string' || !value.trim()) problems.push(`models.map.${platform}.${tier} must be a non-empty string`);
        }
      }
    }
  }
}

// Every problem with the document, in reading order; [] when it is valid.
function validate(doc) {
  if (!isObject(doc)) return ['must be a JSON object'];
  const problems = [];
  if (doc.schema !== 1) problems.push('schema must be 1');
  const project = obj(doc.project);
  if (!KINDS.includes(project.kind)) problems.push(`project.kind must be ${KINDS.join(' or ')}`);
  for (const key of ['name', 'reason']) if (key in project) check(problems, `project.${key}`, project[key]);
  if (!Array.isArray(doc.people)) problems.push('people must be a list');
  else {
    doc.people.forEach((person, i) => {
      if (!isObject(person) || typeof person.name !== 'string' || !person.name.trim()) problems.push(`people[${i}] needs a name`);
      if (isObject(person) && 'accepts' in person && typeof person.accepts !== 'boolean') problems.push(`people[${i}].accepts must be true or false`);
    });
    if (!doc.people.some((person) => isObject(person) && person.accepts === true)) problems.push('people must include at least one person with accepts: true (who accepts the result)');
  }
  checkSection(problems, doc, 'systems', DEFAULTS.systems);
  checkSection(problems, doc, 'repo', DEFAULTS.repo);
  if (doc.homes !== undefined) {
    if (!isObject(doc.homes)) problems.push('homes must be an object');
    else for (const [key, value] of Object.entries(doc.homes)) { const p = homeProblem(value); if (p) problems.push(`homes.${key} ${p}`); }
  }
  if (doc.stages !== undefined) {
    if (!isObject(doc.stages)) problems.push('stages must be an object');
    else {
      for (const [name, stage] of Object.entries(doc.stages)) {
        if (ALWAYS_ON.includes(name)) { problems.push(`stages.${name}: ${name} is always on; remove the entry`); continue; }
        if (!OPTIONAL_STAGES.includes(name)) { problems.push(`stages.${name} is not a stage (stages: ${OPTIONAL_STAGES.join(', ')})`); continue; }
        if (!isObject(stage)) { problems.push(`stages.${name} must be an object`); continue; }
        if ('on' in stage && typeof stage.on !== 'boolean') problems.push(`stages.${name}.on must be true or false`);
        if ('reason' in stage) check(problems, `stages.${name}.reason`, stage.reason);
        for (const key of Object.keys(DEFAULT_STAGES[name])) if (key !== 'on' && key in stage) check(problems, `stages.${name}.${key}`, stage[key]);
      }
    }
  }
  if (doc.roster !== undefined) {
    if (!isObject(doc.roster)) problems.push('roster must be an object');
    else {
      for (const [stage, list] of Object.entries(doc.roster)) {
        if (!ROSTER_STAGES.includes(stage)) { problems.push(`roster.${stage} is not a stage with a roster (${ROSTER_STAGES.join(', ')})`); continue; }
        if (!Array.isArray(list)) { problems.push(`roster.${stage} must be a list of agent names`); continue; }
        for (const name of list) if (!AGENT_NAMES.includes(name)) problems.push(`roster.${stage}: unknown agent ${JSON.stringify(name)} (agents: ${AGENT_NAMES.join(', ')})`);
      }
    }
  }
  checkModels(problems, doc);
  if (doc.open !== undefined && (!Array.isArray(doc.open) || doc.open.some((item) => typeof item !== 'string'))) problems.push('open must be a list of strings');
  if (doc.firstJob !== undefined) check(problems, 'firstJob', doc.firstJob);
  return problems;
}

// A copy with every default filled. Unknown keys are kept; the always-on
// stages never appear under `stages`. Does not validate.
function normalize(doc) {
  const src = obj(doc);
  const out = { ...src };
  out.schema = src.schema === undefined ? 1 : src.schema;
  out.project = { ...DEFAULTS.project, ...obj(src.project) };
  out.people = (Array.isArray(src.people) ? src.people : []).map((person) => ({ ...DEFAULTS.person, ...obj(person) }));
  out.systems = { ...DEFAULTS.systems, ...obj(src.systems) };
  out.systems.remote = stripUserinfo(out.systems.remote); // never carry credentials into the agreement
  out.repo = { ...DEFAULTS.repo, ...obj(src.repo) };
  out.repo.checks = Array.isArray(out.repo.checks) ? [...out.repo.checks] : [];
  out.homes = Object.fromEntries(Object.entries({ ...DEFAULTS.homes, ...obj(src.homes) }).map(([key, value]) => [key, trimSlash(value)]));
  const stages = obj(src.stages);
  out.stages = {};
  for (const name of OPTIONAL_STAGES) out.stages[name] = { ...DEFAULT_STAGES[name], ...obj(stages[name]) };
  for (const [name, stage] of Object.entries(stages)) if (!(name in out.stages)) out.stages[name] = stage;
  const roster = obj(src.roster);
  out.roster = {};
  for (const stage of ROSTER_STAGES) out.roster[stage] = Array.isArray(roster[stage]) ? [...roster[stage]] : [];
  for (const [stage, list] of Object.entries(roster)) if (!(stage in out.roster)) out.roster[stage] = list;
  const models = obj(src.models);
  const modelEntry = (value) => (typeof value === 'string' ? { tier: value, effort: '' } : { ...MODEL_ENTRY, ...obj(value) });
  const mStages = obj(models.stages), mAgents = obj(models.agents);
  out.models = { stages: {}, agents: {}, map: {} };
  for (const name of OPTIONAL_STAGES) out.models.stages[name] = modelEntry(mStages[name]);
  for (const [name, value] of Object.entries(mStages)) if (!(name in out.models.stages)) out.models.stages[name] = value;
  for (const name of AGENT_NAMES) out.models.agents[name] = modelEntry(mAgents[name]);
  for (const [name, value] of Object.entries(mAgents)) if (!(name in out.models.agents)) out.models.agents[name] = value;
  for (const [platform, row] of Object.entries(obj(models.map))) out.models.map[platform] = isObject(row) ? { ...row } : row;
  out.open = Array.isArray(src.open) ? [...src.open] : [];
  out.firstJob = typeof src.firstJob === 'string' ? src.firstJob : '';
  return out;
}

// Read, parse, validate and normalize <root>/harness.json (or another file).
function load(root, file = path.join(root, HARNESS_FILE)) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (error) {
    if (error.code === 'ENOENT') return { ok: false, missing: true, message: MISSING_MESSAGE };
    return { ok: false, problems: [error.message], message: error.message };
  }
  let doc;
  try { doc = JSON.parse(raw); } catch (error) {
    const problem = `invalid JSON (${error.message})`;
    return { ok: false, problems: [problem], message: problem };
  }
  const problems = validate(doc);
  if (problems.length) return { ok: false, problems, message: problems.join('; ') };
  return { ok: true, harness: normalize(doc), file };
}

// True when the stage runs: the always-on two, and every other stage unless
// the agreement switched it off. Unknown names are off.
function stageOn(harness, name) {
  if (ALWAYS_ON.includes(name)) return true;
  if (!OPTIONAL_STAGES.includes(name)) return false;
  const stage = obj(obj(harness).stages)[name];
  return isObject(stage) ? stage.on !== false : true;
}
// Where specs, tickets and evidence live, relative to the root, defaults filled.
function homes(harness) {
  return Object.fromEntries(Object.entries({ ...DEFAULTS.homes, ...obj(obj(harness).homes) }).map(([key, value]) => [key, trimSlash(value)]));
}
// The names in the rosters of the stages that are on, sorted and unique.
function activeAgents(harness) {
  const h = obj(harness);
  const names = new Set();
  for (const stage of ROSTER_STAGES) {
    if (!stageOn(h, stage)) continue;
    const list = obj(h.roster)[stage];
    if (Array.isArray(list)) for (const name of list) if (typeof name === 'string') names.add(name);
  }
  return [...names].sort();
}
// The names of the people who accept results.
function acceptors(harness) {
  const people = obj(harness).people;
  return (Array.isArray(people) ? people : [])
    .filter((person) => isObject(person) && person.accepts === true && typeof person.name === 'string' && person.name.trim())
    .map((person) => person.name.trim());
}
// The entry points' convention for a load failure: one line, exit 3.
function die(message, exit = 3) {
  process.stderr.write(`${HARNESS_FILE}: ${message}\n`);
  process.exit(exit);
}

module.exports = {
  HARNESS_FILE, STAGES, ALWAYS_ON, OPTIONAL_STAGES, ROSTER_STAGES, AGENT_NAMES, KINDS, DEFAULT_STAGES, DEFAULTS, MISSING_MESSAGE,
  TIERS, MAP_TIERS, EFFORTS, PLATFORMS,
  load, validate, normalize, stageOn, homes, acceptors, activeAgents, die,
};
