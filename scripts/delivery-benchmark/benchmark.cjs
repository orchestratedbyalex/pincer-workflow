#!/usr/bin/env node
'use strict';
// Independent delivery benchmark harness (PRD v6, R-10). Usage:
//
//   node scripts/delivery-benchmark/benchmark.cjs <command> [options]
//
//   freeze        [--out <file>]                       write test/fixtures/delivery-benchmark/frozen.json
//   check-freeze                                       exit 1 when briefs, evaluators, harness or protocol drifted
//   schedule      [--json]                             the 36-run balanced order
//   prepare       --runs <dir> --run <id> [--kit <tgz|dir>] [--model m] [--tool t] [--tool-version v]
//                 [--cap turns_per_session=N] [--cap wall_clock_minutes=N] [--rerun <invalid run id>]
//   session       --runs <dir> --run <id> --name S1 (--start | --end [--exit n] [--transcript p])
//   stage         --runs <dir> --run <id> --name S2    apply the operator step that precedes a session
//   intervene     --runs <dir> --run <id> --session S1 --type clarification|reapproval|repair|operator --note "…"
//   effort        --runs <dir> --run <id> --set key=value …   (setup_minutes, tokens.input, unavailable.cost_usd=reason, …)
//   mark          --runs <dir> --run <id> --status invalid|unavailable --reason "…"
//   evaluate      --runs <dir> --run <id> [--candidate <sha>] [--evaluators <dir>] [--tool node=/path]
//   validate      (--runs <dir> [--run <id>] | <record.json> …)
//   report        --runs <dir> [--json]
//
// A run id is <brief>/pair-<n>/<arm>. The harness writes only under --runs; evaluator
// assets stay in the repository and are never copied into a workspace.
const fs = require('node:fs');
const path = require('node:path');
const lib = require('./lib.cjs');
const record = require('./record.cjs');
const { evaluateRun, DEFAULT_TOOLS } = require('./evaluate.cjs');
const report = require('./report.cjs');

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      if (opts[k] === undefined) opts[k] = v; else opts[k] = [].concat(opts[k], v);
    } else opts._.push(a);
  }
  return opts;
}
const fail = (msg, code = 2) => { process.stderr.write(`benchmark: ${msg}\n`); process.exit(code); };
const need = (opts, k) => { if (typeof opts[k] !== 'string') fail(`--${k} is required`); return opts[k]; };
const parseId = id => { const m = /^([a-z0-9-]+)\/pair-(\d+)\/(pincer|plain)$/.exec(id || ''); if (!m) fail(`run id must be <brief>/pair-<n>/<arm>: ${id}`); return { brief: m[1], pair: Number(m[2]), arm: m[3] }; };
const loadRecord = (runs, id) => { const f = path.join(lib.runDir(runs, id), 'record.json'); if (!fs.existsSync(f)) fail(`no record for ${id} under ${runs}`); return { file: f, rec: lib.readJson(f) }; };
const readFrozen = () => (fs.existsSync(lib.FROZEN) ? lib.readJson(lib.FROZEN) : null);
const list = v => (v === undefined ? [] : [].concat(v));

function frozenManifest(evaluatorsDir = lib.BRIEFS_DIR) {
  const briefs = {};
  for (const id of lib.briefIds(evaluatorsDir)) {
    const b = lib.loadBrief(id, evaluatorsDir);
    const d = lib.briefDigest(id, evaluatorsDir);
    briefs[id] = { digest: d.digest, evaluator: d.evaluator, sessions: b.sessions, files: d.files };
  }
  return { schema: 1, frozen: null, protocol: fs.existsSync(lib.PROTOCOL) ? lib.sha256(fs.readFileSync(lib.PROTOCOL)) : null, harness: lib.treeDigest(__dirname).digest, briefs };
}
function drift(frozen, current) {
  const out = [];
  if (!frozen) return ['no frozen manifest'];
  if (frozen.protocol !== current.protocol) out.push('docs/delivery-benchmark.md changed since the freeze');
  if (frozen.harness !== current.harness) out.push('scripts/delivery-benchmark/ changed since the freeze');
  for (const id of new Set([...Object.keys(frozen.briefs), ...Object.keys(current.briefs)])) {
    if (!frozen.briefs[id]) { out.push(`brief ${id} added since the freeze`); continue; }
    if (!current.briefs[id]) { out.push(`brief ${id} removed since the freeze`); continue; }
    if (frozen.briefs[id].digest !== current.briefs[id].digest) {
      const changed = Object.keys({ ...frozen.briefs[id].files, ...current.briefs[id].files }).filter(f => frozen.briefs[id].files[f] !== current.briefs[id].files[f]);
      out.push(`brief ${id} changed since the freeze: ${changed.join(', ')}`);
    }
  }
  return out;
}

function installKit(kit, runDirectory, ws) {
  let pkg, digest, source;
  if (/\.tgz$/.test(kit)) {
    const dest = path.join(runDirectory, 'kit');
    fs.rmSync(dest, { recursive: true, force: true }); fs.mkdirSync(dest, { recursive: true });
    const r = lib.sh('tar', ['-xzf', kit, '-C', dest]);
    if (r.status !== 0) fail(`cannot extract kit ${kit}: ${r.stderr}`);
    pkg = path.join(dest, 'package'); digest = lib.sha256(fs.readFileSync(kit)); source = `tarball ${path.basename(kit)}`;
  } else {
    pkg = path.resolve(kit);
    if (!fs.existsSync(path.join(pkg, 'template')) || !fs.existsSync(path.join(pkg, 'bin', 'pincer.js'))) fail(`${kit} is not a kit (needs bin/pincer.js and template/)`);
    digest = lib.sha256(`${lib.treeDigest(path.join(pkg, 'template')).digest}\n${lib.sha256(fs.readFileSync(path.join(pkg, 'bin', 'pincer.js')))}\n`); source = `directory ${pkg}`;
  }
  const r = lib.sh(process.execPath, [path.join(pkg, 'bin', 'pincer.js'), 'init', '--platform', 'claude'], { cwd: ws, env: { CI: '1' } });
  if (r.status !== 0) fail(`kit install failed: ${r.stdout}${r.stderr}`);
  for (const rel of ['AGENTS.md.new']) { const p = path.join(ws, rel); if (fs.existsSync(p)) fs.rmSync(p); }
  return { source, digest, version: (() => { try { return JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8')).version; } catch { return null; } })() };
}

function cmdPrepare(opts) {
  const runs = path.resolve(need(opts, 'runs'));
  const id = need(opts, 'run');
  const { brief: briefId, pair, arm } = parseId(id);
  const slot = lib.schedule().find(s => s.run === id) || null;
  if (!slot && pair <= lib.PAIRS) fail(`${id} is not a slot of the schedule`);
  if (!slot && pair > lib.MAX_PAIR) fail(`pair ${pair} exceeds the rerun limit ${lib.MAX_PAIR}`);
  if (!slot && typeof opts.rerun !== 'string') fail(`pair ${pair} is outside the schedule: pass --rerun <run id of the invalid run it replaces>`);
  const brief = lib.loadBrief(briefId);
  const dir = lib.runDir(runs, id);
  if (fs.existsSync(path.join(dir, 'record.json'))) fail(`${id} is already prepared (${dir}); a run is never replaced silently — use a new pair or mark this one invalid`);
  const ws = path.join(dir, 'workspace');
  fs.rmSync(ws, { recursive: true, force: true });
  fs.mkdirSync(ws, { recursive: true });
  brief.base.create(ws, lib);
  lib.write(ws, 'BRIEF.md', `# ${briefId}\n\n${brief.task}\n`);
  const projectBase = lib.commitAll(ws, 'Task brief');
  let kit = null;
  if (arm === 'pincer') {
    if (typeof opts.kit !== 'string') fail('a pincer run needs --kit <tgz|dir>');
    const k = installKit(opts.kit, dir, ws);
    kit = { source: k.source, digest: k.digest };
    lib.commitAll(ws, `Install PINCER kit${k.version ? ` v${k.version}` : ''}`);
  } else if (opts.kit) fail('a plain run installs no kit');
  const base = lib.git(ws, 'rev-parse', 'HEAD');
  const unrelated = brief.base.unrelated ? brief.base.unrelated(ws, lib) : {};
  const unrelatedDigests = Object.fromEntries(Object.entries(unrelated).map(([rel, e]) => [rel, e.kind === 'append' ? { kind: 'append', text: e.text } : { kind: 'untracked', digest: lib.sha256(e.content) }]));
  for (const rel of lib.walk(ws)) for (const held of lib.HELD_OUT) if (rel === held || rel.startsWith(`${held}/`) || rel.split('/').includes('evaluator')) fail(`workspace received a held-out file: ${rel}`);
  const caps = {};
  for (const c of list(opts.cap)) { const [k, v] = String(c).split('='); if (!['turns_per_session', 'wall_clock_minutes'].includes(k) || !Number.isFinite(Number(v))) fail(`bad --cap ${c}`); caps[k] = Number(v); }
  const rec = record.empty({ brief: briefId, pair, arm, order: slot ? slot.order : null, prompts: brief.prompts, environment: { model: typeof opts.model === 'string' ? opts.model : null, tool: typeof opts.tool === 'string' ? opts.tool : null, tool_version: typeof opts['tool-version'] === 'string' ? opts['tool-version'] : null, kit, caps: { turns_per_session: null, wall_clock_minutes: null, ...caps } }, workspace: { base, project_base: projectBase, candidate: null, unrelated_edits: unrelatedDigests } });
  if (!slot) rec.interventions.push({ type: 'operator', session: rec.sessions[0].name, at: lib.nowIso(), note: `rerun outside the schedule, replacing the invalid run ${opts.rerun}` });
  lib.writeJson(path.join(dir, 'record.json'), rec);
  process.stdout.write(`prepared ${id} (${slot ? `#${slot.order}` : `rerun of ${opts.rerun}`}) at ${dir}\n  workspace ${ws}\n  base ${base}${kit ? `\n  kit ${kit.digest} (${kit.source})` : ''}\n  sessions ${rec.sessions.map(s => s.name).join(', ')}\n`);
}

function cmdSession(opts) {
  const runs = path.resolve(need(opts, 'runs')); const id = need(opts, 'run'); const name = need(opts, 'name');
  const { file, rec } = loadRecord(runs, id);
  const s = rec.sessions.find(x => x.name === name);
  if (!s) fail(`session ${name} is not part of ${id} (${rec.sessions.map(x => x.name).join(', ')})`);
  if (opts.start === true) { if (s.started) fail(`session ${name} already started at ${s.started}; a session is never restarted silently`); s.started = lib.nowIso(); }
  else if (opts.end === true) { if (!s.started) fail(`session ${name} was not started`); if (s.ended) fail(`session ${name} already ended`); s.ended = lib.nowIso(); if (opts.exit !== undefined) s.exit = Number(opts.exit); if (typeof opts.transcript === 'string') s.transcript = opts.transcript; }
  else fail('session needs --start or --end');
  lib.writeJson(file, rec);
  process.stdout.write(`${id} ${name} ${opts.start === true ? 'started' : 'ended'} ${opts.start === true ? s.started : s.ended}\n`);
}

function cmdStage(opts) {
  const runs = path.resolve(need(opts, 'runs')); const id = need(opts, 'run'); const name = need(opts, 'name');
  const { file, rec } = loadRecord(runs, id);
  const brief = lib.loadBrief(rec.brief);
  const step = brief.base.between && brief.base.between[name];
  if (!step) fail(`${rec.brief} has no operator step before ${name}`);
  if (!rec.sessions.find(x => x.name === name)) fail(`session ${name} is not part of ${id}`);
  const note = step(path.join(lib.runDir(runs, id), 'workspace'), lib);
  rec.interventions.push({ type: 'operator', session: name, at: lib.nowIso(), note: String(note || `operator step before ${name}`).slice(0, lib.LIMITS.note) });
  lib.writeJson(file, rec);
  process.stdout.write(`${id}: operator step before ${name} applied — ${note}\n`);
}

function cmdIntervene(opts) {
  const runs = path.resolve(need(opts, 'runs')); const id = need(opts, 'run');
  const { file, rec } = loadRecord(runs, id);
  const type = need(opts, 'type'); const session = need(opts, 'session'); const note = need(opts, 'note');
  if (!lib.INTERVENTIONS.includes(type)) fail(`--type must be one of ${lib.INTERVENTIONS.join(', ')}`);
  if (!rec.sessions.find(x => x.name === session)) fail(`session ${session} is not part of ${id}`);
  rec.interventions.push({ type, session, at: lib.nowIso(), note: note.slice(0, lib.LIMITS.note) });
  lib.writeJson(file, rec);
  process.stdout.write(`${id}: ${type} in ${session} recorded (${rec.interventions.length} total)\n`);
}

function cmdEffort(opts) {
  const runs = path.resolve(need(opts, 'runs')); const id = need(opts, 'run');
  const { file, rec } = loadRecord(runs, id);
  for (const kv of list(opts.set)) {
    const at = String(kv).indexOf('='); if (at < 0) fail(`--set needs key=value: ${kv}`);
    const key = kv.slice(0, at), value = kv.slice(at + 1);
    if (['setup_minutes', 'review_minutes', 'active_minutes', 'elapsed_minutes', 'cost_usd'].includes(key)) { rec.effort[key] = value === 'null' ? null : Number(value); if (key === 'cost_usd' && value !== 'null') rec.effort.unavailable.cost_usd = null; }
    else if (key === 'tokens.input' || key === 'tokens.output') { rec.effort.tokens = rec.effort.tokens || { input: 0, output: 0 }; rec.effort.tokens[key.split('.')[1]] = Number(value); rec.effort.unavailable.tokens = null; }
    else if (key === 'unavailable.tokens') { rec.effort.tokens = null; rec.effort.unavailable.tokens = value; }
    else if (key === 'unavailable.cost_usd') { rec.effort.cost_usd = null; rec.effort.unavailable.cost_usd = value; }
    else fail(`unknown effort key ${key}`);
  }
  lib.writeJson(file, rec);
  process.stdout.write(`${id}: effort updated\n`);
}

function cmdMark(opts) {
  const runs = path.resolve(need(opts, 'runs')); const id = need(opts, 'run');
  const { file, rec } = loadRecord(runs, id);
  const status = need(opts, 'status'); const reason = need(opts, 'reason');
  if (!['invalid', 'unavailable'].includes(status)) fail('--status must be invalid or unavailable');
  rec.status = status; rec.reason = reason.slice(0, lib.LIMITS.note);
  lib.writeJson(file, rec);
  process.stdout.write(`${id}: marked ${status} — ${rec.reason}\n`);
}

async function cmdEvaluate(opts) {
  const runs = path.resolve(need(opts, 'runs')); const id = need(opts, 'run');
  const tools = DEFAULT_TOOLS();
  for (const t of list(opts.tool)) { const [k, v] = String(t).split('='); if (!k || !v) fail(`bad --tool ${t}`); tools[k] = v; }
  const evaluatorsDir = typeof opts.evaluators === 'string' ? path.resolve(opts.evaluators) : lib.BRIEFS_DIR;
  const { record: rec, dir } = await evaluateRun({ runsRoot: runs, id, candidate: typeof opts.candidate === 'string' ? opts.candidate : null, evaluatorsDir, tools });
  const frozen = readFrozen();
  const problems = record.problems(rec, { frozen });
  const ev = rec.evaluation;
  process.stdout.write(`${id}: ${ev.outcome} (candidate ${ev.candidate ? ev.candidate.slice(0, 7) : '?'}, evaluator ${ev.evaluator.digest.slice(0, 12)}${frozen && frozen.briefs[rec.brief] && frozen.briefs[rec.brief].evaluator === ev.evaluator.digest ? ' frozen' : ' NOT FROZEN'})\n`);
  const gist = d => { const lines = String(d).split('\n').filter(Boolean); return (lines.find(l => /^not ok/.test(l)) || lines[0] || '').slice(0, 160); };
  for (const c of ev.checks) process.stdout.write(`  ${c.result.padEnd(10)} ${c.id}${c.exit === null ? '' : ` exit ${c.exit}`} — ${gist(c.detail)}\n`);
  process.stdout.write(`  log ${path.join(dir, ev.log)} · status ${rec.status}\n`);
  if (problems.length) { for (const p of problems) process.stdout.write(`  record problem ${p.code}: ${p.detail}\n`); }
  process.exit(ev.outcome === 'accepted' ? 0 : 1);
}

function cmdValidate(opts) {
  const frozen = readFrozen();
  const files = [];
  if (typeof opts.runs === 'string') {
    const runs = path.resolve(opts.runs);
    if (typeof opts.run === 'string') files.push(path.join(lib.runDir(runs, opts.run), 'record.json'));
    else for (const rel of lib.walk(runs)) if (rel.endsWith('/record.json')) files.push(path.join(runs, rel));
  }
  files.push(...opts._.map(f => path.resolve(f)));
  if (!files.length) fail('validate needs --runs <dir> or record files');
  let bad = 0;
  for (const f of files) {
    let rec; try { rec = lib.readJson(f); } catch (e) { process.stdout.write(`${f}: RECORD_INVALID ${e.message}\n`); bad++; continue; }
    const p = record.problems(rec, { frozen });
    const a = record.acceptance(rec, { frozen });
    if (p.length) { bad++; for (const x of p) process.stdout.write(`${f}: ${x.code} ${x.detail}\n`); }
    else process.stdout.write(`${f}: ok ${rec.run} · status ${rec.status} · ${a.counted ? `counted, ${a.reason}` : `not counted (${a.reason})`}\n`);
  }
  process.exit(bad ? 1 : 0);
}

function cmdReport(opts) {
  const runs = path.resolve(need(opts, 'runs'));
  const rep = report.compute(runs, { frozen: readFrozen() });
  process.stdout.write(opts.json === true ? `${JSON.stringify(rep, null, 2)}\n` : report.render(rep));
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const opts = parseArgs(rest);
  switch (cmd) {
    case 'freeze': {
      const m = frozenManifest(); m.frozen = lib.nowIso();
      const out = typeof opts.out === 'string' ? path.resolve(opts.out) : lib.FROZEN;
      const previous = fs.existsSync(out) ? lib.readJson(out) : null;
      if (previous) m.history = [...(previous.history || []), { frozen: previous.frozen, protocol: previous.protocol, harness: previous.harness, briefs: Object.fromEntries(Object.entries(previous.briefs).map(([k, v]) => [k, v.digest])) }];
      lib.writeJson(out, m);
      process.stdout.write(`frozen ${Object.keys(m.briefs).length} briefs at ${m.frozen} → ${out}${previous ? ' (previous freeze kept in history)' : ''}\n`);
      return;
    }
    case 'check-freeze': {
      const d = drift(readFrozen(), frozenManifest());
      if (d.length) { for (const x of d) process.stdout.write(`drift: ${x}\n`); process.exit(1); }
      process.stdout.write(`ok: briefs, evaluators, harness and protocol match the freeze of ${readFrozen().frozen}\n`);
      return;
    }
    case 'schedule': {
      const s = lib.schedule();
      if (opts.json === true) process.stdout.write(`${JSON.stringify(s, null, 2)}\n`);
      else for (const r of s) process.stdout.write(`${String(r.order).padStart(2)}  ${r.run}\n`);
      return;
    }
    case 'prepare': return cmdPrepare(opts);
    case 'session': return cmdSession(opts);
    case 'stage': return cmdStage(opts);
    case 'intervene': return cmdIntervene(opts);
    case 'effort': return cmdEffort(opts);
    case 'mark': return cmdMark(opts);
    case 'evaluate': return cmdEvaluate(opts);
    case 'validate': return cmdValidate(opts);
    case 'report': return cmdReport(opts);
    default: {
      const usage = fs.readFileSync(__filename, 'utf8').split('\n').filter(l => l.startsWith('//')).slice(1).map(l => l.replace(/^\/\/ ?/, '')).join('\n');
      process.stdout.write(`${usage}\n`);
      process.exit(cmd ? 2 : 0);
    }
  }
}
main().catch(e => { process.stderr.write(`benchmark: ${e && e.stack ? e.stack : e}\n`); process.exit(2); });
