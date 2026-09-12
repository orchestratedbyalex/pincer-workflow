# Delivery benchmark report (2026-09-12T21:44:34.579Z)
Protocol frozen 2026-09-12T13:26:14.931Z (052634c93a02).
Slots 36 · valid 36 · accepted 34/36 · outstanding 0 · invalid 6 · unavailable 0
Order balance: 9 pairs pincer-first, 9 pairs plain-first.

| Brief | Arm | Accepted / valid | Rejected | Unverified · error | Outstanding · invalid · unavailable | Regressions | Clarif. · reappr. · repair · operator | Active min | Elapsed min | Setup · review min | Tokens · cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bugfix-brownfield | pincer | 3/3 | 0 | 0 · 0 | 0 · 1 · 0 | 0 | 0 · 0 · 0 · 1 | 1.97 (min 1.55, max 2.42, n=3) | 1.97 (min 1.55, max 2.42, n=3) | 0 (min 0, max 0, n=3) · n/a (n=0) | 3/3 · 3/3 |
| bugfix-brownfield | plain | 3/3 | 0 | 0 · 0 | 0 · 1 · 0 | 0 | 0 · 0 · 0 · 1 | 1.62 (min 1.33, max 1.63, n=3) | 1.62 (min 1.33, max 1.63, n=3) | 0 (min 0, max 0, n=3) · n/a (n=0) | 3/3 · 3/3 |
| cli-greenfield | pincer | 3/3 | 0 | 0 · 0 | 0 · 1 · 0 | 0 | 0 · 0 · 0 · 1 | 6.27 (min 6.14, max 19.99, n=3) | 6.27 (min 6.14, max 19.99, n=3) | 0 (min 0, max 0, n=3) · n/a (n=0) | 3/3 · 3/3 |
| cli-greenfield | plain | 3/3 | 0 | 0 · 0 | 0 · 1 · 0 | 0 | 0 · 0 · 0 · 1 | 2.06 (min 1.88, max 2.35, n=3) | 2.06 (min 1.88, max 2.35, n=3) | 0 (min 0, max 0, n=3) · n/a (n=0) | 3/3 · 3/3 |
| handoff-two-changes | pincer | 3/3 | 0 | 0 · 0 | 0 · 0 · 0 | 0 | 0 · 0 · 0 · 0 | 9.31 (min 8.24, max 9.55, n=3) | 9.31 (min 8.25, max 9.55, n=3) | 0 (min 0, max 0, n=3) · n/a (n=0) | 3/3 · 3/3 |
| handoff-two-changes | plain | 3/3 | 0 | 0 · 0 | 0 · 0 · 0 | 0 | 0 · 0 · 0 · 0 | 2.7 (min 2.01, max 3.23, n=3) | 2.7 (min 2.02, max 3.23, n=3) | 0 (min 0, max 0, n=3) · n/a (n=0) | 3/3 · 3/3 |
| integration-untested | pincer | 3/3 | 0 | 0 · 0 | 0 · 0 · 0 | 0 | 0 · 0 · 0 · 0 | 12.66 (min 4.48, max 15.86, n=3) | 12.66 (min 4.48, max 15.86, n=3) | 0 (min 0, max 0, n=3) · n/a (n=0) | 3/3 · 3/3 |
| integration-untested | plain | 3/3 | 0 | 0 · 0 | 0 · 0 · 0 | 0 | 0 · 0 · 0 · 0 | 3.99 (min 2.42, max 4.49, n=3) | 3.99 (min 2.42, max 4.49, n=3) | 0 (min 0, max 0, n=3) · n/a (n=0) | 3/3 · 3/3 |
| scope-revision | pincer | 3/3 | 0 | 0 · 0 | 0 · 0 · 0 | 0 | 0 · 0 · 0 · 3 | 13.62 (min 11.91, max 17.96, n=3) | 13.63 (min 11.91, max 17.97, n=3) | 0 (min 0, max 0, n=3) · n/a (n=0) | 3/3 · 3/3 |
| scope-revision | plain | 2/3 | 1 | 0 · 0 | 0 · 0 · 0 | 0 | 0 · 0 · 0 · 3 | 2.94 (min 2.7, max 3.07, n=3) | 2.95 (min 2.7, max 3.08, n=3) | 0 (min 0, max 0, n=3) · n/a (n=0) | 3/3 · 3/3 |
| ui-states | pincer | 2/3 | 1 | 0 · 0 | 0 · 1 · 0 | 0 | 0 · 0 · 0 · 1 | 8.92 (min 5.31, max 10.6, n=3) | 8.92 (min 5.31, max 10.6, n=3) | 0 (min 0, max 0, n=3) · n/a (n=0) | 3/3 · 3/3 |
| ui-states | plain | 3/3 | 0 | 0 · 0 | 0 · 1 · 0 | 0 | 0 · 0 · 0 · 1 | 1.52 (min 1.43, max 1.97, n=3) | 1.52 (min 1.43, max 1.97, n=3) | 0 (min 0, max 0, n=3) · n/a (n=0) | 3/3 · 3/3 |

Per run:
- #2 bugfix-brownfield/pair-1/pincer: valid · accepted · candidate 0087eeb · kit b7d6e7894ae4
- #13 bugfix-brownfield/pair-2/pincer: invalid · rejected · candidate 41b20b2 · kit b7d6e7894ae4 · account usage limit reached during S1 (Claude Code reported a session limit); the session produced no usable work
- #26 bugfix-brownfield/pair-3/pincer: valid · accepted · candidate 63c5468 · kit b7d6e7894ae4
- #null bugfix-brownfield/pair-4/pincer: valid · accepted · candidate 32ce523 · kit b7d6e7894ae4
- #1 bugfix-brownfield/pair-1/plain: valid · accepted · candidate a428773
- #14 bugfix-brownfield/pair-2/plain: invalid · rejected · candidate 6944483 · account usage limit reached during S1 (Claude Code reported a session limit); the session produced no usable work
- #25 bugfix-brownfield/pair-3/plain: valid · accepted · candidate 75545df
- #null bugfix-brownfield/pair-4/plain: valid · accepted · candidate f395f07
- #3 cli-greenfield/pair-1/pincer: valid · accepted · candidate f9f1e2f · kit b7d6e7894ae4
- #16 cli-greenfield/pair-2/pincer: invalid · kit b7d6e7894ae4 · account usage limit reached; the operator terminated the session (SIGTERM, exit 143) while stopping the driver
- #27 cli-greenfield/pair-3/pincer: valid · accepted · candidate 8096606 · kit b7d6e7894ae4
- #null cli-greenfield/pair-4/pincer: valid · accepted · candidate fc161e5 · kit b7d6e7894ae4
- #4 cli-greenfield/pair-1/plain: valid · accepted · candidate 3df295d
- #15 cli-greenfield/pair-2/plain: invalid · rejected · candidate 51e5592 · account usage limit reached during S1 (Claude Code reported a session limit); the session produced no usable work
- #28 cli-greenfield/pair-3/plain: valid · accepted · candidate 3a56d99
- #null cli-greenfield/pair-4/plain: valid · accepted · candidate 2477236
- #6 handoff-two-changes/pair-1/pincer: valid · accepted · candidate 8431cfb · kit b7d6e7894ae4
- #17 handoff-two-changes/pair-2/pincer: valid · accepted · candidate 39b5769 · kit b7d6e7894ae4
- #30 handoff-two-changes/pair-3/pincer: valid · accepted · candidate 682861c · kit b7d6e7894ae4
- #5 handoff-two-changes/pair-1/plain: valid · accepted · candidate 02db4e1
- #18 handoff-two-changes/pair-2/plain: valid · accepted · candidate 07a007b
- #29 handoff-two-changes/pair-3/plain: valid · accepted · candidate 2f53a94
- #7 integration-untested/pair-1/pincer: valid · accepted · candidate 60f1c78 · kit b7d6e7894ae4
- #20 integration-untested/pair-2/pincer: valid · accepted · candidate bf4d168 · kit b7d6e7894ae4
- #31 integration-untested/pair-3/pincer: valid · accepted · candidate 219d1bc · kit b7d6e7894ae4
- #8 integration-untested/pair-1/plain: valid · accepted · candidate 091fd75
- #19 integration-untested/pair-2/plain: valid · accepted · candidate ed1a3a3
- #32 integration-untested/pair-3/plain: valid · accepted · candidate 2e505a2
- #10 scope-revision/pair-1/pincer: valid · accepted · candidate 1ba6e11 · kit b7d6e7894ae4
- #21 scope-revision/pair-2/pincer: valid · accepted · candidate bb77e7b · kit b7d6e7894ae4
- #34 scope-revision/pair-3/pincer: valid · accepted · candidate 08720d1 · kit b7d6e7894ae4
- #9 scope-revision/pair-1/plain: valid · rejected · candidate eddfd31
- #22 scope-revision/pair-2/plain: valid · accepted · candidate cfebfb8
- #33 scope-revision/pair-3/plain: valid · accepted · candidate 479fad8
- #11 ui-states/pair-1/pincer: invalid · rejected · candidate 8526876 · kit b7d6e7894ae4 · account usage limit reached during S1 (Claude Code reported a session limit); the session produced no usable work
- #24 ui-states/pair-2/pincer: valid · accepted · candidate f32350e · kit b7d6e7894ae4
- #35 ui-states/pair-3/pincer: valid · accepted · candidate da6e4c2 · kit b7d6e7894ae4
- #null ui-states/pair-4/pincer: valid · rejected · candidate 0db66b1 · kit b7d6e7894ae4
- #12 ui-states/pair-1/plain: invalid · rejected · candidate bda6148 · account usage limit reached during S1 (Claude Code reported a session limit); the session produced no usable work
- #23 ui-states/pair-2/plain: valid · accepted · candidate d52b0a1
- #36 ui-states/pair-3/plain: valid · accepted · candidate 0beb371
- #null ui-states/pair-4/plain: valid · accepted · candidate e54a8e8

Environments: claude-code 2.1.267 · model sonnet · node v22.23.1 · darwin 25.6.0

This report makes no parity or superiority claim. Acceptance is the independent evaluator's judgment on each run; denominators are the valid runs of each brief and arm; outstanding, invalid and unavailable runs are listed, never counted as passed; unavailable values are null with a reason.
