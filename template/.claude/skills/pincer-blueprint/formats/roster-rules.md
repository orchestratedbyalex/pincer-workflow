---
owner: the blueprint stage proposes it, the person confirms it
home: harness.json, under roster
readers: the blueprint (to propose), plan, narrow, code and evaluate (to dispatch), status (to report)
shape: one list of agent names per stage that dispatches agents (plan, narrow, code, evaluate), names from the agent library
---
# Roster rules

How the roster follows the answers and recon. Each agent has one point of view and a
fixed return shape (the reviewers return findings in one format), so the set can
change without changing the stages.

| Agent | Stage | Proposed when |
|---|---|---|
| codebase-explorer | plan, narrow | the kind is brownfield |
| implementer | code | the person opts in (`stages.code.implementer`); otherwise the main session builds |
| code-quality-reviewer | evaluate | always |
| silent-failure-hunter | evaluate | always |
| security-reviewer | evaluate | the project handles secrets or external input: a server, an API, a form, a `.env.example` |
| test-coverage-reviewer | evaluate | brownfield and recon found few or no tests |
| history-reviewer | evaluate | brownfield |
| standards-reviewer | evaluate | the person names a style guide, or a linter gates the merge |
| accessibility-reviewer | evaluate | there is a user interface |
| fix-agent | evaluate | the person opts in; fixes still go through new tickets |

Rules: a stage that is off gets an empty list. `code` lists `implementer` only when
`stages.code.implementer` is true. The person may add or drop any name. A name the
engine does not know fails validation.

## Example

A brownfield web application with a login form, a `.env.example`, thin tests and no
style guide, with the implementer declined:

```json
{
  "plan": ["codebase-explorer"],
  "narrow": ["codebase-explorer"],
  "code": [],
  "evaluate": ["code-quality-reviewer", "silent-failure-hunter", "security-reviewer", "test-coverage-reviewer", "history-reviewer", "accessibility-reviewer"]
}
```
