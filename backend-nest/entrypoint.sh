#!/bin/sh
set -e
echo "▶️ Environment RUN values:"
echo "  RUN_MIGRATIONS=${RUN_MIGRATIONS:-}"
echo "  RUN_SEED=${RUN_SEED:-}"

echo "▶️ Running deploy (migrations, generate, seed)"
npm run deploy

echo "▶️ Running database migrations"
if [ "$RUN_MIGRATIONS" = "true" ]; then
  npx prisma migrate deploy
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "▶️ Running seed"
  npx prisma db seed || echo "⚠️ Seed failed, continuing"
fi

echo "▶️ Starting application"
exec node dist/src/main.js
