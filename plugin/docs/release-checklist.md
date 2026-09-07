# PINCER Release Checklist

Audit the selected PRD and its evaluated candidate. This checklist applies to product
changes in greenfield and brownfield repositories. It is read-only: failures return work
to the owning stage or a new ticket.

## Change identity and state

- [ ] `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-status.sh` selects the intended PRD with `status: built` and no warnings
- [ ] Every ticket associated with that PRD is done with current `last_check` and `verified` evidence
- [ ] `NOTES.md` names the selected PRD, reviewed base, and candidate; status reports it current
- [ ] The working tree is clean before and after the audit

## Scope and evidence

- [ ] Every in-scope success criterion has delivered evidence or an explicit non-delivered disposition
- [ ] Ticket dependencies, acceptance criteria, and verification commands match the implemented change
- [ ] The repository's candidate-wide release gate passes when run directly, without invoking the ticket state writer
- [ ] Scope cuts and known limitations are explicit in the PRD or evaluation notes

## Review

- [ ] High-confidence review findings have file and line evidence and a disposition
- [ ] Fixes made after evaluation use a new ticket, current verification, and a scoped commit
- [ ] UI changes have visual evidence; non-UI changes mark this item not applicable with a reason
- [ ] Security review reports locations and remediation without printing candidate secret values
- [ ] No secret environment file is tracked; dependency and invalid-input checks run when applicable

## Handover and verdict

- [ ] Commit history identifies the plan, ticket work, evaluation, and any review-fix tickets
- [ ] `NOTES.md` covers what shipped, cuts, limitations, next steps, dependencies, and the riskiest aging assumption
- [ ] Platform or environment limits are stated without claiming untested support
- [ ] Every failed or skipped required item is named before the final PASS or FAIL verdict
