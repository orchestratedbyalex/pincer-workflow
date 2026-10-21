# Confirm the kind

Fill the slots from the recon report, say it in one paragraph, then ask.

---
I looked at the repository. It reads as **{{kind}}**: {{reasons}} I could not see
{{unavailable}}, so tell me if that changes the picture.

{{kind_meaning}}

Is that right? Answer `yes`, or tell me what I got wrong: the kind, a fact, or
something I could not see.
---

`{{kind_meaning}}` by kind:
- brownfield: "Brownfield means there is code, history or a running system to respect, so we start by tracing how work moves today and bend the pipeline to it."
- greenfield: "Greenfield means the first real job is also the first trace: we agree the shape now and check it against that job."

Returns: the confirmed kind (`greenfield` or `brownfield`) for `project.kind`, and the corrected reasons in the person's words for `project.reason`.
