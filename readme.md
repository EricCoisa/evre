# Template Monorepo

Monorepo com backend NestJS e frontend Next.js como base para novos projetos.

## Estrutura

```
template/
├── backend-nest/    # API NestJS 11 + Prisma 6
├── frontend-next/   # Next.js 16 + Payload CMS 3
├── docker-compose.yml
├── .env.example
├── pnpm-workspace.yaml
└── turbo.json
```

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | NestJS 11, Prisma 6.19, BullMQ 5, Passport JWT, nestjs-i18n |
| Frontend | Next.js 16.2.10, React 19, Payload CMS 3.86, shadcn/ui, TanStack Query 5 |
| Infra | PostgreSQL 16, Redis 7, MinIO (S3-compatible) |
| Orquestração | Turborepo 2, pnpm workspaces |

## Rodar localmente

```bash
# 1. Configurar variáveis
cp .env.example .env
# Edite .env — substitua os REPLACE_WITH_* por valores reais

# 2. Subir infra + apps
docker compose up -d

# RUN_MIGRATIONS=true e RUN_SEED=true no .env aplicam migrations e seed automaticamente
```

| Serviço | URL |
|---------|-----|
| Backend API | http://localhost:3001/api/v1 |
| Swagger | http://localhost:3001/api/docs |
| Frontend | http://localhost:3000 |
| Payload CMS admin | http://localhost:3000/admin |
| MinIO console | http://localhost:9001 |

```bash
# Reset total (apaga volumes)
docker compose down -v
```

## Desenvolvimento (sem Docker)

```bash
pnpm install
pnpm dev      # roda backend + frontend via turbo
pnpm test
pnpm build
```

## Backend — arquitetura

```
backend-nest/src/
├── domain/         # tipos e regras de domínio (sem framework)
├── common/         # infraestrutura transversal: guards, decorators, crypto, redis, storage, throttler
├── modules/        # feature modules (controller → use-case → Prisma)
├── i18n/           # traduções en / pt-BR
└── prisma/         # schema Prisma
```

**Padrão:** cada endpoint vive num use-case dedicado (`*.use-case.ts`). Controllers só recebem a requisição e delegam.

**Módulos disponíveis:** `auth`, `user`, `role`, `route`, `role-route-access`, `user-route-access`, `system-configuration`, `user-configuration`, `user-configuration-definition`, `email`, `cms`, `logging`, `clientLog`, `health`, `tasks`.

**Auth:** JWT access token (15 min por padrão) + refresh token + invite token. RBAC via roles e route-access — cada rota pode ter permissões por role.

## Frontend — arquitetura

```
frontend-next/src/app/
├── (payload)/      # rotas do Payload CMS admin (/admin e /api)
├── (private)/
│   ├── (admin)/    # área administrativa protegida
│   └── (client)/   # área de cliente protegida
└── api/auth/       # handlers NextAuth
```

Payload CMS roda embedded no mesmo processo Next.js, conectado a um schema separado no mesmo banco PostgreSQL.

## Variáveis de ambiente obrigatórias

Ver `.env.example`. Variáveis marcadas com `REPLACE_WITH_*` não têm valor padrão seguro e devem ser definidas antes de subir qualquer ambiente.

## Banco de dados — conexões

PostgreSQL tem `max_connections=100` por padrão.

**Fórmula:**
```
total = backend_replicas × connection_limit + frontend_replicas × pool_payload + margem
```

**Valores recomendados:**
- Backend: `connection_limit=10` na `DATABASE_URL`
- Frontend/Payload: `pool.max=5`
- Margem: ~10 (migrations, Prisma Studio)

**Exemplo com 3 réplicas de cada:** `3×10 + 3×5 + 10 = 55` — dentro do limite de 100.

Quando `backend_replicas > 3`, ative PgBouncer em transaction mode e adicione `pgbouncer=true` à `DATABASE_URL`.
