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

// A hook that ends with any status but 2 lets the call run, so whatever goes wrong
// in here refuses it: a line this file cannot read to the end is not waved through.
process.on('uncaughtException', () => block('the hook could not read this call; write the command more plainly.'));
// Text that is only saved or shown (a here-document for a file or a message) is read
// as loosely as before: prose is full of apostrophes and (#links).
let prose = 0;
const loosely = (read) => { prose++; try { return read(); } finally { prose--; } };
const unsure = () => { if (!prose) unreadable(); };
const unreadable = () => block('this shell line cannot be read with certainty (a quote, a test or a substitution that never closes, deep nesting, $[…], a # or << inside ((…)) or straight after a paren); write it more plainly.');

// The check is bounded in time as well: a line that takes this long to read is refused.
const DEADLINE = Date.now() + 10000;
const inTime = () => { if (Date.now() > DEADLINE) block('this line takes too long to check; split it into shorter commands.'); };

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
      const inner = lexShell(text, i + 2, true, arithmeticAt(text, i + 2));
      subs.push(text.slice(i + 2, inner.end));
      i = inner.end;
    } else if (text[i] === '`') {
      let end = i + 1;
      while (end < text.length && text[end] !== '`') end += text[end] === '\\' ? 2 : 1;
      if (end >= text.length) unsure();
      subs.push(text.slice(i + 1, end).replace(/\\`/g, '`'));
      i = end;
    }
  }
  return subs;
}

// What ends one command and starts the next. A single `&` does, like `;`.
const SEPARATORS = ['|', '|&', ';', ';;', '&&', '||', '&', '(', ')'];
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=/;

// Arithmetic and commands are read differently: in ((…)), $((…)) and $[…] a `<<` is a
// shift and a `#` is no comment. The shell takes ((…)) for arithmetic when the
// paren that closes it is doubled, and for two subshells otherwise. That is certain
// here only for text with nothing in it that could hide a paren (a quote, a
// backslash, a new line, a substitution); `at` is where the inside starts.
const ARITHMETIC_TEXT = /^[A-Za-z0-9_ \t+\-*/%<>=!&|^~?:,.$#()[\]]$/;
function closesDoubled(source, at) {
  let depth = 0;
  for (let i = at; i < source.length; i++) {
    const ch = source[i];
    if (!ARITHMETIC_TEXT.test(ch) || (ch === '$' && source[i + 1] === '(')) return false;
    if (ch === '(') depth++;
    else if (ch === ')') { if (depth === 0) return source[i + 1] === ')'; depth--; }
  }
  return false;
}
// false for a command substitution; for $(( 'sure' or 'maybe'. `at` is the index after `$(`.
const arithmeticAt = (source, at) => (source[at] !== '(' ? false : closesDoubled(source, at + 1) ? 'sure' : 'maybe');
// The index after the ] that closes the $[ whose inside starts at `at`, or -1.
function squareEnd(source, at) {
  let depth = 1;
  for (let i = at; i < source.length; i++) {
    const ch = source[i];
    if (!ARITHMETIC_TEXT.test(ch) || (ch === '$' && source[i + 1] === '(')) return -1;
    if (ch === '[') depth++;
    else if (ch === ']' && --depth === 0) return i + 1;
  }
  return -1;
}
const LEX_DEPTH = 64;
let lexing = 0;
function lexShell(...args) {
  if (lexing >= LEX_DEPTH) unreadable();
  lexing++;
  try { return readShell(...args); } finally { lexing--; }
}

// Reads a shell line into words and operators. A word is `computed` when the
// shell works part of it out ($VAR, ${…}, $(…), `…`, $'…', a leading ~), `glob`
// when it holds an unquoted pattern character, and carries in `subs` the commands
// inside its substitutions, which are judged as commands of their own. The body of
// a here-document is kept on its `<<` operator. A comment runs to the end of its
// line. With `stop` the scan ends at the `)` that closes a substitution;
// `arithmetic` is `$((…))`, where `<<` is a shift and opens no here-document.
// Where it is not certain that ((…)) is arithmetic, a `<<` or a `#` in it is read
// neither way: the line is refused. So is a `#` straight after a paren, which zsh
// reads as part of a pattern and bash as a comment, and `<<` in a subscript that is
// not an assignment, which bash reads one way or the other by its version. An
// empty quoted word is a word.
//
// The reader must never take for text what the shell takes for a command. Where
// the two could differ it reads on: a here-document whose end is not found has no
// body, only space, tab and newline separate words, and `<<` inside `$[…]`, `((…))`
// or a subscript is arithmetic.
function readShell(source, from = 0, stop = false, arithmetic = false) {
  const tokens = [];
  const waiting = [];
  let word = null;
  let parens = 0;
  let cases = 0; // `case … esac` being read: the `)` of a pattern closes nothing
  let shift = null; // the paren depth outside the ((…)) being read
  let shiftSure = false;
  const groups = []; // for each open paren whether it was glued to a word
  // inside arithmetic: false, 'sure' or 'maybe'
  const sums = () => (shift !== null ? (shiftSure ? 'sure' : 'maybe') : arithmetic);
  let i = from;
  const open = () => (word ??= { value: '', computed: false, glob: false, quoted: false, subs: [] });
  const starts = () => { const last = tokens[tokens.length - 1]; return !last || (last.op ? SEPARATORS.includes(last.op) : ASSIGNMENT.test(last.value)); };
  const push = () => {
    if (word && (word.value || word.quoted)) {
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
      else if (ch === "'" && !quotedOutside) { const end = source.indexOf("'", at + 1); if (end === -1) { unsure(); return source.length; } at = end; }
      else if (ch === '"') { for (at++; at < source.length && source[at] !== '"'; at++) if (source[at] === '\\') at++; }
      else if (ch === '$' && source[at + 1] === '{') { depth++; at++; }
      else if (ch === '$' && source[at + 1] === '(') at = lexShell(source, at + 2, true, arithmeticAt(source, at + 2)).end;
      else if (ch === '`') { for (at++; at < source.length && source[at] !== '`'; at++) if (source[at] === '\\') at++; }
      else if (ch === '}' && --depth === 0) return at + 1;
    }
    unsure();
    return source.length;
  };
  const dollar = (quotedOutside) => {
    const current = open();
    current.computed = true;
    if (source[i + 1] === '(') {
      const inner = lexShell(source, i + 2, true, arithmeticAt(source, i + 2));
      current.subs.push(source.slice(i + 2, inner.end));
      current.value += '$()';
      i = inner.end;
    } else if (source[i + 1] === '[') {
      // $[…] is arithmetic in bash and zsh; a shell without it would read the inside
      // as words and redirects, so the inside is judged as a command as well
      const end = squareEnd(source, i + 2);
      if (end === -1) { unsure(); current.value += '$'; return; }
      current.subs.push(source.slice(i + 2, end - 1));
      current.value += source.slice(i, end);
      i = end - 1;
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
    if (end >= source.length) unsure();
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
      if (found === -1) { if (!(named.quoted || named.escaped)) doc.op.subs = embedded(source.slice(Math.min(i + 1, source.length))); continue; }
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
      if (end === -1) unsure();
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
      if (i >= source.length) unsure();
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
      if (end >= source.length) unsure();
      open().value += source.slice(i + 2, end);
      word.quoted = true;
      word.computed = true;
      word.ansi = true;
      i = end;
      continue;
    }
    if (ch === '$') { dollar(false); continue; }
    if (ch === '`') { backtick(); continue; }
    if (ch === '#' && !word) {
      const sum = sums();
      if (sum === 'maybe' || (!sum && (source[i - 1] === '(' || source[i - 1] === ')' || groups.includes(true)))) unsure();
      if (!sum) {
        while (i + 1 < source.length && source[i + 1] !== '\n') i++;
        continue;
      }
    }
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      push();
      if (ch === '\n') { tokens.push({ op: ';', newline: true }); bodies(); }
      continue;
    }
    // <(…), >(…) and zsh's =(…) stand for a file the shell makes: a word of its own,
    // with the commands inside judged as commands
    if ((ch === '<' || ch === '>' || (ch === '=' && !word)) && source[i + 1] === '(' && !sums() && !(word && /\$\[[^\]]*$/.test(word.value))) {
      const inner = lexShell(source, i + 2, true, false);
      const current = open();
      current.computed = true;
      current.subs.push(source.slice(i + 2, inner.end));
      current.value += `${ch}()`;
      i = inner.end;
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
      if (source.startsWith('<<', i) && word && !word.quoted && /^[A-Za-z_][A-Za-z0-9_]*\[[^\]]*$/.test(word.value)) unsure();
      const glued = word !== null;
      const array = word !== null && starts() && /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=$/.test(word.value); // name=( … ) where an assignment may stand // `name=(` opens a list only with nothing between
      // zsh: tickets/(T-01|T-02)* is a pattern: the word is marked as one that a paren follows
      if (ch === '(' && glued && !array && source[i + 1] !== ')' && !sums()) { word.glob = true; word.paren = true; }
      push();
      if (ch === ')') {
        if (stop && parens === 0 && cases === 0) return { tokens, end: i };
        if (parens > 0) parens--;
        if (shift !== null && parens <= shift) shift = null;
        groups.pop();
      }
      if (ch === '(') {
        if (shift === null && source[i + 1] === '(') { shift = parens; shiftSure = closesDoubled(source, i + 2); }
        parens++;
        // zsh: a paren glued to a word (not name=( … )) belongs to the word up to its close
        groups.push(glued && !array);
      }
      const three = source.slice(i, i + 3), two = source.slice(i, i + 2);
      const op = ['&>>', '<<<', '<<-', '>>&'].includes(three) ? three
        : ['||', '&&', '>>', '<<', '>&', '>|', '&>', '<&', '<>', '|&', ';;'].includes(two) ? two : ch;
      i += op.length - 1;
      // zsh writes over an existing file with a `!` or `|` after the operator
      if (['>', '>>', '>&', '&>', '&>>', '>>&'].includes(op) && (source[i + 1] === '!' || source[i + 1] === '|')) i++;
      const token = { op, glued };
      if (op === '<<' || op === '<<-') {
        const sum = sums();
        if (sum === 'maybe') unsure();
        if (!sum) waiting.push({ op: token });
      }
      tokens.push(token);
      continue;
    }
    if ('*?[{'.includes(ch)) open().glob = true;
    if (ch === '~' && !word) open().computed = true;
    open().value += ch;
  }
  push();
  if (stop) unsure(); // the substitution never closes
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
  let redirected = false;
  const command = () => (current ??= { tokens: [], words: [], redirects: [], inputs: [], heredocs: [], separator: '' });
  const finish = (separator = '', closed = false) => {
    if (test && !closed) unsure(); // a test with no ]] is no test
    if (current) {
      current.words = current.tokens.map(token => token.value);
      current.separator = separator === '|&' ? '|' : separator;
      commands.push(current);
    }
    current = null;
    test = false;
    list = false;
    redirected = false;
  };
  // [[ is the test only where the shell reads a reserved word: first in its command,
  // after other reserved words, never after an assignment, a redirect or a quote
  const leading = () => !redirected && (!current || current.tokens.every(token => KEYWORDS.includes(token.value) && !token.quoted && !token.escaped));
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.value !== undefined) {
      if (list) token.assign = true;
      if (!token.quoted && token.value === 'always' && current && current.tokens.length && current.tokens[current.tokens.length - 1].value === '}') { finish(';'); continue; }
      if (!token.quoted && !token.escaped && token.value === '[[' && leading()) test = true;
      command().tokens.push(token);
      if (test && !token.quoted && token.value === ']]') finish(';', true);
      continue;
    }
    if (test && token.newline) continue; // a test may run over several lines
    if (test && ['&&', '||', '(', ')', '<', '>', '|'].includes(token.op)) { command().tokens.push(plain(token.op)); continue; }
    if (token.op === '(' && token.glued && current && current.tokens.length && /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=$/.test(current.tokens[current.tokens.length - 1].value)) { list = true; continue; }
    if (token.op === ')' && list) { list = false; continue; }
    if (SEPARATORS.includes(token.op)) { finish(token.op); continue; }
    const next = tokens[i + 1] && tokens[i + 1].value !== undefined ? tokens[i + 1] : null;
    if (next) i++;
    redirected = true;
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

// The GNU tools as Homebrew installs them: gsed is sed.
const GNU_NAMES = /^g(sed|cp|mv|rm|ln|tar|find|xargs|dd|tee|install|touch|chmod|chown|truncate|sort|shred|unlink|rmdir|cat|head|tail|grep|egrep|fgrep|ls|stat|wc|cut|tr|uniq|split|readlink|realpath|basename|dirname|du|nl|tac|od|comm|join|paste|fold|seq|sha256sum|md5sum|base64|diff|cmp)$/;
// Words that only introduce the command after them.
const KEYWORDS = ['if', 'then', 'else', 'elif', 'fi', 'do', 'done', 'while', 'until', '!', '{', '}'];
// Transparent wrappers: the command they run is the one that matters. Each lists
// the options of its own that take a separate value.
const WRAPPERS = {
  env: ['-u', '--unset', '-C', '--chdir', '-P'], sudo: ['-u', '-g', '-h', '-p', '-C', '-D', '-R', '-r', '-t', '-T', '-U'], doas: ['-u', '-C'],
  command: [], builtin: [], exec: ['-a'], nice: ['-n', '--adjustment'], nohup: [], time: ['-f', '-o'], timeout: ['-s', '-k', '--signal', '--kill-after'],
  xargs: ['-n', '-s', '-I', '-L', '-P', '-d', '-a', '-E', '-J', '-R', '-S'], stdbuf: ['-i', '-o', '-e'], caffeinate: ['-t', '-w'], arch: ['-arch', '-e'],
  ionice: ['-c', '-n', '-p'], setsid: [], chronic: [], unbuffer: [], noglob: [], nocorrect: [], coproc: [], repeat: [], busybox: [], xcrun: [],
  npx: ['-p', '--package'], pnpx: ['-p', '--package'], bunx: ['-p', '--package'],
};
const SHELLS = ['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish'];
// Where the system keeps its programs: `/bin/cat` is cat, `./cat` and `/tmp/e/cat` are not.
const SYSTEM_DIRS = ['/bin', '/sbin', '/usr/bin', '/usr/sbin', '/usr/local/bin', '/usr/local/sbin', '/opt/homebrew/bin', '/opt/homebrew/sbin', '/opt/local/bin',
  '/home/linuxbrew/.linuxbrew/bin', '/snap/bin', '/run/current-system/sw/bin', '/usr/libexec', '/Library/Developer/CommandLineTools/usr/bin', '/Applications/Xcode.app/Contents/Developer/usr/bin'];

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
    // `r{m,}` spells its command with a brace: it may be anything
    // and so may ${x:-…}, whose default the shell runs
    if ((!head.quoted && head.glob && /\{[^{}]*,[^{}]*\}/.test(head.value)) || /^\$\{(?![A-Za-z_][A-Za-z0-9_]*\})/.test(head.value)) opaque = true;
    else if (!head.computed || (head.value.includes('/') && !/[$`]/.test(last) && last !== '')) executable = path.basename(head.value).toLowerCase();
    else if (/^\$\{?SHELL\b/.test(head.value)) executable = 'sh';
    else opaque = true;
    // ${x:-rm} file: the default is the command, with the words after it
    const fallback = /^\$\{[A-Za-z_][A-Za-z0-9_]*:?[-=+]([^]*)\}$/.exec(head.value);
    if (fallback) splits.push([fallback[1], ...argTokens.map(token => token.value)].join(' '));
    if (/^python[0-9.]*$/.test(executable)) executable = 'python3';
    if (GNU_NAMES.test(executable)) executable = executable.slice(1);
  }
  // A program named by a path that is not one of the system's directories may be anything under that name.
  const foreign = Boolean(head) && !opaque && head.value.includes('/') && (head.computed || !SYSTEM_DIRS.includes(path.posix.normalize(head.value.slice(0, head.value.lastIndexOf('/')) || '/')));
  return { executable, opaque, foreign, head, args: argTokens.map(token => token.value), argTokens, words: command.words || [], assignments, wrappers, splits, chdirs, values };
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
  if (c === -1) return null;
  // options may follow -c; the text is the first word that is not one (nor the value of -o)
  for (let i = c + 1; i < args.length; i++) {
    if (/^[-+][oO]$/.test(args[i])) i++;
    else if (!/^[-+]/.test(args[i]) || args[i] === '-' || args[i] === '--') return args[i] === '--' ? args[i + 1] ?? null : args[i];
  }
  return null;
}
// A shell, or a program that may be one, that takes its script from standard
// input: no -c and no script file (`-s` hands the words after it to that script).
function readsScript(parts) {
  if (['source', '.'].includes(parts.executable)) return ['/dev/stdin', '/dev/fd/0', '/proc/self/fd/0'].includes(parts.args[0]);
  if (!parts.opaque && !SHELLS.includes(parts.executable)) return false;
  if (shellCommandFlag(parts.args) !== -1) return false;
  return parts.args.includes('-s') || !parts.args.some((arg, i) => !arg.startsWith('-') && !(i > 0 && ['-o', '+o', '-O', '+O'].includes(parts.args[i - 1])));
}
// A git long option, also in the shortened form git accepts.
const longOption = (arg, name) => arg === name || (arg.length >= 3 && arg.startsWith('--') && name.startsWith(arg));
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
    const saved = new Set(); // here-documents that no shell reads
    if (piped || !heredocIsData(parts, commands[i], reader)) { inner.push(...commands[i].heredocs); if (!shell && !piped) commands[i].heredocs.forEach(body => saved.add(body)); }
    if (shell && shellText(args) !== null) inner.push(shellText(args));
    if (shell || executable === 'eval') inner.push(...commands[i].tokens.flatMap(token => token.subs || []).flatMap(producedText));
    if (executable === 'eval') inner.push(args.filter(arg => arg !== '--').join(' '));
    if (executable === 'trap') inner.push(...args);
    if (['su', 'watch', 'flock', 'script', 'parallel'].includes(executable)) inner.push(...commands[i].tokens.filter(token => token.quoted).map(token => token.value));
    if (readsScript(parts) && i > 0 && commands[i - 1].separator === '|') inner.push(...printed(commands[i - 1]));
    for (const nested of inner) {
      const reason = saved.has(nested) ? loosely(() => dangerousReason(nested, depth + 1)) : dangerousReason(nested, depth + 1);
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
const TICKET_MENTION = new RegExp(`(?<![a-z0-9_-])tickets${SEP}(?:t-(?:[0-9]|$)|[*?\\[{^(])`, 'i');
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
// A path asked for once is not looked up again, and nothing is looked up under a
// directory that is not there.
const realPaths = new Map();
function realPath(file) {
  if (realPaths.has(file)) return realPaths.get(file);
  const parent = path.dirname(file);
  let real = null;
  if (parent === file || realPath(parent) !== null) { try { real = fs.realpathSync(file); } catch { /* not there */ } }
  realPaths.set(file, real);
  return real;
}
function realish(file) {
  const tail = [];
  for (let head = file; ;) {
    const real = realPath(head);
    if (real !== null) return path.join(real, ...tail);
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
  if (realPath(file) === null) return ''; // nothing there
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
  inTime();
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
    else if (ch === '[' && close !== -1) {
      const set = `[${text.slice(i + 1, close).replace(/^!/, '^').replace(/\\/g, '\\\\')}]`;
      // a set no shell can read ([z-a]) matches nothing but itself
      let valid = true;
      try { new RegExp(set); } catch { valid = false; }
      if (valid) { out += set; i = close; } else out += '\\[';
    }
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
  // the directory in front of the pattern may be another spelling of the same place (/tmp, a link)
  const cut = pattern.search(/[*?[{]/);
  const dir = cut === -1 ? '' : pattern.slice(0, pattern.lastIndexOf('/', cut) + 1);
  const real = dir ? globMatcher(slashed(path.join(realish(dir), pattern.slice(dir.length)))) : null;
  const kinds = knownProtected().filter(entry => matcher.test(slashed(entry.file)) || (real && real.test(slashed(entry.file)))).map(entry => entry.kind);
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
  if (!token.computed && !token.glob && path.isAbsolute(text)) {
    const kind = located(text);
    // an awk or sed program that opens with a slash is code, not a path
    if (kind || !/[\s'"{(;]/.test(text)) return kind || 'other';
  }
  if (mentionsTicket(token.paren ? `${text}(` : text)) return 'ticket';
  if (mentionsEngine(text)) return 'engine';
  if (token.computed) {
    if (/(^|\/)T-[0-9]+[^/]*$/i.test(text)) return 'ticket';
    // ~/x and $HOME/x are written out but for the home directory, which is known here
    const home = !scope.rehome && !token.glob && /^(~|\$HOME|\$\{HOME\})(\/[^$`~]*)?$/.exec(text);
    if (home && !text.includes('..')) {
      const file = path.join(os.homedir(), home[2] || '');
      const above = roots().some(root => `${slashed(root).toLowerCase()}/`.startsWith(`${slashed(file).toLowerCase().replace(/\/$/, '')}/`));
      return located(file) || (above ? 'unknown' : 'other');
    }
    // "$PWD/tickets": the directory that holds them, wherever the variable points
    if (/\/(tickets|scripts|\.claude)\/*$/i.test(text)) return 'holder';
    // tickets/$f: a name the shell works out, in the directory that holds the tickets
    if (/(^|\/)tickets\/[^/]*[$`][^/]*$/i.test(text)) return 'ticket';
    return !scope.retmp && /^\$(TMPDIR|\{TMPDIR\})\/[^$`~]*$/.test(text) && !text.includes('..') ? 'other' : 'unknown';
  }
  const kinds = [...scope.cwds].map(cwd => (token.glob ? globbed(path.resolve(cwd, text)) : located(path.resolve(cwd, text))));
  const kind = ['ticket', 'engine', 'holder'].find(name => kinds.includes(name));
  if (kind) return kind;
  if (scope.adrift) { const guess = adriftKind(text, token.glob); if (guess) return guess; }
  return token.glob || scope.lost || /^T-[0-9]+/i.test(path.basename(text)) ? 'unknown' : 'other';
}
// A line with more `cd` steps than are followed (`scope.adrift`) may stand anywhere,
// so a relative word is taken for what its last part can name: a ticket, a file or a
// directory of the engine, a directory that holds them, or the directory itself.
function adriftKind(text, glob) {
  const last = text.replace(/\/+$/, '').split('/').pop();
  if (last === '' || last === '.' || last === '..') return 'holder';
  if (/^t-[0-9*?[{]/i.test(last)) return 'ticket';
  const matcher = glob ? globMatcher(last) : null;
  if (glob && !matcher) return 'ticket';
  const same = (name) => (matcher ? matcher.test(name) : name.toLowerCase() === last.toLowerCase());
  const kinds = knownProtected().filter(entry => same(path.basename(entry.file))).map(entry => entry.kind);
  return ['ticket', 'engine', 'holder'].find(kind => kinds.includes(kind)) || '';
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
  if (scope.adrift && !path.isAbsolute(token.value)) return true;
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

// The path a file system that ignores case would open: each part matched to the
// entry there is, whatever its case. Null when there is none.
function foldedPath(file) {
  const absolute = path.resolve(file);
  let at = path.parse(absolute).root;
  for (const part of absolute.slice(at.length).split(path.sep).filter(Boolean)) {
    let names;
    try { names = fs.readdirSync(at); } catch { return null; }
    const match = names.includes(part) ? part : names.find(name => name.toLowerCase() === part.toLowerCase());
    if (!match) return null;
    at = path.join(at, match);
  }
  return at;
}
// What is in the file now. A ticket is a ticket in any case (located), so where the
// file system tells cases apart the ticket of that name is the one compared: the
// guard answers the same on Linux as on macOS and Windows.
function existingContent(file) {
  const absolute = absoluteToolPath(file);
  try { return fs.readFileSync(absolute, 'utf8'); } catch { /* not under this spelling */ }
  const folded = foldedPath(absolute);
  try { return folded ? fs.readFileSync(folded, 'utf8') : null; } catch { return null; }
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
  if (executable === 'python3') return args.some(arg => /^-(?!-)[A-Za-z]*c/.test(arg));
  if (executable === 'php') return args.includes('-r');
  if (['osascript', 'lua'].includes(executable)) return args.includes('-e');
  return ['perl', 'ruby'].includes(executable) && args.some(arg => /^-[A-Za-z0-9]*[eE]$/.test(arg) || /^-[lnpawsWT0-9]*[eE]./.test(arg));
}
// The word that names one of the project's own engine scripts being run, or null.
function ownRun(parts, scope = null) {
  // from a directory the line moved to (cd evidence/<sha> && node ../../scripts/pincer-evidence.cjs): the
  // entry points that write no ticket; the ticket script is its own only by the spellings of ownScript
  const moved = (token, rel) => Boolean(scope) && !WRITER_WORD.test(rel) && !token.computed && !token.glob && !path.isAbsolute(token.value) &&
    [...scope.cwds].some(cwd => path.resolve(cwd, token.value) === path.join(projectRoot(), rel));
  const runnable = (token) => RUNNABLE.some(rel => ownScript(token.value, rel) || moved(token, rel));
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
  // a switch in a directory written out is judged like `cd <dir> && git checkout <ref>`: the ref is no path there
  const wide = branchSwitch ? widePathspec(positional[0].replace(/[$`]/g, 'x'), /[$`~]/.test(cdir) ? cdir : '') : positional.some(p => widePathspec(p, cdir));
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
// The scripts a sed command is given: each -e, or else its first word.
function sedScripts(parts) {
  const { args, argTokens } = parts;
  const scripts = [];
  argTokens.forEach((token, i) => {
    if (i > 0 && ['-e', '--expression'].includes(args[i - 1])) scripts.push(token.value);
    else if (/^--expression=/.test(token.value)) scripts.push(token.value.slice('--expression='.length));
    else if (/^-e./.test(token.value)) scripts.push(token.value.slice(2));
  });
  if (!scripts.length) scripts.push(...argTokens.filter(token => !token.value.startsWith('-')).slice(0, 1).map(token => token.value));
  return scripts;
}
// GNU sed's e command and s///e flag run a command.
const sedRuns = (script) => /(^|[;{}\n])\s*([0-9]+|\$|\/[^/\n]*\/)?(,([0-9]+|\$|\/[^/\n]*\/))?\s*!?\s*e(\s|$)/.test(script) || /s([^A-Za-z0-9\s\\])(?:(?!\1).)*\1(?:(?!\1).)*\1[a-zA-Z0-9]*e/.test(script);
// The files a sed script writes with its w command or its s///w flag.
function sedTargets(parts) {
  return sedScripts(parts).flatMap(text => [...text.matchAll(/(?:^|[;{}\n/0-9$,!])[gpIiMm0-9]*\s*[wW]\s+([^;\n}]+)/g)].map(match => ({ ...plain(match[1].trim()), computed: /[$`]/.test(match[1]) })));
}

// Whether a command only reads: a reader by name, or one of those that write
// only when asked to. Each is a reader in the form that cannot write a protected
// file: sort without -o or with -o elsewhere, uniq without a second file, sed
// without -i, awk without a redirect, a pipe or -i, tar that creates or lists,
// gzip to standard output, curl without an output option, a syntax check, chmod
// that only keeps a script executable, gh and rg apart from the forms that write.
function reads(parts, scope) {
  const { executable, args, argTokens } = parts;
  if (untrusted(parts, scope)) return false;
  // a reader told to write: less -o <file>, and any --output <file> that is protected
  if (executable === 'less' && args.some(arg => /^-[A-Za-z]*[oO]/.test(arg) || /^--log-file/i.test(arg))) return false;
  if (argTokens.some((token, i) => /^--out/.test(token.value) && [token, argTokens[i + 1]].filter(Boolean).some(one => protectedKind(argReach(one, scope))))) return false;
  if (READERS.has(executable)) return true;
  const positional = argTokens.filter(token => !token.value.startsWith('-') || token.value === '-');
  const elsewhere = (token) => { const kind = reach(token, scope); return kind === 'other' || (kind === 'unknown' && !scope.tainted); };
  if (executable === 'gh') return !args.some(arg => ['download', 'clone'].includes(arg));
  if (executable === 'rg') return !args.some(arg => arg.startsWith('--pre'));
  if (executable === 'chmod') { const mode = positional[0] ? positional[0].value : ''; return /^[ugoa]*\+x$/.test(mode) || /^0?[57][0-5][0-5]$/.test(mode); }
  if (['node', 'nodejs'].includes(executable)) { const script = args.findIndex(arg => !arg.startsWith('-')); return (script === -1 ? args : args.slice(0, script)).some(arg => arg === '--check' || arg === '-c'); }
  if (SHELLS.includes(executable)) { const script = args.findIndex(arg => !/^[-+]/.test(arg)); return shellCommandFlag(args) === -1 && (script === -1 ? args : args.slice(0, script)).includes('-n'); }
  if (executable === 'sort') return optionValues(argTokens, 'o', ['--o', '--ou', '--out', '--outp', '--outpu', '--output']).every(elsewhere);
  if (executable === 'uniq') return positional.length < 2;
  // sed in place, or GNU sed's e command and s///e flag, which run a command
  if (executable === 'sed') return !args.some(arg => /^-[^-]*[iI]/.test(arg) || /^--i(n(-(p(l(a(c(e)?)?)?)?)?)?)?(=|$)/.test(arg)) &&
    !sedScripts(parts).some(sedRuns);
  if (['gzip', 'gunzip', 'bzip2', 'xz', 'zstd'].includes(executable)) return args.some(arg => /^-[cdfklqtvz1-9]*[clt][cdfklqtvz1-9]*$/.test(arg) || ['--stdout', '--to-stdout', '--list', '--test'].includes(arg));
  if (executable === 'curl') return !args.some(arg => (!arg.startsWith('--') && /^-[A-Za-z]*[oODcJ]/.test(arg)) || /^--(output|remote-name|dump-header|cookie-jar|trace|stderr|create-dirs)/.test(arg)) && !argTokens.some(token => protectedKind(argReach(token, scope)));
  if (executable === 'tar' || executable === 'bsdtar') {
    const mode = args[0] || '';
    // a program tar is told to run
    if (args.some(arg => /^(-I|-F)$|^--(use-compress-program|to-command|checkpoint-action|rsh-command|info-script|new-volume-script)/.test(arg))) return false;
    if (/^-?[A-Za-z]*t/.test(mode) && !/[xcru]/.test(mode)) return true;
    if (args.includes('--remove-files') || !(args.includes('--create') || (/^-?[A-Za-z]*c/.test(mode) && !/[xru]/.test(mode)))) return false;
    const archive = optionValues(argTokens, 'f', ['--file'])[0] || (/^[A-Za-z]*f$/.test(mode) ? argTokens[1] : null);
    return Boolean(archive) && (archive.value === '-' || elsewhere(archive));
  }
  if (AWKS.includes(executable)) {
    if (args.some(arg => ['-i', '--include', '-f', '--file', '-o', '-p', '-d', '-D', '-e', '-E', '--exec'].includes(arg) || /inplace|^--(source|dump-variables|profile|pretty-print|debug)|^-[opdD]./.test(arg))) return false;
    const program = argTokens.find((token, i) => !token.value.startsWith('-') && !(i > 0 && ['-v', '-F', '--assign', '--field-separator'].includes(args[i - 1])));
    return Boolean(program) && !/(>>?|\|&?)\s*"|print[^;}\n]*(>>?|\|)\s*[A-Za-z_($]|system\s*\(|\bgetline\b/.test(awkBare(program.value.replace(/\\\n/g, ' ')));
  }
  return false;
}

// The names the guard is lenient with: readers, the forms of other commands that only
// read, git, find and the copies. Under such a name a program is the system's only
// when it is called by that name or from a system directory, and the line gives the
// name no other meaning (a function, an alias, `hash name=…`, a PATH set for that one
// command). A PATH set for the rest of the line is not followed: docs/engine.md.
const LENIENT = new Set([...READERS, 'gh', 'rg', 'chmod', 'node', 'nodejs', ...SHELLS, 'sort', 'uniq', 'sed', 'gzip', 'gunzip', 'bzip2', 'xz', 'zstd', 'curl', 'tar', 'bsdtar', ...AWKS, 'git', 'find', ...COPIERS]);
const untrusted = (parts, scope) => LENIENT.has(parts.executable) &&
  (parts.foreign || Boolean(scope.renamed && scope.renamed.has(parts.executable)) || parts.assignments.some(token => /^PATH\+?=/.test(token.value)));

// An awk program with its strings emptied, so that a bar or an arrow printed between
// columns is not taken for a pipe or a redirect. A program with a `/` or a `#` outside
// its strings is left as it is: a quote inside a pattern or a comment would be misread.
function awkBare(program) {
  let bare = '';
  for (let i = 0; i < program.length; i++) {
    const ch = program[i];
    if (ch === '/' || ch === '#') return program;
    if (ch !== '"') { bare += ch; continue; }
    let end = i + 1;
    while (end < program.length && program[end] !== '"') end += program[end] === '\\' ? 2 : 1;
    if (end >= program.length) return program;
    bare += '""';
    i = end;
  }
  return bare;
}

// Whether a file of this name is protected in a holder directory known only by its last part.
function landsProtected(holder, source) {
  const name = path.basename(source.replace(/\/+$/, ''));
  const last = holder.replace(/\/+$/, '').split('/').pop().toLowerCase();
  if (last === 'tickets') return /^t-[0-9]/i.test(name);
  if (last === 'scripts') return /^(pincer|pincer-.*\.(sh|cjs)|sync-prompts\.sh)$/i.test(name);
  return /^(hooks|settings\.json)$/i.test(name);
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
    if (kind === 'holder' && (whole || scope.adrift || sources.some(token => token.value.endsWith('/')))) return true;
    if (whole && scope.tainted && aboveRoot(destination, scope)) return true;
    if (destination.computed || destination.glob) {
      // "$ROOT/tickets": what lands there keeps its name, and a name the shell works out may be any
      if (kind === 'holder' && sources.some(source => source.computed || source.glob || landsProtected(destination.value, source.value))) return true;
      continue;
    }
    for (const source of sources) {
      if (source.computed || source.glob) { if (kind === 'holder') return true; continue; }
      if ([...scope.cwds].some(cwd => located(path.resolve(cwd, destination.value, path.basename(source.value))))) return true;
    }
  }
  return false;
}

// What a find expression asks for: where it starts, how deep it goes, and its
// actions (-delete, the writing prints, the command of each -exec). An action acts
// on what the tests in front of it let through, in its own -o branch only: in
// 'a -o b -delete' the delete follows b, and in '-delete -name x' nothing narrows
// it. A negated test narrows nothing here, and neither does anything inside a
// \( … \) that is negated or holds an -o.
function findPlan(parts) {
  const tokens = parts.argTokens;
  // `whole` is what the search can print, for a line that hands it on (find … | xargs)
  const plan = { starts: [], actions: [], files: [], depth: Infinity, whole: { tests: [], type: '', empty: false } };
  let i = 0;
  while (tokens[i] && /^-[HLPEXdfsx]+$/.test(tokens[i].value)) i++;
  while (tokens[i] && !/^[-!(]/.test(tokens[i].value)) plan.starts.push(tokens[i++]);
  const branch = () => ({ tests: [], type: '', empty: false });
  let now = branch();
  const groups = []; // for each open \( whether what is inside narrows nothing
  let grouped = 0;
  let negated = false;
  const act = (more) => plan.actions.push({ tests: [...now.tests], type: now.type, empty: now.empty, ...more });
  for (; i < tokens.length; i++) {
    const value = tokens[i].value;
    const narrows = !negated && !grouped;
    if (value === '!' || value === '-not') { negated = true; continue; }
    if (value === '(') {
      let end = i + 1;
      for (let open = 1; end < tokens.length; end++) { if (tokens[end].value === '(') open++; else if (tokens[end].value === ')' && --open === 0) break; }
      groups.push(negated || tokens.slice(i, end).some(token => ['-o', '-or', ','].includes(token.value)));
      grouped = groups.filter(Boolean).length;
    } else if (value === ')') { groups.pop(); grouped = groups.filter(Boolean).length; }
    else if (['-o', '-or', ','].includes(value)) { plan.loose = true; if (!grouped) now = branch(); }
    else if (/^-i?(name|path|wholename|regex|lname)$/.test(value)) {
      const test = tokens[i + 1] && { token: tokens[i + 1], name: /name$/.test(value), regex: /regex$/.test(value) };
      if (test && narrows) now.tests.push(test);
      if (test && !negated) plan.whole.tests.push(test);
      i++;
    }
    else if (value === '-maxdepth' && tokens[i + 1]) { const depth = Number(tokens[++i].value); plan.depth = Number.isFinite(depth) ? depth : Infinity; }
    else if (value === '-empty') { if (narrows) now.empty = true; plan.whole.empty = !negated; }
    else if (value === '-type' && tokens[i + 1]) { if (narrows) now.type = tokens[i + 1].value; if (!negated) plan.whole.type = tokens[i + 1].value; i++; }
    else if (/^-(exec|execdir|ok|okdir)$/.test(value)) {
      let end = i + 1;
      while (end < tokens.length && tokens[end].value !== ';' && tokens[end].value !== '+') end++;
      act({ run: tokens.slice(i + 1, end), each: Boolean(tokens[end]) && tokens[end].value === ';' });
      i = end;
    } else if (value === '-delete') act({ direct: true });
    else if (/^-(fprint|fprint0|fprintf|fls)$/.test(value)) plan.files.push(tokens[++i] || null); // the file it writes its list to
    negated = false;
  }
  if (plan.loose) plan.whole.tests = [];
  return plan;
}
function passesTest({ token, name, regex }, entry) {
  if (token.computed || regex) return true;
  const matcher = globMatcher(token.value, !name);
  if (!matcher) return true;
  const forms = name ? [path.basename(entry.file)] : roots().flatMap(root => { const rel = slashed(path.relative(root, entry.file)); return [slashed(entry.file), rel, `./${rel}`]; });
  return forms.some(text => matcher.test(text));
}
// The protected files an action can be handed, where the search starts from paths
// written out: those there are now, under a start, within the depth, that pass the
// tests in front of the action.
function findReach(plan, action, scope) {
  return knownProtected().filter(entry => {
    if ((action.type === 'f' && entry.dir) || (action.type === 'd' && !entry.dir)) return false;
    if (action.empty) { try { if (entry.dir || fs.statSync(entry.file).size) return false; } catch { return false; } }
    const under = (scope.adrift && plan.starts.some(start => !path.isAbsolute(start.value))) || [...scope.cwds].some(cwd => plan.starts.some(start => {
      const rel = path.relative(path.resolve(cwd, start.value), entry.file);
      return !rel.startsWith('..') && !path.isAbsolute(rel) && (rel === '' ? 0 : rel.split(path.sep).length) <= plan.depth;
    }));
    return under && action.tests.every(test => passesTest(test, entry));
  });
}
const findLiteral = (plan) => plan.starts.length > 0 && plan.starts.every(token => !token.computed && !token.glob);
// Whether what an action is handed can be a protected file. With a start the shell
// computes it is assumed, unless a name test rules every protected file out.
function findCovers(plan, action, scope) {
  if (findLiteral(plan)) return findReach(plan, action, scope).length > 0;
  const tests = action.tests;
  return !tests.length || tests.some(test => /^\*?t-[0-9*?[]/i.test(test.token.value) || mentions(test.token.value) || knownProtected().some(entry => passesTest(test, entry)));
}
const asCommand = (list) => {
  const kept = list.filter(token => token.value !== '{}');
  return { tokens: kept, words: kept.map(token => token.value), redirects: [], inputs: [], heredocs: [], separator: '' };
};
// '-exec cp {} <elsewhere> \;' copies what it finds out, one file at a time: the same
// copy is judged with each protected file it can be handed standing where {} is.
function findCopiesOut(plan, action, scope, depth) {
  const run = action.run;
  if (!action.each || !findLiteral(plan) || !run.length || run[0].computed || run[0].value !== 'cp') return false;
  if (run.filter(token => token.value.includes('{}')).length !== 1 || !run.some(token => token.value === '{}')) return false;
  return findReach(plan, action, scope).every(entry => {
    const tokens = run.map(token => (token.value === '{}' ? plain(entry.file) : token));
    return !commandWrites({ tokens, words: tokens.map(token => token.value), redirects: [], inputs: [], heredocs: [], separator: '' }, scope, false, depth + 1);
  });
}
// find only reads until it is given an action. An action is a write when what it is
// handed can be a protected file and it is not a command that only reads.
function findWrites(parts, scope, depth) {
  const plan = findPlan(parts);
  if (plan.files.some(file => { const kind = file ? reach(file, scope) : 'unknown'; return protectedKind(kind) || (kind === 'unknown' && scope.tainted); })) return true;
  return plan.actions.some(action => {
    const run = action.run ? asCommand(action.run) : null;
    if (!findCovers(plan, action, scope)) return Boolean(run) && commandWrites(run, scope, false, depth + 1);
    if (!run) return true;
    if (findCopiesOut(plan, action, scope, depth)) return false;
    return !reads(commandParts(run), scope) || commandWrites(run, scope, false, depth + 1);
  });
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
  // a variable set for git that names a protected path (GIT_EXTERNAL_DIFF='cp … <ticket>')
  if (parts.assignments.some(token => protectedKind(argReach(token, scope)))) return true;
  const stdinPathspec = !sub.args.some(arg => !arg.startsWith('-')) || sub.args[sub.args.length - 1] === '--';
  if (fed && ((['checkout', 'restore', 'clean'].includes(sub.name) && stdinPathspec) || ['', 'reset', 'stash'].includes(sub.name))) return true;
  const tokens = sub.args.length ? parts.argTokens.slice(-sub.args.length) : [];
  const local = sub.cdir
    ? { ...scope, cwds: new Set([...scope.cwds].flatMap(cwd => [cwd, path.resolve(cwd, sub.cdir)])), lost: scope.lost || /[$`~]/.test(sub.cdir) }
    : scope;
  const after = (i, names) => i > 0 && names.includes(tokens[i - 1].value);
  // commands git is told to run: rebase --exec, an alias, a config value that starts with !
  if (sub.name === 'rebase' && tokens.some((token, i) => {
    const value = token.value;
    const glued = /^--e(x(e(c)?)?)?=/.test(value) ? value.slice(value.indexOf('=') + 1) : /^-x./.test(value) ? value.slice(2) : null;
    return (i > 0 && (tokens[i - 1].value === '-x' || longOption(tokens[i - 1].value, '--exec')) && code(value)) || (glued !== null && code(glued));
  })) return true;
  if (sub.name === 'config') {
    const words = tokens.filter(token => !token.value.startsWith('-'));
    if (words[1] && words[1].value.startsWith('!') && code(words[1].value.slice(1))) return true;
    if (words[1] && /^alias\./.test(words[0].value) && !words[1].value.startsWith('!') && code(`git ${words[1].value}`)) return true;
    // a value that names a protected path: a file to write (--file, also shortened), a command git runs later (core.fsmonitor)
    if (tokens.some(token => protectedKind(argReach(token, local)))) return true;
  }
  // git grep -O<pager> runs the pager on the files it finds
  if (sub.name === 'grep' && (scope.tainted || scope.holds) && tokens.some(token => /^-O/.test(token.value) || (token.value.length >= 4 && '--open-files-in-pager'.startsWith(token.value.split('=')[0])))) return true;
  if (sub.name === 'rm' && (sub.args.includes('--') ? sub.args.slice(0, sub.args.indexOf('--')) : sub.args).includes('--cached')) return false; // the index only
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
      const outputFlag = (value) => /^--output/.test(value) || (value.split('=')[0].length >= 4 && '--output'.startsWith(value.split('=')[0]));
      const output = outputFlag(token.value) || (i > 0 && outputFlag(tokens[i - 1].value)) || (after(i, ['-o']) && ['format-patch', 'archive'].includes(sub.name));
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
  const pre = executable === 'rg' && args.some(arg => arg.startsWith('--pre'));
  const known = WRITERS.has(executable) || parts.opaque || pre;
  // inside a here-document that is saved or passed on, only what is known to write counts
  if (scope.lenient && !known) return false;
  const inline = !shell && inlineCode(executable, args);
  const near = scope.tainted || scope.holds;
  // the whole command is a variable: what it holds may be the text this line names
  if (parts.opaque && scope.tainted && (/^\$\{/.test(parts.head.value) || (/^\$[A-Za-z_@*0-9]/.test(parts.head.value) && !parts.head.value.includes('/')))) return true;
  // zsh: `- command` runs the command
  if (executable === '-' && argTokens.length) return commandWrites({ tokens: argTokens, words: args, redirects: [], inputs: [], heredocs: [], separator: '' }, scope, false, depth + 1);
  // commands handed down a pipe to parallel; an archive unpacked where the line stands
  if (executable === 'parallel' && near) return true;
  const unpacks = executable === 'unzip' || (['tar', 'bsdtar'].includes(executable) && (/^-?[A-Za-z]*x/.test(args[0] || '') || args.some(arg => ['--extract', '--get'].includes(arg))));
  if (unpacks && near && !optionValues(argTokens, executable === 'unzip' ? 'd' : 'C', ['--directory', '--cd']).some(token => reach(token, scope) === 'other')) return true;
  // a runner the guard does not know that is handed an interpreter runs the program in its quotes
  const carries = !known && args.some(arg => { const base = path.basename(arg).toLowerCase(); return SHELLS.includes(base) || INTERPRETERS.includes(base) || /^python[0-9.]*$/.test(base); });
  if (carries && command.heredocs.some(mentions)) return true;
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
  else if ((SHELLS.includes(executable) || interpreter) && !inline) { script = tokens.find(token => !token.value.startsWith('-')) || null; tokens = tokens.filter(token => token !== script); }
  // xargs handing files to a shell line that only reads them is a read
  const fedReads = fed && text !== null && shellCommands(text).every(inner => !inner.redirects.length && (!commandParts(inner).head || reads(commandParts(inner), scope)));
  let blind = fed && !fedReads;
  for (const token of [...parts.assignments, ...tokens]) {
    if (!known && !carries && token.quoted && /\s/.test(token.value)) continue;
    const kind = argReach(token, scope);
    if (protectedKind(kind) || (kind === 'holder' && (TREE.has(executable) || executable === 'tar' || executable === 'watch' || parts.opaque || pre))) return true;
    if (['rm', 'rmdir', 'chmod', 'chown', 'chgrp', 'chflags'].includes(executable) && !token.value.startsWith('-') && aboveRoot(token, scope)) return true;
    if (kind === 'unknown') blind = true;
  }
  if (interpreter || ['ed', 'ex'].includes(executable)) {
    // the paths a program names in quotes, read from where the line stands
    // … and a program printed into a substitution: python3 <(echo "…")
    const printedPrograms = command.tokens.flatMap(token => token.subs || []).flatMap(producedText);
    const programs = [...(inline ? tokens.filter(token => token.quoted).map(token => token.value) : []), ...command.heredocs, ...printedPrograms];
    let holder = false, named = false;
    for (const program of programs) for (const match of program.matchAll(/['"]([^'"\n]{1,200})['"]/g)) {
      if (protectedKind(reach({ ...plain(match[1]), glob: /[*?[]/.test(match[1]) }, scope))) return true;
      holder ||= /^(\.\/)?tickets\/?$/i.test(match[1]);
      named ||= /^T-[0-9*?[]/i.test(match[1]);
    }
    // the tickets directory and a ticket's name or pattern, put together by the program
    if (holder && named) return true;
    if (command.heredocs.some(mentions) || printedPrograms.some(mentions)) return true;
    // a program written by here-document on this line, or one that arrives on standard input
    if (interpreter && scope.scripted) return true;
    // one that arrives on standard input from elsewhere: not a here-document, which was read above, and not `node -v`
    const version = !args.includes('-') && args.some(arg => ['--version', '--help', '-h', executable === 'python3' ? '-V' : '-v'].includes(arg));
    if (interpreter && !inline && scope.tainted && !command.heredocs.length && !version && args.every(arg => arg === '-' || /^-[A-Za-z]$/.test(arg))) return true;
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
  const own = ownRun(parts, scope);
  for (const token of [...command.tokens, ...command.redirects.filter(Boolean), ...command.inputs]) {
    const kind = token === own ? 'other' : argReach(token, scope);
    if (protectedKind(kind) || kind === 'holder') found.add(kind);
  }
  for (const body of command.heredocs) {
    if (mentionsTicket(body)) found.add('ticket');
    if (mentionsEngine(body)) found.add('engine');
  }
  if (parts.executable === 'find') { const plan = findPlan(parts); if (findCovers(plan, plan.whole, scope)) found.add('ticket'); }
  for (const sub of substitutions(command)) for (const inner of shellCommands(sub)) for (const kind of marks(inner, scope, depth + 1)) found.add(kind);
  return found;
}

// What a line says about its own variables, worked out before anything is judged.
// `consts`: a variable the line gives one written value, in the assignments it opens
// with, and names nowhere else but to read it (S=/tmp/out; cp <ticket> $S/copy.md).
// Nothing on the line may be able to set a variable by a name it works out: no eval,
// source, read, declare, export, printf -v, $'…', and no command that is itself a
// variable. `repwd`: the line names PWD other than to read it, so $PWD is not followed.
const SETTERS = ['eval', 'source', '.', 'trap', 'read', 'declare', 'typeset', 'local', 'readonly', 'export', 'let', 'getopts', 'mapfile', 'readarray', 'unset', 'integer', 'float', 'vared', 'nameref'];
const RESERVED = /^(PWD|OLDPWD|PATH|HOME|TMPDIR|CDPATH|IFS|ENV|BASH_ENV|ZDOTDIR|CLAUDE_PROJECT_DIR|GIT_.*)$/;
function lineFacts(source, commands, outer) {
  const repwd = Boolean(outer && outer.repwd) || /(?<![A-Za-z0-9_])PWD(?![A-Za-z0-9_])/.test(source.replace(/\$(\{PWD\}|PWD(?![A-Za-z0-9_]))/g, ''));
  const consts = new Map();
  if (outer) return { repwd, consts };
  const sets = commands.some(command => {
    const parts = commandParts(command);
    return parts.opaque || SETTERS.includes(parts.executable) || (['printf', 'print'].includes(parts.executable) && parts.args.some(arg => /^-[A-Za-z]*v/.test(arg))) ||
      (parts.executable === 'set' && parts.args.some(arg => /^[-+][A-Za-z]*A/.test(arg))) || command.tokens.some(token => token.ansi);
  });
  if (sets) return { repwd, consts };
  // name=$(mktemp) and name=$(mktemp -d): a new file or directory under the temporary directory
  const fresh = !/TMPDIR/.test(source) && !/mktemp\s*\(\)|(function|alias|hash)\s[^;\n]*mktemp/.test(source);
  const value = (token) => {
    if (token.assign || token.glob) return null;
    const made = fresh && token.computed && !token.ansi && token.subs.length === 1 && /^mktemp(\s+-d)?$/.test(token.subs[0].trim()) && /^([A-Za-z_][A-Za-z0-9_]*)=\$\(\)$/.exec(token.value);
    if (made) return [made[1], path.join(os.tmpdir(), 'pincer-mktemp', made[1])];
    const written = !token.computed && /^([A-Za-z_][A-Za-z0-9_]*)=([A-Za-z0-9_@%+,./][A-Za-z0-9_@%+,./-]*)$/.exec(token.value);
    return written ? [written[1], written[2]] : null;
  };
  // An assignment counts where it is sure to run before anything reads it: among the
  // statements the line opens with, or later as a statement of its own on a line with no
  // compound command (if, for, { }, a subshell, a function).
  const compound = commands.some(command => ['(', ')'].includes(command.separator) ||
    command.tokens.some(token => !token.quoted && (KEYWORDS.includes(token.value) || ['for', 'case', 'esac', 'select', 'function', 'coproc'].includes(token.value))));
  let leading = true;
  commands.forEach((command, i) => {
    const pure = [';', '&&', ''].includes(command.separator) && command.tokens.length > 0 && !command.redirects.length && !command.inputs.length && !command.heredocs.length && command.tokens.every(value);
    if (!pure) { leading = false; return; }
    if (leading || (!compound && commands[i - 1].separator === ';')) for (const token of command.tokens) consts.set(...value(token));
  });
  for (const name of [...consts.keys()]) {
    const all = [...source.matchAll(new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`, 'g'))];
    const refs = [...source.matchAll(new RegExp(`\\$(?:\\{${name}\\}|${name}(?![A-Za-z0-9_]))`, 'g'))];
    // named once to set it and otherwise only read, and set before the first read
    const set = all.find(match => !/[$\{]$/.test(source.slice(0, match.index)));
    if (RESERVED.test(name) || all.length !== refs.length + 1 || !set || (refs.length && refs[0].index < set.index)) consts.delete(name);
  }
  return { repwd, consts };
}
// A word made of written text and variables whose value is known here, as the word it
// is: $S/y with S=/tmp/out, $PWD/x from where the line stands, $CLAUDE_PROJECT_DIR/x.
// A zsh modifier or subscript after the name ($S:h, $S[1]) leaves the word computed.
function settle(token, facts) {
  if (!token || !token.computed || token.ansi || (token.subs && token.subs.length) || /^~|`/.test(token.value)) return token;
  let failed = false;
  const value = token.value.replace(/\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}(?![[:])|([A-Za-z_][A-Za-z0-9_]*)(?![A-Za-z0-9_[:]))/g, (whole, braced, bare, offset) => {
    const name = braced || bare;
    if (name === 'PWD' && !facts.repwd && offset === 0) return '.';
    if (name === 'CLAUDE_PROJECT_DIR') return projectRoot();
    if (facts.consts.has(name)) return facts.consts.get(name);
    failed = true;
    return whole;
  });
  return failed || /[$`]/.test(value) ? token : { ...token, value, computed: false };
}
function settleCommand(command, facts) {
  const tokens = command.tokens.map(token => settle(token, facts));
  return { ...command, tokens, words: tokens.map(token => token.value), redirects: command.redirects.map(token => settle(token, facts)), inputs: command.inputs.map(token => settle(token, facts)) };
}

// Where the commands of a line can stand and what the line names. Every `cd`,
// `pushd` and `env -C` adds the directory it leads to, whichever command comes
// first: a relative path is protected if it is from any of them. `tainted`: the
// line names a protected path (`ticketed`: a ticket); `holds`: a directory that
// holds them; `scripted`: a here-document that is saved or passed on names one;
// `retmp`: the line sets TMPDIR; `lost`: it moves somewhere that is computed.
// The directories are followed up to CWDS of them. A line with more `cd` steps
// than that is `adrift`: it is judged as a line that names a protected file, and a
// relative word on it from where the line started and by what its last part can
// name (adriftKind).
const CWDS = 1024;
function scopeOf(commands, outer) {
  const start = [typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : projectRoot(), projectRoot(), process.cwd()];
  const scope = outer
    ? { ...outer, cwds: new Set(outer.cwds) }
    : { cwds: new Set(start.map(dir => path.resolve(dir))), renamed: new Set(), repwd: false, lost: false, adrift: false, tainted: false, ticketed: false, holds: false, scripted: false, retmp: false, rehome: false, lenient: false };
  // a name the line gives another meaning: a function, an alias, hash name=…
  const rename = (name) => { if (name) scope.renamed.add(path.basename(name).toLowerCase()); };
  for (const command of commands) {
    const words = command.tokens;
    if (words.length === 1 && command.separator === '(' && !words[0].quoted) rename(words[0].value);
    words.forEach((token, i) => { if (token.value === 'function' && !token.quoted && words[i + 1]) rename(words[i + 1].value.replace(/\(\)$/, '')); });
    const parts = commandParts(command);
    if (['alias', 'hash'].includes(parts.executable)) for (const arg of parts.args) if (!arg.startsWith('-')) rename(arg.split('=')[0]);
  }
  const started = [...scope.cwds];
  const add = (dir) => { if (scope.cwds.size < CWDS) scope.cwds.add(dir); else if (!scope.cwds.has(dir)) scope.adrift = true; };
  const stand = (target) => {
    if (scope.adrift) return;
    if (!target) { add(os.homedir()); return; }
    const known = /^(\$PWD|\$\{PWD\}|\$CLAUDE_PROJECT_DIR|\$\{CLAUDE_PROJECT_DIR\})(\/[^$`]*)?$/.exec(target.value);
    if (known) {
      for (const base of known[1].includes('PWD') ? [...scope.cwds] : [projectRoot()]) add(path.resolve(base, (known[2] || '').slice(1)));
    } else if (target.computed || target.value === '-') scope.lost = true;
    else if (target.glob) {
      scope.lost = true;
      for (const cwd of [...scope.cwds]) {
        const matcher = globMatcher(slashed(path.resolve(cwd, target.value)));
        for (const entry of knownProtected()) if (entry.dir && (!matcher || matcher.test(slashed(entry.file)))) add(entry.file);
      }
    } else for (const cwd of [...scope.cwds]) add(path.resolve(cwd, target.value));
  };
  const walk = (list, depth) => {
    for (const command of list) {
      const parts = commandParts(command);
      parts.chdirs.forEach(stand);
      if (['cd', 'pushd', 'chdir'].includes(parts.executable)) {
        const targets = parts.argTokens.filter(token => !token.value.startsWith('-') || token.value === '-');
        if (targets.length > 1) scope.lost = true; // zsh: cd old new
        stand(targets[0]);
      }
      if (parts.executable === 'eval' && depth < 3) walk(shellCommands(parts.args.filter(arg => arg !== '--').join(' ')), depth + 1);
      if (command.tokens.some(token => /^TMPDIR\+?=/.test(token.value))) scope.retmp = true;
      if (command.tokens.some(token => /^CDPATH\+?=/.test(token.value))) scope.lost = true; // cd may land anywhere
      if (command.tokens.some(token => /^HOME\+?=/.test(token.value))) scope.rehome = true;
    }
  };
  // the commands of a line need not run in the order they are written (a function, a loop)
  for (let round = 0, size = -1; round < 4 && scope.cwds.size > size && scope.cwds.size < 256; round++) { size = scope.cwds.size; walk(commands, 0); }
  if (scope.cwds.size >= 256) scope.lost = true;
  if (scope.adrift) { scope.lost = scope.tainted = scope.ticketed = true; scope.cwds = new Set(started); }
  for (const command of commands) {
    const found = marks(command, scope);
    scope.ticketed ||= found.has('ticket');
    scope.tainted ||= found.has('ticket') || found.has('engine');
    scope.holds ||= found.has('holder');
  }
  for (const command of commands) {
    const parts = commandParts(command);
    const reader = parts.executable !== 'find' && !ownRun(parts, scope) && reads(parts, scope);
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
  if ((shell || ['eval', 'source', '.'].includes(executable)) && command.tokens.flatMap(token => token.subs || []).flatMap(producedText).some(code)) return true;
  if (readsScript(parts) && previous && previous.separator === '|' && printed(previous).some(code)) return true;
  if (executable === 'eval' && code(args.filter(arg => arg !== '--').join(' '))) return true;
  if (executable === 'trap' && args.some(code)) return true;
  if (executable === 'alias' && args.some(arg => arg.includes('=') && code(arg.slice(arg.indexOf('=') + 1)))) return true;
  // commands made on the spot and piped to a shell, beside a protected name
  if (readsScript(parts) && previous && previous.separator === '|' && (scope.tainted || scope.holds) && !printed(previous).length) return true;
  if (TEXT_RUNNERS.includes(executable) && command.tokens.filter(token => token.quoted).some(token => code(token.value))) return true;
  // A lookalike of the writer anywhere but the project's own path is refused outright.
  // A sentence that ends with the script's name, handed to a command that runs no text, is not one.
  const runsText = shell || INTERPRETERS.includes(executable) || ['eval', 'source', '.', 'trap', 'alias'].includes(executable) || TEXT_RUNNERS.includes(executable);
  const sentence = (token) => token.quoted && /\s/.test(token.value) && token !== parts.head && !runsText;
  if ([...command.tokens, ...command.redirects.filter(Boolean)].some(token => lookalikeWriter(token.value) && !sentence(token))) return true;
  if (!parts.head) return false;
  // in text that is only saved, a line that opens with a capital is prose (At the end …, Install the …)
  if (scope.lenient && /[A-Z]/.test(path.basename(parts.head.value))) return false;
  const fed = parts.wrappers.includes('xargs');
  const own = ownRun(parts, scope);
  // a variable that makes git run a command, set for a later git on the line
  if (!own && command.tokens.some(token => /^GIT_[A-Z_]+\+?=/.test(token.value) && protectedKind(argReach(token, scope)))) return true;
  // under a reader's name, a program that is not the system's: refused with a protected path or a directory that holds them
  if (!own && untrusted(parts, scope) && [...parts.assignments, ...parts.argTokens].some(token => { const kind = argReach(token, scope); return protectedKind(kind) || kind === 'holder'; })) return true;
  const reader = executable !== 'git' && executable !== 'find' && !own && reads(parts, scope);
  // A here-document that is more than a message: a script for a shell, or text that is
  // saved or passed on, in which only what is known to write counts.
  if (piped || !heredocIsData(parts, command, reader)) {
    const strict = shell || piped ? scope : { ...scope, lenient: true };
    if (command.heredocs.some(body => (strict === scope ? shellWrites(body, strict, depth + 1) : loosely(() => shellWrites(body, strict, depth + 1))))) return true;
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
  const written = shellCommands(source);
  // a line that points CLAUDE_PROJECT_DIR elsewhere would make another script the project's own
  if (written.some(command => command.tokens.some(token => /^CLAUDE_PROJECT_DIR\+?=/.test(token.value)))) return true;
  const facts = lineFacts(source, written, outer);
  const commands = written.map(command => settleCommand(command, facts));
  const scope = scopeOf(commands, outer ? { ...outer, repwd: facts.repwd } : null);
  scope.repwd = facts.repwd;
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
