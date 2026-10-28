# CLAUDE.md

Monorepo **template**: base para desenvolver qualquer outro software. Backend **NestJS** (`backend-nest/`) + frontend **Next.js** (`frontend-next/`) sobre um Postgres compartilhado. Tudo aqui existe para **acelerar o desenvolvimento** de projetos novos a partir desta base.

## Fonte de verdade

O código manda. A documentação viva fica em **`docs/`** (vault Obsidian, PT-BR), organizada por tópico e apontando o caminho do arquivo real em cada nota.

**Não leia a doc inteira.** Use o mapa abaixo para ir direto na nota do que você precisa — o objetivo é gastar token só no necessário.

> ⚠️ `docs/` (vault Obsidian) é a **única** fonte canônica de contexto.

## Mapa — quando precisar de X, leia

| Preciso de... | Leia |
|---|---|
| Visão geral, stack, mapa de pastas | [docs/architecture/overview.md](docs/architecture/overview.md) |
| Fluxo de uma request (rota→guard→controller→use-case→Prisma) | [docs/architecture/request-lifecycle.md](docs/architecture/request-lifecycle.md) |
| **Criar/renomear endpoint**: desenho de URL, segmento × query, status code | [docs/architecture/api-conventions.md](docs/architecture/api-conventions.md) |
| Auth, JWT, roles, route-access (RBAC) | [docs/architecture/auth-rbac.md](docs/architecture/auth-rbac.md) |
| Capability (recurso configurado/vivo, disponível × operacional, `requirements`) | [docs/architecture/capabilities.md](docs/architecture/capabilities.md) |
| Login social OAuth/OIDC (Google, Microsoft, …) | [docs/backend/oauth.md](docs/backend/oauth.md) |
| Captcha anti-bot (Turnstile, hCaptcha, reCAPTCHA) | [docs/backend/captcha.md](docs/backend/captcha.md) |
| Verificação de alvo (código por propósito: telefone, email), `@RequireVerification` | [docs/backend/verification.md](docs/backend/verification.md) |
| Erros: envelope da API, mensagem i18n, `ProviderResult` | [docs/architecture/error-handling.md](docs/architecture/error-handling.md) |
| Models Prisma e relações | [docs/architecture/data-model.md](docs/architecture/data-model.md) |
| Inventário dos módulos backend | [docs/backend/modules.md](docs/backend/modules.md) |
| Padrão controller → use-case | [docs/backend/use-cases.md](docs/backend/use-cases.md) |
| i18n backend | [docs/backend/i18n.md](docs/backend/i18n.md) |
| Filas / cron (BullMQ, @nestjs/schedule) | [docs/backend/queues-and-jobs.md](docs/backend/queues-and-jobs.md) |
| Mensageria WhatsApp (agnóstico: conexões, contatos, chat, templates, botões, webhooks) | [docs/backend/messaging.md](docs/backend/messaging.md) |
| Notificação in-app agnóstica (notify() por usuário/role/todos, relay email/WhatsApp, sininho) | [docs/backend/notifications.md](docs/backend/notifications.md) |
| Detalhes **por provider** de mensageria (Meta, Evolution API/Go) | [docs/backend/messaging-providers.md](docs/backend/messaging-providers.md) |
| Storage S3/MinIO | [docs/backend/storage.md](docs/backend/storage.md) |
| Logs, Sentry, health, throttler | [docs/backend/observability.md](docs/backend/observability.md) |
| Config global chave/valor em runtime | [docs/backend/system-configuration.md](docs/backend/system-configuration.md) |
| Feature flags (backend) | [docs/backend/feature-flags-backend.md](docs/backend/feature-flags-backend.md) |
| Front: App Router, route groups, Payload CMS | [docs/frontend/frontend-overview.md](docs/frontend/frontend-overview.md) |
| Server Actions (front → back), Alive, Collector | [docs/frontend/server-actions.md](docs/frontend/server-actions.md) |
| Cliente HTTP tipado (Orval) | [docs/frontend/http-client-orval.md](docs/frontend/http-client-orval.md) |
| Auth no front (cookies HttpOnly, middleware) | [docs/frontend/frontend-auth.md](docs/frontend/frontend-auth.md) |
| i18n frontend (i18next, namespaces) | [docs/frontend/i18n-frontend.md](docs/frontend/i18n-frontend.md) |
| Feature flags (frontend) | [docs/frontend/feature-flags-frontend.md](docs/frontend/feature-flags-frontend.md) |
| Estrutura de página, gating server-side (RSC + TabsShell) | [docs/frontend/page-structure.md](docs/frontend/page-structure.md) |
| Loading/erro/retry (AsyncBoundary, useSuspenseQuery) | [docs/frontend/async-boundary.md](docs/frontend/async-boundary.md) |
| PageBuilder (página customizável, `pageSource` no endpoint) | [docs/frontend/page-builder.md](docs/frontend/page-builder.md) |
| Linha de configuração editável (System/UserConfiguration, ConfigRow/ConfigurationRow, `forceType`) | [docs/frontend/config-rows.md](docs/frontend/config-rows.md) |
| Desabilitar UI quando serviço externo cai (storage, email) | [docs/frontend/service-health-gate.md](docs/frontend/service-health-gate.md) |
| Testes backend: unit (Vitest/spec) + E2E (Testcontainers) | [docs/backend/testing.md](docs/backend/testing.md) |
| Testes frontend: Vitest + jsdom, escopo de cobertura, padrões de mock | [docs/frontend/testing-frontend.md](docs/frontend/testing-frontend.md) |
| Módulo IA (providers, streaming SSE, BYOK, health) | [docs/backend/ai.md](docs/backend/ai.md) |
| Criar/estender tools do agente | [docs/backend/ai-tools.md](docs/backend/ai-tools.md) |
| API keys com scopes, dual auth | [docs/backend/api-key.md](docs/backend/api-key.md) |
| Conector MCP remoto (Claude Desktop, ChatGPT), OAuth 2.1 + DCR | [docs/backend/mcp.md](docs/backend/mcp.md) |

### Guias (passo a passo)

| Tarefa | Guia |
|---|---|
| Criar módulo backend (plop) | [docs/guides/add-a-module.md](docs/guides/add-a-module.md) |
| Criar módulo frontend (plop) | [docs/guides/add-a-frontend-module.md](docs/guides/add-a-frontend-module.md) |
| Adicionar um use-case | [docs/guides/add-a-use-case.md](docs/guides/add-a-use-case.md) |
| Expor uma rota protegida | [docs/guides/add-a-protected-route.md](docs/guides/add-a-protected-route.md) |
| Enviar mensagem com template/botões e tratar o toque (exemplo) | [docs/guides/messaging-template-flow.md](docs/guides/messaging-template-flow.md) |
| Subir o stack local | [docs/guides/run-locally.md](docs/guides/run-locally.md) |
| Deploy e produção | [docs/guides/deploy.md](docs/guides/deploy.md) |

Índice completo do vault: [docs/index.md](docs/index.md).

## Comandos essenciais

**Raiz (Turborepo):** `pnpm dev` (back + front) · `pnpm test` · `pnpm build` · `pnpm lint`

**Docker:** `docker compose up -d` (`RUN_MIGRATIONS` / `RUN_SEED` via `.env`) · reset total `docker compose down -v`
URLs: back `http://localhost:3001/api/v1` · Swagger `/api/docs` · front `http://localhost:3000` · Payload `/admin` · MinIO `:9001`

**`backend-nest/`:**
- `npm run plop` — scaffold (module, use-case, …)
- `npm run prisma:migrate` · `prisma:generate` · `prisma:seed` · `prisma:studio`
- `npm run test` · `npm run test:e2e`
- `npm run openapi:export` — atualiza `openapi.json`

**`frontend-next/`:**
- `npm run plop` — scaffold (page, api, queries, …)
- `npm run generate:api` — regenera o client Orval a partir do `openapi.json`
- `npm run test`

**Mudou o contrato do backend?** rode `openapi:export` (back) → `generate:api` (front).

## Regras de trabalho neste repo

1. **Ao terminar qualquer desenvolvimento, pergunte ao dev se a documentação deve ser atualizada** — identifique qual nota em `docs/` cobre o que foi alterado (use o mapa acima), cite-a pelo nome e pergunte se deve ser atualizada. Se necessário, atualize também `docs/index.md`.
2. **Se o desenvolvimento tocar em algo que o `plop` gera, referencia ou modifica, pergunte ao dev se o gerador deve ser atualizado também.** Isso inclui: mover/renomear um arquivo que `backend-nest/plopfile.js` ou `frontend-next/plopfile.cjs` editam via regex (ex. `app.module.ts`, `app-openapi.module.ts`, `domain/route/route-path.const.ts`, `prisma/seeds/routes.seed.ts`, `translation-utils.ts`, `performance.config.ts`, `routepages.types.ts`); trocar um componente/padrão que os templates em `plop-templates/` usam (ex. `FormBuilder`, decorators de rota, padrão de use-case, `DataTable`); ou mudar a convenção que o gerador replica. As ações `modify` do plop não falham quando o regex de ancoragem para de casar — só deixam de fazer nada, em silêncio — então um template desatualizado não aparece como erro, aparece como módulo gerado com um passo faltando.
3. **Trabalho no próprio template ⇒ documentação agnóstica.** Sem viés de domínio de negócio: escreva pensando em outro dev que vai criar outro projeto a partir desta base.
4. **Antes de reimplementar, procure.** O padrão provavelmente já existe (use-case, plop, RBAC, i18n, feature flags) — reutilize em vez de recriar.
5. **Testes fazem parte do desenvolvimento, não são opcionais.** Ao implementar qualquer lógica de negócio ou use-case: verifique se já existe spec (`*.spec.ts`), rode `npm run test` antes e depois, e certifique-se que a suite continua verde. Use-cases novos gerados pelo plop já vêm com spec — preencha-o. Para mudanças no contrato HTTP, rode também `npm run test:e2e`.
6. **Nunca faça commit**
7. **Comentário é uma linha afirmativa do que o código faz, nunca o porquê.** Sem parágrafo de histórico/trade-off/decisão, sem banner decorativo, sem código morto comentado. Regra completa e exceção (fato de segurança/compliance crítico, que vai para `docs/`, não para o comentário) em [docs/architecture/overview.md](docs/architecture/overview.md#convenções-globais).