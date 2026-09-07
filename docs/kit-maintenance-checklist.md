# Pincer kit maintenance checks

These checks apply to this distribution repository. They are separate from the generic
product release audit shipped to installed projects.

- [ ] `npm test` passes every regression suite
- [ ] Regenerating Codex skills, Copilot prompts, and the Claude plugin in a clean temporary copy produces no diff
- [ ] The npm tarball contains dot-directories, canonical playbooks, helpers, and the structured hook parser
- [ ] Packed Claude, Codex, Copilot, and all-platform installs pass in greenfield and brownfield fixtures
- [ ] Plugin marketplace, manifest, and hook references resolve
- [ ] Linux and macOS CI runs the same candidate-wide gate at the supported Node floor
- [ ] Manual live-agent trials are reported separately from deterministic distribution checks
