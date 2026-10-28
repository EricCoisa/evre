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
# --filter: this image only builds the backend; installing the frontend tree
# (next, payload, react) here doubles peak build disk for nothing
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter backend-nest

# ── build ─────────────────────────────────────────────────────
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules          ./node_modules
COPY --from=deps /app/backend-nest/node_modules ./backend-nest/node_modules
COPY backend-nest  ./backend-nest
COPY package.json pnpm-workspace.yaml ./
WORKDIR /app/backend-nest
RUN pnpm exec prisma generate
RUN pnpm run build

# ── production image ──────────────────────────────────────────
FROM base AS prod
ENV NODE_ENV=production
WORKDIR /app

# prod-only deps for this workspace, installed fresh here.
# never COPY the build stage's node_modules: that store holds every
# workspace's dev+prod tree (next, payload, swc binaries) — multi-GB.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY backend-nest/package.json  ./backend-nest/
COPY frontend-next/package.json ./frontend-next/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --prod --filter backend-nest --frozen-lockfile

WORKDIR /app/backend-nest
# compiled output — nest-cli assets copies i18n + email templates into dist/src
COPY --from=build /app/backend-nest/dist    ./dist
# prisma migrations + schema (needed for migrate deploy at startup)
COPY --from=build /app/backend-nest/prisma  ./prisma
COPY --from=build /app/backend-nest/prisma.config.ts ./prisma.config.ts
# regenerate the client against the prod-only store (hashed .pnpm paths
# differ from the build stage, so the generated client can't be copied)
RUN pnpm exec prisma generate

EXPOSE 3001
CMD ["sh", "-c", "\
  if [ \"$RUN_MIGRATIONS\" = \"true\" ]; then \
    ./node_modules/.bin/prisma migrate deploy; \
  fi && \
  if [ \"$RUN_SEED\" = \"true\" ]; then \
    ./node_modules/.bin/tsx prisma/seed.ts; \
  fi && \
  node dist/src/main.js"]
