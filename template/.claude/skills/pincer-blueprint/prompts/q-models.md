# Models

Propose, do not ask from scratch: apply the "Model tiers" section of
`.claude/skills/pincer-blueprint/formats/roster-rules.md` to the confirmed roster, then
present the result for confirmation. One question.

---
Each role can run on a tier: `strong` (the most capable model the platform offers),
`standard`, or `fast`. A tier is translated to the model each platform knows, so this
agreement never names a vendor's model. From the roster, I propose:

{{tier_table}}

Everything not named here runs on whatever model your session runs on, and `inherit`
pins a role to that on purpose. Effort (`low`, `medium`, `high`) stays the platform's
default unless you name one for a role. Confirm, or change any line; `open` leaves a
role unset and I record it under open.
---

Returns: models.stages and models.agents as tiers, with an effort only where the person named one.
