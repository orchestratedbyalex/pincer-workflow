---
version: 1
status: ticketed
date: 2026-09-05
---

# Preserve user work and report completion honestly

## Problem
Pincer v0.2.3 can overwrite project customizations on repeated updates, close tickets after failed checks, and confuse a new PRD with completed earlier work. These undermine both new projects and existing repositories, for individuals and larger teams.

## Solution
Implement the six M0 work packages from `docs/pincer-improvement-plan.md`. Keep the Node installer and Bash workflow interfaces, repair their safety contracts, and test behavior through real temporary installations and ticket lifecycles. The user's request to start this fix plan authorizes this scope and order; approval is session authorization, not an independently authenticated artifact.

## Scope
| This PRD covers | This PRD does NOT cover |
| --- | --- |
| R-01: preserve local files and conflict sidecars across init, repeated updates, and legacy manifests | Hosted services, tracker integrations, publication |
| R-02: failed/interrupted verification revokes readiness; closing reruns the current check | Full source-bound attestation/runtime migration |
| R-03: malformed tickets and unchecked acceptance criteria cannot close | General-purpose YAML/Markdown support |
| R-04: tickets reference a PRD; status rejects ambiguous legacy associations and stale notes | Concurrent multi-change scheduling and authenticated approval identities |
| R-05: hooks handle common documented forms; playbooks support greenfield and brownfield and preserve existing work | Complete shell security boundary or enterprise policy engine |
| R-06: CI tests regressions, generated parity, packaged installs, and plugin references | Claims of live-agent or native Windows validation |

## Architecture
Modify `bin/pincer.js` without dependencies. Version the installer manifest independently; trust only baselines recorded by the fixed installer. Preserve conflicting `.new` content with unique sidecars. Retain existing shell commands, with a shared Bash helper if needed for consistent parsing. Verification records an attempt before execution, removes any prior receipt, and closes only after a fresh success. Tickets use `prd: .prd/prd-vN.md`; existing tickets require explicit binding when ambiguous. Evaluation notes identify the PRD and candidate commit. Generators ship all helpers with each channel. No additional dependencies or secrets are required.

Existing installer and ticket tests protect baseline behavior. New regression tests pin failures before fixes. Tests operate in temporary projects with explicit project roots. Generated output stays canonical under `template/`. Rollback is through scoped commits; do not roll back fixed manifest tracking into an unsafe writer. Older untrusted baselines are conservatively preserved rather than guessed.

## Success Criteria
| Requirement | Verification |
| --- | --- |
| R-01 | `node test/installer.test.js` plus existing smoke test |
| R-02 | `node test/verification.test.js` and ticket lifecycle test |
| R-03 | `node test/validation.test.js` |
| R-04 | `node test/recovery.test.js` |
| R-05 | `node test/hooks.test.js` and generated playbook contract checks |
| R-06 | `npm test` including packed greenfield/brownfield installs on all platforms; CI matrix defined for Linux/macOS |

## Out of Scope
No feature from later milestones is silently claimed complete. Teams of any size may use this release with their existing branch/review/CI process; concurrent ownership and independent approval enforcement remain later work. Greenfield uses an appropriate walking skeleton; brownfield uses an existing protected path or characterization test. No fixed team-size, ticket-count, or delivery-time limit is introduced.
