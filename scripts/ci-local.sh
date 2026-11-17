#!/usr/bin/env bash
# Espelha .github/workflows/coolify-deploy.yml: lockfile, lint, test e build de backend e frontend.
# Uso: pnpm ci:local [backend|frontend]   (sem argumento roda os dois)
set -uo pipefail
cd "$(dirname "$0")/.."

target="${1:-all}"
export DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

fail_labels=()
fail_files=()
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
step_idx=0

run() {
  local label="$1"; shift
  step "$label"
  local f="$tmpdir/$step_idx.log"
  step_idx=$((step_idx + 1))
  if ! "$@" > "$f" 2>&1; then
    fail_labels+=("$label")
    fail_files+=("$f")
  fi
}

backend() {
  local d=backend-nest
  run "[backend] Prisma generate" bash -c "cd '$d' && pnpm exec prisma generate"
  run "[backend] Lint"            bash -c "cd '$d' && pnpm lint"
  run "[backend] Test"            bash -c "cd '$d' && JWT_SECRET=ci-dummy-secret JWT_REFRESH_SECRET=ci-dummy-refresh-secret NODE_ENV=test pnpm test"
  run "[backend] Build"           bash -c "cd '$d' && pnpm build"
}

frontend() {
  local d=frontend-next
  run "[frontend] Generate API client" bash -c "cd '$d' && pnpm generate:api"
  run "[frontend] Lint"                bash -c "cd '$d' && pnpm lint"
  run "[frontend] Test"                bash -c "cd '$d' && pnpm exec vitest run"
  run "[frontend] Build"               bash -c "cd '$d' && NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production pnpm build"
}

run "Install (frozen lockfile)" pnpm install --frozen-lockfile

[[ $target == all || $target == backend  ]] && backend
[[ $target == all || $target == frontend ]] && frontend

if [[ ${#fail_labels[@]} -eq 0 ]]; then
  printf '\n\033[1;32m✔ Tudo OK.\033[0m\n'
else
  printf '\n\033[1;31m✘ Falhas:\033[0m\n'
  for i in "${!fail_labels[@]}"; do
    printf '\n\033[1;33m### %s\033[0m\033[0m\n' "${fail_labels[$i]}"
    cat "${fail_files[$i]}"
  done
  exit 1
fi
