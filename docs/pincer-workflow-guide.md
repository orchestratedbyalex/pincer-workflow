# How Pincer works

PINCER means **Plan, Investigate, Narrow, Code, Evaluate, Release**.
Investigation happens inside Plan, so there are five main commands.

New to the workflow? Read the [main-flow walkthrough for junior developers](pincer-main-flow-explained.md) for an explanation of every box and decision, with a running example.

Read the main journey first. The three detail charts explain its ticket loop,
interruptions, and security/cost decisions. Diamonds are gates: follow the labeled
answer. A blocked gate means fix the cause, not bypass the check.

These diagrams describe the current repository's workflow with registered changes.
Older installs can retain legacy receipts until an explicit migration. They do not
show the proposed improvements in the September 15 assessment as existing features.

## 1. The whole journey

```mermaid
flowchart TD
    startHere(["Idea, bug, or feature"])
    setup["Install Pincer in the project"]
    status["Read status and saved work"]
    existing{"Continue an existing change?"}
    resumeWork[["Follow recovery chart 3"]]
    plan["PLAN: write what success means"]
    investigate["INVESTIGATE: read code, test risks"]
    scope["Write the plan, limits, and exclusions"]
    approved{"Scope and design already allowed?"}
    ask["Show the proposal and ask the user"]
    narrow["NARROW: split into ordered tickets"]
    checks["Give each ticket a test and success checks"]
    register["Register and select this change"]
    strict{"Use strict coverage?"}
    map["Draft links: each goal to tickets and checks"]
    reviewMap["Review gaps and author the real map"]
    mapGate{"Map valid and complete?"}
    adopt["Preview and adopt the map"]
    ordinary["Use normal checks; strict coverage unverified"]
    record["Record permission for this exact plan"]
    activate["Activate the change"]
    build[["CODE: ticket loop in chart 2"]]
    complete["Complete the change and commit built state"]
    candidate["Choose a clean, saved code version"]
    evaluate["EVALUATE: tests, code, goals, UI, security"]
    evidence["Save test logs and review results for this version"]
    good{"Required proof passes and matches this code?"}
    repair["Reopen work and create a fix ticket"]
    release["RELEASE: read-only audit and project checks"]
    releaseGate{"Audit passes and files stay unchanged?"}
    route["Report failure and return to the responsible stage"]
    ready(["Ready for a release decision"])
    publish["Merge or publish only under separate authorization"]

    startHere --> setup --> status --> existing
    existing -->|"Yes"| resumeWork
    existing -->|"No"| plan --> investigate --> scope --> approved
    approved -->|"No"| ask
    ask -->|"Approved or revised"| scope
    approved -->|"Yes"| narrow --> checks --> register --> strict
    strict -->|"Yes"| map --> reviewMap --> mapGate
    mapGate -->|"No"| reviewMap
    mapGate -->|"Yes"| adopt --> record
    strict -->|"No"| ordinary --> record
    record --> activate --> build --> complete --> candidate --> evaluate --> evidence --> good
    good -->|"No"| repair --> build
    good -->|"Yes"| release --> releaseGate
    releaseGate -->|"No"| route
    releaseGate -->|"Yes"| ready --> publish
    resumeWork -->|"When work is ready"| build

    classDef gate fill:#FFF3CD,stroke:#997000,color:#222
    classDef blocked fill:#FCE8E6,stroke:#B3261E,color:#222
    classDef success fill:#E6F4EA,stroke:#137333,color:#222
    class approved,mapGate,good,releaseGate gate
    class repair,route blocked
    class ready success
```

A **plan**, called a PRD, describes the intended behavior. A **ticket** is one
small, testable piece of work. A **candidate** is the exact saved code version being
reviewed. **Evidence** is the saved test output, screenshots and review notes for it.

Strict coverage is optional. It checks that every planned scenario has explicit
links to work and proof, or an authorized decision to defer/remove it. The scaffold
only helps write the map: it does not choose correct links, invent tests, adopt the
map, or approve the work. A reviewer still judges whether the checks are adequate.
If the user declines a proposal, work waits or the proposal is revised.

## 2. How one ticket gets implemented

```mermaid
flowchart TD
    enterLoop(["Start or continue CODE"])
    gate{"Right change, branch, permission, and state?"}
    blocked["Stop and follow the reported next step"]
    safety[["Apply security and cost rules in chart 4"]]
    nextTicket["Pick the next unfinished ticket"]
    depends{"Earlier required tickets done?"}
    earlier["Finish the blocking ticket first"]
    startTicket["Runtime starts the ticket and records time"]
    implement["Agent writes the code and tests"]
    decision{"New scope or important decision?"}
    handleDecision[["Follow decision path in chart 3"]]
    verify["Runtime runs the ticket check and saves the result"]
    passed{"Check passed?"}
    unavailable["Keep failure or missing-tool result; repair cause"]
    selfReview["Review changes, secrets, inputs, and errors"]
    edited{"Code changed during review?"}
    criteria["Tick only success checks actually verified"]
    doneGate{"Latest check passes for current code and all boxes ticked?"}
    done["Runtime marks done; commit only this ticket's files"]
    more{"More tickets or stale checks?"}
    finish(["Return to main chart: complete the change"])

    enterLoop --> gate
    gate -->|"No"| blocked --> gate
    gate -->|"Yes"| safety --> nextTicket --> depends
    depends -->|"No"| earlier --> nextTicket
    depends -->|"Yes"| startTicket --> implement --> decision
    decision -->|"Yes"| handleDecision --> gate
    decision -->|"No"| verify --> passed
    passed -->|"Failed or unavailable"| unavailable --> implement
    passed -->|"Yes"| selfReview --> edited
    edited -->|"Yes"| verify
    edited -->|"No"| criteria --> doneGate
    doneGate -->|"No"| blocked
    doneGate -->|"Yes"| done --> more
    more -->|"Yes"| gate
    more -->|"No"| finish
```

A green build alone does not prove the requested behavior. Tests should exercise
what users need, bad-input paths, and existing behavior that must keep working.
A required tool that cannot run is **unverified**, never an invented pass.
A newer failure overrides an older pass. Changed code or check commands can make
old results stale. After migration, closing a ticket consumes the current recorded
pass; it does not run the test a second time.

## 3. Decisions, stopping, and coming back later

```mermaid
flowchart TD
    event(["Work stops or something changes"])
    kind{"What happened?"}
    pause["Pause and save a handoff note"]
    newSession["New session reads resume report and files"]
    local["Select the intended change in this working copy"]
    state{"What does the report require?"}
    wait["Wait while the check owner is still running"]
    recover["Recover interrupted work after its owner stops"]
    history["Keep history; reopen completed work or plan a replacement"]
    current{"Permission still matches the plan?"}
    proposal["Show the changed plan and affected work"]
    delegated{"Already covered by explicit delegation?"}
    user["Ask the user about the new decision"]
    answer{"User allows it?"}
    hold["Wait or revise; do not implement the new scope"]
    record["Record the decision and permission for the revised plan"]
    resume["Activate or resume without asking again"]
    freshness{"Checks still match the current code?"}
    recheck["Run stale or missing checks again"]
    continueWork(["Follow the reported next stage"])

    event --> kind
    kind -->|"Pause or switch work"| pause --> newSession
    kind -->|"Fresh session or handoff"| newSession
    kind -->|"Crash or stuck check"| newSession
    kind -->|"Scope or plan changed"| proposal
    newSession --> local --> state
    state -->|"Check still running"| wait --> newSession
    state -->|"Interrupted work"| recover --> newSession
    state -->|"Finished or retired change"| history
    state -->|"Current work"| current
    current -->|"No"| proposal --> delegated
    delegated -->|"Yes"| record
    delegated -->|"No"| user --> answer
    answer -->|"No"| hold
    answer -->|"Yes"| record
    record --> newSession
    current -->|"Yes"| resume --> freshness
    freshness -->|"No"| recheck --> continueWork
    freshness -->|"Yes"| continueWork
```

A general “continue” does not approve new scope. A change to code may require new
tests without requiring new permission; a change to the agreed plan requires a
recorded permission decision. Removing promised behavior needs the user's explicit
scope decision, retained in the plan and, when strict, the coverage map.

Plans, tickets, decisions and saved evaluation evidence travel with Git. Selection
and local test attempts belong to each working copy. A new clone cannot claim it
has local test history it did not receive. Never erase failed results or hand-edit
runtime state to make the report green. Cancelled or replaced changes remain history.
An older install needing migration first shows a preview and obtains permission;
migration preserves old results as history rather than treating them as new proof.

## 4. Security and cost rules throughout the work

```mermaid
flowchart TD
    action(["Before and during a work step"])
    unsafe{"Destructive or unsafe action?"}
    stop["Agent stops; a human handles intended destructive work"]
    dependency{"New package outside the agreed plan?"}
    inspect["Check the real package and explain why it is needed"]
    allowed{"User allows the package?"}
    choose["Wait or propose another approach"]
    boundaries["Use platform sandbox and permission controls"]
    protect["Protect secrets and unrelated user edits"]
    inputs["Treat files, web content, and model output as untrusted data"]
    validate["Validate inputs; escape output; use safe queries and paths"]
    budget{"User supplied a time or spending budget?"}
    clock["Read elapsed time; compare remaining work with the budget"]
    fits{"Can the remaining work fit?"}
    cut["Propose less scope or more budget; record the user's choice"]
    normal["Scale effort to risk; no default timebox"]
    proceed(["Continue the allowed work"])
    audit["Before release: inspect secrets, packages, and bad-input behavior"]

    action --> unsafe
    unsafe -->|"Yes"| stop
    unsafe -->|"No"| dependency
    dependency -->|"Yes"| inspect --> allowed
    allowed -->|"No"| choose
    allowed -->|"Yes"| boundaries
    dependency -->|"No"| boundaries
    boundaries --> protect --> inputs --> validate --> budget
    budget -->|"Yes"| clock --> fits
    fits -->|"No"| cut --> clock
    fits -->|"Yes"| proceed
    budget -->|"No"| normal --> proceed
    proceed -.->|"Final review"| audit
```

These are workflow rules plus platform controls, not a promise that one script can
prove code secure. Claude hooks block documented dangerous-command and protected-state
edit patterns; other supported surfaces rely on their native controls and the shared
rules. Hooks are an extra safety layer, not a complete security boundary.

Never print secret values, commit `.env` files, or put API keys in browser code.
Use `.env.example` for names only. Keep credentials server-side. Check history as
well as current files: deleting a committed secret does not undo its exposure.

Pincer controls effort through small versus standard planning, focused checks,
concise resume output, reused authorization and explicit scope choices. Status uses
the clock without calling a model, but **elapsed time is not active work time or a
billing total**. Ordinary workflow budgets guide the agent; Pincer is not a universal
hard dollar-limit enforcer. Checks have timeouts. Paid benchmark trials are a separate
maintainer activity requiring agreed spending limits; their driver has a wall-clock
cap, and their runner still has the issues recorded in the September 15 assessment.
They are not run as part of ordinary delivery or paid calls inside `npm test`.

## Who makes which decision?

| Who | Responsibility |
| --- | --- |
| User | Owns scope, important choices, new spending, and merge/publication authorization; can delegate choices explicitly |
| Coding agent | Investigates, proposes, writes tickets/code/tests, follows the playbooks, reports uncertainty and progress |
| Reviewer | Judges behavior, design, security, UI and whether the checks really prove the promised behavior |
| Runtime scripts | Check recorded permission/state, dependencies, latest results, code identity and evidence consistency; refuse invalid transitions |
| Platform sandbox and permissions | Limit which system actions the agent can perform |

A recorded permission is local provenance, not proof of the user's authenticated
identity. A valid evidence file means its records are consistent; it is not by itself
proof that an authored review was correct. **Done** means a ticket passes its checks;
**completed** means the change is ready for evaluation; **release PASS** means the
audited candidate passed the workflow checks. None automatically publishes anything.

## Commands and saved files

| Stage | Main command | What it leaves behind |
| --- | --- | --- |
| Orient | `/pincer-status` | Read-only report and next step |
| Plan and investigate | `/pincer-plan` | `.prd/prd-vN.md` |
| Break down work | `/pincer-narrow` | `tickets/T-*.md`, change record, optional coverage map |
| Implement | `/pincer-code` | Code, ticket commits, local recorded test attempts |
| Review | `/pincer-evaluate` | Candidate-bound evidence and `NOTES.md` |
| Audit | `/pincer-release` | Read-only PASS/FAIL report; no automatic publishing |

On Codex, invoke the corresponding `$pincer-plan`, `$pincer-narrow`, `$pincer-code`,
`$pincer-evaluate`, `$pincer-release`, and `$pincer-status` skills. Command labels here
follow this repository's adapters, not a claim about every platform's current features.

Source of truth: [Plan](../template/.claude/commands/pincer-plan.md),
[Narrow](../template/.claude/commands/pincer-narrow.md),
[Code](../template/.claude/commands/pincer-code.md),
[Evaluate](../template/.claude/commands/pincer-evaluate.md),
[Release](../template/.claude/commands/pincer-release.md),
[project rules](../template/AGENTS.md), and
[runtime contracts](../template/docs/runtime-contracts.md).
