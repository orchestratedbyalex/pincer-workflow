# First job

Name one small, real piece of work, and say that its first run through the pipeline
is the trace to revisit the agreement with.

---
{{proposal}}

Shall we make that the first job? Say yes, or name another small, real change. The
first run through the pipeline shows where this agreement is wrong; we fix the
agreement then, not now.
---

`{{proposal}}` by kind:
- brownfield: the smallest real change recon or the open items point at (a failing check, a missing CI step, a secret in the wrong place, the oldest small bug), stated as "Fix X so that Y".
- greenfield: the setup job (the repository, the checks named under Repo, the deploy if one was chosen), stated as "Set up X so that the first feature can ship through the pipeline".

Returns: `firstJob`, one line the person agreed to.
