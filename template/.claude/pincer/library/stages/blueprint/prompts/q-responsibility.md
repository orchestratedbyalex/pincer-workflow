# Responsibility

Keep decisions and work apart. What to build, where it is going, when it counts as
accepted, what leaves the machine (a push, a merge) and the rules themselves belong
to a person. The work, and the technical choices inside it, can be the agent's as
long as it writes them down.

---
Who works on this project? {{people_seen}} For each person: name, role, and whether
they accept results, meaning they are the one who says "done" after the checks pass.
At least one person must accept.
---

Then, for each artifact the pipeline keeps (spec, tickets, code, evidence, this
agreement):
---
**{{artifact}}**: who writes the first version, who updates it as things change, and
whose yes closes it? When a cell is honestly "not applicable", say why instead of
leaving it blank.
---

Then the line between the two:
---
These stay with a person unless you say otherwise: scope and direction, pushing and
merging, acceptance, changes to this agreement. The agent may build, verify, review,
record receipts and evidence, and propose. Anything to move across the line? And if
the agent runs with your credentials, should it be told never to use an admin bypass?
---

Returns: `people` (name, role, accepts) and, for `open`, any decision the person moved across the line.
