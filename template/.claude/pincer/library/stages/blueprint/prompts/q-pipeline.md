# Current pipeline

Reconstruct how a piece of work really moves today, not how a process document says
it should. Ask for one recent job and walk it from the request to the result, one
step at a time.

---
Think of the last real change that shipped. {{recent_hint}} Walk me through it from
the moment it was asked for to the moment it was done: what happened first, then
next? Where did it wait, or go back a step? Where was the yes given that let it move on?
---

Follow-ups, one at a time, until the path is clear:
- "What would you call that stage?" Collect the stages in order.
- "Was there a gate there, a check, an approval, a review, and who or what gave it?"
- "Did anything happen before there was a record of it: setup, a change of direction?"
- "Where does the written process differ from what really happened?" Record the real one.

Then propose the mapping onto PINCER's stages, blueprint, plan, narrow, code,
evaluate, release, status, and ask which of today's stages each absorbs. Keep their
gates; the Simplify question decides what goes.

Greenfield: there is no trace yet. Say so, propose the default pipeline with its
gates (spec approved; a passing check per ticket; evidence saved; accepted by the
person), and ask what to change. The first job will be the trace.

Returns: the stages in order with their gates, mapped onto the PINCER stages, and `stages.plan.gate` when the person names the spec's approval gate.
