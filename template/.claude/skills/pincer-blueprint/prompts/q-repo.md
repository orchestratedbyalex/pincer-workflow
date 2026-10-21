# Repo

Decide from the real setup, which recon already looked at. Explain an option before
offering it. Record only what the person agrees to.

---
I see {{repo_seen}}: commits, authors, branches, merge style, remote, protection,
checks. Let's settle how work is separated, checked and integrated.
---

One at a time:
- Branches: "One branch per ticket, or commit to the main branch?" Options: `per-ticket` (recommended with more than one committer or with a PR flow; each ticket gets its own branch), `main` (one person, no PR: fewer moving parts), `open`.
- In progress: "How many tickets may be in progress at once?" Recommended: one.
- Checks: "Which checks gate a merge?" Seen: {{checks_seen}}. They become `repo.checks`, what evaluate runs and what CI should run.
- Protection: "Is the main branch protected? {{protection_seen}}" Options: require the checks and a review before merge (recommended with a PR flow), none, `open`. Never test protection by pushing as an admin; the bypass proves nothing.
- Merge: "Merge commit, squash or rebase?" One sentence each: a merge commit keeps every commit and adds one that joins them; squash collapses the branch into one commit; rebase replays the commits onto main, one per ticket when the branch was kept clean. Recommend what the history already does: {{merge_seen}}.
- PR: "Does every change go through a pull request?" Options: yes (recommended with a forge and more than one person), no.
- Cleanup: "Delete branches after merge?" Recommended: yes.
- Identity: "I see {{authors_seen}}. Which identity should commits carry, and how are the agent's commits attributed?"

Returns: `repo.branches`, `repo.pr`, `repo.merge`, `repo.protection`, `repo.checks`; the in-progress limit, cleanup and identity choices go under `## Conventions` in `AGENTS.md`.
