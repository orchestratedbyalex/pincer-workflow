#!/bin/bash
# A check that spawns a background grandchild writing a heartbeat file, then
# waits. Used to observe that cancellation and timeout terminate the whole
# process group, not only the shell the runtime launched.
(
  while true; do date +%s%N > heartbeat.tmp 2>/dev/null || date +%s > heartbeat.tmp; sleep 0.2; done
) &
sleep "${1:-30}"
