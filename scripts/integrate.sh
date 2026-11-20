#!/bin/bash
# Integrator: merge origin/<branch> into main, verify, rebuild, restart hc-app, demo-check, push.
# Usage: scripts/integrate.sh plan-a|plan-b
set -e
cd /home/surf/housechecker
b=${1:?branch}
git fetch -q origin
before=$(git rev-parse HEAD)
git merge --no-edit "origin/$b"
if ! git diff --quiet "$before" HEAD -- package.json package-lock.json; then npm install --silent; fi
npm run typecheck
npm test 2>&1 | grep -E "Test Files|Tests|FAIL|×" || true
npm test >/dev/null 2>&1 || { echo "TESTS FAILED"; exit 1; }
npm run build 2>&1 | grep -E "Compiled|rror" || true
tmux kill-session -t hc-app 2>/dev/null || true
tmux new-session -d -s hc-app -c /home/surf/housechecker "npm run start -- -p 3000 2>&1 | tee -a /home/surf/housechecker/.data/app.log"
for i in $(seq 1 30); do curl -s -o /dev/null localhost:3000/ && break; sleep 1; done
node scripts/demo-check.mjs | tail -1
# Browser smoke on a fresh (uncached) address: catches client crashes the API check can't see.
PW=/tmp/claude-1000/-home-surf-housechecker/878163fe-2e63-440f-bd2f-1c46077ebc11/scratchpad/pw
if [ -d "$PW/node_modules/playwright" ]; then
  (cd "$PW" && timeout 150 node /home/surf/housechecker/submission/tools/ui-smoke.mjs "$(( (RANDOM % 2000) + 100 )) Judah St, San Francisco. 2 bed 1 bath." | tail -1)
fi
git push -q origin main
git log --oneline -1
