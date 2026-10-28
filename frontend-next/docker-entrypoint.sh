#!/bin/sh
set -e

# Apply Payload CMS migrations before boot (idempotent, safe to re-run)
# ponytail: bounded — on a dev-pushed DB (payload_migrations row with batch=-1)
# payload migrate opens an interactive confirm that never returns without a TTY,
# so an unbounded call hangs the container silently instead of failing
timeout 300 node_modules/.bin/payload migrate

exec node frontend-next/server.js
