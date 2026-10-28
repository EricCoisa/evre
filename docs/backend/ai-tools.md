---
title: AI Tools — contrato, discovery e como criar uma nova tool
tags: [backend, ai, tools, extensibility]
---

# AI Tools

Este documento é a referência central para estender o agente. **Um dev ou agente de IA deve conseguir criar uma nova tool lendo só este arquivo.**

> Fonte: `backend-nest/src/domain/ai/`, `backend-nest/src/modules/*/ai-tools/`

## Princípio fundamental

O módulo `ai/` **não conhece nenhuma tool**. Tools vivem nos módulos donos da feature:

```
modules/
  feature-flag/
    ai-tools/
      list-feature-flags.tool.ts   ← LEITURA
      toggle-feature-flag.tool.ts  ← ESCRITA (com approvalScope)
      ...
  user/
    ai-tools/
      list-users.tool.ts
      find-user.tool.ts
      ...
  route/
    ai-tools/
      list-routes.tool.ts
      ...
```

Praticamente todo módulo com um controller tem seu `ai-tools/`, espelhando o que a REST API já expõe para o role do usuário logado (exceto as categorias descritas em "O que **não** vira tool", abaixo). Veja a tabela completa em [Tools registradas atualmente](#tools-registradas-atualmente).

**Nunca registrar uma tool em `modules/ai/`.** A tool pertence ao módulo da feature que ela acessa.

### O que **não** vira tool

Nem todo endpoint REST deve ganhar uma tool. Categorias que ficam de fora por padrão:

- **Sessão/cookies** (`login`, `refresh`, `logout`, `accept-invite`): dependem de `@Req`/`@Res` cru para setar cookies httpOnly — não representável como `tool_result`.
- **Segredo digitado em texto** (`forgot-password`, `reset-password`, `update-password`, `delete-my-account`, `verification/request`, `verification/confirm`): a senha ou o código de verificação apareceria em texto pro LLM.
- **Arquivo binário/streaming** (`update-profile` com upload, `get-user-image`, `export-my-data`): resultado não é serializável como JSON.
- **Health/diagnóstico como tool própria** (`health/*`): não é uma ação de usuário. 
  **Exceção:** storage, email e captcha expõem o health *dentro* da tool de leitura de
  configuração (`get_storage_config`, `get_email_config`, `get_captcha_config`). A pergunta real do
  usuário é "está configurado **e** funcionando?" — separar obrigaria o modelo a duas chamadas para
  responder uma coisa, e o health desses três é cacheado. Health solto, sem config ao lado,
  continua fora — é por isso que `verification/health` também não ganha tool própria.
- **Emissão de segredo mostrado uma única vez** (`create_api_key`): canal de chat é o lugar errado para isso.
- **Módulo de infraestrutura/orquestração, sem dado de feature próprio** (`mcp/`): expõe o conector
  MCP remoto em si (OAuth 2.1 + DCR), não um recurso de negócio — mesmo princípio de "nunca registrar
  tool em `modules/ai/`" aplicado a outra peça de infraestrutura.
- **Deleção de usuário** (`remove_user`, `delete_my_account`): exclusão explícita de escopo — a IA nunca deleta um usuário.
- **Endpoint com bug de autorização conhecido**: se o REST não tem o guard de role correto, não replique o bug numa tool — corrija o REST primeiro.

### Configuração de provider: tool típada, nunca a genérica

Storage, email e captcha guardam a configuração em `SystemConfiguration`, mas cada um tem um
use-case que **valida contra o provider real** antes de persistir (`assertProviderOk`) e trata
segredo em branco como "manter o gravado". A tool genérica `update_system_configuration` não
tem nenhuma das duas regras: escrever por ela grava credencial quebrada e apaga secret sem querer.

Por isso as três tools genéricas (`create/update/delete_system_configuration`) **recusam** essas
chaves e apontam a tool certa — ver `typedConfigOwner()` em
`src/domain/system-configuration/typed-config-keys.const.ts`. Não é restrição de permissão (o
`approvalScope` é o mesmo `system-configuration:write`): é fechar o caminho que não valida.

Ao criar um formulário de provider validado novo, registre o prefixo das chaves lá. Duas
exceções deliberadas:

- `SYSTEM_CAPTCHA_ENABLED` fica livre: ligar/desligar não valida credencial nenhuma, e o
  `SaveCaptchaConfigUseCase` também não o gerencia. Bloquear tiraria a capacidade sem substituto.
- `SYSTEM_AI_*`, `SYSTEM_OAUTH_*` e `SYSTEM_SENTRY_DSN` ficam livres **porque não têm tool típada**
  — por decisão de segurança, o agente não configura provider de IA, login social nem telemetria.
  Todos têm use-case validado (`SaveSentryConfigUseCase` sonda o DSN antes de gravar, ver
  [[observability]]), mas bloquear aqui removeria a capacidade sem alternativa. Se um dia ganharem
  tool, registre os prefixos.

### Leitura de configuração nunca devolve segredo

`SystemConfigurationService.findByLabelKey()` e `getValueOrNull()` devolvem o segredo
**descriptografado** — só o `maskSecretValue` da camada de cima mascara. Numa tool de leitura,
reporte **presença** em vez de valor (`secretStatus()` no mesmo arquivo de domínio): `'configurado'`
/ `'não configurado'`. É à prova de esquecimento, e o modelo não precisa do valor para diagnosticar.

## Contrato — `IAiTool`

```ts
// domain/ai/ai-tool.types.ts

export interface AiToolContext {
  userId: string;
  roleName: string;
  approvedScopes: string[];
}

export interface AiToolDefinition {
  name: string;           // snake_case, único globalmente — ex.: 'list_users'
  description: string;    // o que o MODELO lê para decidir usar a tool — não é texto de UI
  descriptionKey?: string;// chave i18n do texto que o USUÁRIO lê; ausente = `tool_<name>`
  inputSchema: z.ZodType; // valida o input do modelo (não-confiável)
  roles?: string[];       // RBAC — espelha o guard do endpoint REST equivalente
  invalidates?: string[]; // tags p/ o frontend invalidar TanStack Query
  approvalScope?: McpScope; // obrigatório em toda tool de ESCRITA
}

export interface IAiTool {
  readonly definition: AiToolDefinition;
  execute(input: unknown, ctx: AiToolContext): Promise<unknown>;
}
```

## Decorator `@AiToolDef()`

```ts
// domain/ai/ai-tool.decorator.ts
export const AI_TOOL_KEY = 'AI_TOOL';
export const AiToolDef = (): ClassDecorator => SetMetadata(AI_TOOL_KEY, true);
```

O `ToolRegistry` varre todos os providers do NestJS via `DiscoveryService` buscando classes com `AI_TOOL_KEY`. A classe registrada deve também ser um `@Injectable()`.

## Regras de campo

### `name`

- `snake_case`, único em todo o repositório.
- O modelo usa este nome para invocar a tool — seja descritivo.

### `description`

- Escrita para o modelo, não para o dev — e **não para o usuário final**.
- Explica **o que faz** e **quando usar**.
- Para tools de busca: mencione parâmetros opcionais.
- É comum ser longa e cheia de ressalvas de uso ("pode afetar comportamento global — use com cautela").
  Esse texto é ruim numa tela; quem cuida da tela é o `descriptionKey` abaixo.

### `descriptionKey` — o texto que o usuário lê

A tela `/profile?tab=agentPermissions` lista as tools para o usuário decidir quais o agente pode usar.
Mostrar o `description` cru ali significaria mostrar prompt de modelo como se fosse UI — em um idioma
só, ainda por cima. Então a tela usa uma **chave i18n**, resolvida por
`ToolRegistry.getDescriptionKey(name)`.

- **Não declare em tool nenhuma.** Sem o campo, a chave é derivada do `name`: `list_users` →
  `tool_list_users`. Repetir `descriptionKey: 'tool_list_users'` ao lado de `name: 'list_users'` em
  dezenas de tools seria só boilerplate.
- O campo existe para o caso raro de uma tool precisar divergir dessa convenção.
- A tradução vive em `frontend-next/src/locales/{en,pt-BR}/profile.json`, namespace `profile`.
- **Tool nova ⇒ adicione `tool_<name>` nos dois arquivos.** Sem a chave, a tela cai no `description`
  cru (texto de modelo, sem tradução) — degrada, não quebra.

### `inputSchema` (Zod — fronteira de confiança)

- O input vem do LLM — **nunca é confiável**.
- O `ToolRegistry.dispatch()` chama `schema.safeParse(input)` antes de executar.
- Input inválido vira `tool_result` de erro para o modelo (que pode se corrigir); nunca lança exception no stream.
- Use `z.string().uuid()`, `z.enum()`, `.min()`/`.max()` para reduzir superfície de ataque.
- **Reaproveite o schema do use-case/DTO em vez de redeclarar um `z.object({...})` inline** — ex.: `PaginationQuerySchema` (`common/schemas/pagination.schema.ts`) para tools de listagem, ou o `XxxSchema` exportado ao lado do `XxxDto` do módulo. Importe também o tipo (`PaginationQuery`, `z.infer<typeof XxxSchema>`) e tipe `execute(input: TipoDoSchema, ...)` diretamente — elimina o `input: unknown` + cast manual e mantém schema/tipo sincronizados com o use-case.

### `roles` — RBAC

- Espelha o guard do endpoint REST equivalente para a mesma operação.
- Ausente = qualquer usuário autenticado pode usar.
- O `ToolRegistry.getToolDefinitions()` filtra antes de enviar ao modelo: **role sem permissão não vê a tool na lista**.
- O `dispatch()` re-checa roles antes de executar (defesa dupla).

```ts
// GET /user requer ADMIN ou MODERATOR → mesmos roles na tool
roles: ['ADMIN', 'MODERATOR']
```

### `invalidates` — invalidação de queries no frontend

- Array de tags de recurso, tipado como `InvalidationTag[]` (`domain/ai/invalidation-tags.const.ts`) — **nunca string literal solta**. Import: `import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const'`.
- Cada tag é o primeiro segmento do path REST do recurso (`InvalidationTags.USER` → `'user'`, `InvalidationTags.ROUTE` → `'route'`, etc.). Tag nova → adicionar em `InvalidationTags` primeiro, nunca escrever a string direto no tool.
- Ao receber `tool_result` com `invalidates`, o frontend (`frontend-next/src/lib/actions/ai/use-ai-stream.ts`) chama `queryClient.invalidateQueries()` por tag — via um mapa tag→queryKey (`INVALIDATION_TAG_QUERY_KEYS`) nesse mesmo arquivo, já que back e front são apps separados no monorepo e não compartilham esse const. **Toda tag nova em `InvalidationTags` precisa de uma entrada correspondente nesse mapa**, ou a invalidação vira no-op silencioso no front.
- Essa invalidação usa `refetchType: 'all'`, e **não é detalhe**: a tool roda enquanto o usuário está no chat, ou seja, com a tela afetada quase sempre desmontada. Com `refetchOnMount: false` global (`lib/queryClient.ts`), o `refetchType` padrão (`'active'`) marcaria a query como stale sem nunca buscar de novo — o usuário voltaria para a tela com o dado anterior até um F5. Coberto por regressão em `use-ai-stream.test.tsx`.
- Tools de leitura pura: `invalidates: []`. **Isso importa:** `invalidates` não-vazio também
  dispara `router.refresh()` no front, porque parte da tela é decidida em Server Component e não
  observa o TanStack (ver [[page-structure#Mudou o dado: como a tela server-side reage]]). Tool de
  leitura que declarasse tag pagaria um render de servidor por chamada, à toa.
- Escrita SEMPRE declara as tags afetadas.

### `approvalScope` — human-in-the-loop (obrigatório em escrita)

- Toda tool que altera estado **deve declarar** `approvalScope`. Omitir em escrita é bug de segurança.
- Usa os mesmos valores de `McpScopes` (`domain/api-key/mcp-scopes.const.ts`).
- O node de tools do grafo lê o `approvalScope` da tool (`ToolRegistry.getApprovalScope`, sem efeito colateral) **antes** de despachar. Faltando aprovação, chama `interrupt()` do LangGraph: o turno pausa no checkpoint e o stream emite `approval_required`. Nenhuma tool da leva executa antes de todas as aprovações estarem resolvidas — pausar depois de despachar reexecutaria o efeito colateral no resume.
- O usuário aprova via card no chat → `POST /ai/conversations/:id/approvals` → `new Command({ resume: decision })` retoma exatamente de onde parou.
- "Aprovar para a conversa" persiste o scope no canal `approvedScopes` do estado do grafo (reducer de união), não em tabela — vale para os turnos seguintes da mesma thread.
- `deny` nunca chega no `dispatch()`: o node produz um `ToolMessage` de erro sintético, e o modelo segue o turno sabendo que foi negado.
- Chamadas via API key (MCP): os scopes da chave entram em `ctx.approvedScopes` no envio **e** na retomada, e são unidos aos aprovados na conversa pelo estado do grafo.

## Exemplo canônico — tool de LEITURA

```ts
// modules/user/ai-tools/list-users.tool.ts
import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type { IAiTool, AiToolDefinition, AiToolContext } from 'src/domain/ai/ai-tool.types';
import { FindAllUsersUseCase } from '../use-cases/find-all-users.use-case';
import { PaginationQuery, PaginationQuerySchema } from 'src/common/schemas/pagination.schema';

@AiToolDef()
@Injectable()
export class ListUsersTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_users',
    description: 'Lista os usuários do sistema com paginação e busca por nome/email.',
    inputSchema: PaginationQuerySchema,     // ← mesmo schema usado pelo controller/use-case
    roles: ['ADMIN', 'MODERATOR'],          // espelha GET /user
    invalidates: [],
  };

  constructor(private readonly findAllUsers: FindAllUsersUseCase) {}

  execute(input: PaginationQuery, _ctx: AiToolContext) {
    return this.findAllUsers.execute(input);   // schema já validou/normalizou — passa direto
  }
}
```

> Note que `execute` recebe `input: PaginationQuery` (não `unknown`) — o `IAiTool.execute(input: unknown, ...)` da interface é o contrato genérico do registry; cada tool pode (e deve) estreitar o tipo do parâmetro para o schema declarado em `inputSchema`, já que o `safeParse` do dispatch garante esse formato em runtime.

## Exemplo canônico — tool de ESCRITA com aprovação

```ts
// modules/feature-flag/ai-tools/toggle-feature-flag.tool.ts
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import type { IAiTool, AiToolDefinition, AiToolContext } from 'src/domain/ai/ai-tool.types';
import { FeatureFlagService } from '../feature-flag.service';

const ToggleFeatureFlagSchema = z.object({
  id:      z.string().uuid(),
  enabled: z.boolean(),
});
type ToggleFeatureFlagInput = z.infer<typeof ToggleFeatureFlagSchema>;

@AiToolDef()
@Injectable()
export class ToggleFeatureFlagTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'toggle_feature_flag',
    description:
      'Habilita ou desabilita uma feature flag pelo id. Use list_feature_flags antes para obter o id.',
    inputSchema: ToggleFeatureFlagSchema,
    roles:         ['ADMIN'],
    approvalScope: McpScopes.FEATURE_FLAGS_WRITE,       // ← obrigatório em escrita
    invalidates:   [InvalidationTags.FEATURE_FLAGS],    // ← nunca string literal solta
  };

  constructor(private readonly featureFlagService: FeatureFlagService) {}

  async execute(input: ToggleFeatureFlagInput, _ctx: AiToolContext) {
    return this.featureFlagService.update(input.id, { enabled: input.enabled });
  }
}
```

> Aqui não existe um DTO de update com exatamente esse shape (`id` + `enabled` obrigatório) para reaproveitar, então o schema é declarado como `const` no topo do arquivo (não inline no objeto `definition`) e o tipo é derivado dele com `z.infer` — assim `inputSchema` e o parâmetro de `execute` nunca dessincronizam. Nunca `input: unknown` + cast manual.

## Passo a passo para criar uma nova tool

1. **Criar o arquivo** em `modules/<feature>/ai-tools/<nome>.tool.ts`.
2. **Implementar** `IAiTool` com `@AiToolDef()` e `@Injectable()`.
3. **`name`** único, snake_case.
4. **`roles`** espelhando o guard REST equivalente.
5. Se for escrita: **`approvalScope`** obrigatório (`McpScopes`) + **`invalidates`** com as tags afetadas (`InvalidationTags` — adicione uma nova tag ali primeiro se o recurso ainda não tiver uma, nunca string literal solta no tool).
6. **Registrar** no array `providers` do módulo dono da feature.
7. Garantir que o módulo dono **exporta** os use-cases que a tool injeta.
8. Tag de `invalidates` nova? Adicionar a entrada correspondente em `INVALIDATION_TAG_QUERY_KEYS` (`frontend-next/src/lib/actions/ai/use-ai-stream.ts`), senão a invalidação não reflete no front.
9. Adicionar a descrição de UI `tool_<name>` em `frontend-next/src/locales/{en,pt-BR}/profile.json` — é o texto que o usuário lê na tela de permissões (ver [`descriptionKey`](#descriptionkey--o-texto-que-o-usuário-lê)).
10. É configuração de provider validado? Registrar o prefixo das chaves em
    `typed-config-keys.const.ts` para a tool genérica recusá-las (ver acima).
11. Rodar `npm run test` no backend — o `ToolRegistry` valida nomes duplicados na inicialização.

## Scopes disponíveis (`McpScopes`)

```ts
export const McpScopes = {
  USERS_READ:                             'users:read',
  USERS_WRITE:                            'users:write',
  ROUTES_READ:                            'routes:read',
  ROUTES_WRITE:                           'routes:write',
  FEATURE_FLAGS_READ:                     'feature-flags:read',
  FEATURE_FLAGS_WRITE:                    'feature-flags:write',
  INVITES_WRITE:                          'invites:write',
  ROLES_WRITE:                            'roles:write',
  ROLE_ROUTE_ACCESS_WRITE:                'role-route-access:write',
  SYSTEM_CONFIGURATION_WRITE:             'system-configuration:write',
  USER_CONFIGURATION_DEFINITIONS_WRITE:   'user-configuration-definitions:write',
  USER_CONFIGURATION_WRITE:               'user-configuration:write',
  USER_ROUTE_ACCESS_WRITE:                'user-route-access:write',
  API_KEYS_WRITE:                         'api-keys:write',
  CMS_WRITE:                              'cms:write',
  AGENT_CHAT:                             'agent:chat',
  MESSAGING_READ:                         'messaging:read',
  MESSAGING_WRITE:                        'messaging:write',
  NOTIFICATION_WRITE:                     'notification:write',
} as const;
```

O mesmo vocabulário é usado em `AiToolDefinition.approvalScope`, `ApiKey.scopes` e no canal `approvedScopes` do estado do grafo.

## Fluxo de aprovação (approval_required)

```
1. Modelo emite tool_call "toggle_feature_flag"
2. node "tools" → ToolRegistry.getApprovalScope('toggle_feature_flag') = 'feature-flags:write'
   → não está em state.approvedScopes → interrupt({ toolCallId, tool, scope, input })
   → NADA foi despachado ainda (o interrupt vem antes de qualquer dispatch da leva)
   → o grafo pausa e o checkpoint grava a pendência
3. runAgentGraph lê o interrupt pendente (graph.getState) e emite
   { type: 'approval_required', ... } + done → stream encerra
4. Frontend renderiza ApprovalCard com [Aprovar uma vez] [Aprovar para conversa] [Negar]
5. Usuário clica → POST /ai/conversations/:id/approvals { toolCallId, decision }
6. ResolveApprovalUseCase: revalida o toolCallId contra o interrupt real
   (getPendingApproval — 409 se já resolvida) e chama
   runAgentGraph({ resume: decision }) → new Command({ resume })
   - 'conversation' → scope entra no canal approvedScopes do grafo + log AI_SCOPE_APPROVED
   - 'once'         → aprovação só desta leva; não persiste
   - 'deny'         → ToolMessage de erro sintético + log AI_TOOL_DENIED; dispatch nunca roda
7. O node replay: interrupts já resolvidos retornam na hora, os pendentes pausam de novo
   (uma por vez). Resolvidas todas, despacha e o stream SSE retoma.
```

## Revogação de tools por usuário (UserToolAccess)

Além do filtro por `roles`, cada usuário pode revogar o acesso do **próprio** agente a tools específicas que seu role já permite — self-service, não é gerenciado por admin. Modelo Prisma `UserToolAccess` (`ai.prisma`): presença de linha `(userId, toolName)` = tool desabilitada para aquele usuário; ausência = segue o filtro de `roles` normal. É um deny-list — o inverso de `UserRouteAccess`, que é default-deny (aqui o padrão é permitir; a linha só existe para registrar uma exceção negativa).

Fonte: `tool-registry.service.ts`, `use-cases/{list,revoke,allow}-my-tool-access*.ts` (todos em `modules/ai/`).

- `ToolRegistry.getToolDefinitions(ctx)` — filtra por `roles` **e** exclui as tools que `ctx.userId` revogou (mesmo princípio de "registry filtra o que o modelo vê").
- `ToolRegistry.dispatch()` — re-checa a revogação antes de executar (defesa dupla, mesmo padrão do recheck de `roles`).
- Vale para **qualquer** canal que chega ao `ToolRegistry` — chat in-app (JWT) e chamadas via API key/MCP (`send_ai_message`) igualmente, porque os dois populam `ctx.userId` do mesmo jeito (ver [[api-key]] — dual auth). Revogar uma tool no perfil bloqueia o agente para esse usuário em qualquer canal, não só no chat da UI.

### Grupo (para a tela de permissões)

`ToolRegistry.getToolGroup(name)` deriva o grupo automaticamente do módulo Nest que registra a tool (via `DiscoveryService`, `wrapper.host.name` — ex.: `UserRouteAccessModule` → `user-route-access`) — **não é um campo manual em `AiToolDefinition`**. Uma tool nova cai no grupo certo sozinha; não precisa de nenhum passo extra além do 6 do "Passo a passo" acima (registrar no módulo dono).

### Descrição na tela de permissões

O texto exibido por tool vem de `ToolRegistry.getDescriptionKey(name)` (ver [`descriptionKey`](#descriptionkey--o-texto-que-o-usuário-lê)),
traduzido no namespace `profile`. O `description` da definition só aparece como fallback quando a chave
não tem tradução.

### Endpoints self-service (`AiController`)

| Endpoint | Descrição |
|---|---|
| `GET /ai/tools/permissions` | Catálogo completo permitido pelo role do usuário, com `group`, `descriptionKey` e `enabled` (`enabled: false` = revogada) |
| `DELETE /ai/tools/:name/access` | Revoga a tool para o usuário logado |
| `POST /ai/tools/:name/access` | Remove a revogação (volta ao padrão: permitido) |

### UI

`/profile?tab=agentPermissions` — sub-tabs por grupo (`group_<grupo>` no namespace `profile`), switch por tool. Aba visível só com a feature flag `AI_AGENT` habilitada para o role do usuário. Ver [[page-structure]].

## Exceção: tools que saem do processo — pontes com o Next.js

Toda tool documentada até aqui é DI in-process: injeta um use-case do próprio módulo e roda dentro do NestJS. **Duas áreas fogem disso**, e pelo mesmo motivo — o que elas precisam consultar vive no processo do Next.js, não no backend:

- `modules/cms/ai-tools/` — o Payload CMS roda embarcado no Next (detalhado abaixo);
- `modules/page-builder/ai-tools/` — o catálogo de blocos visuais vive no registry do frontend, então `describe_page_builder` chama `GET /api/agent/page-builder/schema` pelo mesmo mecanismo (`PageBuilderBridgeService`, mesmo header `x-agent-secret`, mesma env `AGENT_CMS_SECRET`). Ver [[page-builder]].

O resto desta seção descreve a ponte do CMS, que é a mais completa das duas (também escreve, não só lê).

### Payload CMS

O Payload CMS roda embarcado no processo do Next.js (`frontend-next/`), não no backend, então não tem use-case local pra injetar.

**Por que não é REST do Payload nem raw SQL:**
- REST do Payload (`/api/*`) exige `req.user`, e o Payload deste projeto **não tem nenhuma collection com `auth: true`** (decisão deliberada — ver `frontend-next/payload.config.ts`, `admin.user: undefined`). Não há login possível; escrever via REST está fora de cogitação.
- Raw SQL direto nas tabelas do schema `payload` (o padrão que `PayloadUserRepository` usa pra lock/unlock) quebra o Payload: bypassa hooks do plugin de SEO, pipeline de upload S3 dos campos de `Media`, estrutura do rich-text do Lexical e o tracking de `payload_locked_documents`/versionamento.

**A ponte usada — Payload Local API a partir de um endpoint interno no frontend:**

```
backend (NestJS)                          frontend (Next.js, mesmo processo do Payload)
────────────────────                      ─────────────────────────────────────────────
cms/services/cms-agent-bridge.service.ts
  → axios + header x-agent-secret    →     app/api/agent/cms/schema/route.ts        (GET)
                                            app/api/agent/cms/[collection]/route.ts  (GET, lista)
                                            app/api/agent/cms/[collection]/[id]/route.ts (GET, PATCH)
                                              → getPayload({ config }) — Local API,
                                                overrideAccess: true (não existe req.user
                                                pra checar; ver payload.config.ts acima)
```

- **Auth**: segredo compartilhado (`AGENT_CMS_SECRET`, env var em ambos os serviços) no header `x-agent-secret` — não é sessão de usuário, não é login do Payload. `CmsAgentBridgeService` monta a URL a partir de `NEXTAUTH_URL` (reaproveitada — já é "onde o frontend está" pra CORS e pros links de convite/reset de senha; nenhuma env var nova só pra isso). `ponytail`: em `docker compose up` local isso quebra (`NEXTAUTH_URL` aponta pro `localhost` do host, não alcançável de dentro do container do backend) — não é o caso hoje (dev roda os dois fora de container), ajustar se/quando isso rodar via compose local.
- **RBAC**: cada tool chama `CheckAccessUseCase.execute(ctx.userId, '/cms')` (reexportado de `UserRouteAccessModule`) antes de qualquer chamada à ponte — mesmo gate que já protege o iframe do CMS pra humanos. `overrideAccess: true` no Payload significa que **essa checagem é o único portão de segurança** — não há defesa em profundidade do lado do Payload, então nunca pule essa chamada numa tool nova nessa área.
- **Resiliente a schema drift, de propósito**: `describe_cms_schema` lê `payload.config.collections` ao vivo (não um cache/doc desatualizável) e `update_cms_document` aceita `data: Record<string, unknown>` sem shape fixo — a validação de campo é 100% do Payload. Isso quebra o padrão de "reaproveite o schema do DTO" usado em toda outra tool, de propósito: aqui não existe um DTO fixo pra reaproveitar, porque collections/campos do Payload podem mudar a qualquer momento no admin sem gerar deploy.

## Segurança

- **Registry filtra** o que o modelo vê (`getToolDefinitions`) — por `roles` e por revogação individual (`UserToolAccess`, ver seção acima).
- **Dispatch re-checa** roles e revogação individual antes de executar (nunca confiar só no filtro de envio).
- **Zod valida** todo input antes de chegar ao use-case.
- **Endpoint de aprovação revalida** que o toolCall existe, está `pending` e pertence à conversa do usuário.
- **Prompts não são fronteira de segurança** — o registry é. Instruções no system prompt não concedem permissão alguma.
- Toda execução de tool gera `SystemLog { module: 'AI', action: 'AI_TOOL_EXECUTED' }`.

## Tools registradas atualmente

| Tool | Módulo | Roles | Escrita? | Scope |
|---|---|---|---|---|
| `list_users` | `user/` | ADMIN, MODERATOR | não | — |
| `find_user` | `user/` | ADMIN, MODERATOR | não | — |
| `get_my_profile` | `user/` | qualquer autenticado | não | — |
| `list_roles` | `user/` | qualquer autenticado | não | — |
| `list_user_statuses` | `user/` | qualquer autenticado | não | — |
| `update_user` | `user/` | ADMIN | **sim** (sem `role`*) | `users:write` |
| `list_routes` | `route/` | ADMIN, USER | não | — |
| `create_route` | `route/` | ADMIN | **sim** | `routes:write` |
| `get_route` | `route/` | ADMIN | não | — |
| `get_route_by_path` | `route/` | qualquer autenticado | não | — |
| `update_route` | `route/` | ADMIN | **sim** | `routes:write` |
| `remove_route` | `route/` | ADMIN | **sim** | `routes:write` |
| `list_logs` | `logging/` | ADMIN, MODERATOR | não | — |
| `list_feature_flags` | `feature-flag/` | ADMIN | não | — |
| `get_feature_flag` | `feature-flag/` | ADMIN | não | — |
| `toggle_feature_flag` | `feature-flag/` | ADMIN | **sim** | `feature-flags:write` |
| `create_feature_flag` | `feature-flag/` | ADMIN | **sim** | `feature-flags:write` |
| `update_feature_flag` | `feature-flag/` | ADMIN | **sim** | `feature-flags:write` |
| `remove_feature_flag` | `feature-flag/` | ADMIN | **sim** | `feature-flags:write` |
| `set_feature_flag_roles` | `feature-flag/` | ADMIN | **sim** | `feature-flags:write` |
| `list_invites` | `auth/` | ADMIN | não | — |
| `generate_invite` | `auth/` | ADMIN | **sim** | `invites:write` |
| `delete_invite` | `auth/` | ADMIN | **sim** | `invites:write` |
| `list_system_roles` | `role/` | ADMIN | não | — |
| `create_role` | `role/` | ADMIN | **sim** | `roles:write` |
| `delete_role` | `role/` | ADMIN | **sim** | `roles:write` |
| `grant_role_route_access` | `role-route-access/` | ADMIN | **sim** | `role-route-access:write` |
| `list_role_route_access` | `role-route-access/` | ADMIN | não | — |
| `list_role_route_access_user_roles` | `role-route-access/` | ADMIN | não | — |
| `list_role_route_access_by_role` | `role-route-access/` | ADMIN | não | — |
| `get_role_route_access` | `role-route-access/` | ADMIN | não | — |
| `remove_role_route_access` | `role-route-access/` | ADMIN | **sim** | `role-route-access:write` |
| `remove_role_route_access_by_role` | `role-route-access/` | ADMIN | **sim** (bulk) | `role-route-access:write` |
| `grant_user_route_access` | `user-route-access/` | ADMIN | **sim** | `user-route-access:write` |
| `list_user_route_access` | `user-route-access/` | ADMIN | não | — |
| `list_user_route_access_by_user` | `user-route-access/` | ADMIN | não | — |
| `check_my_route_access` | `user-route-access/` | qualquer autenticado | não | — |
| `revoke_user_route_access` | `user-route-access/` | ADMIN | **sim** | `user-route-access:write` |
| `revoke_all_user_route_access` | `user-route-access/` | ADMIN | **sim** (bulk) | `user-route-access:write` |
| `list_system_configuration` | `system-configuration/` | ADMIN | não | — |
| `get_system_configuration` | `system-configuration/` | ADMIN | não | — |
| `get_system_configuration_by_key` | `system-configuration/` | ADMIN | não | — |
| `create_system_configuration` | `system-configuration/` | ADMIN | **sim** | `system-configuration:write` |
| `update_system_configuration` | `system-configuration/` | ADMIN | **sim** | `system-configuration:write` |
| `delete_system_configuration` | `system-configuration/` | ADMIN | **sim** | `system-configuration:write` |
| `list_user_configuration_definitions` | `user-configuration-definition/` | ADMIN | não | — |
| `get_user_configuration_definition` | `user-configuration-definition/` | ADMIN | não | — |
| `get_user_configuration_definition_by_key` | `user-configuration-definition/` | ADMIN | não | — |
| `create_user_configuration_definition` | `user-configuration-definition/` | ADMIN | **sim** | `user-configuration-definitions:write` |
| `update_user_configuration_definition` | `user-configuration-definition/` | ADMIN | **sim** | `user-configuration-definitions:write` |
| `delete_user_configuration_definition` | `user-configuration-definition/` | ADMIN | **sim** | `user-configuration-definitions:write` |
| `set_user_configurations` | `user-configuration/` | qualquer autenticado | **sim** | `user-configuration:write` |
| `get_my_configurations` | `user-configuration/` | qualquer autenticado | não | — |
| `get_my_configuration_by_key` | `user-configuration/` | qualquer autenticado | não | — |
| `reset_my_configuration` | `user-configuration/` | qualquer autenticado | **sim** | `user-configuration:write` |
| `reset_all_my_configurations` | `user-configuration/` | qualquer autenticado | **sim** (bulk) | `user-configuration:write` |
| `list_api_keys` | `api-key/` | qualquer autenticado | não | — |
| `revoke_api_key` | `api-key/` | qualquer autenticado | **sim** | `api-keys:write` |
| `update_api_key_scopes` | `api-key/` | qualquer autenticado | **sim** | `api-keys:write` |
| `describe_cms_schema` | `cms/` | ADMIN, MODERATOR** | não | — |
| `get_cms_document` | `cms/` | ADMIN, MODERATOR** | não | — |
| `update_cms_document` | `cms/` | ADMIN, MODERATOR** | **sim** | `cms:write` |
| `describe_page_builder` | `page-builder/` | qualquer autenticado*** | não | — |
| `set_page_layout` | `page-builder/` | qualquer autenticado**** | **sim** | `user-configuration:write` |
| `get_messaging_config` | `messaging/` | ADMIN | não | — |
| `list_whatsapp_messages` | `messaging/` | ADMIN | não | — |
| `send_whatsapp_message` | `messaging/` | ADMIN | **sim** | `messaging:write` |
| `list_whatsapp_templates` | `messaging/` | ADMIN | não | — |
| `send_whatsapp_template` | `messaging/` | ADMIN | **sim** | `messaging:write` |
| `list_whatsapp_template_types` | `messaging/` | ADMIN | não | — |
| `create_whatsapp_template` | `messaging/` | ADMIN | **sim** | `messaging:write` |
| `submit_whatsapp_template` | `messaging/` | ADMIN | **sim** | `messaging:write` |
| `get_storage_config` | `storage/` | ADMIN | não | — |
| `save_storage_config` | `storage/` | ADMIN | **sim** | `system-configuration:write` |
| `get_email_config` | `email/` | ADMIN | não | — |
| `save_email_config` | `email/` | ADMIN | **sim** | `system-configuration:write` |
| `get_captcha_config` | `captcha/` | ADMIN | não | — |
| `save_captcha_config` | `captcha/` | ADMIN | **sim** | `system-configuration:write` |
| `list_capabilities` | `capability/` | qualquer autenticado | não | — |
| `list_my_notifications` | `notification/` | qualquer autenticado***** | não | — |
| `get_unread_notifications_count` | `notification/` | qualquer autenticado***** | não | — |
| `mark_notification_read` | `notification/` | qualquer autenticado***** | **sim** | `notification:write` |
| `mark_all_notifications_read` | `notification/` | qualquer autenticado***** | **sim** (bulk) | `notification:write` |
| `dismiss_notification` | `notification/` | qualquer autenticado***** | **sim** | `notification:write` |
| `send_broadcast_notification` | `notification/` | ADMIN***** | **sim** | `notification:write` |

`*` `update_user` omite o campo `role` do schema por decisão deliberada — reatribuir role via chat é risco de escalação de privilégio; use uma ação administrativa dedicada para isso.

`***` `describe_page_builder` não restringe por `roles` porque customizar a própria tela é self-service — mas as **fontes de dados** que ela devolve já vêm filtradas pelo role de quem perguntou (`PageSourceRegistry.listForRole`), e `set_page_layout` recusa fonte fora desse alcance. Ver [[page-builder]].

`****` `set_page_layout` grava só o layout **do próprio usuário**. O layout padrão do sistema (o que vale para quem não customizou nada) tem endpoint REST restrito a ADMIN e **não** é exposto como tool: publicar tela para todo mundo é ação administrativa deliberada, não conversa. As duas escritas compartilham o mesmo `PageLayoutValidator`, então as recusas são idênticas — um exemplo de tool e REST sendo dois clientes da mesma regra, em vez de duas cópias dela.

`**` as tools de `cms/` usam `roles: ['ADMIN', 'MODERATOR']` para espelhar o **ceiling** da rota `/cms` (`CmsRouteCeiling`, registrado em `RouteCeilingRegistry` — um role fora desse teto nunca passa, mesmo com grant explícito). Isso é só o teto: o acesso efetivo ainda depende do grant por rota (`UserRouteAccess`/`RoleRouteAccess`), checado dentro de `execute()` via `CheckAccessUseCase` — defesa em duas camadas, igual ao padrão de recheck usado no resto do registry. Ver [Exceção: tools que saem do processo](#exceção-tools-que-saem-do-processo--pontes-com-o-nextjs) acima e [[auth-rbac]].

`*****` as tools de `notification/` não usam `roles` (exceto `send_broadcast_notification`, que mirra o `roles: ['ADMIN']` do endpoint REST) porque a maioria é escopo "me" — mas todas checam dentro de `execute()` se a feature flag `NOTIFICATION_ROOT_FLAG` está habilitada para o role do usuário (`FeatureFlagService.isEnabled`), mesma checagem que o `FeatureFlagGuard` faz no REST equivalente. Sem feature flag habilitada, a tool nega mesmo que o role tenha `roles` suficiente.

**Roles vs. REST**: `list_routes` (`ADMIN, USER`) e `list_users` (`ADMIN, MODERATOR`) concedem roles mais amplas que o endpoint REST equivalente (`ADMIN` apenas) — mismatch pré-existente, mantido para não regredir comportamento já em produção; não use como referência ao criar tools novas (siga sempre o guard REST atual).
