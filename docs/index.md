---
title: Home — Documentação da Aplicação
tags: [moc, index]
---

# Documentação da Aplicação

Porta de entrada do vault. Monorepo com **backend NestJS** (`backend-nest/`) e **frontend Next.js** (`frontend-next/`) compartilhando um Postgres.

> Fonte da verdade é o código. Cada nota aponta o caminho do arquivo — pule direto para lá quando precisar de detalhe.

- [[quick-info]] — resumo curto de capacidades já prontas (módulos, padrões, modelo de dados), pensado pra outra IA especificar um software derivado sem reinventar o que já existe

## Arquitetura

- [[overview]] — stack real, monorepo, mapa de pastas
- [[request-lifecycle]] — rota → guard → controller → use-case → Prisma
- [[api-conventions]] — desenho de URL, segmento × query, status codes, colisão de rotas, contrato gerado
- [[auth-rbac]] — JWT em cookie, rotação do refresh token, guards, roles e route-access
- [[capabilities]] — recurso configurado/vivo (disponível × operacional), registry descentralizado, `requirements` em configuração
- [[error-handling]] — envelope único de erro, mensagem i18n, caminho até o toast
- [[data-model]] — models Prisma e relações

## Backend (`backend-nest/`)

- [[modules]] — inventário dos módulos
- [[use-cases]] — o padrão controller → use-case
- [[i18n]] — traduções, resolvers, fallback
- [[queues-and-jobs]] — BullMQ + cron (@nestjs/schedule)
- [[messaging]] — WhatsApp (agnóstico a provider): conexões, contatos, chat, templates, botões, webhooks e filas
- [[notifications]] — inbox in-app agnóstico (NotificationService.notify), fan-out por usuário/role/todos, relay opcional de email/WhatsApp, flag `NOTIFICATION`
- [[messaging-providers]] — detalhes por provider (Meta, Evolution API, Evolution Go)
- [[storage]] — S3/RustFS, multi-provider
- [[observability]] — pino, sentry, health, throttler
- [[system-configuration]] — config global chave/valor em runtime
- [[feature-flags-backend]] — flags runtime, guard @RequireFeature, cache Redis
- [[oauth]] — login social agnóstico (OIDC Discovery), state assinado, flag `OAUTH_LOGIN`
- [[captcha]] — anti-bot multi-provider (Turnstile, hCaptcha, reCAPTCHA v3), escolhido em runtime
- [[verification]] — código de verificação por propósito (telefone, email), `@RequireVerification`, handlers de confirmação
- [[testing]] — unit (Vitest + spec) e E2E (Testcontainers + supertest)
- [[ai]] — módulo IA (providers, AiService, streaming SSE, BYOK, health)
- [[ai-tools]] — contrato de tool, discovery, como criar uma nova tool
- [[api-key]] — CRUD de chaves, scopes, dual auth, ScopeGuard
- [[mcp]] — conector MCP remoto (Claude Desktop, ChatGPT): OAuth 2.1 + DCR, tools = ToolRegistry

## Frontend (`frontend-next/`)

- [[frontend-overview]] — App Router, route groups, Payload CMS
- [[server-actions]] — como o front chama o backend, Alive, Collector
- [[http-client-orval]] — cliente tipado gerado, camadas HTTP
- [[frontend-auth]] — cookies HttpOnly, middleware (guarda de rotas + renovação da sessão)
- [[i18n-frontend]] — i18next, namespaces, como adicionar traduções
- [[feature-flags-frontend]] — serverFeatureFlag (RSC) e useFeatureFlag, componente Feature, tela admin
- [[page-structure]] — página = composição; gating (flag/permissão) decidido no servidor; conteúdo de tab em `./components/`
- [[config-rows]] — linha de configuração editável (System/UserConfiguration + ConfigRow/ConfigurationRow), `forceType`, armadilhas de `disableLabel`/`description`
- [[async-boundary]] — loading, erro e retry centralizados; quando usar `useSuspenseQuery` e onde pôr o boundary
- [[page-builder]] — página customizável: blocos + fontes marcadas no endpoint, montadas no editor visual ou pelo agente, com padrão do sistema por trás
- [[service-health-gate]] — desabilitar UI quando serviço externo está inoperante (storage, email, etc.)
- [[tour]] — tutoriais guiados passo a passo com spotlight, HelpButton, `onEnter`, auto-scroll e adaptação fluida para mobile
- [[testing-frontend]] — Vitest + jsdom + Testing Library: escopo da cobertura, polyfills de ambiente, padrões de mock por camada (api.ts, queries.ts, componente)

## Guias

- [[add-a-module]] — criar um módulo novo (plop backend)
- [[add-a-frontend-module]] — criar um módulo novo (plop frontend)
- [[add-a-use-case]] — adicionar um use-case
- [[add-a-protected-route]] — expor uma rota protegida
- [[messaging-template-flow]] — enviar mensagem com template e botões (exemplo agnóstico)
- [[run-locally]] — subir o stack, seed, comandos
- [[deploy]] — Docker, variáveis de ambiente, produção
