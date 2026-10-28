---
title: Guia — Rodar localmente
tags: [guide, ops]
---

# Guia — Rodar localmente

## Stack completo via Docker

`docker-compose.yml` (raiz) sobe tudo. Copie `.env.example` → `.env` e ajuste os segredos.

```bash
docker compose up -d --build  # primeira vez (ou após rebuild)
docker compose up -d          # nas demais vezes
docker compose logs -f        # acompanhar
docker compose down           # parar
docker compose down -v        # reset total (apaga volumes)
```

| Serviço | Porta do container | Publicada no host? | Notas |
|---------|-------|-----|-------|
| frontend (Next) | 3000 | **não** | só `EXPOSE`; alcançável pela rede do compose |
| backend (Nest) | 3001 | **não** | só `EXPOSE`; prefixo `/api/v1` |
| postgres | 5432 | sim — `POSTGRES_HOST_PORT` | schemas `public` + `payload` |
| redis | 6379 | não | BullMQ + throttler |
| s3 (RustFS) | 8333 (API) · 9001 (console) | sim | storage S3 local |

> [!warning] O compose não publica as portas do app
> Só `postgres` e `s3` têm `ports:`. `backend` e `frontend` ficam na rede interna — é o
> desenho para produção atrás de proxy (ver [[deploy]] e a nota de throttler em
> [[observability]]), e é o que impede alguém de forjar `X-Forwarded-For` direto no backend.
> Para abrir `http://localhost:3000` na sua máquina, publique as portas no seu próprio
> override em vez de editar o `docker-compose.yml` versionado:
>
> ```yaml
> # docker-compose.override.yml (não versionado)
> services:
>   frontend: { ports: ["3000:3000"] }
>   backend:  { ports: ["3001:3001"] }
> ```
>
> O fluxo de desenvolvimento do dia a dia é o "Dev sem Docker" abaixo, que não tem esse passo.

Flags no `.env`: `RUN_MIGRATIONS=true` roda migrations no boot do backend; `RUN_SEED=true` roda o seed. O frontend roda as migrations do Payload CMS automaticamente no boot.

> **Atenção:** `frontend-next/.env.local` é ignorado no build Docker (`.dockerignore`). Variáveis de ambiente para Docker devem ficar apenas em `.env`.

## Dev sem Docker

Precisa de Postgres + Redis rodando (pode subir só esses via compose).

**Backend** (`backend-nest/`):

```bash
pnpm install
pnpm run prisma:generate
pnpm run prisma:migrate         # ou prisma:push
pnpm run prisma:seed
pnpm run start:dev              # nest watch (PORT=3001)
```

**Frontend** (`frontend-next/`):

```bash
pnpm install
pnpm run generate:api           # gera o client do openapi.json do backend
pnpm run dev                    # http://localhost:3000
```

## Credenciais do seed

`prisma/seed.ts` cria os papéis de sistema e o admin:

- **email:** `admin@example.com`
- **senha:** `SEED_USER_PASSWORD` (default `admin123` no seed; `.env.example` usa `changeme`)

## Comandos úteis

| Comando | Onde | Faz |
|---------|------|-----|
| `pnpm run openapi:export` | backend | Regenera `openapi.json` |
| `pnpm run generate:api` | frontend | Regenera `src/lib/generated/` |
| `pnpm run prisma:studio` | backend | Prisma Studio |
| `pnpm test` | ambos | Vitest |
| `pnpm run plop` | backend/frontend | Geradores (módulo, use-case) |

Docs da API (dev): `http://localhost:3001/api/docs`. Ver [[add-a-module]] · [[frontend-overview]].
