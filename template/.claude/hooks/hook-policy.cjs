#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const mode = process.argv[2];
const input = fs.readFileSync(0, 'utf8');

function block(message) {
  const label = mode === 'ticket' ? 'ticket guard' : 'guardrail';
  process.stderr.write(`Blocked by PINCER ${label}: ${message}\n`);
  process.exit(2);
}

let payload;
try {
  payload = JSON.parse(input);
} catch {
  block('hook input is not valid JSON.');
}
if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
    typeof payload.tool_name !== 'string' || !payload.tool_input ||
    typeof payload.tool_input !== 'object' || Array.isArray(payload.tool_input)) {
  block('hook input must contain tool_name and a tool_input object.');
}

function lexShell(source) {
  const tokens = [];
  let word = '';
  let quote = '';
  const push = () => { if (word) tokens.push({ value: word }); word = ''; };
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = '';
      else if (ch === '\\' && quote === '"' && i + 1 < source.length) word += source[++i];
      else word += ch;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '\\' && i + 1 < source.length) { word += source[++i]; continue; }
    if (/\s/.test(ch)) {
      push();
      if (ch === '\n') tokens.push({ op: ';' });
      continue;
    }
    if ('|;&><()'.includes(ch)) {
      push();
      const pair = source.slice(i, i + 2);
      if (['||', '&&', '>>', '<<'].includes(pair)) { tokens.push({ op: pair }); i++; }
      else tokens.push({ op: ch });
      continue;
    }
    word += ch;
  }
  push();
  return tokens;
}

function shellCommands(source) {
  const commands = [];
  let words = [];
  let operators = [];
  const finish = (separator = '') => {
    if (words.length || operators.length) commands.push({ words, operators, separator });
    words = []; operators = [];
  };
  for (const token of lexShell(source)) {
    if (token.value !== undefined) words.push(token.value);
    else if (['|', ';', '&&', '||', '(', ')'].includes(token.op)) finish(token.op);
    else operators.push(token.op);
  }
  finish();
  return commands;
}

function commandParts(command) {
  const words = [...command.words];
  let i = 0;
  while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) i++;
  if (words[i] === 'env') {
    i++;
    while (i < words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i]) || words[i].startsWith('-'))) i++;
  }
  if (words[i] === 'sudo') {
    i++;
    while (i < words.length && words[i].startsWith('-')) i++;
  }
  while (['command', 'builtin', 'exec'].includes(words[i])) i++;
  // Transparent wrappers: the command they run is the one that matters.
  while (['nice', 'nohup', 'time', 'timeout', 'xargs'].includes(words[i])) {
    const wrapper = words[i++];
    while (i < words.length && words[i].startsWith('-')) {
      if (['-n', '-s', '-k', '--signal', '--kill-after', '-I', '-L', '-P', '-d', '-a'].includes(words[i])) i++;
      i++;
    }
    if (wrapper === 'timeout' && /^[0-9]/.test(words[i] || '')) i++;
  }
  const executable = words[i] ? path.basename(words[i]).toLowerCase() : '';
  return { executable, args: words.slice(i + 1), words };
}

// Index of a shell's -c flag, including bundled forms such as -lc or -ec.
function shellCommandFlag(args) {
  return args.findIndex(arg => /^-[A-Za-z]*c[A-Za-z]*$/.test(arg));
}

function gitSubcommand(args) {
  let i = 0, cdir = '';
  while (i < args.length) {
    if (args[i] === '-C') { cdir = args[i + 1] || ''; i += 2; }
    else if (args[i] === '-c' && /^alias\./.test(args[i + 1] || '')) return { name: 'alias', args: [], cdir };
    else if (['-c', '--git-dir', '--work-tree'].includes(args[i])) i += 2;
    else if (args[i].startsWith('-')) i++;
    else return { name: args[i], args: args.slice(i + 1), cdir };
  }
  return { name: '', args: [], cdir };
}

function dangerousReason(source, depth = 0) {
  if (depth > 2) return '';
  const commands = shellCommands(source);
  for (let i = 0; i < commands.length; i++) {
    const { executable, args, words } = commandParts(commands[i]);
    if ((executable === 'claude' || (executable === 'npx' && args.some(arg => arg === 'claude'))) &&
        words.includes('--dangerously-skip-permissions')) return 'permission bypass flags are not allowed.';
    if (executable === 'git') {
      const sub = gitSubcommand(args);
      if (sub.name === 'push' && sub.args.some(arg => arg === '-f' || arg === '--force' || arg.startsWith('--force=')))
        return 'force-push commands are not allowed.';
      if (sub.name === 'reset' && sub.args.includes('--hard') && sub.args.some(arg => /^origin\//.test(arg)))
        return 'hard resets to a remote branch are not allowed.';
    }
    if (executable === 'rm') {
      let recursive = false, force = false;
      const targets = [];
      for (const arg of args) {
        if (arg === '--recursive') recursive = true;
        else if (arg === '--force') force = true;
        else if (/^-[^-]/.test(arg)) { recursive ||= /[rR]/.test(arg.slice(1)); force ||= /f/.test(arg.slice(1)); }
        else if (arg !== '--') targets.push(arg);
      }
      if (recursive && force && targets.some(arg => arg.startsWith('/') || arg === '~' || arg.startsWith('~/') || arg === '$HOME' || arg.startsWith('$HOME/') || arg.startsWith('${HOME}')))
        return 'recursive forced deletion of an absolute or home path is not allowed.';
    }
    if (executable === 'chmod' && args.some(arg => /^(0?777|a\+rwx)$/.test(arg)))
      return 'mass permission changes are not allowed.';
    if (['sh', 'bash', 'zsh'].includes(executable)) {
      const c = shellCommandFlag(args);
      if (c !== -1 && typeof args[c + 1] === 'string') {
        const nested = dangerousReason(args[c + 1], depth + 1);
        if (nested) return nested;
      }
    }
    if (['curl', 'wget'].includes(executable) && commands[i].separator === '|') {
      const next = commandParts(commands[i + 1] || { words: [] }).executable;
      if (['sh', 'bash', 'zsh'].includes(next)) return 'downloading content directly into a shell is not allowed.';
    }
  }
  return '';
}

const TICKET_PATH = /(^|[\\/])tickets[\\/]T-[0-9]+[^\\/]*\.md$/;
// Runtime-owned state: local attempts under .pincer/, change records under
// .prd/changes/ and evaluation locators under .prd/evidence/changes/ are written
// only by pincer-runtime.cjs.
// The runtime owns .pincer/runtime/ and .pincer/backups/ (and the directory as a
// whole); .pincer/drafts/ is the agent's own scratch space for evidence drafts.
const RUNTIME_PATH = /(^|[\\/])\.pincer(?:[\\/](?:runtime|backups)(?:[\\/]|$)|[\\/]?$)/;
const BINDING_PATH = /(^|[\\/])\.prd[\\/](?:changes|evidence[\\/]changes)([\\/]|$)/;
const PROTECTED = ['status', 'started', 'last_check', 'verified', 'finished'];

function ticketPath(value) {
  return typeof value === 'string' && TICKET_PATH.test(value);
}
function runtimePath(value) {
  return typeof value === 'string' && (RUNTIME_PATH.test(value) || BINDING_PATH.test(value));
}

function stateFields(content) {
  const result = Object.fromEntries(PROTECTED.map(key => [key, []]));
  let scope = String(content ?? '');
  if (scope.startsWith('---\n')) {
    const end = scope.indexOf('\n---', 4);
    if (end !== -1) scope = scope.slice(4, end + 1);
  }
  for (const line of scope.split(/\r?\n/)) {
    const match = line.match(/^([a-z_]+):[ \t]*(.*)$/);
    if (match && PROTECTED.includes(match[1])) result[match[1]].push(match[2]);
  }
  return result;
}

const sameState = (a, b) => JSON.stringify(stateFields(a)) === JSON.stringify(stateFields(b));

function absoluteToolPath(file) {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return path.isAbsolute(file) ? file : path.resolve(root, file);
}

function existingContent(file) {
  try { return fs.readFileSync(absoluteToolPath(file), 'utf8'); }
  catch { return null; }
}

function applyEdit(content, oldText, newText, replaceAll = false) {
  if (typeof oldText !== 'string' || typeof newText !== 'string') block('edit payload must contain string old_string and new_string values.');
  if (!oldText) block('edit old_string must not be empty.');
  if (replaceAll) return content.split(oldText).join(newText);
  const index = content.indexOf(oldText);
  return index === -1 ? content : content.slice(0, index) + newText + content.slice(index + oldText.length);
}

function guardEdits(tool, toolInput) {
  const file = toolInput.file_path;
  if (typeof file !== 'string') block(`${tool} payload must contain a string file_path.`);
  if (runtimePath(file)) block('runtime state (.pincer/) and change bindings (.prd/changes/) are written only by pincer-runtime.cjs.');
  if (!ticketPath(file)) return;
  const before = existingContent(file);
  if (tool === 'Write') {
    if (typeof toolInput.content !== 'string') block('Write payload must contain string content.');
    if (before !== null) {
      if (!sameState(before, toolInput.content)) block('ticket lifecycle fields may only be changed by pincer-ticket.sh.');
    } else {
      const state = stateFields(toolInput.content);
      if (state.status.length !== 1 || state.status[0].split(/[ \t]+#/)[0].trim() !== 'open' ||
          PROTECTED.slice(1).some(key => state[key].length))
        block('new tickets must start with status: open and no lifecycle receipts or timestamps.');
    }
    return;
  }
  const edits = tool === 'MultiEdit' ? toolInput.edits : [toolInput];
  if (!Array.isArray(edits)) block('MultiEdit payload must contain an edits array.');
  let after = before ?? '';
  for (const edit of edits) {
    if (!edit || typeof edit !== 'object') block('each edit must be an object.');
    after = applyEdit(after, edit.old_string, edit.new_string, edit.replace_all === true);
  }
  if (!sameState(before ?? '', after)) block('ticket lifecycle fields may only be changed by pincer-ticket.sh.');
}

function isExactPincerCall(source) {
  const commands = shellCommands(source).filter(command => command.words.length);
  if (commands.length !== 1 || commands[0].separator) return false;
  const { executable, args } = commandParts(commands[0]);
  let words = [executable, ...args];
  if (['bash', 'sh', 'node'].includes(words[0])) words = words.slice(1);
  if (/pincer-runtime\.cjs$/.test(words[0] || '')) {
    return ['start', 'verify', 'done', 'bind', 'register', 'migrate', 'recover', 'check', 'evidence', 'change', 'resume'].includes(words[1]);
  }
  if (!/pincer-ticket\.sh$/.test(words[0] || '')) return false;
  const action = words[1];
  if (!['start', 'verify', 'done', 'bind'].includes(action)) return false;
  return action === 'bind' ? words.length === 4 : words.length === 3;
}

// A pathspec is "wide" when, after normalisation, it cannot be shown to stay
// outside tickets/: the whole tree, an absolute or unexpanded path, a glob at
// the top level, or anything whose first segment is tickets. Exclude entries
// never widen. `cdir` is a `git -C <dir>` prefix.
function widePathspec(arg, cdir = '') {
  if (/[$`]/.test(arg) || /[$`]/.test(cdir) || cdir.startsWith('/') || cdir.startsWith('~') || /^[A-Za-z]:[\\/]/.test(cdir)) return true;
  let p = arg;
  if (p.startsWith(':(')) {
    const end = p.indexOf(')');
    if (end < 0) return true;
    const magic = p.slice(2, end).split(',').map(s => s.trim());
    if (magic.includes('exclude')) return false;
    p = p.slice(end + 1);
    if (magic.includes('top')) cdir = '';
  } else if (p.startsWith(':/')) { p = p.slice(2); cdir = ''; }
  else if (p.startsWith(':!') || p.startsWith(':^')) return false;
  else if (p.startsWith(':')) p = p.slice(1);
  if (p.startsWith('/') || p.startsWith('~') || /^[A-Za-z]:[\\/]/.test(p)) return true;
  if (cdir) p = `${cdir}/${p}`;
  const segments = [];
  for (const segment of p.split(/[\\/]+/)) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') { if (!segments.length) return true; segments.pop(); continue; }
    segments.push(segment);
  }
  if (!segments.length) return true;
  if (/[*?[{]/.test(segments[0])) return true;
  return segments[0].toLowerCase() === 'tickets';
}

// Git forms that restore the working tree wholesale — and with it any ticket file
// whose failed attempt would be erased and whose revoked receipt would come back.
function wholeTreeRestore(sub) {
  const { name, args, cdir } = sub;
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') { positional.push(...args.slice(i + 1)); break; }
    if (['-e', '--exclude', '--source', '-b', '-B', '--orphan', '-c', '-C', '--conflict'].includes(arg)) { i++; continue; }
    if (arg.startsWith('-')) continue;
    positional.push(arg);
  }
  const force = args.some(arg => arg === '--force' || arg === '--discard-changes' || /^-[A-Za-z]*f[A-Za-z]*$/.test(arg));
  const fromFile = args.some(arg => arg === '--pathspec-from-file' || arg.startsWith('--pathspec-from-file='));
  const patch = args.some(arg => arg === '-p' || arg === '--patch');
  // `git checkout <ref>` / `git switch <ref>`: one positional, no `--`, no force flag is a branch switch,
  // allowed even through a variable; every pathspec form keeps the wide test.
  const branchSwitch = (name === 'checkout' || name === 'switch') && positional.length === 1 && !args.includes('--');
  const wide = branchSwitch ? widePathspec(positional[0].replace(/[$`]/g, 'x'), cdir) : positional.some(p => widePathspec(p, cdir));
  switch (name) {
    case 'alias': return true;
    case 'checkout': case 'switch': return force || fromFile || wide || (patch && positional.length === 0);
    case 'restore': return fromFile || wide || positional.length === 0;
    case 'reset': return args.some(arg => ['--hard', '--merge', '--keep'].includes(arg));
    case 'stash':
      if (args.some(arg => arg === '-h' || arg === '--help')) return false;
      return !['list', 'show', 'create', 'store'].includes(positional[0] || '');
    case 'clean': return force && (positional.length === 0 || wide);
    case 'checkout-index': return args.some(arg => arg === '--all' || /^-[A-Za-z]*a/.test(arg));
    case 'read-tree': return args.some(arg => arg === '--reset' || /^-[A-Za-z]*u/.test(arg));
    default: return false;
  }
}

function ticketShellMutation(source, depth = 0) {
  if (depth > 2) return false;
  if (isExactPincerCall(source)) return false;
  const commands = shellCommands(source);
  for (const command of commands) {
    const { executable, args, words } = commandParts(command);
    if (['sh', 'bash', 'zsh'].includes(executable)) {
      const c = shellCommandFlag(args);
      if (c !== -1 && typeof args[c + 1] === 'string' && ticketShellMutation(args[c + 1], depth + 1)) return true;
    }
    if (executable === 'eval' && ticketShellMutation(args.join(' '), depth + 1)) return true;
    if (executable === 'git') {
      const sub = gitSubcommand(args);
      if (wholeTreeRestore(sub)) return true;
      const viaXargs = command.words.some(word => path.basename(word).toLowerCase() === 'xargs');
      const stdinPathspec = !sub.args.some(arg => !arg.startsWith('-')) || sub.args[sub.args.length - 1] === '--';
      if (viaXargs && ['checkout', 'restore', 'clean'].includes(sub.name) && stdinPathspec) return true;
    }
    const hasTicket = words.some(ticketPath) || /(^|[\s'"`])tickets[\\/]T-[0-9]+[^\s'"`]*/.test(source) ||
      words.some(runtimePath) || /(^|[\s'"`=])\.pincer(?:[\\/](?:runtime|backups)(?:[\\/]|[\s'"`]|$)|[\\/]?(?:[\s'"`]|$))/.test(source) || /(^|[\s'"`=])\.prd[\\/](?:changes|evidence[\\/]changes)([\\/]|[\s'"`]|$)/.test(source);
    if (!hasTicket) continue;
    if (command.operators.some(op => op === '>' || op === '>>')) return true;
    if (['rm', 'mv', 'cp', 'install', 'truncate', 'touch', 'tee', 'ed', 'ex'].includes(executable)) return true;
    if (['python', 'python3', 'node', 'ruby'].includes(executable)) return true;
    if (['sed', 'perl'].includes(executable) && args.some(arg => /^-[^-]*i/.test(arg) || arg === '--in-place' || arg.startsWith('--in-place='))) return true;
    if (executable === 'git') {
      const sub = gitSubcommand(args).name;
      if (['checkout', 'restore', 'reset', 'clean'].includes(sub)) return true;
    }
  }
  return false;
}

if (mode === 'dangerous') {
  if (payload.tool_name !== 'Bash') process.exit(0);
  if (typeof payload.tool_input.command !== 'string') block('Bash payload must contain a string command.');
  const reason = dangerousReason(payload.tool_input.command);
  if (reason) block(reason);
} else if (mode === 'ticket') {
  if (['Edit', 'Write', 'MultiEdit'].includes(payload.tool_name)) guardEdits(payload.tool_name, payload.tool_input);
  else if (payload.tool_name === 'Bash') {
    if (typeof payload.tool_input.command !== 'string') block('Bash payload must contain a string command.');
    if (ticketShellMutation(payload.tool_input.command)) block('shell commands may not write, reset, or restore ticket files or runtime state (.pincer/, .prd/changes/), including whole-tree checkout/restore, reset --hard, stash, clean -f; use pincer-ticket.sh or pincer-runtime.cjs for lifecycle state.');
  }
} else {
  block('hook policy mode is invalid.');
}
