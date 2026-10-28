---
title: API Keys — CRUD, scopes, dual auth, ScopeGuard
tags: [backend, api-key, auth, mcp]
---

# API Keys

Módulo `api-key/` — chaves de API com scopes para acesso programático (MCP server, integrações externas).

> Fonte: `backend-nest/src/modules/api-key/`

## Formato

```
ak_<base64url-32-bytes>
```

- Exibida **uma única vez** na criação.
- O banco armazena somente o SHA-256 (`keyHash`) — nunca o valor raw.
- `keyPrefix` (`ak_xxxx…`) armazenado para exibição na UI.

## Modelo Prisma

```prisma
model ApiKey {
  id         String    @id @default(uuid())
  name       String
  keyHash    String    @unique   // SHA-256 do raw
  keyPrefix  String              // primeiros chars p/ identificação visual
  scopes     String[]  @default([])
  userId     String
  createdAt  DateTime  @default(now())
  lastUsedAt DateTime?           // atualizado a cada uso válido
  expiresAt  DateTime?           // null = nunca expira
  user       User      @relation(...)
}
```

## Endpoints

| Método | Path | Auth | Descrição |
|---|---|---|---|
| `POST` | `/api-keys` | JWT | Cria chave; retorna `rawKey` só aqui |
| `GET` | `/api-keys` | JWT | Lista próprias (admin: todas); nunca expõe hash |
| `DELETE` | `/api-keys/:id` | JWT | Revoga chave (403 p/ chave alheia sem admin) |
| `PATCH` | `/api-keys/:id/scopes` | JWT | Atualiza scopes de uma chave |

## Scopes (`McpScopes`)

```ts
// domain/api-key/mcp-scopes.const.ts
export const McpScopes = {
  USERS_READ:                           'users:read',
  USERS_WRITE:                          'users:write',
  ROUTES_READ:                          'routes:read',
  ROUTES_WRITE:                         'routes:write',
  FEATURE_FLAGS_READ:                   'feature-flags:read',
  FEATURE_FLAGS_WRITE:                  'feature-flags:write',
  INVITES_WRITE:                        'invites:write',
  ROLES_WRITE:                          'roles:write',
  ROLE_ROUTE_ACCESS_WRITE:              'role-route-access:write',
  SYSTEM_CONFIGURATION_WRITE:           'system-configuration:write',
  USER_CONFIGURATION_DEFINITIONS_WRITE: 'user-configuration-definitions:write',
  USER_CONFIGURATION_WRITE:             'user-configuration:write',
  USER_ROUTE_ACCESS_WRITE:              'user-route-access:write',
  API_KEYS_WRITE:                       'api-keys:write',
  CMS_WRITE:                            'cms:write',
  AGENT_CHAT:                           'agent:chat',
  MESSAGING_READ:                       'messaging:read',
  MESSAGING_WRITE:                      'messaging:write',
  NOTIFICATION_WRITE:                   'notification:write',
} as const;
```

Ver a lista completa de tools que usam cada scope em [ai-tools.md](ai-tools.md#tools-registradas-atualmente).

> **Sincronização com o frontend:** a UI de scopes (`/profile?tab=apiKeys`) **não duplica** essa lista manualmente — `frontend-next/src/lib/actions/api-keys/types.ts` deriva `McpScope`/`MCP_SCOPES` do enum gerado pelo Orval (`CreateApiKeyDtoScopesItem`, a partir do `openapi.json`). Adicionou um scope novo em `McpScopes`? Rode `npm run openapi:export` (back) → `npm run generate:api` (front) — sem isso, o scope existe no backend mas some da UI. Confira que o `openapi:export` terminou sem erro: um export que falha deixa o `openapi.json` defasado em silêncio, e o scope novo nunca chega ao front. Ver [[http-client-orval]].

**Default-deny:** um endpoint só é alcançável via API key se declarar `scope` explicitamente no decorator `@ApiMethod`. JWT ignora completamente o `ScopeGuard`.

## Dual auth (JWT ou API key)

`api-method.decorator.ts` — quando `authenticated: true`, o guard aceita JWT **ou** `x-api-key`:

```
AuthGuard(['jwt', 'api-key'])
```

A `ApiKeyStrategy` (`passport-custom`):

1. Lê `x-api-key` do header.
2. Sem header → falha rápida (Passport tenta o próximo: `jwt`).
3. Valida SHA-256 contra banco, checa `expiresAt`, atualiza `lastUsedAt`.
4. Popula `request.user` no **mesmo shape** do JWT (`id`, `email`, `roleId`, `roleName`).
5. Popula `request.apiKeyScopes` com os scopes da chave.

`RolesGuard` e `ToolRegistry` funcionam idênticos para ambos os tipos de auth — leem `request.user.roleName`.

## ScopeGuard — como anotar um endpoint

```ts
@PostApi({
  path: 'conversations',
  authenticated: true,
  scope: 'agent:chat',   // ← scope exigido para chamadas via API key
})
```

- JWT: `ScopeGuard` passa sem checar scopes.
- API key sem `scope` no endpoint: **403** (endpoint não exposto a chaves).
- API key com `scope` no endpoint + scope na chave: passa.
- API key sem o scope necessário: **403**.

Endpoints anotados com scope:

| Endpoint | Scope |
|---|---|
| `GET /user` · `GET /user/stats/signups` · `GET /user/:id` | `users:read` |
| `GET /route` | `routes:read` |
| `GET /feature-flags` | `feature-flags:read` |
| `POST /ai/conversations` · `GET /ai/conversations` · `GET /ai/conversations/:id` | `agent:chat` |
| `POST /ai/conversations/:id/messages` | `agent:chat` |
| Quase toda a API de `messaging/` (envio, histórico, contatos, conexões, templates, botões — ver [[messaging]]) | `messaging:read` / `messaging:write` |

`messaging/` é o módulo mais exposto a chave de API hoje: tanto `messaging.controller.ts` quanto
`messaging-template.controller.ts` declaram `scope` em praticamente toda rota de operador (webhook
e handshake ficam de fora, são anônimos por natureza). `notification:write` existe em `McpScopes`
mas só é usado como `approvalScope` de tool de IA — nenhum endpoint REST do módulo declara `scope`,
então `notification/` continua JWT-only para dual auth.

Todo o resto da API é JWT-only por consequência do default-deny — inclusive
`POST /ai/conversations/:id/approvals`, `/rewind` e os endpoints de `/ai/tools`.
Ao expor um endpoint novo a chaves, some o `scope:` no decorator e rode
`openapi:export` + `generate:api`.

## Aprovações de tool via API key (MCP)

`SendMessageUseCase` e `ResolveApprovalUseCase` semeiam `ctx.approvedScopes` com os `apiKeyScopes` da request; o canal `approvedScopes` do estado do grafo une isso ao que já foi aprovado na conversa (reducer de união). Os scopes da chave funcionam, portanto, como aprovação prévia de escrita — o operador humano aprovou ao criar a chave com aquele scope.

Uma tool cujo `approvalScope` não esteja coberto pausa o turno num `interrupt()`. Resolver esse
`interrupt()` exige `POST /ai/conversations/:id/approvals`, que **não** declara scope e por isso só
aceita sessão JWT: o turno fica pendente até alguém abrir o chat na UI e decidir. Chave de API que
precise rodar sem intervenção deve carregar de saída todos os `approvalScope` das tools que vai usar.

## Logs

| Ação | Módulo | Quando |
|---|---|---|
| `API_KEY_CREATED` | `API_KEY` | `CreateApiKeyUseCase` |
| `API_KEY_REVOKED` | `API_KEY` | `RevokeApiKeyUseCase` |

## UI no perfil

`/profile?tab=apiKeys` — criar, listar, editar scopes e revogar chaves. Aba visível apenas com a feature flag `MCP_API_KEYS` habilitada para o role do usuário (ver [[feature-flags-backend]]). Ver [[frontend-overview]].
