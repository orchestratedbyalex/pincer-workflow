'use strict';
// PINCER engine — model tiers (docs/engine.md, "Models"). The agreement names a
// tier per role; the library's models.json maps a tier to each platform's model
// name; the agreement's map overrides a row; a library agent file may carry a
// tier: default. Pure except the two readers. Dependency-free.
const fs = require('node:fs');
const path = require('node:path');
const harness = require('./harness.cjs');

const TABLE_FILE = 'models.json';
const { TIERS, MAP_TIERS, PLATFORMS, OPTIONAL_STAGES } = harness;
const SESSION = "the session's model";

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const filled = (value) => typeof value === 'string' && value.trim() !== '';

// The library's table. A missing entry is not a fault (the generator reports it
// when a tier needs it); a present entry that is not a non-empty string is.
function readTable(libraryDir) {
  const file = path.join(libraryDir, TABLE_FILE);
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (error) {
    if (error.code === 'ENOENT') return { ok: false, missing: true, problem: `${TABLE_FILE}: no such file` };
    return { ok: false, problem: `${TABLE_FILE}: ${error.message}` };
  }
  let table;
  try { table = JSON.parse(raw); } catch (error) { return { ok: false, problem: `${TABLE_FILE}: invalid JSON (${error.message})` }; }
  if (!isObject(table) || table.schema !== 1) return { ok: false, problem: `${TABLE_FILE}: schema must be 1` };
  for (const platform of PLATFORMS) {
    if (table[platform] === undefined) continue;
    if (!isObject(table[platform])) return { ok: false, problem: `${TABLE_FILE}: ${platform} must be an object` };
    for (const tier of MAP_TIERS) {
      const value = table[platform][tier];
      if (value !== undefined && !filled(value)) return { ok: false, problem: `${TABLE_FILE}: ${platform}.${tier} must be a non-empty string` };
    }
  }
  return { ok: true, table };
}

// The table with the agreement's map laid over it; a copy, the inputs untouched.
function overlay(table, map) {
  const out = { ...(isObject(table) ? table : {}) };
  for (const platform of PLATFORMS) {
    const row = { ...(isObject(out[platform]) ? out[platform] : {}) };
    const over = isObject(map) && isObject(map[platform]) ? map[platform] : {};
    for (const tier of MAP_TIERS) if (filled(over[tier])) row[tier] = over[tier];
    out[platform] = row;
  }
  return out;
}

// null: no model field (inherit or not set); undefined: the table has no entry.
function modelFor(table, platform, tier) {
  if (!tier || tier === 'inherit') return null;
  const row = isObject(table) && isObject(table[platform]) ? table[platform] : {};
  return filled(row[tier]) ? row[tier] : undefined;
}

// The tier: field of a library agent's frontmatter; '' when absent.
function libraryTier(libraryDir, name) {
  let text;
  try { text = fs.readFileSync(path.join(libraryDir, 'agents', `${name}.md`), 'utf8'); } catch { return ''; }
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const match = block && /^tier:\s*["']?([a-z]+)["']?\s*$/m.exec(block[1]);
  return match && TIERS.includes(match[1]) ? match[1] : '';
}

// What each role runs on: every optional stage that is on and every active
// agent. The agreement's tier wins, then the library's default, then ''.
function effective(doc, libraryDir) {
  const h = harness.normalize(doc);
  const out = { stages: {}, agents: {} };
  for (const stage of OPTIONAL_STAGES) {
    if (!harness.stageOn(h, stage)) continue;
    const entry = isObject(h.models.stages[stage]) ? h.models.stages[stage] : {};
    out.stages[stage] = { tier: filled(entry.tier) ? entry.tier : '', effort: filled(entry.effort) ? entry.effort : '' };
  }
  for (const name of harness.activeAgents(h)) {
    const entry = isObject(h.models.agents[name]) ? h.models.agents[name] : {};
    const agreed = filled(entry.tier) ? entry.tier : '';
    const fallback = agreed ? '' : libraryTier(libraryDir, name);
    out.agents[name] = { tier: agreed || fallback, effort: filled(entry.effort) ? entry.effort : '', source: agreed ? 'agreement' : fallback ? 'library' : 'none' };
  }
  return out;
}

// 'strong', 'strong/high', 'effort high', or '' for an unset role.
function describeEntry(entry) {
  const tier = entry && filled(entry.tier) ? entry.tier : '';
  const effort = entry && filled(entry.effort) ? entry.effort : '';
  if (tier && effort) return `${tier}/${effort}`;
  if (tier) return tier;
  if (effort) return `effort ${effort}`;
  return '';
}
const agentNames = (eff) => Object.keys(isObject(eff.agents) ? eff.agents : {}).sort();
const stageNames = (eff) => OPTIONAL_STAGES.filter((stage) => isObject(eff.stages) && eff.stages[stage]);

// The status line: stages, then agents; '' when nothing is set.
function statusLine(eff) {
  const stages = stageNames(eff).filter((s) => describeEntry(eff.stages[s])).map((s) => `${s} ${describeEntry(eff.stages[s])}`);
  const agents = agentNames(eff).filter((n) => describeEntry(eff.agents[n])).map((n) => `${n} ${describeEntry(eff.agents[n])}`);
  return [stages.join(', '), agents.join(', ')].filter(Boolean).join('; ');
}

// The agreement's Models line: stages, then agents grouped by tier.
function agreementLine(eff) {
  const onWhat = (tier) => (tier && tier !== 'inherit' ? tier : SESSION);
  const note = (entry) => (filled(entry.effort) ? ` (${entry.effort} effort)` : '');
  const list = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0]);
  const stages = stageNames(eff).filter((s) => describeEntry(eff.stages[s])).map((s) => `${s} on ${onWhat(eff.stages[s].tier)}${note(eff.stages[s])}`);
  const groups = [];
  for (const tier of [...TIERS, '']) {
    const names = agentNames(eff).filter((n) => describeEntry(eff.agents[n]) && (filled(eff.agents[n].tier) ? eff.agents[n].tier : '') === tier);
    if (names.length) groups.push(`${list(names.map((n) => `${n}${note(eff.agents[n])}`))} on ${onWhat(tier)}`);
  }
  if (!stages.length && !groups.length) return `${SESSION} everywhere.`;
  return [stages.join(', '), ...groups, `everything else on ${SESSION}.`].filter(Boolean).join('; ');
}

module.exports = { TABLE_FILE, readTable, overlay, modelFor, libraryTier, effective, describeEntry, statusLine, agreementLine };
