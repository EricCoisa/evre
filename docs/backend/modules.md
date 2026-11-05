---
title: Inventário de módulos
tags: [backend]
---

# Inventário de módulos

Registrados em `backend-nest/src/app.module.ts`. Cada módulo segue a mesma anatomia — ver [[use-cases]].

| Módulo | Prefixo | O que faz |
|--------|---------|-----------|
| `AuthModule` | `/auth` | Login, refresh, logout, `me`, register, convites, forgot/reset senha. Ver [[auth-rbac]]. |
| `UserModule` | `/user` | CRUD de usuário, perfil, senha, imagem, roles/status, export e exclusão de conta (LGPD). |
| `RoleModule` | `/role` | Papéis nomeados (tabela `Role`). |
| `RouteModule` | `/route` | CRUD da árvore de rotas/menu. |
| `UserRouteAccessModule` | `/user-route-access` | Concede/revoga rota a usuário; `GET /me?path=` consulta o acesso do requisitante. |
| `RoleRouteAccessModule` | `/role-route-access` | Concede/revoga rota a papel. |
| `SystemConfigurationModule` | `/system-configuration` | Config global tipada (chave/valor). |
| `UserConfigurationDefinitionModule` | `/user-configuration-definitions` | Catálogo de preferências tipadas (`labelKey`, `valueType`, `options`, `defaultValue`, `isRequired`, `secret`). **Só ADMIN**, inclusive `PATCH /:id/default`, que altera o valor herdado por todos. Ver [[system-configuration]]. |
| `UserConfigurationModule` | `/user-configuration` | Valor de uma definição para um usuário específico. Escrita: `POST /user-configuration/me` com `{ definitionId, value }` — o `userId` vem de `@CurrentUser()`, nunca do path. Único por `(userId, definitionId)`. |
| `LoggingModule` | `/logging` | Trilha de eventos / audit trail (`SystemLog`). `LoggingService.create(...)` é chamado pelos use-cases. |
| `ClientLogModule` | — | Replica o audit trail para o webhook de suporte. Sem controller: `LoggingService` chama `ClientLogService.create(...)`, não existe rota. |
| `CmsModule` | `/cms` | Ponte de auth com o Payload CMS (login/valida usuário Payload). |
| `FeatureFlagModule` | `/feature-flags` | Flags de funcionalidade em runtime; guard `@RequireFeature`; cache Redis TTL 300 s. Ver [[feature-flags-backend]]. |
| `CapabilityModule` | `/capabilities` | `@Global()`. `CapabilityRegistry`: cada módulo dono declara, no próprio `onModuleInit`, o que precisa estar configurado/vivo para um recurso funcionar e quais chaves de configuração dependem dele. `GET /capabilities` resolve o estado (`available`/`operational`) para o usuário autenticado. Ver [[capabilities]]. |
| `PageBuilderModule` | `/page-builder` | Catálogo das fontes marcadas com `pageSource` nos endpoints (`PageSourceRegistry`) + escrita do layout de página, do usuário e o padrão do sistema. Sem model Prisma próprio: persiste em `UserConfiguration`/`SystemConfiguration`. A validação (`PageLayoutValidator`) é a mesma para os três escritores — tool do agente, editor visual e admin. Ver [[page-builder]]. |
| `AiModule` | `/ai` | Agente: conversas, streaming SSE, tools, BYOK, health. Ver [[ai]] · [[ai-tools]]. |
| `ApiKeyModule` | `/api-keys` | Chaves de API com scopes; auth dual com JWT. Ver [[api-key]]. |
| `McpModule` | `/mcp` · `/oauth` · `/mcp-connections` · `/.well-known/*` | Conector MCP remoto + OAuth 2.1 com DCR. Quatro controllers: `mcp.controller.ts` (JSON-RPC), `mcp-oauth.controller.ts` (Authorization Server), `mcp-connections.controller.ts` (tela de conectores) e `mcp-discovery.controller.ts`, que responde na **raiz do host** — os três caminhos `.well-known` são excluídos do prefixo `api/v1` no `main.ts`. Ver [[mcp]]. |
| `CaptchaModule` | `/captcha` | Config pública do widget e verificação anti-bot; guard `@RequireCaptcha`. Ver [[captcha]]. |
| `SentryConfigModule` | `/sentry` | DSN do Sentry em runtime, por `PUT /sentry/config`. A leitura usa o endpoint genérico de SystemConfiguration. Ver [[observability]]. |
| `StorageModule` | `/storage` | Upload/download S3 (RustFS local) ou disco (LOCAL), com provider trocável em runtime. Ver [[storage]]. |
| `MessagingModule` | `/messaging` | WhatsApp multi-provider (`EVOLUTION_API`, `EVOLUTION_GO`, `META`) em **conexões**: cada uma é um número, com credencial própria. Facade `MessagingService` resolve a conexão, valida credencial em duas camadas (schema + sonda) e serve health cacheado; `send()` lança e `trySend()` devolve `null` para quem a mensagem é opcional. Provider e número são imutáveis por conexão — trocar é arquivar e criar outra. Flag `MESSAGING` é kill-switch, avaliada com `roleName` vazio, então vale para cron e webhook. |
| `HealthModule` | `/health` | Liveness/readiness (@nestjs/terminus). Ver [[observability]]. |
| `TasksModule` | — | Jobs agendados (cron). Ver [[queues-and-jobs]]. |
| `PayloadUserModule` | — | Adapter que lê/escreve na tabela `payload.users` via raw SQL. Permite que o backend sincronize credenciais do usuário com o Payload CMS sem importar dependências do Payload. |
| `EmailModule` | `/email` | Envio transacional (convite, reset, boas-vindas) por fila BullMQ; `PUT /email/config` valida-e-salva a configuração do provider, `GET /email/health` serve a saúde cacheada. Ver [[queues-and-jobs]]. |
| `NotificationModule` | `/notification` | Notificação in-app agnóstica de domínio: envia para um usuário, uma lista de roles ou todos. Facade `NotificationService.notify()` injetável por qualquer módulo; nunca lança. Modelo em duas tabelas — `Notification` (evento) e `NotificationRecipient` (lido/dispensado por usuário) — para não duplicar payload no fan-out. Relay opcional de email (`EmailService.send`) e WhatsApp (`MessagingService.trySendTemplate`, exige template aprovado) por chamada; preferências do usuário (mute por canal e por tipo) reaproveitam `UserConfigurationDefinition`/`UserConfiguration`. Flag `NOTIFICATION` é kill-switch, avaliada com `roleName` vazio. Tipos são constantes TS por módulo, não catálogo no banco. |
| `VerificationModule` | `/verification` | Código de verificação (OTP) de propósito específico — confirmar email, confirmar telefone, e futuramente ações sensíveis como pagamento. Não é 2FA de login (2º fator na autenticação); é um código decoupled da sessão, amarrado a um `purpose` (chave TS do módulo chamador, mesmo padrão de `Notification.type`). Controller genérico (`POST /request`, `POST /confirm`, `GET /health`) consumido por qualquer módulo chamador; proteger um endpoint de outro módulo é guard + decorator (`@RequireVerification`, exportado por `VerificationGuard`), nunca um use-case bespoke — hoje usado por `UserModule` para confirmar telefone antes de gravar. Diferente de `NotificationService`, falha de envio **propaga** — a ação sensível não pode seguir como se o código tivesse chegado. Canal (`EMAIL`/`WHATSAPP`/`AUTHENTICATOR` reservado, sem TOTP implementado ainda) é decidido por quem chama, não por config. |
| `ShortUrlModule` | `/s/:code` | Encurtador de links agnóstico de domínio (`ShortLink`). Facade `ShortUrlService.shorten()`/`.deactivate()` injetável por qualquer módulo; `ShortUrlRedirectController` (`GET /s/:code`, excluído do prefixo `api/v1` no `main.ts`) valida expiração/desativação/limite de acessos, incrementa `clicksCount` e responde 302 para `targetUrl`. |
| `CompanyModule` | `/company` | Primeiro módulo de domínio do EVRE e primeiro consumidor de `ResourceAccessModule`. `Company` nasce só com `name` obrigatório; `Contact` não tem módulo próprio, vive como model + use-cases aqui (aba da empresa). `remove` arquiva (`archivedAt`), nunca deleta. Rotas aninhadas `company/:id/contacts[/:contactId]`, todas `roles: ['ADMIN']`. Ver [[data-model]]. |
| `ArtifactModule` | `/artifacts` | Arquivo ou pasta de arquivos (site estático via `.zip` extraído em memória, sem tocar disco) salvo via `StorageService`, agnóstico de quem consome — hoje: bloco `iframe` do page-builder, que guarda só o `id` do artefato como string, sem FK real. `kind` (`FILE`/`FOLDER`), manifesto `files` (Json) valida sub-caminho na visualização e fecha path traversal por rejeição explícita. `published`/`publicToken` (gerado uma vez, reusado) controlam acesso público — resolvido só por token em `ArtifactPublicController` (`/artifacts/public/:token`, anônimo, throttled), nunca por id interno. Visualização sempre via redirect 302 para presigned URL (nunca ACL pública no bucket, pra "despublicar" revogar de fato). `PublishReferencedArtifactsUseCase` é exportado e chamado pelo `ProposalModule` dentro da transação de publish — cascateia a publicação dos artefatos referenciados no layout e troca o id interno pelo `publicToken` na `ProposalVersion`. Todas as rotas de gestão `roles: ['ADMIN', 'MODERATOR']`. Ver [[data-model]] · [[storage]]. |
| `ProposalModule` | `/proposal` | Registro da proposta: rascunho (`layout` JSON livre nesta fase) + envelope comercial em coluna (`totalCents`/`currency`/`recurrence`/`termDays`/`validUntil`/`includedItems`/`optionalItems`), nunca texto livre. `create` exige só `name`; `remove` arquiva. `update`/`layout`/`terms` recusam fora de `status: DRAFT`; `status` exige `lostReason` quando `LOST` e trava transição a partir de `ACCEPTED`/`LOST` (terminais). `duplicate` copia nome (`"<nome> (cópia)"`), layout e envelope — nasce `DRAFT`, sem `ProposalVersion`. `ProposalVersion.publicToken`/`revokedAt` (ainda sem uso nesta etapa) serão a fonte de verdade do acesso público em F1-05 — não o `ShortLink`, que é só redirect. Todas as rotas `roles: ['ADMIN']`. Ver [[data-model]]. |
| `ProjectModule` | `/project` | Projeto de desenvolvimento vinculado a uma empresa. Board Kanban com milestones (colunas) e tasks (cards), reordenáveis. Comentários polimórficos (`ProjectComment`: PROJECT/MILESTONE/TASK via `entityType`+`entityId`, FK real só em `projectId` para cascade). Aprovação de milestone (`MilestoneApproval`: ADMIN solicita, cliente ou admin responde APPROVED/REJECTED). Solicitação de informação sensível (`ProjectInfoRequest`: resposta criptografada AES-256-GCM via `CryptoService`, valor descriptografado só para ADMIN). ADMIN cria/edita projeto; ADMIN/MODERATOR gerenciam board, aprovações e info requests; USER (cliente) visualiza, comenta e responde via `Membership(projectId)`. `ResourceAccessService.assertCanRead({ companyId, projectId })` decide o acesso. `remove` arquiva. Ver [[data-model]]. |
| `PrismaModule` / `RedisModule` | — | Infra compartilhada (DB, Redis). |
| `RouteCeilingModule` | — | `@Global()`. `RouteCeilingRegistry`: cada módulo dono de uma tela restrita por papel declara, no próprio `onModuleInit`, o teto de papéis que podem receber aquela `Route` via `RoleRouteAccess`/`UserRouteAccess` — espelhando os `roles` dos controllers que a tela consome. Ver [[auth-rbac#Teto de código: RouteCeilingRegistry]]. |
| `ResourceAccessModule` | — | `@Global()`. `ResourceAccessService`: ponto único por onde toda leitura de recurso (`Company`, e o que mais vier) passa, com bypass de `ADMIN` e negação por padrão quando o escopo (`companyId`/`projectId`) é vazio — nunca "sem escopo = tudo". `assertCanRead`/`canSeeCommercials`/`scopeFilter`/`hasAnyMembership`, baseado em `Membership`. Ver [[auth-rbac]]. |

> [!warning] `EmailModule` não está no `app.module.ts`
> Ele chega ao grafo pela importação do `AuthModule`, e as rotas `/email` existem
> por efeito colateral dessa importação. Isso contraria a convenção de [[overview]]
> ("todo módulo de feature se registra no `app.module.ts`"): parar de importá-lo do
> `AuthModule` derruba as rotas sem erro de boot. Módulo novo vai direto no
> `app.module.ts`.

## Anatomia de um módulo

```
modules/<nome>/
├── <nome>.module.ts        # imports, controllers, providers (use-cases), exports
├── <nome>.controller.ts    # rotas via @GetApi/@PostApi/... → chama use-cases
├── use-cases/              # uma classe execute() por operação + o spec
├── ai-tools/               # opcional: tools do agente, injetam o MESMO use-case
├── dto/                    # DTOs Zod (createZodDto)
└── <nome>.service.ts       # só se outro módulo consumir — ver [[use-cases]]
```

Pastas em **kebab-case**, sem exceção (`client-log/`, não `clientLog/`).

Criar um módulo novo: [[add-a-module]].
