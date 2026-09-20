# T-121 corrected candidate: host validation

The custody corrections are locally fixture-verified. The remaining implementation
boundary is a full regression pass on a permitted host and CI on the committed
candidate. This procedure does not log in, run a study or publish an npm release.

Run this in your normal terminal. The subshell stops on any failure. The full suite
includes process-claim regressions and packed-distribution parity and usually takes
about 15 minutes. On failure, retain the output and stop before committing or pushing.

```bash
(
  set -e
  cd /Users/alex/Documents/dev/personal/pincer-workflow
  test "$(git branch --show-current)" = feat/prd-v8
  git diff --cached --quiet
  git diff --check
  npm test
  bash /tmp/pincer-v8-management-694241c/scripts/pincer-ticket.sh verify T-121
  git diff --check
  git add -- \
    scripts/delivery-benchmark-v7/login-custody.cjs \
    scripts/delivery-benchmark-v7/isolated-launch.cjs \
    scripts/delivery-benchmark-v7/run-claims.cjs \
    test/native-login-study.test.js \
    test/fixtures/delivery-benchmark-v7/frozen.json \
    docs/prd-v8-agent-isolation.md \
    docs/prd-v8-native-tool-contracts.md \
    docs/prd-v8-native-tool-plan.md \
    docs/prd-v8-progress.md \
    docs/wiki/systems/native-tool-contracts.md \
    docs/prd-v8-artifacts/execution/T-121-native-smoke-execution-package.md \
    docs/prd-v8-artifacts/execution/T-121-candidate-validation.md \
    tickets/T-121-implement-native-login-study.md
  git diff --cached --stat
  git commit -m "fix: preserve native login custody through cleanup and recovery"
  git push origin feat/prd-v8
  git rev-parse HEAD
)
```

If the pinned kit is missing, stop and restore the pinned kit; do not substitute the
implementation under test or edit ticket receipts manually. Review any unrelated
pre-existing staged changes before running this sequence.

CI is defined in `.github/workflows/ci.yml`: the full suite runs on Ubuntu and macOS
with Node 22 and 24. Require all four jobs to pass for the SHA printed above. A green
run on an earlier commit does not validate this candidate. The workflow is available
at https://github.com/orchestratedbyalex/pincer-workflow/actions/workflows/ci.yml.

Send back the candidate SHA and CI run URL, or the first failing check and its output.
Only then refresh the external study checkout and regenerate its draft inputs for
that candidate, preserving historical decisions and evidence. Use the replacement
native-login package to settle the remaining execution decisions. A successful test
or CI run does not authorize a live session or demonstrate native authentication.
