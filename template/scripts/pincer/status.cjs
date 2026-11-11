'use strict';
// PINCER engine — where the work stands (docs/engine.md, "Stage gate"), read
// from harness.json and the artifacts on disk. Read-only: nothing here writes
// a file or runs a check. Every stage skill runs the gate first.
const fs = require('node:fs');
const path = require('node:path');
const parse = require('./parse.cjs');
const harnessModule = require('./harness.cjs');
const models = require('./models.cjs');
const generate = require('./generate.cjs');

const SCRIPT = 'scripts/pincer-ticket.sh';
const { STAGES, ALWAYS_ON, HARNESS_FILE } = harnessModule;

// Only a Codex-only install unambiguously chooses dollar-style skill mentions.
// Mixed installs keep the shared slash spelling; shell paths are never rewritten.
function commandMentions(root, text) {
  const platforms = generate.manifestPlatforms(root);
  return platforms.length === 1 && platforms[0] === 'codex' ? generate.codexMentions(text) : text;
}

// Is a ticket's receipt current? Lifted from 0.7: the wording is what a done
// ticket that needs attention has always shown.
function readiness(text, fields) {
  const receipt = fields.verified || '';
  const attempt = fields.last_check || '';
  const hash = parse.blockHash(text);
  const fail = (message) => ({ ready: false, message });
  if (!attempt) return fail('missing latest verification outcome — re-run verify');
  const parts = attempt.split(/[ \t]+/);
  if (!(parts.length === 3 && parse.TIMESTAMP.test(parts[0]) && parts[1] === 'passed' && /^[a-f0-9]{12}$/.test(parts[2])) || parts[2] !== hash) {
    return fail(`latest verification: ${attempt} — re-run verify`);
  }
  if (!receipt) return fail('done without a verification receipt — re-run verify');
  const rparts = receipt.split(/[ \t]+/);
  if (!(rparts.length === 2 && parse.TIMESTAMP.test(rparts[0]) && /^[a-f0-9]{12}$/.test(rparts[1])) || rparts[1] !== hash) {
    return fail('stale or malformed verification receipt — re-run verify');
  }
  if (parse.unticked(text).length) return fail('unticked acceptance criteria — complete and re-run verify');
  return { ready: true, message: null };
}

const idOf = (file) => (path.basename(file).match(/^T-[0-9]+/) || [''])[0];
const readText = (root, file) => { try { return fs.readFileSync(path.join(root, file), 'utf8'); } catch (error) { return null; } };

function specEntries(root, specsDir) {
  const dir = path.join(root, specsDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.md')).sort().map((name) => {
    const file = path.posix.join(specsDir, name);
    const text = readText(root, file) || '';
    return { file, status: parse.frontmatterField(text, 'status') || null };
  });
}
function ticketEntry(root, file) {
  const text = readText(root, file);
  const entry = { id: idOf(file), file, status: null, started: null, verified: null, lastCheck: null, accepted: null, acceptedBy: null, ready: false, problem: null, depends: [] };
  if (text === null) { entry.problem = 'cannot read the file'; return entry; }
  const v = parse.validateTicket(file, text);
  const fields = v.fields;
  entry.status = fields.status || null;
  entry.started = fields.started || null;
  entry.verified = fields.verified || null;
  entry.lastCheck = fields.last_check || null;
  entry.accepted = fields.accepted || null;
  entry.acceptedBy = fields.accepted_by || null;
  entry.depends = parse.dependencies(fields);
  if (!v.ok) { entry.problem = v.problems.join('; '); return entry; }
  entry.id = fields.ticket;
  const r = readiness(text, fields);
  entry.ready = r.ready;
  entry.readiness = r.message;
  return entry;
}
function manifests(root, evidenceDir) {
  const dir = path.join(root, evidenceDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort()
    .map((name) => path.posix.join(evidenceDir, name, 'manifest.json'))
    .filter((file) => fs.existsSync(path.join(root, file)));
}

// The whole picture, as data. `harness` is null without a valid agreement;
// `harnessProblem` says why when the file exists but does not validate.
function gather(root) {
  const report = { name: path.basename(root), harness: null, harnessProblem: null, stages: {}, models: null, specs: [], tickets: [], evidence: [], warnings: [], next: '' };
  const loaded = harnessModule.load(root);
  let homes = harnessModule.homes(null);
  if (loaded.ok) {
    report.harness = loaded.harness;
    if (loaded.harness.project.name) report.name = loaded.harness.project.name;
    for (const name of STAGES) report.stages[name] = harnessModule.stageOn(loaded.harness, name) ? 'on' : 'off';
    report.models = models.effective(loaded.harness, generate.libraryDir(root));
    homes = harnessModule.homes(loaded.harness);
  } else if (!loaded.missing) {
    report.harnessProblem = loaded.message;
    report.warnings.push(`${HARNESS_FILE}: ${loaded.message}`);
  }
  report.specs = specEntries(root, homes.specs);
  report.tickets = parse.ticketFiles(root, homes.tickets).map((file) => ticketEntry(root, file));
  report.evidence = manifests(root, homes.evidence);
  for (const t of report.tickets) {
    if (t.problem) { report.warnings.push(`${t.file}: ${t.problem}`); continue; }
    if (t.status === 'done' && !t.ready) report.warnings.push(`${t.id} done: ${t.readiness}`);
    if (t.status === 'done' && !t.accepted) report.warnings.push(`${t.id} done without acceptance`);
  }
  report.next = commandMentions(root, nextCommand(report));
  return report;
}

// The one thing to do next, first rule that matches.
function nextCommand(report) {
  if (!report.harness) return '/pincer-blueprint';
  const tickets = report.tickets;
  const broken = tickets.find((t) => t.problem);
  if (broken) return `fix ${broken.file}`;
  const draft = report.stages.plan === 'on' && report.specs.find((s) => !['approved', 'built'].includes(s.status));
  if (report.stages.plan === 'on' && report.specs.length === 0 && tickets.length === 0) return '/pincer-plan <brief>';
  if (tickets.length === 0) {
    if (draft) return `/pincer-plan ${draft.file} (awaiting approval)`;
    return report.stages.narrow === 'on' ? '/pincer-narrow' : '/pincer-code';
  }
  const inProgress = tickets.find((t) => t.status === 'in_progress');
  if (inProgress) return `${SCRIPT} verify ${inProgress.id}`;
  if (tickets.some((t) => t.status === 'open')) return '/pincer-code';
  const stale = tickets.find((t) => t.status === 'done' && !t.ready);
  if (stale) return `${SCRIPT} verify ${stale.id}`;
  if (draft) return `/pincer-plan ${draft.file} (awaiting approval)`;
  if (report.stages.evaluate === 'on' && report.harness.stages.evaluate.evidence && report.evidence.length === 0) return '/pincer-evaluate';
  const unaccepted = tickets.find((t) => t.status === 'done' && !t.accepted);
  if (unaccepted) {
    // Acceptance is the floor even with release off: then the next step is the accept call itself.
    if (harnessModule.stageOn(report.harness, 'release')) return '/pincer-release';
    return `${SCRIPT} accept ${unaccepted.id} --by "<name>" --words "<their words>"`;
  }
  return 'all tickets done and accepted';
}

function ticketLine(t) {
  if (t.problem) return `${t.id || t.file} invalid: ${t.problem}`;
  let line = `${t.id} ${t.status}`;
  if (t.status === 'in_progress' && t.started) line += ` started ${t.started}`;
  if (t.verified) line += ` verified ${t.verified.split(/\s+/)[0]}`;
  if (t.acceptedBy) line += ` accepted by ${t.acceptedBy}`;
  return line;
}
function render(report) {
  const lines = [];
  const h = report.harness;
  lines.push(h ? `PINCER — ${report.name} (${h.project.kind})` : 'PINCER — no agreement yet');
  if (h) lines.push(`Stages: ${STAGES.map((name) => `${name} ${report.stages[name]}`).join(', ')}`);
  const tiers = report.models ? models.statusLine(report.models) : '';
  if (tiers) lines.push(`Models: ${tiers}`);
  if (report.specs.length) lines.push(`Specs: ${report.specs.map((s) => `${s.file} (${s.status || 'no status'})`).join(', ')}`);
  for (const t of report.tickets) lines.push(ticketLine(t));
  if (report.warnings.length) { lines.push('Warnings:'); for (const w of report.warnings) lines.push(`  ${w}`); }
  lines.push(`Next: ${report.next}`);
  return `${lines.join('\n')}\n`;
}

// The gate every stage runs first. Exit 0 and "on", or exit 3 and the reason;
// exit 2 for a name that is not a stage. The always-on stages pass without an
// agreement, because the blueprint is what writes it.
function stageGate(root, name) {
  if (!STAGES.includes(name)) return { exit: 2, message: `${name} is not a stage (${STAGES.join(', ')})` };
  if (ALWAYS_ON.includes(name)) return { exit: 0, message: 'on' };
  const loaded = harnessModule.load(root);
  if (!loaded.ok) return { exit: 3, message: loaded.missing ? commandMentions(root, loaded.message) : `${HARNESS_FILE}: ${loaded.message}` };
  if (!harnessModule.stageOn(loaded.harness, name)) return { exit: 3, message: `stage ${name} is off in ${HARNESS_FILE}` };
  return { exit: 0, message: 'on' };
}

module.exports = { readiness, gather, nextCommand, render, stageGate, commandMentions };
