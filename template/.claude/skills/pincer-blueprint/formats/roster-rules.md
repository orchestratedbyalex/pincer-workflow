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

## Model tiers

The tier each role is proposed to run on. A tier (`strong`, `standard`, `fast`) is
translated to the model each platform knows through the library's `models.json`;
`inherit` keeps the session's model; a role left unset falls back to the library's
default for it, else to the session's model. Effort (`low`, `medium`, `high`) is
proposed for nobody: the platform's default stands unless the person names one.

| Role | Proposed tier | Why |
|---|---|---|
| every reviewer: the seven `-reviewer` agents and `silent-failure-hunter` | strong | a judgment task that runs once per change |
| implementer, fix-agent | standard | they run per ticket; capable enough, cost in check |
| codebase-explorer | standard | the library's default: read-heavy and runs often |
| every stage | unset | the session's model, chosen by the person |
| effort, for every role | unset | the platform's default; named only when the person wants more or less reasoning |

The person may change any line. Nothing is written that the person did not confirm;
`open` leaves a role unset and is recorded under `open`.

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
