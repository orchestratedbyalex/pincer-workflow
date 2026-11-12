# Changelog

## 1.0.4 — 2026-11-12

Defects found while verifying 1.0.3 on Claude Code. The guard fixes apply to Claude
Code, the only platform with a hook; the installer, ticket, status and skill changes
apply to every platform.

- A hook that dies refuses. The wrappers handed over to `node` with `exec`, so a
  `node` that crashed ended the hook with a signal, and Claude Code blocks a call only
  on status 2: the call ran. A line of 300 `cd` steps made the ticket guard run out
  of memory that way, and 12 steps took 26 seconds to check. Both wrappers now run
  `node` and refuse on every status but 0. The guard follows at most 1024
  directories for the `cd` steps of a line; a line with more is judged as one that
  names a protected file, a relative word on it by what its last part can name. A
  check that takes more than ten seconds is refused. 12 steps now take 0.1 seconds.
- Protected writes 1.0.3 let through are refused: a copy from `<(…)` or zsh's
  `=(…)` onto a protected file; a copy into `"$PWD/tickets"` and other spellings of
  a directory that holds protected files; a program under a reader's name that is not
  the system's (`./cat`, `/tmp/e/cat`, a function, an alias, `hash cat=…`,
  `PATH=… cat`).
- Older gaps are closed where the line shows the write: `set -- cp … ; "$@"`; a
  `git config` value and a `GIT_*` variable that name a protected file; `git grep
  -O`; `--file` and `--output` in their shortened forms; `rg --pre`; `less -o`;
  GNU sed's `e`; an awk program that opens with a slash; `source <(…)` and `source
  /dev/stdin`; zsh patterns after `tickets/`. `docs/engine.md` lists the ones that
  still pass.
- Reads and ordinary work the guard refused now pass: a here-document that holds a
  bracket set no shell can read (`[['--format']]`); `node -v`, and a program in a
  here-document in a statement of its own, beside a read of a protected file; the
  evidence digest as the evaluate stage writes it (`cd evidence/<sha> && node
  ../../scripts/pincer-evidence.cjs digest $(find …)`); a variable the line gives one
  written value (`S=/tmp/out; cp tickets/T-02-x.md $S/y`), `$PWD` and
  `name=$(mktemp)`; `git -C <dir> checkout <ref>`; a sentence that ends with the
  ticket script's name (`gh pr create --body "… scripts/pincer-ticket.sh"`).
- A refusal says which rule fired, on which word and in which command of the line.
  It was the same text for every refused line, and sessions tried a line again two
  or three times.
- `scripts/pincer-ticket.sh check T-NN` runs a ticket's Verification block as a dry
  run and records nothing. Narrow uses it to see a new check fail for the reason the
  ticket names; every way of copying the block out of the ticket was refused by the
  guard.
- An edit alone gives no sidecar. A line added under `## Conventions` in
  `AGENTS.md`, which the template asks to be kept by hand, made every update write
  `AGENTS.md.new` and `doctor` fail. That section is now the project's like the
  agreement. For any edited file, `update` writes a `.new` only when the package's
  version of it changed since it was installed or last offered, and says `kept`
  otherwise; the sidecar 1.0.3 left behind is removed. A file that was deleted comes
  back from the package on `update`, which is now the way to restore the library
  table.
- `doctor` names an edited copy of an always-on stage once, and does not call the
  copies `sync-prompts.sh` derives from it edited.
- `scripts/pincer-status.sh --json`: `firstJob` is the first job the agreement
  names; `newJob` is that job when it was named since the last acceptance. It was
  `""` while the report used the job.
- Skill wording: `done` runs in a call of its own, not chained with the commit, and
  its reminder agrees with the skill that the self-review comes before `done`; the
  boxes are ticked with the Edit tool.

Not changed, on purpose: an unknown command and a bad `--platform` value still exit
1; an inline program (`node -e`) on a line that names a ticket is still refused; a
copy of the engine run from outside the project is still refused.

## 1.0.3 — 2026-11-11

Defects found while verifying 1.0.2 on Claude Code. The installer, status and skill
fixes apply to every platform; the guard fixes apply to Claude Code, the only platform
with a hook.

- An update no longer leaves a blank `AGENTS.md.new`. The agreement between the
  markers in `AGENTS.md` belongs to the blueprint: the installer compares and proposes
  only the text around it, refreshes that text in place when the project did not
  change it, and puts the project's agreement into any proposal it does write. A blank
  proposal left by 1.0.2 is removed by the next update, and `doctor` no longer calls a
  filled agreement a local edit.
- `--help` and `-h` print usage, for the tool and for `init`, `update` and `doctor`,
  and write nothing; `init --help` used to install. An unknown argument exits 2 and is
  named. `init` without a terminal wants `--platform` instead of installing all three
  platforms; `--platform=<name>` is read like `--platform <name>`.
- The ticket guard keeps a list of commands that only read, instead of a list of
  commands that write. A command that names a ticket, the engine or the hooks is
  refused unless it is a known reader, a copy that only reads it, or one of the
  engine's own entry points. This closes the writers the old list missed (`rsync`,
  `dd`, `install`, `ditto`, `git restore`, `git checkout <rev> -- <path>`,
  `git checkout-index`, `git apply`, `git rm`, `git mv`, `node -e`, `python3 -c`,
  `perl`, `awk`, `vim -es`, `curl -o`, `wget -O`, `sort -o`, `patch`, `tar`, `unzip`,
  `unlink`, `chmod`, `ln`, `find -exec` and others). It also splits a line at a single
  `&`, follows `cd` and `pushd` so a bare name after them is resolved, looks through
  `command -p`, `exec -a`, `sudo -u`, `stdbuf`, `caffeinate` and `arch`, refuses a
  variable or computed target on any line that names a protected file, ignores case
  and resolves `//`, `/./`, `..`, symbolic and hard links for shell targets and for
  Edit, Write and MultiEdit paths, and treats every `scripts/pincer-*.sh` and
  `scripts/pincer-*.cjs` as the engine. The destructive-command guard reads lines the
  same way, so `true & git push --force` and `sudo -u root rm -rf /path` are refused.
- The guard reads a line closer to the way the shell does: quotes, `$'…'`, `${…}`,
  `$(…)` and backticks, arithmetic, `case … esac`, here-documents (data, unless a
  shell or an interpreter is handed one), zsh's `>!` and `>|`, and a program reached
  through `~`, a variable or a substitution. Only space, tab and new line separate
  words. A line nested more than eight levels deep is refused.
- A line the guard cannot read with certainty is refused, not read on: a quote, a
  `[[` test or a substitution that never closes, a `#` or a `<<` inside a `((…))` that
  may be two subshells, a `#` straight after a paren (a comment in bash, part of a
  pattern in zsh), `<<` in a subscript that is not an assignment, more than 64
  substitutions inside each other. The hook also refuses when anything in it fails:
  it used to end with status 1 on such a line, which lets the call run. Text that is
  only saved or shown (a here-document for a file or a commit message) is still read
  loosely, so prose with apostrophes and `(#links)` passes.
- Readers are readers only in the forms that cannot write. Refused now: `sed` with a
  `w` file in its script or `--in-place` shortened, `sort --out=`, `xz -C…`, `curl`
  handed a protected path, `tar -I <program>`, `gawk --source`, `node script.js
  --check <file>` and `bash script.sh -n <file>` (the option belongs to the script),
  `find -fprint <file>`, `find` with its action in front of the test meant to narrow
  it or in another `-o` branch, and `find … -exec rm -rf` on the directories that hold
  the tickets, the engine or the hooks.
- More ways to a protected file are followed: a program run through `uv run`,
  `poetry run` or `pnpm exec`; a program glued to its option (`python3 -c"…"`); a
  program that puts `tickets` and a ticket's name together; text kept in a variable
  and run (`eval "$S"`, `$cmd`, `${x:-rm …}`); `tickets/$f`; `"$PWD/tickets"`; GNU
  tools under their `g` names; commands made on the spot and piped to a shell; `git`
  options in their shortened forms; `cd` inside a function and `CDPATH`; a whole tree
  copied over the project on a line that names a protected file.
- `NotebookEdit` is guarded like Edit and Write: it may not reach a ticket, the engine
  or the hooks. The ticket guard's matcher in `.claude/settings.json` is now
  `Edit|Write|MultiEdit|NotebookEdit|Bash`; `update` refreshes the file, or leaves the
  new one beside it as `.claude/settings.json.new` when the project changed its own.
- The guard lets more reads through: copying a ticket or the engine out
  (`cp tickets/T-02-x.md /tmp/`, `cat … | tee /tmp/copy.md`, `> ~/copy.md`, `find
  tickets -name '*.md' -exec cp {} /tmp/backup/ \;`), a read after `cd` saved
  to another path, `awk` that prints a bar or an arrow between columns, `find` that
  deletes only what its own `-o` branch names, quoted text that only mentions a ticket or the ticket script, a
  here-document that is a commit message, and a comment. Still refused, on purpose:
  `T-NN*` in any directory named `tickets` is a ticket wherever it is, so a copy into
  a scratch clone's `tickets/` is refused, and a tool the guard does not know is
  refused when it is given a protected path. `docs/engine.md` says so, and that the
  guard is a guard rail against mistakes, not a sandbox.
- Status notices a done ticket whose work was never committed: the ticket file at
  `HEAD` is missing, not done or carries another receipt. It warns, lists the ticket
  under `uncommitted` in `--json`, and `Next:` is `/pincer-code T-NN (done, not
  committed)` before any other ticket is started. The code skill says how to resume
  such a ticket.
- `Next:` uses the first job the agreement names: on a new project, and when the
  blueprint names another one after every ticket was accepted, instead of `all
  tickets done and accepted`.
- `doctor` looks at the generated project copies: a missing one is a problem, an
  edited one a note, and one edited in a derived place (a Codex skill, a Copilot
  prompt) is pointed back to the copy under `.claude/`.
- `update --platform` says when the named platform is already installed, and ends
  with the blueprint, not status, when the project has no agreement yet.
- Skill wording: `done` comes only after `verify` passed and the self-review is
  finished, and `done` prints that reminder; narrow and code say when the implementer
  is on but no ticket is size M; narrow does not build the feature to try its checks;
  narrow and evaluate remove their scratch directories; the evidence format says that
  a gap in the `C-NN` numbers is not an error.

Correction to 1.0.2: its release notes and commit message said the redirect-aware
guard newly allowed no command with a protected or computed target. That was not
true. 1.0.2 newly allowed a writer the guard did not list when a harmless redirect
stood beside it (`rsync /tmp/x tickets/T-02-x.md 2>&1`, `git restore
.claude/settings.json 2>&1`, `node -e "…writeFileSync('.claude/settings.json')" 2>&1`),
a `git mv` round trip, a redirect onto an engine path spelled in another case on a
line that names a ticket, and a write through a link made on the same line with
`command -p ln`, `eval ln`, `bash -c 'ln …'` or `perl symlink`. Each had an equivalent
form that 1.0.1 already allowed. 1.0.3 refuses all of them.

## 1.0.2 — 2026-11-11

Defects found while running 1.0.1 on Claude Code. The status and installer fixes
apply to every platform; the hook fix applies to Claude Code, the only platform
with a hook.

- Status judges the change in hand, not the project's history. An approved spec
  that no ticket names in its `spec:` field goes to narrow even when every older
  ticket is accepted. Finished tickets go to evaluate until evidence exists for the
  candidate commit that holds them; evidence saved for an earlier change no longer
  sends a new change straight to release. `--json` lists them under `unevaluated`.
- The Claude Code ticket guard judges a redirect by its target. `2>&1`,
  `2>/dev/null` and saving a read to another file pass; a redirect onto a ticket,
  the engine or the hooks is refused, now also as `>|`, as `tickets//T-…` and as a
  relative path from inside a protected directory. The destructive-command guard no
  longer reads `2>/dev/null` as a path being deleted.
- `update --platform <name>` adds a platform to an existing install; `init` on an
  installed project points to it.
- `doctor` compares every installed file with the running package and fails on
  files from another build that carries the same version number; local edits stay
  a note.

## 1.0.1 — 2026-11-11

- Codex-only status and missing-agreement hints use `$pincer-*`; draft specs stay
  at approval, and disabled narrowing routes directly to code.
- Generated Codex argument descriptions no longer nest Markdown code spans.
- Release separates its read-only audit from actual human acceptance and an
  acceptance-only commit, preserving the evaluated candidate identity.
- A packed workflow integration test exercises real CLI checks, failure/recovery,
  evidence integrity and a clearly synthetic acceptance commit.


## 1.0.0 — 2026-11-11

PINCER becomes a harness builder: a project-specific agreement drives the coding
workflow across Claude Code, Codex CLI and GitHub Copilot.

- Blueprint inspects the project and interviews the owner before writing
  `harness.json` and the agreement in `AGENTS.md`.
- Configurable plan, narrow, code, evaluate and release stages; blueprint and
  status remain always available.
- Script-owned ticket verification receipts, completion and named human acceptance.
- Evidence manifest validation and status that names the next command.
- Generated platform adapters and model tiers for stages and review agents.
- Dependency-free Node core; installer preserves edits using `.new` sidecars.

### Breaking changes and upgrade guidance

Node.js 22 or newer is required. The 0.7 runtime, its migration paths and fixed PRD
workflow are retired. PRD v8 and its open study work are superseded, not completed
by this release. The wiki is historical and the Claude plugin channel is paused.

Try the release tarball in a separate project or checkout first. Back up or commit
your current project before updating. Inspect installer output and resolve `.new`
sidecars deliberately; do not overwrite customized instructions blindly. Run
`doctor`, then blueprint to create and review the new agreement. Keep historical
tickets and evidence separate: old verification and acceptance are not migrated
into the new lifecycle automatically. Do not delete historical artifacts to make
status appear clean.

Available on npm as `pincer-workflow@1.0.0` and as a GitHub release
tarball. This release has automated fixture and packaged-install validation;
it makes no comparative productivity or best-in-class claim.
