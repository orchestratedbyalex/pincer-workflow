# T-109 native-login status blocker — 21 September 2026

Candidate: `b92aa104fb574262211e7810bc5665c7ac2d84dc`.
Profile: `claude-project-native-login-v1`. Pinned CLI: 2.1.273.
Disposition: `NATIVE_LOGIN_NOT_PRESERVED` for the existing profile; a current-account status construction now succeeds and is implemented locally, with host verification pending; no model session ran. This is a failed prerequisite observation, not a completed native smoke or a finding about session billing.

## Observations

The user completed native login in the study CLAUDE_CONFIG_DIR and reports that the same pinned executable's `auth status --text` says logged in in their normal terminal. The assembled review packet stopped with `LOGIN_REQUIRED` when the runner constructed a fresh HOME and minimal environment.

A follow-up status-only diagnostic retained four results: the existing isolated environment, isolated plus USER, isolated plus LOGNAME, and isolated plus both all returned `LOGIN_REQUIRED`. USER and LOGNAME came from the operating system's account name; the script did not retain their values. All four kept fresh HOME directories and the same study CLAUDE_CONFIG_DIR. This rules out those additions as a sufficient fix. It does not prove HOME alone is the cause or identify the internal credential lookup behavior.

Retained source: `/Users/Shared/pincer-v8-study/drafts/login-diagnostic-z1irH0/results.json`.
SHA-256: `074f796933efb42a0d127e27676cc2b7d663317413af5a257a116d0b4532de89`.
No raw authentication output or credentials are included in this receipt.

## Status-only investigation (before the runner change)

The user requires their current macOS account; a dedicated account is not an available solution. The next status-only diagnostic, `/tmp/pincer-diagnose-home.cjs`, compares the existing isolated environment with normal account HOME, then normal HOME plus USER and LOGNAME, and finally repeats the isolated control. Each uses the same dedicated study configuration, pinned executable, scratch working directory, and minimal environment. No model prompt is issued.

The diagnostic uses the existing custody lock and sanitized status reader. It does not directly read, copy, hash, modify or delete personal configuration or credentials; the native CLI handles its own authentication. This does not establish which files the CLI itself accesses. Real HOME is passed only as a child environment value; it is never a scratch or cleanup target. Raw authentication output is not printed or retained. Results go into a new study draft directory.

The script passed JavaScript syntax checking and the user executed it in their terminal; results are recorded below. The assistant cannot write the external study directory under its current filesystem permissions. No successful authentication or profile isolation is inferred from preparing the diagnostic.

If normal HOME succeeds, design and verify a separately named current-account profile before any launch. Keep scratch ownership separate from the account HOME and state the weaker configuration-isolation boundary explicitly. Existing frozen inputs and CI do not cover that future implementation. If it fails, the HOME-only explanation remains unsupported and further status diagnostics are needed. Session authorization remains separate from authentication diagnostics.

## Current-account status result — 21 September 2026

Source: `/Users/Shared/pincer-v8-study/drafts/login-home-diagnostic-FdZpCu/results.json`.
SHA-256: `8bd6a8c17f8324a7e42f43ec522db8fc0cc71390a695506e9b5273c210809791`.

| Construction | Result |
| --- | --- |
| Fresh HOME, minimal environment | LOGIN_REQUIRED |
| Account HOME, minimal environment | LOGIN_REQUIRED |
| Account HOME plus OS-derived USER and LOGNAME | logged_in true; auth_method claude.ai; api_provider firstParty; subscription_type max |
| Fresh HOME control repeated | LOGIN_REQUIRED |

This establishes a successful status construction on this host, not which individual account-name variable is necessary or the CLI's internal credential lookup mechanism. No model sessions ran. The observed subscription is Max, while the user's earlier declaration was Pro; the user confirmed this is the account to use. No identity details beyond the existing sanitized contract were retained.

### Required implementation boundaries

Use the separately named profile `claude-project-current-account-login-v1`, rather than changing the meaning of historical `claude-project-native-login-v1` records. Resolve HOME and account names from the OS, never spread the shell environment. Apply this construction consistently at pre-workspace status, pre-session status, and the native child launch. Keep the study CLAUDE_CONFIG_DIR and custody unchanged.

The current launcher plants a canary under its synthetic HOME. That location would cease to be a user configuration source under a real-HOME profile: retaining it as evidence would be misleading. The new profile must explicitly mark the home canary as not installed/not observed, use only the owned study-config canary, and leave personal-configuration absence unknown until independently supported. Never plant files in the account's personal configuration. Successful login does not establish configuration isolation.

Keep sessionRoot, temporary files, hook logs, and all cleanup targets under owned study scratch directories. The real HOME is exclusively a child environment value; no cleanup path may derive from it. Fixture coverage must verify these boundaries, historical profile behavior, and refusal of undeclared profile changes. Profile identity, observation targets, contracts, frozen inputs, and proposed smoke inputs must move together; exact-candidate CI must be renewed after implementation.

The current-account implementation is being verified locally; session launch remains pending. This receipt records the diagnosis and local implementation; it is not a passing smoke or completed host verification.
