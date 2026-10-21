# Systems

One activity at a time. The distinction to carry through: the place where work gets
done (a chat, an editor, a call) is not the place where its record ends up (an issue,
a commit message, a pull request, a deploy run). Context is lost when the two are
confused.

Open with: "Take each activity in turn: where is it done, and where would someone
find its trace a month from now?"

For each activity in turn, define, build, test, review, deploy:
---
**{{activity}}**: I see {{prefill}}. Where is it done, and where does its record end
up? If it does not happen yet, say `not yet` and we leave the cell open
rather than pick a tool today.
---

Then, each on its own:
- Forge: "{{forge_seen}}. Should the forge hold the spec and the tickets, or do they stay as files in the repository?" Options: `files` (recommended for one or two people: nothing to sync, and the ticket script can protect the fields), `forge` (the issue holds the discussion and a local file points at it), `open`.
- CI: "{{ci_seen}}. Does CI gate anything today, and what does it run?" Options: keep what runs, add the checks the Repo section will name, `open`.
- Deploy: "{{deploy_seen}}. What triggers a deploy, and where would you see that it ran?" Options: on merge to the main branch, by hand, nothing deploys yet, `open`.
- Secrets: "Where do secrets live: a vault, a `.env` file that is never committed, the platform's settings?" Options as the person names them, or `open`.

Record a tool only when the person names it. A tool that exists but that nobody
opens is nominal; write it down as nominal, not as a system. A blocker that surfaces here (a repository that cannot
deploy, a secret in the code) becomes the first open item and often the first job.

Returns: `systems.forge`, `systems.remote`, `systems.ci`, `systems.deploy`, `systems.secrets`, and the blockers for `open`.
