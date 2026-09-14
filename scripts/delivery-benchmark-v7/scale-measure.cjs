'use strict';
// PRD v7 T-90/T-91 — how the two additive surfaces scale with change size.
//
//   node scripts/delivery-benchmark-v7/scale-measure.cjs <kit-dir>
//
// Generates strict changes of 3, 10, 20 and 40 scenarios against a kit, then measures: the bytes a map author must read to
// author by hand vs the draft that replaces that reading, and full vs brief resume.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');
const KIT = process.argv[2];
const sizes = [3, 10, 20, 40];
const rows = [];
for (const n of sizes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pincer-scale-'));
  fs.mkdirSync(path.join(dir, 'scripts/pincer-runtime'), { recursive: true });
  for (const f of ['pincer-runtime.cjs', 'pincer-evidence.cjs', 'pincer-ticket.sh', 'pincer-status.sh']) fs.copyFileSync(path.join(KIT, f), path.join(dir, 'scripts', f));
  for (const f of fs.readdirSync(path.join(KIT, 'pincer-runtime'))) fs.copyFileSync(path.join(KIT, 'pincer-runtime', f), path.join(dir, 'scripts/pincer-runtime', f));
  const w = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const sh = (cmd, args) => spawnSync(cmd, args, { cwd: dir, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  // n scenarios over ceil(n/5) requirements, one ticket each, one shared check.
  const reqs = []; const map = { schema: 1, change: 'prd-v1', prd: '.prd/prd-v1.md', scenarios: {}, scope: {}, tickets: {}, checks: { 'C-01': { kind: 'command', required: true, command: 'test "$(cat value.txt)" = good', timeout: 60, cwd: null, obligation: null, note: null } } };
  const perReq = 5;
  for (let r = 1; r * perReq - perReq < n; r++) {
    const rows2 = [];
    for (let k = 1; k <= perReq; k++) {
      const i = (r - 1) * perReq + k; if (i > n) break;
      const sid = `S-${String(i).padStart(2, '0')}`, tid = `T-${String(i).padStart(2, '0')}`;
      rows2.push(`- **${sid}:** Scenario ${i} states one observable outcome of requirement ${r}.`);
      map.scenarios[sid] = { tickets: [tid], checks: ['C-01'] };
      map.tickets[tid] = { role: 'implements', rationale: null };
      w(`tickets/${tid}-work.md`, `---\nticket: ${tid}\nstatus: open\nsize: S\nprd: .prd/prd-v1.md\ndepends_on: []\n---\n\n## Objective\nDeliver scenario ${i}.\n\n## Context\n- Implements: ${sid}\n\n## Acceptance Criteria\n- [x] behaves as specified\n\n## Verification\n\`\`\`bash\ntest "$(cat value.txt)" = good\n\`\`\`\n`);
    }
    if (rows2.length) reqs.push(`### R-${String(r).padStart(2, '0')} — Requirement ${r}\n\n${rows2.join('\n')}\n`);
  }
  w('.prd/prd-v1.md', `---\nversion: 1\nstatus: ticketed\ndate: 2026-09-14\n---\n# Scale PRD\n\n## 1. Problem\n\nA change of ${n} scenarios.\n\n## 4. Requirements\n\n${reqs.join('\n')}\n`);
  w('.prd/coverage/prd-v1.json', `${JSON.stringify(map, null, 2)}\n`);
  w('value.txt', 'good\n'); w('.gitignore', '.pincer/\n');
  sh('git', ['init', '-q', '-b', 'main']); sh('git', ['config', 'user.email', 't@e.invalid']); sh('git', ['config', 'user.name', 't']); sh('git', ['config', 'commit.gpgsign', 'false']);
  sh('git', ['add', '-A']); sh('git', ['commit', '-q', '-m', 'base']);
  const RT = path.join(dir, 'scripts/pincer-runtime.cjs');
  sh(process.execPath, [RT, 'register', '--prd', '.prd/prd-v1.md']);
  sh(process.execPath, [RT, 'change', 'select', 'prd-v1']);
  // Source a hand author must read: the PRD plus every ticket file.
  const source = fs.statSync(path.join(dir, '.prd/prd-v1.md')).size
    + fs.readdirSync(path.join(dir, 'tickets')).reduce((t, f) => t + fs.statSync(path.join(dir, 'tickets', f)).size, 0);
  const draft = sh(process.execPath, [RT, 'coverage', 'scaffold', '--change', 'prd-v1']);
  // Adopt so resume has a strict report to render.
  sh('git', ['add', '-A']); sh('git', ['commit', '-q', '-m', 'map']);
  sh(process.execPath, [RT, 'coverage', 'adopt', '--apply', '--change', 'prd-v1']);
  const cur = () => JSON.parse(sh(process.execPath, [RT, 'resume', '--json']).stdout).agreement.current;
  sh(process.execPath, [RT, 'change', 'authorize', 'prd-v1', '--agreement', cur(), '--reference', 'op', '--excerpt', 'go']);
  sh(process.execPath, [RT, 'change', 'activate', 'prd-v1']);
  const full = sh(process.execPath, [RT, 'resume']).stdout.length;
  const brief = sh(process.execPath, [RT, 'resume', '--brief']).stdout.length;
  const fullJson = sh(process.execPath, [RT, 'resume', '--json']).stdout.length;
  const briefJson = sh(process.execPath, [RT, 'resume', '--brief', '--json']).stdout.length;
  rows.push({ n, source, draft: draft.stdout.length, map: fs.statSync(path.join(dir, '.prd/coverage/prd-v1.json')).size, full, brief, fullJson, briefJson });
}
console.log('scenarios | source-to-read | draft | map | resume | brief | saved | resume --json | brief --json | saved');
for (const r of rows) console.log(`${String(r.n).padStart(9)} | ${String(r.source).padStart(14)} | ${String(r.draft).padStart(5)} | ${String(r.map).padStart(4)} | ${String(r.full).padStart(6)} | ${String(r.brief).padStart(5)} | ${String(Math.round((1 - r.brief / r.full) * 100) + '%').padStart(5)} | ${String(r.fullJson).padStart(13)} | ${String(r.briefJson).padStart(12)} | ${String(Math.round((1 - r.briefJson / r.fullJson) * 100) + '%').padStart(5)}`);
