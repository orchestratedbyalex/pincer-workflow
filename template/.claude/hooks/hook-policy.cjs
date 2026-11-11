#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
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

// The substitutions in text the shell expands the way it does between double
// quotes: the inside of ${…} and the body of a here-document whose delimiter is
// not quoted. What they hold runs, wherever the text goes.
function embedded(text) {
  const subs = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') i++;
    else if (text[i] === '$' && text[i + 1] === '(') {
      const inner = lexShell(text, i + 2, true, text[i + 2] === '(');
      subs.push(text.slice(i + 2, inner.end));
      i = inner.end;
    } else if (text[i] === '`') {
      let end = i + 1;
      while (end < text.length && text[end] !== '`') end += text[end] === '\\' ? 2 : 1;
      subs.push(text.slice(i + 1, end).replace(/\\`/g, '`'));
      i = end;
    }
  }
  return subs;
}

// What ends one command and starts the next. A single `&` does, like `;`.
const SEPARATORS = ['|', '|&', ';', ';;', '&&', '||', '&', '(', ')'];
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=/;

// Reads a shell line into words and operators. A word is `computed` when the
// shell works part of it out ($VAR, ${…}, $(…), `…`, $'…', a leading ~), `glob`
// when it holds an unquoted pattern character, and carries in `subs` the commands
// inside its substitutions, which are judged as commands of their own. The body of
// a here-document is kept on its `<<` operator. A comment runs to the end of its
// line. With `stop` the scan ends at the `)` that closes a substitution;
// `arithmetic` is `$((…))`, where `<<` is a shift and opens no here-document.
//
// The reader must never take for text what the shell takes for a command. Where
// the two could differ it reads on: a here-document whose end is not found has no
// body, only space, tab and newline separate words, and `<<` inside `$[…]`, `((…))`
// or a subscript is arithmetic.
function lexShell(source, from = 0, stop = false, arithmetic = false) {
  const tokens = [];
  const waiting = [];
  let word = null;
  let parens = 0;
  let cases = 0; // `case … esac` being read: the `)` of a pattern closes nothing
  let shift = null; // the paren depth outside the ((…)) being read
  let i = from;
  const open = () => (word ??= { value: '', computed: false, glob: false, quoted: false, subs: [] });
  const starts = () => { const last = tokens[tokens.length - 1]; return !last || (last.op ? SEPARATORS.includes(last.op) : ASSIGNMENT.test(last.value)); };
  const push = () => {
    if (word && word.value) {
      if (!word.quoted && word.value === 'case' && starts()) cases++;
      if (!word.quoted && word.value === 'esac' && cases) cases--;
      tokens.push(word);
    }
    word = null;
  };
  // The index after the } that closes the ${ whose inside starts at `start`.
  const closing = (start, quotedOutside) => {
    let depth = 1;
    for (let at = start; at < source.length; at++) {
      const ch = source[at];
      if (ch === '\\') at++;
      else if (ch === "'" && !quotedOutside) { const end = source.indexOf("'", at + 1); if (end === -1) return source.length; at = end; }
      else if (ch === '"') { for (at++; at < source.length && source[at] !== '"'; at++) if (source[at] === '\\') at++; }
      else if (ch === '$' && source[at + 1] === '{') { depth++; at++; }
      else if (ch === '$' && source[at + 1] === '(') at = lexShell(source, at + 2, true, source[at + 2] === '(').end;
      else if (ch === '`') { for (at++; at < source.length && source[at] !== '`'; at++) if (source[at] === '\\') at++; }
      else if (ch === '}' && --depth === 0) return at + 1;
    }
    return source.length;
  };
  const dollar = (quotedOutside) => {
    const current = open();
    current.computed = true;
    if (source[i + 1] === '(') {
      const inner = lexShell(source, i + 2, true, source[i + 2] === '(');
      current.subs.push(source.slice(i + 2, inner.end));
      current.value += '$()';
      i = inner.end;
    } else if (source[i + 1] === '{') {
      const end = closing(i + 2, quotedOutside);
      current.subs.push(...embedded(source.slice(i + 2, end)));
      current.value += source.slice(i, end);
      i = end - 1;
    } else current.value += '$';
  };
  const backtick = () => {
    let end = i + 1;
    while (end < source.length && source[end] !== '`') end += source[end] === '\\' ? 2 : 1;
    const current = open();
    current.computed = true;
    current.subs.push(source.slice(i + 1, end).replace(/\\`/g, '`'));
    current.value += '$()';
    i = end;
  };
  // The bodies of the here-documents opened on the line that just ended.
  const bodies = () => {
    for (const doc of waiting.splice(0)) {
      const at = tokens.indexOf(doc.op);
      const named = tokens[at + 1] && tokens[at + 1].value !== undefined ? tokens[at + 1] : null;
      // The shell does not expand a delimiter, so one written with $ or ` cannot be matched
      // here, and one that is missing is a syntax error: nothing is taken as a body then.
      if (!named || named.computed) continue;
      const lines = [];
      let next = i + 1;
      let found = -1;
      while (next < source.length) {
        let end = source.indexOf('\n', next);
        if (end === -1) end = source.length;
        const line = source.slice(next, end);
        const text = doc.op.op === '<<-' ? line.replace(/^\t+/, '') : line;
        // inside a substitution some shells take `EOF)` for the last line
        if (text === named.value) { found = end; break; }
        if (stop && text.startsWith(`${named.value})`)) { found = end - text.length + named.value.length - 1; break; }
        lines.push(line);
        next = end + 1;
      }
      // No last line: the lines that follow are read as the commands they may be.
      if (found === -1) continue;
      doc.op.body = lines.join('\n');
      // quoting any part of the delimiter turns expansion off for the whole body
      doc.op.subs = named.quoted || named.escaped ? [] : embedded(doc.op.body);
      i = Math.min(found, source.length - 1);
    }
  };
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === "'") {
      const end = source.indexOf("'", i + 1);
      const close = end === -1 ? source.length : end;
      open().value += source.slice(i + 1, close);
      word.quoted = true;
      i = close;
      continue;
    }
    if (ch === '"') {
      open().quoted = true;
      for (i++; i < source.length && source[i] !== '"'; i++) {
        if (source[i] === '\\' && i + 1 < source.length) { if (source[++i] !== '\n') word.value += source[i]; }
        else if (source[i] === '$') dollar(true);
        else if (source[i] === '`') backtick();
        else word.value += source[i];
      }
      continue;
    }
    if (ch === '\\' && i + 1 < source.length) {
      if (source[i + 1] === '\n') i++; // a continued line
      else { open().value += source[++i]; word.escaped = true; }
      continue;
    }
    if (ch === '$' && source[i + 1] === "'") {
      // $'…' ends at the first quote that is not escaped; its escapes can spell any name
      let end = i + 2;
      while (end < source.length && source[end] !== "'") end += source[end] === '\\' ? 2 : 1;
      open().value += source.slice(i + 2, end);
      word.quoted = true;
      word.computed = true;
      i = end;
      continue;
    }
    if (ch === '$') { dollar(false); continue; }
    if (ch === '`') { backtick(); continue; }
    if (ch === '#' && !word) {
      while (i + 1 < source.length && source[i + 1] !== '\n') i++;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      push();
      if (ch === '\n') { tokens.push({ op: ';' }); bodies(); }
      continue;
    }
    if ('|;&><()'.includes(ch)) {
      // `<` and `>` inside $[…] or the subscript of an assignment are arithmetic
      if ((ch === '<' || ch === '>') && word && !word.quoted && (/\$\[[^\]]*$/.test(word.value) || (starts() && /^[A-Za-z_][A-Za-z0-9_]*\[[^\]]*$/.test(word.value)))) { word.value += ch; continue; }
      // A number glued to a redirect (2>, 1>>, 0<) is its file descriptor, not an argument.
      // The number after `>&` is that redirect's target, even with another redirect glued on.
      const last = tokens[tokens.length - 1];
      const duplicated = last && (last.op === '>&' || last.op === '<&');
      if ((ch === '>' || ch === '<') && word && !word.quoted && /^[0-9]+$/.test(word.value) && !duplicated) word = null;
      const glued = word !== null; // `name=(` opens a list only with nothing between
      push();
      if (ch === ')') {
        if (stop && parens === 0 && cases === 0) return { tokens, end: i };
        if (parens > 0) parens--;
        if (shift !== null && parens <= shift) shift = null;
      }
      if (ch === '(') {
        if (shift === null && source[i + 1] === '(') shift = parens;
        parens++;
      }
      const three = source.slice(i, i + 3), two = source.slice(i, i + 2);
      const op = ['&>>', '<<<', '<<-', '>>&'].includes(three) ? three
        : ['||', '&&', '>>', '<<', '>&', '>|', '&>', '<&', '<>', '|&', ';;'].includes(two) ? two : ch;
      i += op.length - 1;
      // zsh writes over an existing file with a `!` or `|` after the operator
      if (['>', '>>', '>&', '&>', '&>>', '>>&'].includes(op) && (source[i + 1] === '!' || source[i + 1] === '|')) i++;
      const token = { op, glued };
      if ((op === '<<' || op === '<<-') && !arithmetic && shift === null) waiting.push({ op: token });
      tokens.push(token);
      continue;
    }
    if ('*?[{'.includes(ch)) open().glob = true;
    if (ch === '~' && !word) open().computed = true;
    open().value += ch;
  }
  push();
  return { tokens, end: source.length };
}

// Where an output redirect can never write a file: the sinks every shell has.
const SINKS = ['/dev/null', '/dev/stdout', '/dev/stderr', '/dev/tty'];
const plain = (value) => ({ value, computed: false, glob: false, quoted: false, subs: [] });

// The commands of a line. Each has its word `tokens` (and their text in `words`),
// the targets of its output redirects in `redirects` (a word token, or null when
// none follows `>`, `>>`, `>|`, `&>`, `>&file` or `<>`), the words it only reads
// from in `inputs`, and the bodies of its here-documents and here-strings in
// `heredocs`. Duplicating or closing a file descriptor (`2>&1`, `>&2`, `2>&-`)
// and writing to a sink open no file, so they appear nowhere. Inside `[[ … ]]`
// the operators are part of the test, and what follows `]]` is a command of its
// own (zsh runs `if [[ … ]] command`); the words of `name=( … )` are a value.
function shellCommands(source) {
  const { tokens } = lexShell(source);
  const commands = [];
  let current = null;
  let test = false;
  let list = false;
  const command = () => (current ??= { tokens: [], words: [], redirects: [], inputs: [], heredocs: [], separator: '' });
  const finish = (separator = '') => {
    if (current) {
      current.words = current.tokens.map(token => token.value);
      current.separator = separator === '|&' ? '|' : separator;
      commands.push(current);
    }
    current = null;
    test = false;
    list = false;
  };
  const leading = () => !current || current.tokens.every(token => KEYWORDS.includes(token.value) || ASSIGNMENT.test(token.value));
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.value !== undefined) {
      if (list) token.assign = true;
      if (!token.quoted && token.value === '[[' && leading()) test = true;
      command().tokens.push(token);
      if (test && !token.quoted && token.value === ']]') finish(';');
      continue;
    }
    if (test && ['&&', '||', '(', ')', '<', '>'].includes(token.op)) { command().tokens.push(plain(token.op)); continue; }
    if (token.op === '(' && token.glued && current && current.tokens.length && /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=$/.test(current.tokens[current.tokens.length - 1].value)) { list = true; continue; }
    if (token.op === ')' && list) { list = false; continue; }
    if (SEPARATORS.includes(token.op)) { finish(token.op); continue; }
    const next = tokens[i + 1] && tokens[i + 1].value !== undefined ? tokens[i + 1] : null;
    if (next) i++;
    if (token.op === '<<' || token.op === '<<-') {
      command().heredocs.push(token.body || '');
      if (token.subs && token.subs.length) current.inputs.push({ value: '', computed: true, subs: token.subs });
    }
    else if (token.op === '<<<') { if (next) { command().heredocs.push(next.value); current.inputs.push(next); } }
    else if (token.op === '<' || token.op === '<&') { if (next) command().inputs.push(next); }
    else if (!next) command().redirects.push(null);
    else if ((token.op === '>&' && /^([0-9]+-?|-)$/.test(next.value)) || (!next.computed && SINKS.includes(next.value))) command();
    else command().redirects.push(next);
  }
  finish();
  return commands;
}

// Words that only introduce the command after them.
const KEYWORDS = ['if', 'then', 'else', 'elif', 'fi', 'do', 'done', 'while', 'until', '!', '{', '}'];
// Transparent wrappers: the command they run is the one that matters. Each lists
// the options of its own that take a separate value.
const WRAPPERS = {
  env: ['-u', '--unset', '-C', '--chdir', '-P'], sudo: ['-u', '-g', '-h', '-p', '-C', '-D', '-R', '-r', '-t', '-T', '-U'], doas: ['-u', '-C'],
  command: [], builtin: [], exec: ['-a'], nice: ['-n'], nohup: [], time: ['-f', '-o'], timeout: ['-s', '-k', '--signal', '--kill-after'],
  xargs: ['-n', '-s', '-I', '-L', '-P', '-d', '-a', '-E', '-J', '-R', '-S'], stdbuf: ['-i', '-o', '-e'], caffeinate: ['-t', '-w'], arch: ['-arch', '-e'],
  ionice: ['-c', '-n', '-p'], setsid: [], chronic: [], unbuffer: [], noglob: [], nocorrect: [], coproc: [], repeat: [], busybox: [], xcrun: [],
  npx: ['-p', '--package'], pnpx: ['-p', '--package'], bunx: ['-p', '--package'],
};
const SHELLS = ['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish'];

// The command a line of words runs: its executable (lower case, without a
// directory), its argument tokens, the variable assignments in front of it and
// the wrappers it was run through. A program reached through ~, a variable or a
// substitution is still named by the last part of its path; when even that is
// computed the command is `opaque`: it may be anything, a shell included. What a
// wrapper is told about files is kept too: a command line in one word (`env -S`,
// `npx -c`) in `splits`, a directory to stand in (`env -C`) in `chdirs`, and the
// values of its other options in `values`.
function commandParts(command) {
  let tokens = command.tokens || (command.words || []).map(plain);
  const assignments = [];
  const wrappers = [];
  const splits = [];
  const chdirs = [];
  const values = [];
  let i = 0;
  for (;;) {
    const token = tokens[i];
    if (!token) break;
    if (token.assign || ASSIGNMENT.test(token.value)) { assignments.push(token); i++; continue; }
    if (KEYWORDS.includes(token.value)) { i++; continue; }
    if (token.value === 'function' && !token.quoted) { i += 2; continue; }
    // `{rm,-f,file}` is the command its parts spell
    if (token.glob && /^\{[^{}\s]+(,[^{}\s]*)+\}$/.test(token.value)) { tokens = [...tokens.slice(0, i), ...token.value.slice(1, -1).split(',').map(plain), ...tokens.slice(i + 1)]; continue; }
    const name = token.computed ? '' : path.basename(token.value).toLowerCase();
    const runner = name === 'npm' && tokens[i + 1] && ['exec', 'x'].includes(tokens[i + 1].value) ? 'npx' : name === 'direnv' && tokens[i + 1] && tokens[i + 1].value === 'exec' ? 'direnv' : '';
    if (!runner && !Object.hasOwn(WRAPPERS, name)) break;
    wrappers.push(runner || name);
    i += runner ? 2 : 1;
    if (runner === 'direnv') { i++; continue; } // its directory
    const own = WRAPPERS[runner || name];
    while (tokens[i] && (tokens[i].value.startsWith('-') || (name === 'env' && ASSIGNMENT.test(tokens[i].value)))) {
      const value = tokens[i].value;
      if (!value.startsWith('-')) assignments.push(tokens[i]);
      else if (value === '--') { i++; break; }
      else if ((name === 'env' && /^(-S|--split-string)/.test(value)) || (['npx', 'pnpx', 'bunx'].includes(runner || name) && /^(-c|--call)/.test(value))) {
        const glued = value.replace(/^(-S|--split-string=?|--call=?|-c)/, '');
        splits.push(glued || (tokens[++i] ? tokens[i].value : ''));
      } else if (own.includes(value)) {
        if (tokens[i + 1]) (name === 'env' && ['-C', '--chdir'].includes(value) ? chdirs : values).push(tokens[i + 1]);
        i++;
      }
      i++;
    }
    if (['timeout', 'repeat'].includes(name) && /^[0-9.]/.test(tokens[i] ? tokens[i].value : '')) i++;
  }
  const head = tokens[i] || null;
  const argTokens = tokens.slice(i + 1);
  let executable = '';
  let opaque = false;
  if (head) {
    const last = head.value.slice(head.value.lastIndexOf('/') + 1);
    if (!head.computed || (head.value.includes('/') && !/[$`]/.test(last) && last !== '')) executable = path.basename(head.value).toLowerCase();
    else if (/^\$\{?SHELL\b/.test(head.value)) executable = 'sh';
    else opaque = true;
    if (/^python[0-9.]*$/.test(executable)) executable = 'python3';
  }
  return { executable, opaque, head, args: argTokens.map(token => token.value), argTokens, words: command.words || [], assignments, wrappers, splits, chdirs, values };
}

// Every command inside the substitutions of a command's words.
const substitutions = (command) => [...command.tokens, ...command.redirects.filter(Boolean), ...command.inputs].flatMap(token => token.subs || []);

// Index of a shell's -c flag, including bundled forms such as -lc or -ec.
function shellCommandFlag(args) {
  return args.findIndex(arg => /^-[A-Za-z]*c[A-Za-z]*$/.test(arg));
}

function gitSubcommand(args) {
  let i = 0, cdir = '';
  while (i < args.length) {
    if (args[i] === '-C') { cdir = args[i + 1] || ''; i += 2; }
    else if (args[i] === '-c' && /^alias\./.test(args[i + 1] || '')) return { name: 'alias', args: [], cdir };
    else if (['-c', '--git-dir', '--work-tree', '--namespace', '--attr-source', '--super-prefix', '--config-env'].includes(args[i])) i += 2;
    else if (args[i].startsWith('-')) i++;
    else return { name: args[i], args: args.slice(i + 1), cdir };
  }
  return { name: '', args: [], cdir };
}

// The command line a shell's -c runs: the first word after it that is not an option.
function shellText(args) {
  const c = shellCommandFlag(args);
  return c === -1 ? null : args.slice(c + 1).find(arg => !arg.startsWith('-')) ?? null;
}
// A shell, or a program that may be one, that takes its script from standard
// input: no -c and no script file (`-s` hands the words after it to that script).
function readsScript(parts) {
  if (!parts.opaque && !SHELLS.includes(parts.executable)) return false;
  if (shellCommandFlag(parts.args) !== -1) return false;
  return parts.args.includes('-s') || !parts.args.some((arg, i) => !arg.startsWith('-') && !(i > 0 && ['-o', '+o', '-O', '+O'].includes(parts.args[i - 1])));
}
// A git long option, also in the shortened form git accepts.
const longOption = (arg, name) => arg === name || (arg.length >= 4 && arg.startsWith('--') && name.startsWith(arg));
// What text a command prints that the next command, or the substitution around it, may
// run: the words of echo and printf, and a here-document handed to cat.
function printed(command) {
  const { executable, args } = commandParts(command);
  return [...(['echo', 'printf'].includes(executable) ? [args.join(' '), ...args] : []), ...command.heredocs];
}
const producedText = (source) => shellCommands(source).flatMap(printed);
// Whether a here-document is only shown or stored as a message: handed to git or gh,
// or to a reader that neither saves it nor passes it on.
function heredocIsData(parts, command, reader) {
  if (!command.heredocs.length) return true;
  if (['git', 'gh'].includes(parts.executable)) return true;
  return reader && !command.redirects.length && command.separator !== '|';
}
const NESTING = 8; // deeper than this a line is refused, not waved through

function dangerousReason(source, depth = 0) {
  if (depth > NESTING) return 'the command is nested too deep to be checked.';
  const commands = shellCommands(source);
  const piped = commands.some(command => readsScript(commandParts(command)));
  for (let i = 0; i < commands.length; i++) {
    const parts = commandParts(commands[i]);
    const { executable, args, words, splits } = parts;
    const shell = SHELLS.includes(executable) || parts.opaque;
    // What runs inside the command: a substitution, a wrapper's command line, a shell's
    // -c text, a here-document that is more than a message, text printed into a shell.
    const inner = [...substitutions(commands[i]), ...splits];
    const reader = ['cat', 'echo', 'printf', 'grep', 'head', 'tail', 'wc', 'less', 'more'].includes(executable);
    if (piped || !heredocIsData(parts, commands[i], reader)) inner.push(...commands[i].heredocs);
    if (shell && shellText(args) !== null) inner.push(shellText(args));
    if (shell || executable === 'eval') inner.push(...commands[i].tokens.flatMap(token => token.subs || []).flatMap(producedText));
    if (executable === 'eval') inner.push(args.filter(arg => arg !== '--').join(' '));
    if (executable === 'trap') inner.push(...args);
    if (['su', 'watch', 'flock', 'script', 'parallel'].includes(executable)) inner.push(...commands[i].tokens.filter(token => token.quoted).map(token => token.value));
    if (readsScript(parts) && i > 0 && commands[i - 1].separator === '|') inner.push(...printed(commands[i - 1]));
    for (const nested of inner) {
      const reason = dangerousReason(nested, depth + 1);
      if (reason) return reason;
    }
    if ((executable === 'claude' || (executable === 'npx' && args.some(arg => arg === 'claude'))) &&
        words.includes('--dangerously-skip-permissions')) return 'permission bypass flags are not allowed.';
    // git, also behind a runner that takes a command as its arguments (flock, xcrun, npm exec)
    const at = executable === 'git' ? 0 : args.findIndex(arg => path.basename(arg).toLowerCase() === 'git') + 1;
    if (executable === 'git' || at > 0) {
      const sub = gitSubcommand(args.slice(at));
      const fed = parts.wrappers.includes('xargs');
      if (sub.name === 'push' && (fed || sub.args.some(arg => arg === '-f' || longOption(arg, '--force') || arg.startsWith('--force=') || arg === '--mirror' || /^\+./.test(arg))))
        return 'force-push commands are not allowed.';
      if (sub.name === 'reset' && sub.args.some(arg => longOption(arg, '--hard')) && sub.args.some(arg => /^origin\//.test(arg)))
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
    if (['curl', 'wget'].includes(executable) && commands[i].separator === '|') {
      const next = commandParts(commands[i + 1] || { words: [] }).executable;
      if (SHELLS.includes(next)) return 'downloading content directly into a shell is not allowed.';
    }
  }
  return '';
}

// What the ticket guard protects.
//   A ticket: `T-NN*` in a directory named tickets, wherever that directory is.
//   The hook does not read harness.json; a project that renames its tickets home
//   loses this coverage (docs/engine.md, "Platform notes").
//   The engine and the hooks, in this project only: scripts/pincer/, the
//   scripts/pincer-*.sh and scripts/pincer-*.cjs entry points, scripts/sync-prompts.sh,
//   .claude/hooks/ and .claude/settings.json. They are installed by pincer-workflow
//   and refreshed by its update; an agent that could edit them could also forge a
//   receipt or an acceptance.
// Paths are compared without regard to case (macOS and Windows volumes ignore it)
// and after `//`, `/./`, `..` and symbolic links are resolved.
//
// The lifecycle fields only scripts/pincer-ticket.sh writes: the state, its
// timestamps, the receipts, and the acceptance. A copy of LIFECYCLE_FIELDS in
// scripts/pincer/parse.cjs; the hook must not load the kit.
const PROTECTED = ['status', 'started', 'last_check', 'verified', 'finished', 'accepted', 'accepted_by', 'accepted_words'];
const ENGINE_MESSAGE = 'the engine (scripts/pincer-*.sh, scripts/pincer-*.cjs, scripts/pincer/) and the hooks (.claude/hooks/, .claude/settings.json) are installed by pincer-workflow and never edited by an agent; refresh them with `npx pincer-workflow update`.';

function projectRoot() {
  return path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
}
const slashed = (file) => file.split(path.sep).join('/');

// A protected name inside any text, for the places a path cannot be resolved: an
// argument that is code or `key=value`, a relative path, a path the shell computes.
// SEP is one separator however it is spelled; a pattern character after tickets/
// can match a ticket.
const SEP = '/+(?:\\./+)*';
const TICKET_MENTION = new RegExp(`(?<![a-z0-9_-])tickets${SEP}(?:t-(?:[0-9]|$)|[*?\\[{])`, 'i');
const ENGINE_MENTION = new RegExp(`(?<![a-z0-9_-])(?:scripts${SEP}(?:pincer(?![a-z0-9_.-])|pincer-[^/\\s'"]*\\.(?:sh|cjs)|sync-prompts\\.sh)|\\.claude${SEP}(?:hooks(?![a-z0-9_.-])|settings\\.json))`, 'i');
// Also with `x/../` folded away, which a path the shell computes may still carry.
const folded = (text) => (text.includes('..') ? [text, path.posix.normalize(text)] : [text]);
const mentionsTicket = (text) => folded(text).some(form => TICKET_MENTION.test(form));
const mentionsEngine = (text) => folded(text).some(form => ENGINE_MENTION.test(form));
const mentions = (text) => mentionsTicket(text) || mentionsEngine(text);
// The same names as resolved paths: a ticket anywhere, the engine relative to the project root.
const TICKET_FILE = /(^|\/)tickets\/t-[0-9]+[^/]*$/;
const ENGINE_REL = /^(scripts\/pincer(\/.*)?|scripts\/(pincer-[^/]*\.(sh|cjs)|sync-prompts\.sh)|\.claude\/hooks(\/.*)?|\.claude\/settings\.json)$/;
// A directory of the project that holds protected files without being one.
const HOLDER_REL = /^(scripts|\.claude|(.*\/)?tickets)$/;

// The real path of a file that may not exist yet: its longest existing part, resolved.
function realish(file) {
  const tail = [];
  for (let head = file; ;) {
    try { return path.join(fs.realpathSync(head), ...tail); } catch { /* not there: try its parent */ }
    const parent = path.dirname(head);
    if (parent === head) return file;
    tail.unshift(path.basename(head));
    head = parent;
  }
}
let rootSpellings = null;
const roots = () => (rootSpellings ??= [...new Set([projectRoot(), realish(projectRoot())])]);
// A lower-case absolute path relative to the project root, or null outside it.
function insideRoot(lower) {
  for (const root of roots().map(dir => slashed(dir).toLowerCase())) {
    if (lower === root) return '';
    if (lower.startsWith(`${root}/`)) return lower.slice(root.length + 1);
  }
  return null;
}

// The protected files and directories this project has now, for the checks that
// need the real names: a pattern the shell will expand and a hard link.
let known = null;
function knownProtected() {
  if (known) return known;
  known = [];
  for (const root of roots()) {
    const list = (dir) => { try { return fs.readdirSync(path.join(root, dir), { withFileTypes: true }); } catch { return []; } };
    const walk = (dir, depth = 0) => {
      known.push({ file: path.join(root, dir), kind: 'engine', dir: true });
      for (const entry of list(dir)) {
        if (!entry.isDirectory()) known.push({ file: path.join(root, dir, entry.name), kind: 'engine' });
        else if (depth < 4) walk(`${dir}/${entry.name}`, depth + 1);
      }
    };
    walk('scripts/pincer');
    walk('.claude/hooks');
    for (const entry of list('scripts')) if (/^(pincer-.*\.(sh|cjs)|sync-prompts\.sh)$/i.test(entry.name)) known.push({ file: path.join(root, 'scripts', entry.name), kind: 'engine' });
    known.push({ file: path.join(root, '.claude/settings.json'), kind: 'engine' });
    for (const entry of list('tickets')) if (/^t-[0-9]+/i.test(entry.name)) known.push({ file: path.join(root, 'tickets', entry.name), kind: 'ticket' });
    for (const dir of ['tickets', 'scripts', '.claude']) known.push({ file: path.join(root, dir), kind: 'holder', dir: true });
  }
  return known;
}
// A second name of a protected file: a hard link made earlier.
function aliasKind(file) {
  let stat;
  try { stat = fs.statSync(file); } catch { return ''; }
  if (!stat.isFile() || stat.nlink < 2) return '';
  for (const entry of knownProtected()) {
    if (entry.dir) continue;
    try { const other = fs.statSync(entry.file); if (other.ino === stat.ino && other.dev === stat.dev) return entry.kind; } catch { /* gone */ }
  }
  return '';
}
// What an absolute path is: 'ticket', 'engine', 'holder' or ''.
function located(file) {
  const absolute = path.resolve(file);
  let holder = false;
  for (const spelling of new Set([absolute, realish(absolute)])) {
    const lower = slashed(spelling).toLowerCase();
    if (TICKET_FILE.test(lower)) return 'ticket';
    const rel = insideRoot(lower);
    if (rel !== null && ENGINE_REL.test(rel)) return 'engine';
    if (rel !== null && HOLDER_REL.test(rel)) holder = true;
  }
  return aliasKind(absolute) || (holder ? 'holder' : '');
}
// The patterns a brace expression stands for: {a,b{c,d}} is a, bc and bd.
function braces(pattern, limit = 64) {
  for (let open = pattern.indexOf('{'); open !== -1; open = pattern.indexOf('{', open + 1)) {
    let depth = 0;
    const commas = [];
    for (let at = open; at < pattern.length; at++) {
      if (pattern[at] === '{') depth++;
      else if (pattern[at] === ',' && depth === 1) commas.push(at);
      else if (pattern[at] === '}' && --depth === 0) {
        if (!commas.length) break;
        const cuts = [open, ...commas, at];
        const parts = cuts.slice(1).map((cut, n) => pattern.slice(cuts[n] + 1, cut));
        return parts.flatMap(part => braces(pattern.slice(0, open) + part + pattern.slice(at + 1), limit)).slice(0, limit);
      }
    }
  }
  return [pattern];
}
const CLASSES = { alpha: 'a-zA-Z', digit: '0-9', alnum: 'a-zA-Z0-9', upper: 'A-Z', lower: 'a-z', xdigit: '0-9a-fA-F', space: ' ', word: 'a-zA-Z0-9_', punct: '!-/:-@' };
// A shell pattern as a regular expression source; with `cross`, * also matches /.
function globSource(pattern, cross = false) {
  const text = pattern.replace(/\[:([a-z]+):\]/g, (whole, name) => CLASSES[name] || whole);
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const close = ch === '[' ? text.indexOf(']', i + 2) : -1;
    if (ch === '*') { out += text[i + 1] === '*' || cross ? '.*' : '[^/]*'; while (text[i + 1] === '*') i++; }
    else if (ch === '?') out += '[^/]';
    else if (ch === '[' && close !== -1) { out += `[${text.slice(i + 1, close).replace(/^!/, '^').replace(/\\/g, '\\\\')}]`; i = close; }
    else out += ch.replace(/[.+^$()|\\[\]{}]/, '\\$&');
  }
  return out;
}
// Null when the pattern cannot be read: the caller then takes it to match.
function globMatcher(pattern, cross = false) {
  try { return new RegExp(`^(?:${braces(pattern).map(one => globSource(one, cross)).join('|')})$`, 'i'); } catch { return null; }
}
// What an absolute pattern can match among the protected files there are.
function globbed(pattern) {
  const matcher = globMatcher(slashed(pattern));
  if (!matcher) return 'engine';
  const kinds = knownProtected().filter(entry => matcher.test(slashed(entry.file))).map(entry => entry.kind);
  return ['ticket', 'engine', 'holder'].find(kind => kinds.includes(kind)) || '';
}

// What a word of a command line can reach, read as a path: 'ticket' or 'engine'
// (protected), 'holder' (a directory that holds them), 'other' (shown to be
// elsewhere) or 'unknown'. A word is unknown when where it lands cannot be worked
// out here: the shell computes it, it is a pattern that matches nothing protected
// now, the line moves to a directory that is itself computed (`scope.lost`), or it
// is a bare T-NN name. A relative word is tried from every directory the line can
// stand in (`scope.cwds`): where the hook was told the shell stands, the project
// root, and each `cd` or `pushd` on the line. A path under $TMPDIR is elsewhere,
// unless the line sets TMPDIR itself.
function reach(token, scope) {
  const text = token.value.replace(/\\/g, '/');
  if (!token.computed && !token.glob && path.isAbsolute(text)) return located(text) || 'other';
  if (mentionsTicket(text)) return 'ticket';
  if (mentionsEngine(text)) return 'engine';
  if (token.computed) {
    if (/(^|\/)T-[0-9]+[^/]*$/i.test(text)) return 'ticket';
    return !scope.retmp && /^\$(TMPDIR|\{TMPDIR\})\/[^$`~]*$/.test(text) && !text.includes('..') ? 'other' : 'unknown';
  }
  const kinds = [...scope.cwds].map(cwd => (token.glob ? globbed(path.resolve(cwd, text)) : located(path.resolve(cwd, text))));
  const kind = ['ticket', 'engine', 'holder'].find(name => kinds.includes(name));
  if (kind) return kind;
  return token.glob || scope.lost || /^T-[0-9]+/i.test(path.basename(text)) ? 'unknown' : 'other';
}
const RANK = ['ticket', 'engine', 'holder', 'unknown', 'other'];
const worst = (kinds) => RANK.find(kind => kinds.includes(kind)) || 'other';
// The same for an argument, which may carry its path after `=` (of=…, --output=…)
// or glued to a short option (-o<file>, -C<dir>).
function argReach(token, scope) {
  const value = token.value;
  const kinds = [reach(token, scope)];
  if (protectedKind(kinds[0])) return kinds[0];
  const at = value.indexOf('=');
  if (at > 0) kinds.push(reach({ ...token, value: value.slice(at + 1) }, scope));
  if (/^-[A-Za-z]/.test(value)) for (let cut = 2; cut < Math.min(value.length, 6); cut++) kinds.push(reach({ ...token, value: value.slice(cut) }, scope));
  const found = worst(kinds);
  return protectedKind(found) || found === 'holder' ? found : kinds[0];
}
function protectedKind(kind) { return kind === 'ticket' || kind === 'engine'; }
// Whether a literal word is the project root or a directory above it.
function aboveRoot(token, scope) {
  if (token.computed || token.glob) return false;
  return [...scope.cwds].some(cwd => {
    const lower = slashed(path.resolve(cwd, token.value)).toLowerCase();
    return roots().some(root => { const base = slashed(root).toLowerCase(); return base === lower || base.startsWith(`${lower === '/' ? '' : lower}/`); });
  });
}

// The project's own copy of a writer script, by relative, ./-relative, absolute or
// $CLAUDE_PROJECT_DIR-prefixed path; never a lookalike elsewhere.
function ownScript(word, rel) {
  if (typeof word !== 'string') return false;
  if (word === rel || word === `./${rel}` || word === `$CLAUDE_PROJECT_DIR/${rel}` || word === `\${CLAUDE_PROJECT_DIR}/${rel}`) return true;
  return path.isAbsolute(word) && path.resolve(word) === path.join(projectRoot(), rel);
}
const WRITER_WORD = /(^|[\\/])(pincer-ticket\.sh|pincer[\\/]cli\.cjs)$/;
function lookalikeWriter(word) {
  if (!WRITER_WORD.test(word)) return false;
  return !(ownScript(word, 'scripts/pincer-ticket.sh') || ownScript(word, 'scripts/pincer/cli.cjs'));
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
  // The path as the file system will take it: normalised, links followed, case ignored.
  const absolute = absoluteToolPath(file);
  const kind = located(absolute);
  if (kind === 'engine') block(ENGINE_MESSAGE);
  if (kind !== 'ticket') return;
  // A ticket is a .md file; another file beside the tickets is not one, a hard link to a ticket is.
  if (![absolute, realish(absolute)].some(spelling => /\.md$/i.test(spelling)) && aliasKind(absolute) !== 'ticket') return;
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

// The engine's entry points, which a session runs and never writes.
const RUNNABLE = ['scripts/pincer-ticket.sh', 'scripts/pincer-status.sh', 'scripts/pincer-blueprint.cjs', 'scripts/pincer-evidence.cjs', 'scripts/sync-prompts.sh', 'scripts/pincer/cli.cjs'];
const NODES = ['node', 'nodejs', 'deno', 'bun', 'tsx', 'ts-node'];
// Whether an interpreter is given its program on the command line instead of in a file.
function inlineCode(executable, args) {
  if (SHELLS.includes(executable)) return shellCommandFlag(args) !== -1;
  if (NODES.includes(executable)) return args.some(arg => /^(-e|-p|-pe|--eval|--print|eval)$/.test(arg) || /^--(eval|print)=/.test(arg));
  if (executable === 'python3') return args.some(arg => /^-[A-Za-z]*c$/.test(arg));
  if (executable === 'php') return args.includes('-r');
  if (['osascript', 'lua'].includes(executable)) return args.includes('-e');
  return ['perl', 'ruby'].includes(executable) && args.some(arg => /^-[A-Za-z0-9]*[eE]$/.test(arg));
}
// The word that names one of the project's own engine scripts being run, or null.
function ownRun(parts) {
  const runnable = (token) => RUNNABLE.some(rel => ownScript(token.value, rel));
  if (!parts.head) return null;
  if (runnable(parts.head)) return parts.head;
  if (!['node', 'bash', 'sh', 'zsh'].includes(parts.executable) || inlineCode(parts.executable, parts.args)) return null;
  const script = parts.argTokens.find(token => !token.value.startsWith('-'));
  return script && runnable(script) ? script : null;
}

// The one shell writer of lifecycle fields: `pincer-ticket.sh <start|verify|done> T-NN`
// (three words) or `pincer-ticket.sh accept T-NN ...`, directly or through
// `node scripts/pincer/cli.cjs ticket ...`, alone on its line.
function isExactPincerCall(source) {
  const commands = shellCommands(source);
  if (commands.length !== 1 || commands[0].separator) return false;
  // A redirect to a file is a write whatever runs in front of it, a substitution or
  // a here-document is a command of its own, and a wrapper may be told to do more:
  // all of them fall through to shellWrites, where they are judged like any other.
  if (commands[0].redirects.length || commands[0].heredocs.length || substitutions(commands[0]).length) return false;
  const parts = commandParts(commands[0]);
  if (parts.assignments.length || parts.splits.length || parts.chdirs.length || parts.values.length || parts.opaque) return false;
  const { executable, args, head } = parts;
  let words = [head ? head.value : undefined, ...args];
  if (['bash', 'sh', 'node'].includes(executable)) words = words.slice(1);
  if (ownScript(words[0], 'scripts/pincer/cli.cjs')) {
    words = words.slice(1);
    while (words[0] === '--root' || /^--root=/.test(words[0] || '')) words = words.slice(words[0] === '--root' ? 2 : 1);
    if (words[0] !== 'ticket') return false;
  } else if (!ownScript(words[0], 'scripts/pincer-ticket.sh')) return false;
  const action = words[1];
  if (['start', 'verify', 'done'].includes(action)) return words.length === 3;
  return action === 'accept' && words.length >= 3;
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
  const force = args.some(arg => longOption(arg, '--force') || longOption(arg, '--discard-changes') || /^-[A-Za-z]*f[A-Za-z]*$/.test(arg));
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
    case 'reset': return args.some(arg => ['--hard', '--merge', '--keep'].some(name => longOption(arg, name)));
    case 'stash':
      if (args.some(arg => arg === '-h' || arg === '--help')) return false;
      return !['list', 'show', 'create', 'store'].includes(positional[0] || '');
    case 'clean': return force && (positional.length === 0 || wide);
    case 'checkout-index': return args.some(arg => arg === '--all' || /^-[A-Za-z]*a/.test(arg));
    case 'read-tree': return args.some(arg => arg === '--reset' || /^-[A-Za-z]*u/.test(arg));
    default: return false;
  }
}

// Commands that only read the files they are given, or change nothing on disk that
// can be a ticket or the engine. A protected path among their arguments is a read.
const READERS = new Set([
  'cat', 'head', 'tail', 'less', 'more', 'bat', 'grep', 'egrep', 'fgrep', 'ag', 'ack', 'wc', 'diff', 'cmp', 'comm', 'ls', 'stat', 'file',
  'shasum', 'sha1sum', 'sha256sum', 'sha512sum', 'md5', 'md5sum', 'cksum', 'sum', 'od', 'hexdump', 'strings', 'nl', 'tac', 'rev', 'cut', 'column',
  'fold', 'fmt', 'paste', 'join', 'expand', 'basename', 'dirname', 'realpath', 'readlink', 'du', 'df', 'jq', 'tr', 'look', 'pbcopy', 'mkdir',
  'echo', 'printf', 'true', 'false', 'test', '[', '[[', ':', 'pwd', 'date', 'sleep', 'which', 'type', 'whoami', 'id', 'uname', 'hostname', 'seq', 'expr', 'printenv',
  'cd', 'pushd', 'popd', 'chdir', 'export', 'set', 'unset', 'local', 'declare', 'typeset', 'readonly', 'read', 'return', 'exit', 'break', 'continue', 'wait', 'shift',
  'for', 'case', 'esac', 'select', 'in', 'let', 'alias', 'unalias', 'hash', 'jobs', 'ulimit', 'umask',
  'eval', 'trap', // their text was judged as the commands it is
]);
// Git subcommands that never change a file of the working tree by its path.
const GIT_SAFE = new Set([
  'status', 'log', 'show', 'diff', 'blame', 'annotate', 'add', 'stage', 'commit', 'grep', 'ls-files', 'ls-tree', 'ls-remote', 'cat-file', 'rev-parse', 'rev-list',
  'describe', 'shortlog', 'reflog', 'diff-tree', 'diff-index', 'diff-files', 'merge-base', 'name-rev', 'for-each-ref', 'show-ref', 'show-branch', 'check-ignore',
  'check-attr', 'whatchanged', 'range-diff', 'count-objects', 'var', 'version', 'help', 'branch', 'tag', 'notes', 'fetch', 'push', 'pull', 'remote', 'config', 'init',
  'clone', 'merge', 'rebase', 'cherry-pick', 'revert', 'format-patch', 'archive', 'hash-object', 'commit-tree', 'gc', 'fsck',
]);
// Copies: every argument but the last is read, the last is written.
const COPIERS = ['cp', 'rsync', 'ditto', 'install', 'scp'];
// Programs that run the code they are handed: in a file, inline or on standard input.
const INTERPRETERS = [...NODES, 'python3', 'ruby', 'perl', 'php', 'lua', 'osascript'];
// Commands known to write the files they are given, or to run the text they are
// given. Beside a protected name on the line, one of them with an argument that
// cannot be resolved is refused; and what they are told in quotes is not prose.
const WRITERS = new Set([
  'rm', 'rmdir', 'mv', 'dd', 'truncate', 'touch', 'tee', 'ln', 'link', 'unlink', 'shred', 'chmod', 'chown', 'chgrp', 'chflags', 'patch', 'tar', 'bsdtar', 'unzip',
  'gzip', 'gunzip', 'curl', 'wget', 'sort', 'uniq', 'split', 'sponge', 'sed', 'awk', 'gawk', 'mawk', 'nawk', 'ed', 'ex', 'vi', 'vim', 'nvim', 'emacs', 'nano',
  'watch', 'su', 'script', 'parallel', 'flock', 'ssh', 'screen', 'tmux', 'at', 'expect',
  ...COPIERS, ...INTERPRETERS, ...SHELLS,
]);
// These run the quoted text they are given as a command line of its own.
const TEXT_RUNNERS = ['su', 'watch', 'flock', 'script', 'parallel', 'screen', 'tmux', 'expect'];
// Commands that act on a whole directory: one that holds protected files counts.
const TREE = new Set(['rm', 'rmdir', 'mv', 'ln', 'link', 'chmod', 'chown', 'chgrp', 'chflags', 'unzip']);
const AWKS = ['awk', 'gawk', 'mawk', 'nawk'];

// The value of an option, written apart or glued: -o file, -ofile, --output file, --output=file.
function optionValues(argTokens, short, long) {
  const found = [];
  argTokens.forEach((token, i) => {
    const value = token.value;
    const cluster = short && !value.startsWith('--') && /^-[A-Za-z]+/.test(value) ? value.indexOf(short) : -1;
    if (long.includes(value) || (cluster > 0 && cluster === value.length - 1)) { if (argTokens[i + 1]) found.push(argTokens[i + 1]); }
    else if (long.some(name => value.startsWith(`${name}=`))) found.push({ ...token, value: value.slice(value.indexOf('=') + 1) });
    else if (cluster > 0) found.push({ ...token, value: value.slice(cluster + 1) });
  });
  return found;
}
// The files a sed script writes with its w command or its s///w flag.
function sedTargets(parts) {
  const { args, argTokens } = parts;
  const scripts = [];
  argTokens.forEach((token, i) => {
    if (i > 0 && ['-e', '--expression'].includes(args[i - 1])) scripts.push(token.value);
    else if (/^--expression=/.test(token.value)) scripts.push(token.value.slice('--expression='.length));
    else if (/^-e./.test(token.value)) scripts.push(token.value.slice(2));
  });
  if (!scripts.length) scripts.push(...argTokens.filter(token => !token.value.startsWith('-')).slice(0, 1).map(token => token.value));
  return scripts.flatMap(text => [...text.matchAll(/(?:^|[;{}\n/0-9$,!])\s*[wW]\s+([^;\n}]+)/g)].map(match => ({ ...plain(match[1].trim()), computed: /[$`]/.test(match[1]) })));
}

// Whether a command only reads: a reader by name, or one of those that write
// only when asked to. Each is a reader in the form that cannot write a protected
// file: sort without -o or with -o elsewhere, uniq without a second file, sed
// without -i, awk without a redirect, a pipe or -i, tar that creates or lists,
// gzip to standard output, curl without an output option, a syntax check, chmod
// that only keeps a script executable, gh and rg apart from the forms that write.
function reads(parts, scope) {
  const { executable, args, argTokens } = parts;
  if (READERS.has(executable)) return true;
  const positional = argTokens.filter(token => !token.value.startsWith('-') || token.value === '-');
  const elsewhere = (token) => { const kind = reach(token, scope); return kind === 'other' || (kind === 'unknown' && !scope.tainted); };
  if (executable === 'gh') return !args.some(arg => ['download', 'clone'].includes(arg));
  if (executable === 'rg') return !args.some(arg => arg.startsWith('--pre'));
  if (executable === 'chmod') { const mode = positional[0] ? positional[0].value : ''; return /^[ugoa]*\+x$/.test(mode) || /^0?[57][0-5][0-5]$/.test(mode); }
  if (['node', 'nodejs'].includes(executable)) return args.some(arg => arg === '--check' || arg === '-c');
  if (SHELLS.includes(executable)) return shellCommandFlag(args) === -1 && args.includes('-n');
  if (executable === 'sort') return optionValues(argTokens, 'o', ['--output']).every(elsewhere);
  if (executable === 'uniq') return positional.length < 2;
  if (executable === 'sed') return !args.some(arg => /^-[^-]*[iI]/.test(arg) || arg === '--in-place' || arg.startsWith('--in-place='));
  if (['gzip', 'gunzip', 'bzip2', 'xz', 'zstd'].includes(executable)) return args.some(arg => /^-[A-Za-z]*[clt]/.test(arg) || ['--stdout', '--to-stdout', '--list', '--test'].includes(arg));
  if (executable === 'curl') return !args.some(arg => (!arg.startsWith('--') && /^-[A-Za-z]*[oODcJ]/.test(arg)) || /^--(output|remote-name|dump-header|cookie-jar|trace|stderr|create-dirs)/.test(arg));
  if (executable === 'tar' || executable === 'bsdtar') {
    const mode = args[0] || '';
    if (/^-?[A-Za-z]*t/.test(mode) && !/[xcru]/.test(mode)) return true;
    if (args.includes('--remove-files') || !(args.includes('--create') || (/^-?[A-Za-z]*c/.test(mode) && !/[xru]/.test(mode)))) return false;
    const archive = optionValues(argTokens, 'f', ['--file'])[0] || (/^[A-Za-z]*f$/.test(mode) ? argTokens[1] : null);
    return Boolean(archive) && (archive.value === '-' || elsewhere(archive));
  }
  if (AWKS.includes(executable)) {
    if (args.some(arg => ['-i', '--include', '-f', '--file', '-o', '-p', '-d', '-D'].includes(arg) || /inplace|^--(dump-variables|profile|pretty-print|debug)|^-[opdD]./.test(arg))) return false;
    const program = argTokens.find((token, i) => !token.value.startsWith('-') && !(i > 0 && ['-v', '-F', '--assign', '--field-separator'].includes(args[i - 1])));
    return Boolean(program) && !/(>>?|\|&?)\s*"|print[^;}\n]*(>>?|\|)\s*[A-Za-z_($]|system\s*\(|\bgetline\b/.test(program.value);
  }
  return false;
}

// A copy writes its last argument (or -t <dir>); what lands in a directory keeps
// the name of its source. Every other argument is read, so an option's value is
// never taken for something else: only where an option follows the files is each
// file a possible destination. Linking a protected file, removing it as the
// source, and copying a directory over one that holds protected files are writes.
function copyWrites(parts, scope, fed) {
  const { executable, argTokens } = parts;
  const positional = [];
  let target = null;
  let aliasing = false;
  let whole = executable === 'ditto';
  let trailing = false;
  for (let i = 0; i < argTokens.length; i++) {
    const token = argTokens[i], value = token.value;
    if (value === '--') { positional.push(...argTokens.slice(i + 1)); break; }
    if (!value.startsWith('-') || value === '-') { positional.push(token); continue; }
    if (positional.length) trailing = true;
    if (protectedKind(argReach(token, scope))) return true;
    if (/^--(link|symbolic-link|remove-source-files|remove-sent-files)$/.test(value) || (executable === 'cp' && /^-[A-Za-z]*[ls]/.test(value))) aliasing = true;
    if (/^-[A-Za-z]*[RrAa]/.test(value) || /^--(recursive|archive|delete)/.test(value)) whole = true;
    if (['cp', 'install'].includes(executable) && (value === '-t' || value === '--target-directory')) target = argTokens[++i] || null;
    else if (value.startsWith('--target-directory=')) target = { ...token, value: value.slice('--target-directory='.length) };
    else if (['--log-file', '--backup-dir', '--temp-dir', '--partial-dir'].includes(value) && argTokens[i + 1] && protectedKind(argReach(argTokens[++i], scope))) return true;
  }
  if (aliasing && positional.some(token => reach(token, scope) !== 'other')) return true;
  const destinations = target ? [target] : positional.length < 2 ? [] : trailing ? positional : positional.slice(-1);
  if (!destinations.length) return fed && (scope.tainted || scope.holds); // xargs supplies it
  for (const destination of destinations) {
    const sources = positional.filter(token => token !== destination);
    const kind = reach(destination, scope);
    if (protectedKind(kind) || (kind === 'unknown' && scope.tainted)) return true;
    if (kind === 'holder' && (whole || sources.some(token => token.value.endsWith('/')))) return true;
    if (destination.computed || destination.glob) continue;
    for (const source of sources) {
      if (source.computed || source.glob) { if (kind === 'holder') return true; continue; }
      if ([...scope.cwds].some(cwd => located(path.resolve(cwd, destination.value, path.basename(source.value))))) return true;
    }
  }
  return false;
}

// What a find expression asks for: where it starts, the name tests that narrow it
// (a negated test narrows nothing here, and with -o none does), how deep it goes,
// and its actions: the commands of -exec and whether it deletes or writes itself.
function findPlan(parts) {
  const tokens = parts.argTokens;
  const plan = { starts: [], tests: [], runs: [], direct: false, depth: Infinity, empty: false, type: '', loose: false };
  let i = 0;
  while (tokens[i] && /^-[HLPEXdfsx]+$/.test(tokens[i].value)) i++;
  while (tokens[i] && !/^[-!(]/.test(tokens[i].value)) plan.starts.push(tokens[i++]);
  let negated = false;
  for (; i < tokens.length; i++) {
    const value = tokens[i].value;
    if (value === '!' || value === '-not') { negated = true; continue; }
    if (['-o', '-or', ','].includes(value)) plan.loose = true;
    else if (/^-i?(name|path|wholename|regex|lname)$/.test(value)) { if (tokens[i + 1] && !negated) plan.tests.push({ token: tokens[i + 1], name: /name$/.test(value), regex: /regex$/.test(value) }); i++; }
    else if (value === '-maxdepth' && tokens[i + 1]) { const depth = Number(tokens[++i].value); plan.depth = Number.isFinite(depth) ? depth : Infinity; }
    else if (value === '-empty') plan.empty = !negated;
    else if (value === '-type' && tokens[i + 1]) { if (!negated) plan.type = tokens[i + 1].value; i++; }
    else if (/^-(exec|execdir|ok|okdir)$/.test(value)) {
      let end = i + 1;
      while (end < tokens.length && tokens[end].value !== ';' && tokens[end].value !== '+') end++;
      plan.runs.push(tokens.slice(i + 1, end));
      i = end;
    } else if (/^-(delete|fprint|fprint0|fprintf|fls)$/.test(value)) plan.direct = true;
    negated = false;
  }
  return plan;
}
function passesTest({ token, name, regex }, entry) {
  if (token.computed || regex) return true;
  const matcher = globMatcher(token.value, !name);
  if (!matcher) return true;
  const forms = name ? [path.basename(entry.file)] : roots().flatMap(root => { const rel = slashed(path.relative(root, entry.file)); return [slashed(entry.file), rel, `./${rel}`]; });
  return forms.some(text => matcher.test(text));
}
// Whether what the search finds can be a protected file there is now. With literal
// starting points this is looked up; with one the shell computes it is assumed,
// unless a name test rules every protected file out.
function findCovers(plan, scope) {
  const tests = plan.loose ? [] : plan.tests;
  if (plan.starts.length && plan.starts.every(token => !token.computed && !token.glob)) {
    return knownProtected().some(entry => {
      if (entry.kind === 'holder' || (plan.type === 'f' && entry.dir) || (plan.type === 'd' && !entry.dir)) return false;
      if (plan.empty) { try { if (entry.dir || fs.statSync(entry.file).size) return false; } catch { return false; } }
      const under = [...scope.cwds].some(cwd => plan.starts.some(start => {
        const rel = path.relative(path.resolve(cwd, start.value), entry.file);
        return !rel.startsWith('..') && !path.isAbsolute(rel) && (rel === '' ? 0 : rel.split(path.sep).length) <= plan.depth;
      }));
      return under && tests.every(test => passesTest(test, entry));
    });
  }
  return !tests.length || tests.some(test => /^\*?t-[0-9*?[]/i.test(test.token.value) || mentions(test.token.value) || knownProtected().some(entry => passesTest(test, entry)));
}
const asCommand = (list) => {
  const kept = list.filter(token => token.value !== '{}');
  return { tokens: kept, words: kept.map(token => token.value), redirects: [], inputs: [], heredocs: [], separator: '' };
};
// find only reads until it is given an action. With one, it is a write when what it
// finds can be a protected file and the action is not a command that only reads.
function findWrites(parts, scope, depth) {
  const plan = findPlan(parts);
  if (!plan.direct && !plan.runs.length) return false;
  const runs = plan.runs.map(asCommand);
  if (!findCovers(plan, scope)) return runs.some(run => commandWrites(run, scope, false, depth + 1));
  return plan.direct || runs.some(run => !reads(commandParts(run), scope) || commandWrites(run, scope, false, depth + 1));
}

// git: the whole-tree forms, then any subcommand outside the safe list that names a
// protected path, takes its paths from xargs, or is handed one the line computes.
function gitWrites(parts, scope, fed, depth) {
  const sub = gitSubcommand(parts.args);
  const code = (text) => shellWrites(text, scope, depth + 1);
  // an option in front of the subcommand that names a protected path (-c core.pager='rm …')
  const leading = parts.argTokens.slice(0, Math.max(0, parts.argTokens.length - sub.args.length - (sub.name && sub.name !== 'alias' ? 1 : 0)));
  if (leading.some(token => protectedKind(argReach(token, scope)))) return true;
  if (wholeTreeRestore(sub)) return true;
  const stdinPathspec = !sub.args.some(arg => !arg.startsWith('-')) || sub.args[sub.args.length - 1] === '--';
  if (fed && ((['checkout', 'restore', 'clean'].includes(sub.name) && stdinPathspec) || ['', 'reset', 'stash'].includes(sub.name))) return true;
  const tokens = sub.args.length ? parts.argTokens.slice(-sub.args.length) : [];
  const local = sub.cdir
    ? { ...scope, cwds: new Set([...scope.cwds].flatMap(cwd => [cwd, path.resolve(cwd, sub.cdir)])), lost: scope.lost || /[$`~]/.test(sub.cdir) }
    : scope;
  const after = (i, names) => i > 0 && names.includes(tokens[i - 1].value);
  // commands git is told to run: rebase --exec, an alias, a config value that starts with !
  if (sub.name === 'rebase' && tokens.some((token, i) => (after(i, ['-x', '--exec']) && code(token.value)) || (token.value.startsWith('--exec=') && code(token.value.slice('--exec='.length))))) return true;
  if (sub.name === 'config') {
    const words = tokens.filter(token => !token.value.startsWith('-'));
    if (words[1] && words[1].value.startsWith('!') && code(words[1].value.slice(1))) return true;
    if (words[1] && /^alias\./.test(words[0].value) && !words[1].value.startsWith('!') && code(`git ${words[1].value}`)) return true;
    if (tokens.some((token, i) => (after(i, ['-f', '--file']) || token.value.startsWith('--file=')) && protectedKind(argReach(token, local)))) return true;
  }
  if (sub.name === 'rm' && sub.args.includes('--cached')) return false; // the index only
  const safe = GIT_SAFE.has(sub.name);
  // A branch name is not a path: it never makes the command blind.
  const lone = !sub.args.includes('--') && tokens.filter(token => !token.value.startsWith('-')).length === 1;
  const branch = (i) => sub.name === 'switch' || (sub.name === 'checkout' && (after(i, ['-b', '-B', '--orphan']) || lone));
  let blind = fed;
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];
    // git expands a quoted pattern itself, after the :(magic) in front of it
    if (!safe && !token.value.startsWith('-') && /[*?[]/.test(token.value)) token = { ...token, glob: true, value: token.value.replace(/^:(\([^)]*\)|[/!^])?/, '') };
    const kind = argReach(token, local);
    if (safe) {
      // the few that write a file of their own choosing say so with --output or -o
      const output = /^--output/.test(token.value) || after(i, ['--output']) || (after(i, ['-o']) && ['format-patch', 'archive'].includes(sub.name));
      if (output && protectedKind(kind)) return true;
      continue;
    }
    if (protectedKind(kind) || kind === 'holder') return true;
    if (kind === 'unknown' && !branch(i)) blind = true;
  }
  // a patch says which files it changes only in its body: refused beside any protected name
  if (['apply', 'am'].includes(sub.name) && (scope.tainted || scope.holds)) return true;
  return !safe && scope.tainted && blind;
}

// Any other command: refused when an argument names a protected path. A command
// that is not known to write files may be handed prose that mentions one (a pull
// request body); a known writer may not, because its text is code. Beside a
// protected name on the line a known writer is refused with an argument that
// cannot be resolved, an interpreter with no program file, and any command fed by
// xargs; an inline program is refused on a line that names a ticket.
function otherWrites(parts, command, scope, fed, depth) {
  const { executable, args, argTokens } = parts;
  const shell = SHELLS.includes(executable) || parts.opaque;
  const interpreter = INTERPRETERS.includes(executable);
  const known = WRITERS.has(executable) || parts.opaque;
  // inside a here-document that is saved or passed on, only what is known to write counts
  if (scope.lenient && !known) return false;
  const inline = !shell && inlineCode(executable, args);
  const near = scope.tainted || scope.holds;
  if (executable === 'patch' && near) return true;
  // git behind a runner that takes a command as its arguments (flock, xcrun, script)
  const git = args.findIndex(arg => path.basename(arg).toLowerCase() === 'git');
  if (git !== -1 && gitWrites(commandParts({ tokens: argTokens.slice(git) }), scope, fed, depth)) return true;
  let tokens = executable === 'dd' ? argTokens.filter(token => /^of=/.test(token.value)) : argTokens;
  if (executable === 'wget') tokens = tokens.filter(token => !/^[a-z]+:\/\//i.test(token.value));
  // the file an interpreter runs is run, not written; a shell's -c text was judged as commands
  const text = shell ? shellText(args) : null;
  let script = null;
  if (text !== null) tokens = tokens.filter(token => token.value !== text);
  else if ((shell || interpreter) && !inline) { script = tokens.find(token => !token.value.startsWith('-')) || null; tokens = tokens.filter(token => token !== script); }
  // xargs handing files to a shell line that only reads them is a read
  const fedReads = fed && text !== null && shellCommands(text).every(inner => !inner.redirects.length && (!commandParts(inner).head || reads(commandParts(inner), scope)));
  let blind = fed && !fedReads;
  for (const token of [...parts.assignments, ...tokens]) {
    if (!known && token.quoted && /\s/.test(token.value)) continue;
    const kind = argReach(token, scope);
    if (protectedKind(kind) || (kind === 'holder' && (TREE.has(executable) || executable === 'tar'))) return true;
    if (['rm', 'rmdir', 'chmod', 'chown', 'chgrp', 'chflags'].includes(executable) && !token.value.startsWith('-') && aboveRoot(token, scope)) return true;
    if (kind === 'unknown') blind = true;
  }
  if (interpreter || ['ed', 'ex'].includes(executable)) {
    // the paths a program names in quotes, read from where the line stands
    const programs = [...(inline ? tokens.filter(token => token.quoted).map(token => token.value) : []), ...command.heredocs];
    for (const program of programs) for (const match of program.matchAll(/['"]([^'"\n]{1,200})['"]/g)) if (protectedKind(reach(plain(match[1]), scope))) return true;
    if (command.heredocs.some(mentions)) return true;
    // a program written by here-document on this line, or one that arrives on standard input
    if (interpreter && scope.scripted) return true;
    if (interpreter && !inline && scope.tainted && args.every(arg => arg === '-' || /^-[A-Za-z]$/.test(arg))) return true;
  }
  if (near && ((fed && !fedReads) || (known && blind))) return true;
  return known && inline && scope.ticketed;
}

// What a command names: a 'ticket', the 'engine', a 'holder' directory. It may be
// in a word, a redirect, a here-document or inside a substitution, and a search
// names what it can find. The project's own engine script being run names nothing.
function marks(command, scope, depth = 0) {
  if (depth > NESTING) return new Set(['ticket', 'engine']);
  const found = new Set();
  const parts = commandParts(command);
  const own = ownRun(parts);
  for (const token of [...command.tokens, ...command.redirects.filter(Boolean), ...command.inputs]) {
    const kind = token === own ? 'other' : argReach(token, scope);
    if (protectedKind(kind) || kind === 'holder') found.add(kind);
  }
  for (const body of command.heredocs) {
    if (mentionsTicket(body)) found.add('ticket');
    if (mentionsEngine(body)) found.add('engine');
  }
  if (parts.executable === 'find' && findCovers(findPlan(parts), scope)) found.add('ticket');
  for (const sub of substitutions(command)) for (const inner of shellCommands(sub)) for (const kind of marks(inner, scope, depth + 1)) found.add(kind);
  return found;
}

// Where the commands of a line can stand and what the line names. Every `cd`,
// `pushd` and `env -C` adds the directory it leads to, whichever command comes
// first: a relative path is protected if it is from any of them. `tainted`: the
// line names a protected path (`ticketed`: a ticket); `holds`: a directory that
// holds them; `scripted`: a here-document that is saved or passed on names one;
// `retmp`: the line sets TMPDIR; `lost`: it moves somewhere that is computed.
function scopeOf(commands, outer) {
  const start = [typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : projectRoot(), projectRoot(), process.cwd()];
  const scope = outer
    ? { ...outer, cwds: new Set(outer.cwds) }
    : { cwds: new Set(start.map(dir => path.resolve(dir))), lost: false, tainted: false, ticketed: false, holds: false, scripted: false, retmp: false, lenient: false };
  const stand = (target) => {
    if (!target) { scope.cwds.add(os.homedir()); return; }
    const known = /^(\$PWD|\$\{PWD\}|\$CLAUDE_PROJECT_DIR|\$\{CLAUDE_PROJECT_DIR\})(\/[^$`]*)?$/.exec(target.value);
    if (known) {
      for (const base of known[1].includes('PWD') ? [...scope.cwds] : [projectRoot()]) scope.cwds.add(path.resolve(base, (known[2] || '').slice(1)));
    } else if (target.computed || target.value === '-') scope.lost = true;
    else if (target.glob) {
      scope.lost = true;
      for (const cwd of [...scope.cwds]) {
        const matcher = globMatcher(slashed(path.resolve(cwd, target.value)));
        for (const entry of knownProtected()) if (entry.dir && (!matcher || matcher.test(slashed(entry.file)))) scope.cwds.add(entry.file);
      }
    } else for (const cwd of [...scope.cwds]) scope.cwds.add(path.resolve(cwd, target.value));
  };
  const walk = (list, depth) => {
    for (const command of list) {
      const parts = commandParts(command);
      parts.chdirs.forEach(stand);
      if (['cd', 'pushd', 'chdir'].includes(parts.executable)) stand(parts.argTokens.find(token => !token.value.startsWith('-') || token.value === '-'));
      if (parts.executable === 'eval' && depth < 3) walk(shellCommands(parts.args.filter(arg => arg !== '--').join(' ')), depth + 1);
      if (command.tokens.some(token => /^TMPDIR\+?=/.test(token.value))) scope.retmp = true;
    }
  };
  walk(commands, 0);
  for (const command of commands) {
    const found = marks(command, scope);
    scope.ticketed ||= found.has('ticket');
    scope.tainted ||= found.has('ticket') || found.has('engine');
    scope.holds ||= found.has('holder');
  }
  for (const command of commands) {
    const parts = commandParts(command);
    const reader = parts.executable !== 'find' && !ownRun(parts) && reads(parts, scope);
    scope.scripted ||= !heredocIsData(parts, command, reader) && command.heredocs.some(mentions);
  }
  return scope;
}

function commandWrites(command, scope, piped, depth, previous = null) {
  // A redirect onto a ticket, the engine or the hooks is a write whatever the command is;
  // one that cannot be resolved is a write beside a protected name.
  for (const target of command.redirects) {
    const kind = target ? reach(target, scope) : 'unknown';
    if (protectedKind(kind) || (kind === 'unknown' && scope.tainted)) return true;
  }
  const code = (text) => shellWrites(text, scope, depth + 1);
  if (substitutions(command).some(code)) return true;
  const parts = commandParts(command);
  const { executable, args } = parts;
  const shell = SHELLS.includes(executable) || parts.opaque;
  // What the command is told to run: a wrapper's command line, a shell's -c text, the
  // words of eval and trap, quoted text for a runner, and text that reaches a shell
  // or eval through a substitution or down a pipe.
  if (parts.splits.some(code)) return true;
  if (parts.values.some(token => protectedKind(argReach(token, scope)))) return true;
  if (shell && shellText(args) !== null && code(shellText(args))) return true;
  if ((shell || executable === 'eval') && command.tokens.flatMap(token => token.subs || []).flatMap(producedText).some(code)) return true;
  if (readsScript(parts) && previous && previous.separator === '|' && printed(previous).some(code)) return true;
  if (executable === 'eval' && code(args.filter(arg => arg !== '--').join(' '))) return true;
  if (executable === 'trap' && args.some(code)) return true;
  if (TEXT_RUNNERS.includes(executable) && command.tokens.filter(token => token.quoted).some(token => code(token.value))) return true;
  // A lookalike of the writer anywhere but the project's own path is refused outright.
  if ([...command.words, ...command.redirects.filter(Boolean).map(token => token.value)].some(lookalikeWriter)) return true;
  if (!parts.head) return false;
  const fed = parts.wrappers.includes('xargs');
  const own = ownRun(parts);
  const reader = executable !== 'git' && executable !== 'find' && !own && reads(parts, scope);
  // A here-document that is more than a message: a script for a shell, or text that is
  // saved or passed on, in which only what is known to write counts.
  if (piped || !heredocIsData(parts, command, reader)) {
    const strict = shell || piped ? scope : { ...scope, lenient: true };
    if (command.heredocs.some(body => shellWrites(body, strict, depth + 1))) return true;
  }
  if (executable === 'git') return gitWrites(parts, scope, fed, depth);
  if (own) return false;
  if (executable === 'find') return findWrites(parts, scope, depth);
  if (executable === 'sed' && sedTargets(parts).some(target => { const kind = reach(target, scope); return protectedKind(kind) || (kind === 'unknown' && scope.tainted); })) return true;
  if (reader) return false;
  if (COPIERS.includes(executable)) return copyWrites(parts, scope, fed);
  return otherWrites(parts, command, scope, fed, depth);
}

// Whether a shell line writes, resets or restores a ticket, the engine or the hooks.
function shellWrites(source, outer = null, depth = 0) {
  if (depth > NESTING) return true;
  if (!outer && isExactPincerCall(source)) return false;
  const commands = shellCommands(source);
  // a line that points CLAUDE_PROJECT_DIR elsewhere would make another script the project's own
  if (commands.some(command => command.tokens.some(token => /^CLAUDE_PROJECT_DIR\+?=/.test(token.value)))) return true;
  const scope = scopeOf(commands, outer);
  const piped = commands.some(command => readsScript(commandParts(command)));
  return commands.some((command, i) => commandWrites(command, scope, piped, depth, i ? commands[i - 1] : null));
}

// A notebook is edited by its own tool: a protected file is not a notebook.
function guardNotebook(toolInput) {
  const file = toolInput.notebook_path;
  if (typeof file !== 'string') block('NotebookEdit payload must contain a string notebook_path.');
  const kind = located(absoluteToolPath(file));
  if (kind === 'engine') block(ENGINE_MESSAGE);
  if (kind === 'ticket') block('ticket lifecycle fields may only be changed by pincer-ticket.sh.');
}

if (mode === 'dangerous') {
  if (payload.tool_name !== 'Bash') process.exit(0);
  if (typeof payload.tool_input.command !== 'string') block('Bash payload must contain a string command.');
  const reason = dangerousReason(payload.tool_input.command);
  if (reason) block(reason);
} else if (mode === 'ticket') {
  if (['Edit', 'Write', 'MultiEdit'].includes(payload.tool_name)) guardEdits(payload.tool_name, payload.tool_input);
  else if (payload.tool_name === 'NotebookEdit') guardNotebook(payload.tool_input);
  else if (payload.tool_name === 'Bash') {
    if (typeof payload.tool_input.command !== 'string') block('Bash payload must contain a string command.');
    if (shellWrites(payload.tool_input.command)) block(`shell commands may not write, reset, or restore ticket files, including whole-tree checkout/restore, reset --hard, stash, clean -f; ticket lifecycle fields are written only by the project's own scripts/pincer-ticket.sh. ${ENGINE_MESSAGE}`);
  }
} else {
  block('hook policy mode is invalid.');
}
