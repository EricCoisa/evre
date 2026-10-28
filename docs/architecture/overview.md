---
title: Overview & Stack
tags: [architecture]
---

# Overview & Stack

Monorepo pnpm + Turbo (`pnpm-workspace.yaml`, `turbo.json`). Duas aplicações independentes que compartilham um Postgres.

## Stack real (versões de `package.json`)

**Backend — `backend-nest/`**

| Área | Tecnologia |
|------|-----------|
| Framework | NestJS 11 |
| ORM / DB | Prisma 6.19 · PostgreSQL |
| Auth | passport-jwt, @nestjs/jwt |
| Validação | nestjs-zod (Zod) |
| i18n | nestjs-i18n |
| Filas | BullMQ (@nestjs/bullmq) + Redis |
| Agendamento | @nestjs/schedule |
| Storage | @aws-sdk/client-s3 (RustFS local) |
| Rate limit | @nestjs/throttler (storage Redis) |
| Logs / erros | nestjs-pino · @sentry/nestjs |
| Health | @nestjs/terminus |
| Docs API | @nestjs/swagger |

**Frontend — `frontend-next/`**

| Área | Tecnologia |
|------|-----------|
| Framework | Next.js 16.2 (App Router) · React 19.2 |
| CMS | Payload CMS 3.86 (embutido) |
| Cliente HTTP | Orval 7.9 (gera client tipado do OpenAPI) + axios |
| Data fetching | TanStack Query 5 |
| UI | Radix UI · Tailwind CSS 4 · shadcn |
| Forms | react-hook-form + Zod 4 |
| i18n | i18next / react-i18next |

## Mapa de pastas (topo)

```
template/
├── backend-nest/     API NestJS + Prisma (schema Postgres: public)
├── frontend-next/    Next.js + Payload CMS (schema Postgres: payload)
├── docker-compose.yml   stack local (postgres, backend, frontend, redis, s3)
└── docs/             este vault
```

### `backend-nest/src/`

| Pasta | Papel |
|-------|-------|
| `domain/` | Tipos, entidades, constantes e contratos de provider. Sem Nest nem Prisma — só `@nestjs/swagger` nas entidades, que são também schema de resposta |
| `common/` | Cross-cutting: decorators, guards, filters, interceptors, infraestrutura (redis, crypto, throttler), schemas, utils |
| `modules/` | Um diretório por feature (kebab-case): `*.module.ts`, `*.controller.ts`, `use-cases/`, `dto/`, `ai-tools/`; `*.service.ts` só quando outro módulo consome |
| `prisma/` | `PrismaModule`/`PrismaService` |
| `i18n/` | `en/` e `pt-BR/` (arquivos JSON por área) |

### `frontend-next/src/`

| Pasta | Papel |
|-------|-------|
| `app/` | App Router — route groups `(payload)`, `(private)`, e páginas públicas de auth |
| `lib/actions/` | Server Actions (`"use server"`) — a ponte para o backend |
| `lib/generated/` | Cliente tipado gerado pelo Orval (não editar à mão) |
| `lib/api/` | Camadas HTTP (ver [[http-client-orval]]) |
| `components/` | UI reutilizável (`ui/`, `form/`, `auth/`) |
| `collections/`, `payload-components/` | Coleções e campos do Payload CMS |
| `locales/` | Traduções `en/` e `pt-BR/` |

## Convenções globais

- **`common/` nunca importa de `modules/`.** A dependência é de mão única: feature usa
  cross-cutting, não o contrário. Se algo em `common/` precisa de um módulo, ele não é
  cross-cutting — é feature, e o lugar dele é `modules/`.
- **Tem controller, dto ou ai-tools? É `modules/`.** `common/infrastructure/` guarda só
  o que não expõe rota: `redis`, `crypto`, `throttler`. Integração com provider + tela de
  config (email, storage, ai, captcha, sentry) é módulo, mesmo tendo `providers/` dentro.
- Todo módulo de feature se registra no **`app.module.ts`**. Depender de outro módulo
  importá-lo faz a rota existir por efeito colateral e desaparecer em silêncio.
- Backend expõe tudo sob o prefixo **`/api/v1`** (`main.ts`).
- Contrato: backend gera `openapi.json` → frontend gera o client tipado com Orval. Ver [[http-client-orval]] e [[i18n]].
- Postgres é único; backend usa o schema `public`, Payload CMS usa o schema `payload`.
- **Comentário é afirmação de uma linha, nunca explicação.** `/** Valida o token e devolve o usuário. */`,
  não um parágrafo sobre porquê, histórico de decisão ou trade-off — isso valia no momento em que foi
  escrito e não significa nada depois. Banner decorativo e código morto comentado: apague, não condense.
  A exceção é fato de segurança/compliance genuinamente crítico (ex.: comportamento exigido por RFC) —
  mesmo aí o código fica só com a linha afirmativa; o "porquê" vai para a nota certa em `docs/` (ver o
  mapa no `CLAUDE.md` da raiz), nunca em comentário.

Ver também: [[request-lifecycle]] · [[data-model]] · [[modules]]
