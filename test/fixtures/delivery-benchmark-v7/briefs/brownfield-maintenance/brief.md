# brownfield-maintenance — maintenance and review on existing code

Three sessions across two changes on a repository that already works and already has
users' local edits in it. The long-form counterpart of the bugfix brief: the risk here is
not "can it be built" but "was anything else broken on the way".

## Task

`src/config.js` merges configuration layers. It works and has a suite.

**Change 1** — `merge(base, override)` currently replaces nested objects wholesale. Make
it merge them recursively instead. Arrays are still replaced wholesale, not concatenated.
`null` in the override deletes the key.

**Change 2** — add `describe(config)` returning the sorted list of dotted key paths of
every leaf: `{ a: { b: 1 }, c: 2 }` gives `['a.b', 'c']`. An empty object gives `[]`.

The existing behaviour must not change: `merge` never mutates its arguments, and merging
with an empty override returns a value deep-equal to the base. There are uncommitted local
edits in the working tree that are nothing to do with this task; leave them alone.

## Changes

2

## Prompt 1

Read BRIEF.md in this repository and implement Change 1 only, committing your work as you
go. The repository already works and already has a suite; keep both working. Stop when
Change 1 is done and summarize what you changed.

## Prompt 2

Implement Change 2 as BRIEF.md describes it, committing your work. Keep the behaviour
Change 1 delivered, and keep the existing suite passing. Stop when Change 2 is done.

## Prompt 3

Review the work of the previous two sessions against BRIEF.md without asking for a recap:
read the repository, check both changes against what the brief actually asks for, fix
anything that does not meet it, and commit. Leave anything uncommitted that is not yours.
