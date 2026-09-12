---
version: 1
status: ticketed
date: 2026-09-12
---
# Example strict PRD

## 1. Problem

A fixture project whose PRD follows the strict inventory grammar. S-01 is mentioned
here as a reference, which defines nothing.

## 4. Requirements

### R-01 — Parse the inventory

Every definition is derived from the PRD prose. S-01 and S-02 belong here.

- **S-01:** A PRD with two requirements and three scenarios yields exactly those
  IDs, parent links, content digests and source locations.
- [x] **S-02:** Duplicate IDs cause an actionable diagnostic.

| Scenario | Ticket |
| --- | --- |
| S-01 | T-01 |

```markdown
- **S-99:** an example inside a fence is not a definition
### R-99 — neither is a heading inside a fence
```

### R-02: Report impact

> A quoted line mentioning **S-03:** is a reference, not a definition.

- **S-03** — Changing one scenario names that scenario and its requirement.

## 7. Out of Scope

- S-04 would be a fourth scenario; this bullet does not start with a bold ID.
