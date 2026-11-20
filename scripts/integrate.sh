#!/bin/bash
# Integrator: in the clean worktree /home/surf/hc-int (detached HEAD), merge origin/main and the given
# branches, verify (typecheck, tests, build), restart hc-app from hc-int, demo-check + browser smoke, push HEAD:main.
# Usage: scripts/integrate.sh plan-a [plan-b]
set -euo pipefail
cd /home/surf/hc-int
git fetch -q origin
git merge -q --no-edit origin/main
for b in "$@"; do git merge -q --no-edit "origin/$b"; done
if ! git diff --quiet ORIG_HEAD HEAD -- package.json package-lock.json 2>/dev/null; then npm install --silent; fi
npm run typecheck >/dev/null
npm test >/tmp/hc-int-test.log 2>&1 || { grep -E "FAIL|×" /tmp/hc-int-test.log | head; echo "TESTS FAILED"; exit 1; }
grep -E "Tests " /tmp/hc-int-test.log
npm run build >/tmp/hc-int-build.log 2>&1 || { tail -20 /tmp/hc-int-build.log; echo "BUILD FAILED"; exit 1; }
tmux kill-session -t hc-app 2>/dev/null || true
tmux new-session -d -s hc-app -c /home/surf/hc-int "npm run start -- -p 3000 2>&1 | tee /tmp/hc-app.log"
for i in $(seq 1 30); do curl -s -o /dev/null localhost:3000/ && break; sleep 1; done
node scripts/demo-check.mjs | tail -1 | tee /tmp/hc-int-demo.log; grep -q "all checks passed" /tmp/hc-int-demo.log || { echo "DEMO CHECK FAILED"; exit 1; }
PW=/tmp/claude-1000/-home-surf-housechecker/878163fe-2e63-440f-bd2f-1c46077ebc11/scratchpad/pw
if [ -d "$PW/node_modules/playwright" ]; then
  ADDRS=("1450 Noriega St" "2627 Irving St" "1601 Taraval St" "1001 Potrero Ave" "2201 Lake St" "1800 Union St" "1350 Shotwell St")
  A=${ADDRS[$((RANDOM % ${#ADDRS[@]}))]}
  out=$(cd "$PW" && timeout 150 node uncached.mjs "$A, San Francisco. 2 bed 1 bath. Asking \$1,250,000." | tail -1); echo "$out"
  case "$out" in *"SMOKE FAIL"*) echo "SMOKE FAILED"; exit 1;; esac
fi
git push -q origin HEAD:main
git log --oneline -1
