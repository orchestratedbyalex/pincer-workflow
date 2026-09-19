#!/bin/sh
# T-102: the v7 driver inherited personal settings and disabled approvals. That
# historical invocation is no longer a launch API. Keeping this refusal executable
# makes old automation fail before it can start a session or create run artifacts.
printf '%s\n' 'live-driver: refused: the historical direct launch route is disabled.' >&2
printf '%s\n' 'Use a resolved effective manifest and the isolated launch profile; native use requires the T-109 isolation observation gate.' >&2
exit 3
