# PRD Template

Used by `/pincer-plan` Phase 4. Core sections always included; optional sections only when they
earn their space in the timebox. Keep the whole PRD under ~2 pages.

---

## Core Sections (always include)

### 1. Problem
What problem does this solve? Who has it? (2–4 sentences.)

### 2. Solution
One-paragraph summary of what we're building.

### 3. Scope

| This PRD covers | This PRD does NOT cover |
| --- | --- |
| ... | ... |

### 4. Architecture

#### Structure
```
directory tree showing new/modified files
```

#### Key components
What each component does, owns, and depends on.

#### Data flow
Input → processing → output.

### 5. Success Criteria

| Criterion | How to verify |
| --- | --- |
| ... | a command to run or a thing to observe |

### 6. Out of Scope
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
Only if something outside our control could sink the timebox.

---

## Formatting Rules

- Save as `.prd/prd-v{N}.md` with YAML frontmatter (`version`, `status`, `date`).
- Status lifecycle: `draft → ticketed → built`.
- Diagrams as ASCII or markdown tables only.
- No implementation code and no exact line numbers — those belong in tickets.
- The Scope table always has both columns filled.
