#!/usr/bin/env bash
# Espelha .github/workflows/coolify-deploy.yml: lockfile, lint, test e build de backend e frontend.
# Uso: pnpm ci:local [backend|frontend]   (sem argumento roda os dois)
set -euo pipefail
cd "$(dirname "$0")/.."

target="${1:-all}"
export DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

step "Install (frozen lockfile)"
pnpm install --frozen-lockfile

backend() {
  cd backend-nest
  step "[backend] Prisma generate"; pnpm exec prisma generate
  step "[backend] Lint";            pnpm lint
  step "[backend] Test";            JWT_SECRET=ci-dummy-secret JWT_REFRESH_SECRET=ci-dummy-refresh-secret NODE_ENV=test pnpm test
  step "[backend] Build";           pnpm build
  cd ..
}

frontend() {
  cd frontend-next
  step "[frontend] Generate API client"; pnpm generate:api
  step "[frontend] Lint";                pnpm lint
  step "[frontend] Test";                pnpm exec vitest run
  step "[frontend] Build";               NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production pnpm build
  cd ..
}

[[ $target == all || $target == backend ]] && backend
[[ $target == all || $target == frontend ]] && frontend

printf '\n\033[1;32m✔ Tudo OK.\033[0m\n'
