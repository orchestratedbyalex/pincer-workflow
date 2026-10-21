'use strict';
// PINCER blueprint — repository recon (docs/engine.md, "Recon"). Reads git, the
// filesystem and, only when asked, gh; decides greenfield or brownfield and says
// why; pre-fills the parts of harness.json it could see. Offline by default.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const util = require('./util.cjs');

// Directories never counted as source: dependencies, build output, the kit's own code.
const SKIP_DIRS = new Set(['node_modules', '.git', '.claude', 'vendor', '.venv', 'venv', 'dist', 'build', 'target', '__pycache__']);
const SKIP_PATHS = new Set(['scripts/pincer']);
const MAX_ENTRIES = 50000; // walk budget; past it sourceFiles is a lower bound
const LANGUAGES = {
  js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript',
  ts: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript', tsx: 'TypeScript',
  py: 'Python', go: 'Go', rs: 'Rust', java: 'Java', kt: 'Kotlin', scala: 'Scala',
  rb: 'Ruby', php: 'PHP', cs: 'C#', swift: 'Swift', m: 'Objective-C', dart: 'Dart',
  c: 'C', h: 'C', cpp: 'C++', cc: 'C++', hpp: 'C++', zig: 'Zig',
  sh: 'Shell', bash: 'Shell', zsh: 'Shell', sql: 'SQL', vue: 'Vue', svelte: 'Svelte',
  ex: 'Elixir', exs: 'Elixir', clj: 'Clojure', hs: 'Haskell', lua: 'Lua', r: 'R',
};
const TEST_PATH = /(^|\/)(tests?|spec|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)test_[^/]+\.py$|_test\.(py|go|rb|rs)$|_spec\.rb$/;
const DEPLOY_FILES = ['vercel.json', 'netlify.toml', 'fly.toml', 'Dockerfile', 'render.yaml', 'Procfile', 'serverless.yml', 'wrangler.toml'];
const INSTRUCTION_FILES = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.github/copilot-instructions.md', '.cursorrules', 'CONTRIBUTING.md', 'README.md'];
const LOCKFILES = [
  ['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['bun.lockb', 'bun'], ['bun.lock', 'bun'], ['package-lock.json', 'npm'],
  ['package.json', 'npm'], ['uv.lock', 'uv'], ['poetry.lock', 'poetry'], ['Pipfile', 'pipenv'], ['requirements.txt', 'pip'],
  ['Cargo.toml', 'cargo'], ['go.mod', 'go'], ['Gemfile', 'bundler'], ['composer.json', 'composer'],
];

const exists = (root, rel) => fs.existsSync(path.join(root, rel));
const isDir = (root, rel) => { try { return fs.statSync(path.join(root, rel)).isDirectory(); } catch { return false; } };
const listFiles = (root, rel) => (isDir(root, rel)
  ? fs.readdirSync(path.join(root, rel), { withFileTypes: true }).filter((e) => e.isFile()).map((e) => `${rel}/${e.name}`).sort()
  : []);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Source files, languages by count and whether anything looks like a test.
function walk(root) {
  const counts = new Map();
  let sourceFiles = 0, testFiles = 0, budget = MAX_ENTRIES;
  const visit = (rel) => {
    let entries;
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const entry of entries) {
      if (budget-- <= 0) return;
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !SKIP_PATHS.has(child)) visit(child);
      } else if (entry.isFile()) {
        const language = LANGUAGES[path.extname(entry.name).slice(1).toLowerCase()];
        if (!language) continue;
        sourceFiles += 1;
        counts.set(language, (counts.get(language) || 0) + 1);
        if (TEST_PATH.test(child)) testFiles += 1;
      }
    }
  };
  visit('');
  const languages = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([name]) => name);
  return { sourceFiles, languages, testFiles };
}

// The remote URL without any credentials that may sit before the host.
function stripUserinfo(url) {
  return url.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@]*@/i, '$1');
}

function gitFacts(root, unavailable) {
  const facts = { git: false, commits: 0, authors: [], branch: '', branches: [], mergeStyle: 'unknown', remote: null, forge: null, tags: 0 };
  if (util.tryGit(root, ['rev-parse', '--is-inside-work-tree']) !== 'true') { unavailable.push('git'); return facts; }
  facts.git = true;
  facts.commits = Number(util.tryGit(root, ['rev-list', '--count', 'HEAD'])) || 0;
  const authors = util.tryGit(root, ['log', '--format=%an']);
  facts.authors = authors ? [...new Set(authors.split('\n').filter(Boolean))].sort() : [];
  facts.branch = util.tryGit(root, ['symbolic-ref', '--short', '-q', 'HEAD']) || util.tryGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']) || '';
  const branches = util.tryGit(root, ['branch', '--format=%(refname:short)']);
  facts.branches = branches ? branches.split('\n').filter(Boolean).sort() : [];
  if (util.tryGit(root, ['log', '--merges', '-1', '--format=%H'])) facts.mergeStyle = 'merge';
  else if (facts.commits >= 5) facts.mergeStyle = 'squash-or-rebase';
  const remotes = (util.tryGit(root, ['remote']) || '').split('\n').filter(Boolean);
  const remoteName = remotes.includes('origin') ? 'origin' : remotes[0];
  const url = remoteName ? util.tryGit(root, ['remote', 'get-url', remoteName]) : null;
  if (url) {
    facts.remote = stripUserinfo(url);
    facts.forge = /(^|@|\/\/)github\.com[:/]/i.test(facts.remote) ? 'github' : 'other';
  }
  const tags = util.tryGit(root, ['tag']);
  facts.tags = tags ? tags.split('\n').filter(Boolean).length : 0;
  return facts;
}

// A workflow deploys when its file name, its name, a job id or an action it uses says so.
function workflowDeploys(root, rel) {
  let text;
  try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return false; }
  const hits = [path.basename(rel, path.extname(rel))];
  let inJobs = false;
  for (const line of text.split('\n')) {
    const name = /^\s*name:\s*(.+)$/.exec(line);
    const uses = /^\s*-?\s*uses:\s*(.+)$/.exec(line);
    if (name) hits.push(name[1]);
    if (uses) hits.push(uses[1]);
    if (/^jobs:\s*$/.test(line)) { inJobs = true; continue; }
    if (/^\S/.test(line)) inJobs = false;
    const job = inJobs && /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (job) hits.push(job[1]);
  }
  return hits.some((hit) => /deploy|pages/i.test(hit));
}

function codeFacts(root) {
  const workflows = listFiles(root, '.github/workflows').filter((f) => /\.ya?ml$/.test(f));
  const ci = [...workflows, ...(exists(root, '.gitlab-ci.yml') ? ['.gitlab-ci.yml'] : []), ...listFiles(root, '.circleci')];
  const deploy = [...workflows.filter((f) => workflowDeploys(root, f)), ...DEPLOY_FILES.filter((f) => exists(root, f))].sort();
  const lock = LOCKFILES.find(([file]) => exists(root, file));
  const packageManager = lock ? lock[1] : null;
  const pkg = util.readJson(path.join(root, 'package.json'));
  let runner = null;
  if (pkg && pkg.scripts && typeof pkg.scripts.test === 'string' && pkg.scripts.test.trim()) runner = `${['pnpm', 'yarn', 'bun'].includes(packageManager) ? packageManager : 'npm'} test`;
  else if (exists(root, 'pytest.ini') || exists(root, 'pyproject.toml')) runner = 'pytest';
  else if (exists(root, 'Cargo.toml')) runner = 'cargo test';
  else if (exists(root, 'go.mod')) runner = 'go test ./...';
  const walked = walk(root);
  return {
    ci, deploy,
    tests: { present: walked.testFiles > 0, runner },
    languages: walked.languages,
    packageManager,
    sourceFiles: walked.sourceFiles,
    envExample: ['.env.example', '.env.sample', '.env.template'].some((f) => exists(root, f)),
    instructions: [...INSTRUCTION_FILES.filter((f) => exists(root, f)), ...(isDir(root, 'docs') ? ['docs/'] : [])].sort(),
    name: pkg && typeof pkg.name === 'string' && pkg.name.trim() ? pkg.name.trim() : path.basename(root),
  };
}

// gh is consulted only when the caller allowed the network and gh is on PATH.
function ghFacts(root, branch, network, unavailable) {
  const facts = { available: false, issues: null, prs: null, protection: null };
  const gh = (args) => {
    try { return execFileSync('gh', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 }); } catch (error) { return { error }; }
  };
  if (!network || gh(['--version']).error) { unavailable.push('gh'); return facts; }
  facts.available = true;
  const count = (args) => { const r = gh(args); if (r.error) return null; try { return JSON.parse(r).length; } catch { return null; } };
  facts.issues = count(['issue', 'list', '--state', 'all', '--limit', '100', '--json', 'number']);
  facts.prs = count(['pr', 'list', '--state', 'all', '--limit', '100', '--json', 'number']);
  // Protection is asked about the forge's default branch; the local branch may not exist there.
  const view = gh(['repo', 'view', '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name']);
  const target = (!view.error && view.trim()) || branch;
  if (target) {
    const r = gh(['api', `repos/{owner}/{repo}/branches/${target}/protection`]);
    if (!r.error) facts.protection = true;
    else if (/not protected/i.test(`${r.error.stdout || ''}${r.error.stderr || ''}`)) facts.protection = false;
  }
  if (facts.issues === null && facts.prs === null && facts.protection === null) unavailable.push('gh');
  return facts;
}

// Brownfield when there is history and code, or CI, or something that deploys.
function classify(facts) {
  const reasons = [];
  const commits = facts.commits || 0, sourceFiles = facts.sourceFiles || 0;
  const ci = facts.ci || [], deploy = facts.deploy || [];
  const history = facts.git !== false && commits >= 5 && sourceFiles >= 1;
  if (history) reasons.push(`${plural(commits, 'commit')} and ${plural(sourceFiles, 'source file')}: there is history and code to respect.`);
  if (ci.length) reasons.push(`CI is configured (${ci.join(', ')}).`);
  if (deploy.length) reasons.push(`Something deploys (${deploy.join(', ')}): a running system to respect.`);
  if (history || ci.length || deploy.length) return { kind: 'brownfield', reasons };
  if (facts.git === false) reasons.push(sourceFiles ? `Not a git repository: ${plural(sourceFiles, 'source file')} but no history to respect.` : 'Not a git repository: no history to respect.');
  else if (commits < 5) reasons.push(`${plural(commits, 'commit')} and ${plural(sourceFiles, 'source file')}: the first real job is also the first trace.`);
  else reasons.push(`${plural(commits, 'commit')} but no source files: there is no code to respect yet.`);
  reasons.push('No CI or deploy configuration.');
  return { kind: 'greenfield', reasons };
}

// The answers recon can fill in before the interview; the developer confirms each.
function prefill(facts, kind) {
  const out = {
    project: { name: facts.name, kind },
    systems: { forge: facts.forge === 'github' ? 'github' : facts.remote ? 'other' : 'none', ci: facts.ci.length > 0 },
    repo: {},
  };
  if (facts.remote) out.systems.remote = facts.remote;
  if (facts.mergeStyle === 'merge') out.repo.merge = 'merge';
  if (facts.gh.prs > 0) out.repo.pr = true;
  if (facts.tests.runner) out.repo.checks = [facts.tests.runner];
  return out;
}

function recon(root, { network = false } = {}) {
  const unavailable = [];
  const git = gitFacts(root, unavailable);
  const code = codeFacts(root);
  const { name, ...rest } = code;
  const facts = { ...git, ...rest, gh: ghFacts(root, git.branch, network, unavailable) };
  const { kind, reasons } = classify(facts);
  return { kind, reasons, facts, prefill: prefill({ ...facts, name }, kind), unavailable };
}

function render(result) {
  const lines = [result.kind, ...result.reasons.map((r) => `- ${r}`)];
  if (result.unavailable.length) lines.push(`could not see: ${result.unavailable.join(', ')}`);
  return `${lines.join('\n')}\n`;
}

module.exports = { recon, classify, prefill, render, stripUserinfo, walk, SKIP_DIRS, LANGUAGES };
