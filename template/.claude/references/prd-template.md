# PRD Template

Used by `/pincer-plan` Phase 4. Core sections are always included. Add optional detail
when uncertainty, product context, or risk warrants it; a small fix may remain compact.

## Profile

The frontmatter field `profile: small | standard` sets the planning weight; a PRD
without it is `standard`. `small` means bounded scope, low risk, known behavior and
straightforward verification. Few changed lines alone do not qualify: migrations,
authorization boundaries, uncertain requirements and broad effects stay `standard`
even for a tiny patch. The PRD records in one or two sentences why the profile fits.

A small PRD keeps Problem (with the outcome), Scope, Requirements with scenarios,
Success Criteria (its verification), risks and exclusions, and omits empty sections
and repetition. Interface examples may clarify a contract; implementation code must
not substitute for requirements in any profile.

---

## Core Sections (always include)

### 1. Problem
What problem does this solve? Who has it? (2–4 sentences.) Preserve or link the
original brief (quote it in an appendix or name where it lives) so the source of
every requirement stays reviewable.

### 2. Solution
One-paragraph summary of what we're building: the desired outcome, the assumptions
it rests on, and what it deliberately excludes.

### 3. Scope

| This PRD covers | This PRD does NOT cover |
| --- | --- |
| ... | ... |

### 4. Requirements
One entry per requirement with a stable ID. IDs are assigned once within this PRD
and never renumbered: a revision keeps existing IDs and adds new ones. Tickets
name the IDs they implement and evaluation dispositions every ID.

#### R-01 — short title
- **S-01:** an observable acceptance scenario (given / when / then, or a command
  and its expected output). One bold `S-NN` item per scenario, defined under its
  requirement heading; every requirement has at least one.
- **S-02:** Failure path: what invalid input or the relevant failure produces.
- **S-03:** Preserve: existing behavior this must not change (brownfield).

Scenario IDs are stable like requirement IDs. The runtime reads exactly this
grammar (a `##`..`####` heading `R-NN — title`, bold `- **S-NN:** text` items
under it, continuation lines indented); mentions in prose, tables and fenced
examples define nothing. On a change with strict coverage the parsed inventory is
what the coverage map and the evaluation must cover completely.

When the user supplied a PRD, keep its meaning and its existing requirement IDs.
If its structure needs adapting to this template, add a `Requirement mapping`
table under this section (`their section or ID → R-NN`) instead of rewriting it.

### 5. Architecture

#### Structure
```
directory tree showing new/modified files
```

#### Key components
What each component does, owns, and depends on.

#### Data flow
Input → processing → output.

### 6. Success Criteria

| Criterion | How to verify |
| --- | --- |
| ... | a command to run or a thing to observe |

### 7. Out of Scope
Explicit list. Anything cut for time during `/pincer-code` gets appended here with a reason.

---

## Optional Sections (include when relevant)

### Visual Direction
Only if there's a frontend. 4–6 lines: tone (3 concrete words), theme (light/dark + why),
typography pairing, colour direction (dominant + accent), and what to avoid.

### Security & Trust Boundaries
Include whenever the project handles secrets or external input (which is almost always).
3–5 lines: which inputs are untrusted and where each is validated, which secrets exist
and where they live (server-side only, named in `.env.example`), and what the client
sees on failure (generic message — details stay in server logs).

### Dependencies & Risks
Include when something outside our control or a migration/rollback concern could sink delivery.

---

## Formatting Rules

- Save as `.prd/prd-v{N}.md` with YAML frontmatter (`version`, `status`, `date`,
  and `profile` when small).
- Status lifecycle: `draft → ticketed → built`.
- Diagrams as ASCII or markdown tables only.
- No implementation code and no exact line numbers — those belong in tickets.
- The Scope table always has both columns filled.
