## Harness agreement — {{name}}

### 1 Systems
- Kind: {{kind}}{{kindReason}}
- Forge: {{forge}}
- Remote: {{remote}}
- CI: {{ci}}
- Deploy: {{deploy}}
- Secrets: {{secrets}}

### 2 Current pipeline
{{pipeline}}

### 3 Handoff artifacts
- Spec: {{spec}}
- Tickets: {{tickets}}
- Evidence: {{evidence}}

### 4 Simplify
{{#each simplify}}
- {{.}}
{{/each}}

### 5 Responsibility
{{#each people}}
- {{.}}
{{/each}}
- A person owns scope, direction, pushing, merging, acceptance and the rules in this file.
- The agent reads this agreement first, then proposes, builds, checks, records receipts and evidence, and reports. It never accepts its own work.

### 6 Repo
- Branches: {{branches}}
- PR: {{pr}}
- Merge: {{merge}}
- Protection: {{protection}}
- Checks: {{checks}}

Open:
{{#each open}}
- {{.}}
{{/each}}

First job: {{firstJob}}

Agreed enough to start; revisit after the first job.
