# Real browser gate (T-107)

The maintainer evaluator uses Chrome Headless through Chrome DevTools Protocol and Node
22's built-in WebSocket. It adds no package dependency and is not distributed as runtime
tooling. `scripts/delivery-benchmark-v7/browser.cjs` is the complete adapter implementation.

## Commands and pins

Ordinary tests run the injected seam controls:

```sh
node test/benchmark-browser.test.js
```

The separately provisioned browser gate uses local fixture repositories and launches no
model or provider session:

```sh
PINCER_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
PINCER_BROWSER_VERSION='153.0.8010.48' \
node test/benchmark-browser-live.test.js
```

The defaults match these explicit values. Other platforms must provision the exact
approved browser release and set its executable path and version. Missing Chrome, a
version mismatch, failed launch, incomplete observation or a timeout fails the gate;
there is no skip or fallback to markup-only acceptance. A host must permit launching a
headless browser and binding ephemeral localhost ports.

For execution provenance, T-101's browser descriptor must cover the adapter and its full
dependency closure, and a complete provisioned browser runtime tree. On macOS this means
the Chrome app bundle, including the framework implementation, not only the small
`Contents/MacOS/Google Chrome` executable. Record the tree digest through the effective
manifest; do not substitute a version string or a digest of the launcher alone. Copy a
runtime artifact without unresolved symlinks into the approved input root when required
by the effective-input containment contract. Browser updates require a newly resolved
manifest/cohort. The adapter `create({executable, expectedVersion})` returns an async
`probe()` that checks actual CDP version, native pointer input and screenshot capability;
execution preflight must complete it before preparing a model workspace.

## Observations and artifacts

The real gate proves visible empty/error/submitting states, label focus, enabled empty
submission and refused submitting activation. It rejects `aria-only`, hidden empty/error/
loading controls, and an invisible ancestor. The faulty controls still pass the held-out
markup checks. A separate native-click control verifies the input route.

Each check retains a PNG and JSON report naming the tested candidate commit, page digest,
actual browser and protocol versions, adapter digest, viewport, measured observations,
and screenshot digest. The gate prints the retained temporary artifact directory; each
variant also contains `evaluation.json`. These are operational fixture artifacts, not
measured model-study results. Screenshots require review before claiming visual evidence.

The server binds `127.0.0.1` on a disposable port and serves only the exact supplied HTML
route. Candidate scripts, frames, form navigation and resource loads are constrained by
response CSP; CDP interception permits only the exact route, and unexpected navigation
fails the observation. The gate includes a forbidden localhost resource and file-frame
control. Chrome receives a fresh disposable profile and no production data. Browser
background networking is disabled and external DNS resolution is disabled. This is
application-level isolation, not a claim of an operating-system network sandbox.

Success, candidate rejection, timeout, browser version mismatch and actual SIGTERM are
checked for closed fixture ports, removed profiles and exited Chrome processes. The
normal seam test also exercises a real missing-executable launch error. A forced SIGKILL
of the entire evaluator cannot run JavaScript cleanup and remains an operating-system
supervision concern.

### Effective runtime descriptor

Set `browser.runtime.path` to the entire pinned browser artifact (the full Chrome app
bundle on macOS). Set `browser.runtime.executable` to the input-root-relative executable
inside that artifact. A single-file runtime may omit `executable`; a directory may not.
The preflight checks containment, executable permission, every frozen byte, actual
version, native input and screenshot capability before preparing a measured workspace.
