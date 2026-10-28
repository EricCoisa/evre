---
title: QuickInfo — Recursos do Template
tags: [moc, index, quick-info]
---

# QuickInfo — Recursos do Template

> Para IAs especificando um software novo **a partir** deste template (roadmap, escopo, estimativa):
> confira esta lista antes de propor uma feature. Isso é um resumo de capacidades, não manual de uso —
> para implementação, siga o `[[link]]` da nota correspondente ou o mapa completo em [[index]] /
> `CLAUDE.md` (raiz do repo).

## O que é este template

Monorepo pnpm + Turbo: backend **NestJS** (`backend-nest/`, REST sob `/api/v1`, Swagger em `/api/docs`) +
frontend **Next.js 16** App Router (`frontend-next/`, embute Payload CMS) sobre um **Postgres**
compartilhado (schema `public` = backend, `payload` = CMS). Contrato tipado ponta a ponta: backend
exporta `openapi.json`, frontend gera client via Orval.

## Stack

| Backend | Frontend |
|---|---|
| NestJS 11 · Prisma 6 · PostgreSQL | Next.js 16 (App Router) · React 19 |
| passport-jwt, cookies HttpOnly | Payload CMS 3 (embutido, schema `payload`) |
| nestjs-zod (Zod) · nestjs-i18n | Orval (client tipado) + axios + TanStack Query |
| BullMQ + Redis · @nestjs/schedule | Radix UI · Tailwind 4 · shadcn |
| @aws-sdk/client-s3 (RustFS local) | react-hook-form + Zod · i18next |
| pino · Sentry · Terminus · Throttler | — |

## Já existe — não reimplemente

### Conta e acesso
- Login/senha, convite por email, forgot/reset senha, refresh token com rotação e detecção de reuso — [[auth-rbac]]
- Login social OAuth/OIDC agnóstico de provider (Google, Microsoft, qualquer um com Discovery) — [[oauth]]
- RBAC: papéis (`Role`) + acesso por rota (`User`/`RoleRouteAccess`), guards, teto de papéis por tela — [[auth-rbac]]
- Captcha anti-bot multi-provider (Turnstile, hCaptcha, reCAPTCHA v3), trocável em runtime — [[captcha]]
- Verificação por código (OTP) de propósito específico — confirmar email/telefone, futuramente ação sensível — [[verification]]
- API keys com scopes e dual auth (JWT ou chave) — [[api-key]]
- Conector MCP remoto (Claude Desktop, ChatGPT) com OAuth 2.1 + Dynamic Client Registration — [[mcp]]

### Configuração e flags
- Config global chave/valor em runtime (`SystemConfiguration`) — [[system-configuration]]
- Preferência por usuário com catálogo tipado (`UserConfigurationDefinition`) — [[system-configuration]]
- Feature flags em runtime, hierárquicas, por role, cache Redis — [[feature-flags-backend]] / [[feature-flags-frontend]]
- Capability: "este recurso está configurado e vivo?" (`available` × `operational`), registry descentralizado — [[capabilities]]

### Comunicação
- WhatsApp multi-provider (Meta, Evolution API, Evolution Go): conexões, contatos, chat, templates, botões, webhook — [[messaging]]
- Notificação in-app agnóstica de domínio (sininho), fan-out por usuário/role/todos, relay opcional email/WhatsApp — [[notifications]]
- Email transacional por fila (convite, reset, boas-vindas) — [[queues-and-jobs]]
- Encurtador de link agnóstico de domínio (`ShortUrlService.shorten()`), redirect com expiração/limite de acessos

### IA
- Agente de IA: conversas, streaming SSE, tools, BYOK (chave do próprio usuário), health — [[ai]]
- Framework de tools do agente: contrato, discovery, como plugar uma nova — [[ai-tools]]

### Infra
- Storage S3/RustFS multi-provider, trocável em runtime — [[storage]]
- Filas (BullMQ) + agendamento (cron via `@nestjs/schedule`) — [[queues-and-jobs]]
- Logs estruturados (pino), Sentry, health check, rate limit — [[observability]]
- Audit trail (`SystemLog`) de toda ação administrativa — [[modules]]
- i18n backend (nestjs-i18n) e frontend (i18next), independentes — [[i18n]] / [[i18n-frontend]]

### Frontend — padrões prontos
- Página = Server Component que decide flag/permissão no servidor; interação em `components/` — [[page-structure]]
- PageBuilder: página customizável por blocos, editável no visual ou pelo agente de IA — [[page-builder]]
- Linha de configuração editável (`ConfigRow`/`ConfigList`) — [[config-rows]]
- Loading/erro/retry centralizados (`AsyncBoundary` + `useSuspenseQuery`) — [[async-boundary]]
- Gate de UI quando serviço externo está fora do ar (storage, email) — [[service-health-gate]]
- Tour guiado com spotlight, auto-scroll, adaptação mobile — [[tour]]
- Form builder a partir de schema Zod, menu em árvore a partir das rotas do usuário, busca global no header — [[frontend-overview]]

## Modelo de dados (Prisma, schema `public`)

Por área: **auth** (`User`, `Role`, `RefreshToken`, `Invite`, `PasswordResetToken`) · **rotas/RBAC**
(`Route`, `UserRouteAccess`, `RoleRouteAccess`) · **config** (`SystemConfiguration`,
`UserConfigurationDefinition`, `UserConfiguration`) · **flags** (`FeatureFlag`, `FeatureFlagRole`) ·
**IA** (`AiConversation`) · **API key** (`ApiKey`, `UserToolAccess`) · **MCP** (`OAuthClient`,
`OAuthGrant`) · **mensageria** (`MessagingConnection/Contact/Conversation/Message/Template*`) ·
**notificação** (`Notification`, `NotificationRecipient`) · **verificação** (`VerificationCode`) ·
**log** (`SystemLog`) · **link curto** (`ShortLink`). Detalhe de campo e relação em [[data-model]].

## Convenções que todo módulo novo segue

- Controller → use-case: uma classe `execute()` por operação, com spec — [[use-cases]]
- Módulo de feature se registra em `app.module.ts` — sem isso a rota não existe
- `common/` nunca importa de `modules/`; rota/dto/ai-tools é sempre `modules/`
- Scaffold por `plop` já gera essa anatomia, back e front — [[add-a-module]] / [[add-a-frontend-module]]

## Como usar isto para especificar um projeto derivado

1. **Verifique esta lista antes de propor a feature.** Auth, RBAC, flags, mensageria, notificação, IA,
   storage, verificação, captcha, OAuth social, API key, MCP, encurtador de link e PageBuilder **já
   existem e são agnósticos de domínio** — a entrega costuma ser "configurar/consumir", não "construir".
2. O que **não** está nesta lista é o escopo real do projeto novo — é ali que a estimativa de horas deve focar.
3. Para desenhar a feature nova seguindo os mesmos padrões (rota, erro, i18n, teste), use o mapa completo
   em `CLAUDE.md` (raiz do repo) ou [[index]].
