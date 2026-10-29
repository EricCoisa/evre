---
title: Modelo de dados (Prisma)
tags: [architecture, backend, prisma]
---

# Modelo de dados

Schema dividido por área em `backend-nest/prisma/schema/` (`base.prisma`, `user.prisma`, `config.prisma`, `route.prisma`, `ai.prisma`, `mcp.prisma`, `logging.prisma`, `feature-flag.prisma`, `messaging.prisma`, `notification.prisma`, `verification.prisma`). Provider **PostgreSQL**, schema `public`. (Payload CMS mantém suas tabelas no schema `payload`, no mesmo banco — ver [[frontend-overview]].)

## Entidades

| Model (`@@map`) | Papel |
|-----------------|-------|
| `User` (`users`) | Conta. Credenciais como `salt` + `hash` (ambos opcionais — conta criada por OAuth não tem senha). `roleId` → `Role`. `status`, `deletedAt` (soft delete), lock por tentativas (`loginAttempts`/`lockUntil`), aceite de termos (`termsAcceptedAt`/`termsVersion`). |
| `Role` (`roles`) | Papel nomeado. `isSystem` marca os papéis base. |
| `RefreshToken` (`refresh_tokens`) | Refresh tokens persistidos, com expiração. Cascade no delete do user. `familyId` agrupa a sessão (todos os tokens descendentes de um login); `replacedAt`/`replacedById` sustentam a rotação com detecção de reuso; `sourceIpHash`/`sourceUaHash` (SHA-256 de IP/User-Agent) amarram o sucessor devolvido na janela de graça à mesma origem — ver [[auth-rbac]]. |
| `Invite` (`invites`) | Convite por email, único por `email`. Carrega a `roleId` que o convidado assume, `expiresAt`, `actionUrl?`, `tokenHash?` (credencial bearer — só o hash é persistido) e `usedAt?`. Ver [[auth-rbac]]. |
| `SignupIntent` (`signup_intents`) | Token transitório (hash) de confirmação de cadastro/consentimento OAuth — `purpose` identifica o fluxo, `expiresAt`/`usedAt` fecham a janela de uso único. Limpeza pelo cron `signup-intent-clear.task.ts`. Ver [[auth-rbac#Cadastro e confirmação de e-mail]]. |
| `PasswordResetToken` (`password_reset_tokens`) | Token (hash) de reset de senha, com `expiresAt`/`usedAt`. |
| `SystemLog` (`system_log`) | Trilha de eventos (audit trail). `module` (enum `LogModule`), `action`, `message`, `metadata` JSON, `performedById`. |
| `Route` (`routes`) | Árvore de rotas/menu. Auto-relacionamento `parent`/`children`; o `path` do filho é o caminho completo (`/area/detalhe`), não só o segmento. `labelKey`, `icon`, `isActive`, `showSideBar`, `ordem`. **Sem coluna de "home"**: a rota-padrão por papel vive em `SystemConfiguration` (`ROLE_HOME_CONFIG_KEY`, mapa `{ roleName: routeId }`), resolvida por `RoleHomeService` e devolvida como `isHome` computado no payload de `auth/me`/`auth/user`. Ver [[auth-rbac#Subrotas: o caminho mais específico decide]]. |
| `UserRouteAccess` (`user_route_accesses`) | Acesso de **um usuário** a uma rota. Único por `(userId, routeId)`. `grantedBy` guarda quem concedeu; `denied` marca negação explícita. |
| `RoleRouteAccess` (`role_route_accesses`) | Acesso de **um papel** a uma rota. PK composta `(roleId, routeId)`. |
| `SystemConfiguration` (`system_configurations`) | Config global chave/valor tipada. `secret` esconde o valor; `blocked` trava escrita. |
| `UserConfigurationDefinition` (`user_configuration_definitions`) | Catálogo de preferências por usuário (tipo, default, obrigatória). |
| `UserConfiguration` (`user_configurations`) | Valor de uma definição para um usuário. Único por `(userId, definitionId)`. |
| `FeatureFlag` (`feature_flags`) | Flag de funcionalidade. `key` único, `enabled`, `description?`, `category` (enum `FeatureFlagCategory`), auto-relacionamento `parent`/`children`. Ver [[feature-flags-backend]]. |
| `FeatureFlagRole` (`feature_flag_roles`) | Associa uma flag a um Role. `id` próprio, único por `(featureFlagId, roleId)`. |
| `AiConversation` (`ai_conversations`) | Metadata da conversa com o agente: dono, título, timestamps. Mensagens e tool calls vivem no checkpointer, não aqui — ver [[ai]]. |
| `ApiKey` (`api_keys`) | Chave de API. `keyHash` (SHA-256) único, `keyPrefix` para exibição, `scopes[]`, `lastUsedAt`, `expiresAt?`. Ver [[api-key]]. |
| `UserToolAccess` (`user_tool_accesses`) | Tool de IA que **um usuário** revogou para o próprio agente. Único por `(userId, toolName)`. Deny-list — presença de linha = revogado; ausência segue o filtro de `roles` da tool. Ver [[ai-tools]]. |
| `OAuthClient` (`oauth_clients`) | Cliente MCP registrado por Dynamic Client Registration. `name` e `redirectUris[]`. Ver [[mcp]]. |
| `OAuthGrant` (`oauth_grants`) | Conexão entre um usuário e um cliente MCP. A linha nasce authorization code (`codeHash`, `codeChallenge`) e vira par access/refresh (`accessHash`, `refreshHash`), todos como hash. `scopes[]`, `revokedAt`, `lastUsedAt`. Ver [[mcp]]. |
| `MessagingConnection` (`messaging_connections`) | Um número de WhatsApp acessado por um provider. `config` é a estrutura do provider (segredos cifrados), `phone` é único e fixado no pareamento, `isDefault` marca quem envia sem conexão informada (índice único **parcial** na migration — o Prisma não modela) e `archivedAt` tira de uso liberando o número. Ver [[messaging]]. |
| `MessagingContact` (`messaging_contacts`) | A **pessoa**: `phone` é identidade **global e única** (`@unique`, não mais por conexão) — o mesmo número é um contato só, mesmo falando com dois dos nossos números. Nome editável, `pushName`, foto, opt-out e `lastMessageAt` indexado. Ver [[messaging]]. |
| `MessagingConversation` (`messaging_conversations`) | A **thread**: um `MessagingContact` numa `MessagingConnection`. Único por `(connectionId, contactId)` — duas conexões com a mesma pessoa são duas conversas. `lastInboundAt` ancora a janela de atendimento de 24h. Ver [[messaging]]. |
| `MessagingMessage` (`messaging_messages`) | Histórico inbound/outbound do WhatsApp; `providerMessageId` único **por conexão** para dedupe/correlação e `sentById?` para o usuário que disparou. Ver [[messaging]]. |
| `MessagingTemplateType` / `MessagingTemplate` / `MessagingTemplateSubmission` / `MessagingButtonEvent` | Catálogo de variáveis/botões por tipo, template (chave+idioma), aprovação por `(template, conexão)` e toque de botão recebido. Ver [[messaging]]. |
| `Notification` (`notifications`) | Evento de notificação in-app, sem payload duplicado por destinatário. `type` é chave de catálogo TS (`domain/notification/notification-type.const.ts`), não enum do banco. `audienceAll`/`audienceRoleNames[]` modelam broadcast sem materializar uma linha por usuário no envio. Ver [[notifications]]. |
| `NotificationRecipient` (`notification_recipients`) | Estado por usuário (`readAt`/`dismissedAt`) de uma `Notification`. Único por `(notificationId, userId)`; para broadcast é materializada lazy, no primeiro acesso do usuário. Ver [[notifications]]. |
| `VerificationCode` (`verification_codes`) | Código OTP de propósito específico (`purpose` é chave TS do módulo chamador, não 2FA de login). `channel` (enum `VerificationChannel`), `codeHash`, `attempts`/`maxAttempts`, `expiresAt`, `consumedAt` (confirmado) e `usedAt` (consumo de uso único via `@RequireVerification`). `userId` é id opaco, sem FK para `User` — módulo agnóstico de quem o usa. |

## Enums

`ConfigValueType`, `UserStatus`, `LogModule` e `FeatureFlagCategory` vivem em `base.prisma`; os demais, no `.prisma` da própria área (`messaging.prisma`, `verification.prisma`):

- `ConfigValueType` — `STRING · NUMBER · BOOLEAN · JSON · DATE · ENUM`
- `UserStatus` — `ACTIVE · INACTIVE · SUSPENDED`
- `LogModule` — módulos que escrevem no audit trail: `USER · AUTH · SYSTEM · HEALTH · USER_ROUTE_ACCESS · SYSTEM_CONFIGURATION · ROUTE · ROLE_ROUTE_ACCESS · USER_CONFIGURATION · USER_CONFIGURATION_DEFINITION · CMS · FEATURE_FLAG · AI · API_KEY · MCP · MESSAGING · NOTIFICATION · VERIFICATION`
- `FeatureFlagCategory` — `GENERAL · AI · CONNECTORS · MESSAGING · SYSTEM · AUTH · DASHBOARD · REPORTS · NOTIFICATIONS`. Ver [[feature-flags-backend]].
- `VerificationChannel` — `EMAIL · WHATSAPP · AUTHENTICATOR` (reservado para TOTP futuro).
- `MessagingProvider` — `EVOLUTION_API · EVOLUTION_GO · META`; `MessagingDirection` — `INBOUND · OUTBOUND`; `MessagingStatus` — `QUEUED · SENT · DELIVERED · READ · FAILED`. Mais três enums de template/aprovação/botão (`MessagingTemplateCategory`, `MessagingTemplateApproval`, `MessagingButtonEventStatus`) definidos em `messaging.prisma`. Ver [[messaging]].
- `ProposalSendChannel` (`proposal.prisma`) — `WHATSAPP · EMAIL · MANUAL`. Era coluna `String` com o
  conjunto só em comentário (`channel String // WHATSAPP | EMAIL | MANUAL`); virou enum Prisma de
  verdade no Ajuste 1, como os outros três enums do mesmo arquivo (`ProposalStatus`,
  `ProposalRecurrence`, `ProposalAcceptanceSource`) — é o que dá à tela um conjunto fechado para
  mapear rótulo, em vez de imprimir o valor cru (ver [[i18n-frontend]] § `lib/vocabulary.ts`).

> [!note] Models de domínio de negócio (Company/Proposal) ainda sem entrada nesta nota
> `Company`, `Proposal`, `ProposalVersion` e afins (`backend-nest/prisma/schema/proposal.prisma`,
> `company.prisma`) ainda não têm linha na tabela de Entidades acima — pendência herdada dos ciclos
> que os criaram. Um ajuste de integridade do Ajuste 1 vale registrar enquanto isso não é fechado:
> `ProposalOpenEvent.versionId` ganhou `@relation` para `ProposalVersion` (`onDelete: Cascade`) —
> antes era uma coluna solta, sem `FOREIGN KEY` na migration, e sem o lado inverso da relação
> (`ProposalVersion.openEvents`), que o Prisma exige para aceitar a relação de um lado só.

O papel do usuário **não** é enum Prisma: é a tabela `Role`, referenciada por `User.roleId`. Os nomes dos papéis de sistema (`ADMIN`, `USER`, `MODERATOR`) vivem em `src/domain/auth/userRole.const.ts` e são criados pelo seed.

## Relações principais

```
Role 1─┬─* User
       ├─* RoleRouteAccess *─1 Route
       ├─* FeatureFlagRole *─1 FeatureFlag
       └─* Invite
User 1─┬─* UserRouteAccess *─1 Route
       ├─* RefreshToken
       ├─* PasswordResetToken
       ├─* UserConfiguration *─1 UserConfigurationDefinition
       ├─* AiConversation
       ├─* ApiKey
       ├─* UserToolAccess
       ├─* OAuthGrant *─1 OAuthClient
       ├─* Invite (createdBy)
       ├─* Notification (createdBy)
       ├─* NotificationRecipient
       └─* SystemLog (performedBy)
Route        ─  parent/children (auto-relação)
FeatureFlag  ─  parent/children (auto-relação)
```

O acesso efetivo de um usuário a rotas = `RoleRouteAccess` (do seu papel) ∪ `UserRouteAccess` (dele). Ver [[auth-rbac]].

## Migrations & seed

- Migrations: `backend-nest/prisma/migrations/`. Comandos em [[run-locally]].
- Seed (`prisma/seed.ts` orquestra `prisma/seeds/*.seed.ts`): `roles-and-users.seed.ts` cria os papéis de sistema e o admin `admin@example.com`.
