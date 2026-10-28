# syntax=docker/dockerfile:1

# ── base ─────────────────────────────────────────────────────
FROM node:22-alpine AS base
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate \
    && chmod -R a+rx /opt/corepack

# ── workspace deps ────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY backend-nest/package.json  ./backend-nest/
COPY frontend-next/package.json ./frontend-next/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ── build ─────────────────────────────────────────────────────
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"
WORKDIR /app
COPY --from=deps /app/node_modules              ./node_modules
COPY --from=deps /app/backend-nest/node_modules  ./backend-nest/node_modules
COPY --from=deps /app/frontend-next/node_modules ./frontend-next/node_modules
# orval reads ../backend-nest/openapi.json at build time
COPY backend-nest/openapi.json  ./backend-nest/openapi.json
COPY frontend-next               ./frontend-next
COPY package.json pnpm-workspace.yaml ./
WORKDIR /app/frontend-next
RUN pnpm run generate:api
RUN pnpm run build > /tmp/nextbuild.log 2>&1; STATUS=$?; \
    [ $STATUS -ne 0 ] && echo "=== NEXT BUILD FAILED (exit $STATUS) ===" && cat /tmp/nextbuild.log; \
    exit $STATUS

# ── runner ────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
# Next standalone server.js binds to $HOSTNAME, which Docker presets to the
# container id — that leaves loopback dead and NEXT_INTERNAL_URL unreachable
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
    && adduser  --system --uid 1001 nextjs

# workspace config needed for pnpm install in this stage
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY frontend-next/package.json ./frontend-next/
COPY backend-nest/package.json  ./backend-nest/

# standalone output (includes node_modules with broken pnpm symlinks from build context)
COPY --from=build /app/frontend-next/.next/standalone ./frontend-next/
# static assets and public are not in standalone; copy separately
# static and public go inside the nested monorepo subdir where server.js lives
COPY --from=build /app/frontend-next/.next/static  ./frontend-next/frontend-next/.next/static
COPY --from=build /app/frontend-next/public         ./frontend-next/frontend-next/public

# source files needed by Payload CLI to run migrations at startup
# (payload migrate reads tsconfig.json → payload.config.ts → src/ via jiti)
COPY --from=build /app/frontend-next/payload.config.ts ./frontend-next/payload.config.ts
COPY --from=build /app/frontend-next/src               ./frontend-next/src
# ponytail: minimal tsconfig — get-tsconfig fails with "moduleResolution":"bundler"
# server.js doesn't use this file; it exists only for the payload migrate CLI
RUN printf '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["./src/*"],"@payload-config":["./payload.config.ts"]}}}' \
    > ./frontend-next/tsconfig.json

# drop broken symlinks, reinstall cleanly inside this container
# (pnpm virtual store is now local → symlinks resolve correctly)
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    rm -rf ./frontend-next/node_modules \
    && pnpm install --prod --filter frontend-next --frozen-lockfile \
    && ln -sf /app/node_modules/.pnpm /app/frontend-next/node_modules/.pnpm \
    && chown -R nextjs:nodejs /app

COPY frontend-next/docker-entrypoint.sh ./frontend-next/docker-entrypoint.sh
RUN chmod +x ./frontend-next/docker-entrypoint.sh

USER nextjs
WORKDIR /app/frontend-next
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
