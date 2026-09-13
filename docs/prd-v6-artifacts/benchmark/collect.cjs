#!/usr/bin/env node
'use strict';
// Copies the reviewable parts of the live runs into this artifact directory, sanitized:
//   node collect.cjs <runs-root>
// Per run: record.json, evaluation.log, logs/<S>.prompt.txt, logs/<S>.json (session id,
// turns, duration, cost, usage, is_error, result text), logs/<S>.commands.txt,
// logs/<S>.git-log.txt, logs/<S>.git-status.txt, logs/<S>.err, logs/evaluate.out,
// logs/stage.out. Workspaces are not copied. Scratchpad paths, the home directory and the
// hostname are replaced. Then report.md and report.json from the harness.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const runsRoot = path.resolve(process.argv[2]);
const here = __dirname;
const out = path.join(here, 'runs');
const repo = path.resolve(here, '..', '..', '..');
const replacements = [[runsRoot, '<runs>'], [path.dirname(runsRoot), '<scratchpad>'], [os.homedir(), '~'], [os.hostname(), '<host>']].filter(([a]) => a);
// Literal replacements first, then any absolute path that still names a scratchpad or a
// home directory — nested sessions write their own flattened forms of both.
const PATHS = [/\/private\/tmp\/claude-\d+\/[^\s"'`)\]]*/g, /\/tmp\/claude-\d+\/[^\s"'`)\]]*/g, /\/Users\/[A-Za-z0-9._-]+\/[^\s"'`)\]]*/g, /\/home\/[A-Za-z0-9._-]+\/[^\s"'`)\]]*/g, /\/var\/folders\/[^\s"'`)\]]*/g];
// Account-state notices name a wall-clock time and a timezone; the reason is kept as the
// record of why a run was invalidated, the time and region are not.
const REDACT = [[/(session limit|usage limit)([^"\\]{0,12})resets [^"\\)]*\([^"\\)]*\)/gi, (m, k, s) => `${k}${s}resets <time>`]];
const clean = s => REDACT.reduce((t, [re, to]) => t.replace(re, to), PATHS.reduce((t, re) => t.replace(re, '<path>'), replacements.reduce((t, [a, b]) => t.split(a).join(b), s)));
const lib = require(path.join(repo, 'scripts', 'delivery-benchmark', 'lib.cjs'));
fs.rmSync(out, { recursive: true, force: true });
let n = 0;
for (const rel of lib.walk(runsRoot)) {
  if (!rel.endsWith('/record.json')) continue;
  const dir = path.join(runsRoot, path.dirname(rel));
  const dest = path.join(out, path.dirname(rel));
  fs.mkdirSync(path.join(dest, 'logs'), { recursive: true });
  const rec = JSON.parse(fs.readFileSync(path.join(dir, 'record.json'), 'utf8'));
  fs.writeFileSync(path.join(dest, 'record.json'), clean(JSON.stringify(rec, null, 2)) + '\n');
  for (const f of ['evaluation.log']) if (fs.existsSync(path.join(dir, f))) fs.writeFileSync(path.join(dest, f), clean(fs.readFileSync(path.join(dir, f), 'utf8')));
  const logs = path.join(dir, 'logs');
  if (fs.existsSync(logs)) for (const f of fs.readdirSync(logs)) {
    const src = path.join(logs, f);
    if (f.endsWith('.json')) {
      let j = null; try { j = JSON.parse(fs.readFileSync(src, 'utf8')); } catch { fs.writeFileSync(path.join(dest, 'logs', f), clean(fs.readFileSync(src, 'utf8'))); continue; }
      const kept = { session_id: j.session_id, num_turns: j.num_turns, duration_ms: j.duration_ms, duration_api_ms: j.duration_api_ms, total_cost_usd: j.total_cost_usd, usage: j.usage, is_error: j.is_error, subtype: j.subtype, result: j.result };
      fs.writeFileSync(path.join(dest, 'logs', f), clean(JSON.stringify(kept, null, 2)) + '\n');
    } else if (/\.(txt|out|err)$/.test(f)) fs.writeFileSync(path.join(dest, 'logs', f), clean(fs.readFileSync(src, 'utf8')));
  }
  n++;
}
const bm = path.join(repo, 'scripts', 'delivery-benchmark', 'benchmark.cjs');
for (const [args, file] of [[['report', '--runs', runsRoot], 'report.md'], [['report', '--runs', runsRoot, '--json'], 'report.json'], [['validate', '--runs', runsRoot], 'validate.out']]) {
  const r = spawnSync(process.execPath, [bm, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(path.join(here, file), clean(r.stdout + r.stderr));
}
process.stdout.write(`collected ${n} runs into ${path.relative(repo, out)}; report.md, report.json, validate.out written\n`);
