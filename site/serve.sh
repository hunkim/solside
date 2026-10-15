#!/bin/bash
# restart-safe: stops previous instance, starts in background
cd "$(dirname "$(readlink -f "$0")")"
[ -f serve.pid ] && kill "$(cat serve.pid)" 2>/dev/null && sleep 0.5
nohup env PORT=${PORT:-8081} node server.js >> serve.log 2>&1 &
echo $! > serve.pid
echo "started pid $(cat serve.pid)"
