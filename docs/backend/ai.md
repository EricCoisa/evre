---
title: IA — Módulo AI (grafo LangGraph, checkpointer, providers, streaming, BYOK, health)
tags: [backend, ai, streaming, byok, langgraph]
---

# IA — Módulo AI

Módulo `ai/` — camada agnóstica a provider que expõe um agente conversacional com histórico persistido, streaming SSE e tools plugáveis. O motor do agente é um **grafo LangGraph**; a execução (mensagens, tool calls, aprovação pendente) vive num **checkpointer Postgres**, não no Prisma.

> Fonte: `backend-nest/src/modules/ai/`

## Arquitetura

```
ai.controller.ts  (SSE)
    │
    ├── SendMessageUseCase ─────┐
    ├── ResolveApprovalUseCase ─┤ runConversationTurn (lock Redis + log)
    │                           └──→ runAgentGraph (graph/agent-graph.ts)
    │                                   ├── node "agent"  → AiService.getChatModel() → BaseChatModel.stream()
    │                                   │                     (ChatAnthropic | ChatOpenAI | ChatOpenAI + baseURL)
    │                                   ├── node "tools"  → ToolRegistry.dispatch()   (RBAC + aprovação + auditoria)
    │                                   └── checkpointer Postgres (schema `langgraph`, thread_id = conversationId)
    │
    ├── CreateConversationUseCase
    ├── ListConversationsUseCase
    ├── GetConversationUseCase      (lê do checkpoint)
    ├── RewindConversationUseCase   (trunca o checkpoint)
    └── DeleteConversationUseCase   (Prisma + deleteThread)
```

**AiService** é a facade (espelho de `email.service.ts` / `storage.service.ts`): resolve qual provider usar (plataforma ou BYOK) e delega.

**ToolRegistry** descobre tools via `DiscoveryService` — zero hardcode no módulo `ai/`.

## Providers suportados

Quem conversa com o modelo é o node do grafo, através do `BaseChatModel` que **`AiService.getChatModel(userId, model?)`** devolve. O `IAiProvider` cuida só do que o LangChain não cobre — validar credencial e listar modelos, via SDK cru — e por isso **não declara `chat`**.

`BaseMessage[]` é o formato único de ponta a ponta: é o estado do grafo e é o que o modelo consome. `toLangChainMessages`/`fromLangChainMessages` rodam apenas na fronteira HTTP, ao devolver histórico ao frontend, nunca dentro do turno — assim `id`, `usage_metadata` e o reasoning atravessam o turno intactos.

| Constante | Provider | Pacote de streaming |
|---|---|---|
| `ANTHROPIC` | Anthropic Claude | `@langchain/anthropic` |
| `OPENAI` | OpenAI | `@langchain/openai` |
| `OPENAI_COMPATIBLE` | Qualquer OpenAI-compatible (Ollama, LM Studio, gateways) | `@langchain/openai` com `configuration.baseURL` |

Cada provider implementa `IAiProvider` (`domain/interface/ai-provider.interface.ts`):

```ts
interface IAiProvider {
  validateConfiguration(): Promise<ProviderResult>;
  listModels(): Promise<string[]>;   // fallback: []
}
```

`ProviderResult` é o contrato compartilhado por todo provider plugável (`domain/interface/provider-result.ts`) — em falha, `data` é texto para humano. Ver [[error-handling]].

### Adicionar um provider

1. Criar `providers/<nome>.provider.ts` implementando `IAiProvider` (validar + listar modelos) e uma função `buildChat<Nome>()` que devolve o `BaseChatModel` já configurado.
2. Ligar essa função no `switch` de `AiService.getChatModel()` — é ele que o grafo usa.
3. Criar DTO de config correspondente em `dto/`.
4. Registrar no `AiModule` como provider.
5. Adicionar caso no `switch(engine)` de `AiService.buildProvider()` e `resolveSystemConfig()`/`resolveUserConfig()`.
6. Adicionar constante em `AiProviderConst` (`domain/ai/ai.const.ts`).

## Configuração do sistema (System Configuration)

| Chave | Tipo | Descrição |
|---|---|---|
| `SYSTEM_AI_PROVIDER` | ENUM | Provider ativo (`ANTHROPIC` / `OPENAI` / `OPENAI_COMPATIBLE`). Default: `ANTHROPIC` |
| `SYSTEM_AI_ANTHROPIC_API_KEY` | STRING, secret | Chave Anthropic da plataforma |
| `SYSTEM_AI_ANTHROPIC_MODEL` | STRING | Ex.: `claude-sonnet-4-20250514` |
| `SYSTEM_AI_OPENAI_API_KEY` | STRING, secret | Chave OpenAI da plataforma |
| `SYSTEM_AI_OPENAI_MODEL` | STRING | Ex.: `gpt-4o` |
| `SYSTEM_AI_OPENAI_COMPATIBLE_BASE_URL` | STRING | URL base (ex.: `https://openrouter.ai/api/v1`) |
| `SYSTEM_AI_OPENAI_COMPATIBLE_API_KEY` | STRING, secret | API key (opcional para Ollama/LM Studio) |
| `SYSTEM_AI_OPENAI_COMPATIBLE_MODEL` | STRING | Modelo padrão |
| `SYSTEM_AI_SYSTEM_PROMPT` | STRING | Prompt global injetado em toda conversa (opcional) |
| `SYSTEM_AGENT_OWN_KEY` | BOOLEAN | `true` = modo BYOK — usuário traz sua própria chave |

Gerenciadas em `/settings?tab=agenteConfig`.

## BYOK (Bring Your Own Key)

Quando `SYSTEM_AGENT_OWN_KEY = true`, cada usuário configura o próprio provider em `/profile?tab=agenteConfig`.

`USERCONFIG_AGENT_PROVIDER` (ENUM, igual ao da plataforma) escolhe qual credencial o `AiService`
lê — mas **não é seletor exclusivo**: igual ao lado da plataforma, as chaves de modelo/API key são
**por provider** (`USER_AI_CONFIG_KEYS` em `domain/ai/ai.const.ts`), então o usuário pode manter
credencial guardada para mais de um provider e só trocar qual está ativo.

| Chave de UserConfiguration | Tipo | Descrição |
|---|---|---|
| `USERCONFIG_AGENT_PROVIDER` | ENUM | Provider ativo do usuário (`ANTHROPIC` / `OPENAI` / `OPENAI_COMPATIBLE`) |
| `USERCONFIG_AGENT_ANTHROPIC_API_KEY` | STRING, secret | Chave Anthropic do usuário |
| `USERCONFIG_AGENT_ANTHROPIC_MODEL` | STRING | Modelo Anthropic preferido |
| `USERCONFIG_AGENT_OPENAI_API_KEY` | STRING, secret | Chave OpenAI do usuário |
| `USERCONFIG_AGENT_OPENAI_MODEL` | STRING | Modelo OpenAI preferido |
| `USERCONFIG_AGENT_OPENAI_COMPATIBLE_API_KEY` | STRING, secret | API key (opcional para Ollama/LM Studio) |
| `USERCONFIG_AGENT_OPENAI_COMPATIBLE_MODEL` | STRING | Modelo preferido |
| `USERCONFIG_AGENT_OPENAI_COMPATIBLE_BASE_URL` | STRING | URL base (só OPENAI_COMPATIBLE) |
| `USERCONFIG_AGENT_PROMPT` | STRING | Prompt pessoal — concatenado ao global (`\n\n`) no início de cada conversa |

O `SYSTEM_AI_SYSTEM_PROMPT` global é injetado mesmo com BYOK ativo. Prompts não são fronteira de segurança — o `ToolRegistry` é.

## Contexto de tela (`page` / `screen`)

`SendMessageDto` aceita o que o usuário tem aberto no navegador: `page` (path da URL) e `screen` (o que
os componentes declaram estar montado — `ScreenItem[]`, ver `domain/ai/screen-context.const.ts`).
`describeScreen()` vira um bloco do system prompt (`AiService`), para o modelo entender referências como
"essa configuração" ou "esse registro" — os valores não vão junto, só rótulos.

`source`/`detail` são validados por regex de identificador (`ScreenContextSchema`), não texto livre —
impede que o campo vire canal de prompt injection. **Nunca é usado para autorização**: é só contexto de
conversa; quem decide o que a tool pode fazer é sempre o `ToolRegistry` (roles + `approvalScope`), nunca
o que está na tela.

## Streaming SSE

Fluxo completo de uma mensagem:

```
Browser → POST /api/agent/<id>/stream (proxy Next.js)
         → POST /api/v1/ai/conversations/:id/messages (backend NestJS)
```

O proxy Next.js (`app/api/agent/[conversationId]/stream/route.ts`) resolve o cookie HttpOnly e faz pipe do SSE. O cookie nunca chega ao browser JS.

**Eventos SSE:**

| `type` | Conteúdo |
|---|---|
| `text` | `{ text: string }` — token de resposta |
| `reasoning` | `{ text: string }` — token de raciocínio (modelos que expõem) |
| `tool_call` | `{ id, name, input }` — chamada de tool |
| `tool_result` | `{ toolCallId, result, invalidates? }` — resultado + tags de invalidação |
| `approval_required` | `{ toolCallId, tool, scope, input }` — pausa o stream; aguarda aprovação |
| `error` | `{ message }` — erro não-fatal; stream encerra em seguida |
| `done` | `{ usage? }` — fim da resposta |

O frontend invalida TanStack Query ao receber `tool_result` com `invalidates` — ver [[http-client-orval]].

O `done` é **segurado** até o grafo terminar e o checkpoint gravar, e só então emitido. É o gatilho que o frontend usa para recarregar o histórico, então ele só dispara quando há histórico completo para ler.

### Três defesas do adapter LangChain

`providers/langchain-adapter.ts` traduz `AIMessageChunk` → `AiStreamEvent` e carrega três tratamentos
que existem por causa de gateway OpenAI-compatible mal-comportado. Ao depurar streaming, é aqui que se
olha:

| Sintoma | O que o adapter faz |
|---|---|
| Modelo reporta `reasoning_tokens` mas o "thinking" não aparece na tela | Lê o raciocínio de `additional_kwargs` (`reasoning`, `reasoning_content`, `thinking`) quando ele não chega como content block |
| Tool call chega com delta malformado e o turno se perderia | Refaz a chamada **sem streaming** uma vez; a resposta inteira costuma vir bem formada onde o SSE do gateway erra |
| `finish_reason` sai como `"tool_callstool_calls"` e os argumentos vêm duplicados | O `concat()` do LangChain concatena chunks repetidos; JSON duplicado exato é cortado ao meio, qualquer outra corrupção falha |

Tool call só vira evento `tool_call` depois que o stream termina e `.tool_calls` está parseado —
nunca a partir de fragmento parcial.

## Grafo do agente

`graph/agent-graph.ts` — `StateGraph` com dois nodes:

```
START → agent ──(sem tool_call)──→ END
          │                          ▲
          └──(tem tool_call)──→ tools┘
```

- **node `agent`** — pega o `BaseChatModel` de `AiService.getChatModel(userId, model?)` e o executa com a janela de histórico e o catálogo de tools do usuário; repassa `text`/`reasoning`/`tool_call`/`error` ao stream via `getWriter(config)` (`streamMode: 'custom'`). Resposta sem texto **e** sem tool call vira evento `error`, nunca silêncio.
- **node `tools`** — duas fases, nessa ordem obrigatória:
  1. resolve **todas** as aprovações da leva via `interrupt()`, sem despachar nem escrever nada antes;
  2. só então despacha, em paralelo, via `ToolRegistry.dispatch()`.

  A ordem não é estilística: `interrupt()` reexecuta o node inteiro do topo a cada resume — um dispatch antes dele rodaria o efeito colateral duas vezes. **Toda** tool call recebe um `ToolMessage`, inclusive a negada e a que o dispatch recusa: um `tool_call` sem resposta é um `tool_use` órfão, que o provider rejeita com 400 na ida seguinte.

**Teto de iterações:** `recursionLimit = maxIterations * 2` (conta nodes, não turnos). `MAX_TOOL_ITERATIONS = 10`.

**Janela de histórico:** `windowHistory` manda as últimas 30 mensagens (`HISTORY_WINDOW`), avançando o corte para não abrir num `tool` órfão. O checkpoint guarda a conversa inteira — a janela limita só o que trafega por chamada.

**Lock por conversa:** `Redis SETNX ai:conv:<id>:lock`, em `use-cases/run-conversation-turn.ts` (compartilhado por envio e aprovação). Impede dois streams simultâneos na mesma conversa e renova o TTL a cada meio-tempo enquanto o turno roda.

O lock é proteção de **UX**, não de consistência — quem serializa escrita por conversa é o checkpointer, por `thread_id`. Por isso `RedisService.setnx` falha **aberto**: com o Redis fora, o turno roda sem lock em vez de o chat inteiro parar. Um lock que precise de exclusão mútua de verdade não pode usar esse método.

> A exceção (`ConflictException`, `NotFoundException`) levantada dentro do stream **não vira status HTTP** — os headers SSE já foram enviados. Ela chega ao cliente como evento `error` com a mensagem real, e o status continua 201. O frontend depende do evento, não do status.

**Desconexão do cliente:** listener `close` do response → `AbortSignal` → o grafo para. O que já completou está no checkpoint (ver `durability` abaixo).

## Checkpointer (fonte da verdade da execução)

`checkpointer.service.ts` — `PostgresSaver` no **schema `langgraph`** do mesmo Postgres (mesmo precedente do schema `payload` do CMS). `thread_id` = `AiConversation.id`.

> ⚠️ As tabelas do checkpointer são criadas pelo `.setup()` da própria lib, no `OnModuleInit` — **fora do fluxo `prisma migrate`**. É a única exceção de migration do projeto. Não procure essas tabelas em `prisma/migrations/`.

- `durability: 'sync'` (o default da lib é `'async'`): garante o checkpoint do step N gravado **antes** do step N+1 começar. Com `'async'`, um step que falha logo após um bem-sucedido podia perder o checkpoint em voo — o tool call inteiro sumia do histórico.
- `getConversationHistory(checkpointer, threadId)` lê o histórico direto do checkpoint, sem rodar node nenhum — é o que `GetConversationUseCase` devolve.
- `rewindConversation(...)` descarta uma mensagem e tudo depois dela (`RemoveMessage` + `updateState`), na mesma thread. Alimenta o "voltar aqui" e o "tentar novamente" da UI.
- `getPendingApproval(...)` lê o `interrupt()` pendente da thread sem executar nada — usado para revalidar o `toolCallId` antes de retomar.
- `DeleteConversationUseCase` apaga a conversa no Prisma e depois chama `saver.deleteThread(id)`.

**Aprovação humana:** `interrupt()` + `new Command({ resume: decision })`, com `decision` = `'once' | 'conversation' | 'deny'`. `'conversation'` persiste o scope no canal `approvedScopes` do grafo (reducer de união) — sobrevive aos turnos seguintes da mesma thread. `'deny'` nunca chega no `dispatch()`: vira um `ToolMessage` de erro sintético.

## Endpoints

| Método | Path | Auth | Feature flag | Descrição |
|---|---|---|---|---|
| `POST` | `/ai/conversations` | JWT / API key (`agent:chat`) | — | Cria conversa |
| `GET` | `/ai/conversations` | JWT / API key (`agent:chat`) | — | Lista conversas (paginado) |
| `GET` | `/ai/conversations/:id` | JWT / API key (`agent:chat`) | — | Detalhe + mensagens (lidas do checkpoint) |
| `DELETE` | `/ai/conversations/:id` | JWT | — | Remove conversa (Prisma + checkpoint), 204 |
| `POST` | `/ai/conversations/:id/messages` | JWT / API key (`agent:chat`) | `AI_AGENT` | Envia mensagem (SSE) |
| `POST` | `/ai/conversations/:id/approvals` | JWT | `AI_AGENT` | Resolve aprovação de tool (SSE) |
| `POST` | `/ai/conversations/:id/rewind` | JWT | `AI_AGENT` | Descarta uma mensagem e tudo depois dela; devolve o histórico truncado |
| `GET` | `/ai/tools` | JWT | — | Lista tools disponíveis para o role atual |
| `GET` | `/ai/tools/permissions` | JWT | — | Catálogo de tools do role, cada uma com `enabled` (o usuário revogou ou não) |
| `DELETE` | `/ai/tools/:name/access` | JWT | — | Revoga o acesso do próprio agente a uma tool, 204 |
| `POST` | `/ai/tools/:name/access` | JWT | — | Restaura o acesso do próprio agente a uma tool |
| `GET` | `/ai/health` | JWT (qualquer role) | — | Saúde do serviço (gate do frontend) |
| `PUT` | `/ai/config` | JWT (ADMIN) | — | Valida a configuração da plataforma contra o provider e persiste se passar |
| `PUT` | `/ai/user-config` | JWT | — | Mesmo fluxo, gravando na configuração BYOK do próprio usuário |
| `GET` | `/ai/models` | JWT | — | Lista modelos disponíveis no provider atual |
| `POST` | `/ai/models/candidate` | JWT (ADMIN) | — | Lista modelos de um provider ainda não gravado (popula o select do formulário) |

> [!warning] Só os quatro primeiros aceitam API key
> `ScopeGuard` é default-deny: endpoint sem `scope` no decorator é inalcançável por
> `x-api-key`. Apenas `POST`/`GET /ai/conversations`, `GET /ai/conversations/:id` e
> `POST /ai/conversations/:id/messages` declaram `agent:chat`. Um turno que pare num
> `interrupt()` **não** pode ser resolvido por API key — `POST .../approvals` exige
> sessão JWT. Ver [[api-key]].

## Health / gate

`GET /ai/health` retorna:

```ts
{
  operational: boolean;
  reason?: string;       // quando não-operational
  byokRequired?: boolean;
  userKeyConfigured?: boolean;
}
```

- **BYOK off:** valida a configuração da plataforma (cache Redis TTL 300 s, chave `ai:health`). Cache invalidado ao salvar/validar config em `/settings`.
- **BYOK on:** verifica se o usuário tem os campos necessários preenchidos — sem chamada de rede.

O cache é invalidado automaticamente no `SystemConfigurationService.actionFire` para chaves `SYSTEM_AI_*`/`SYSTEM_AGENT_*` e na validação do usuário. O frontend usa `useAiHealth` para bloquear o input quando não-operational — ver [[service-health-gate]].

## Feature flag

`AI_AGENT` gateia `POST /ai/conversations/:id/messages`, `/approvals` e `/rewind` — os três que rodam o grafo. Configuração (`PUT /ai/config`, `PUT /ai/user-config`), `GET /ai/health` e `GET /ai/models` ficam fora da flag, para o admin configurar e conferir o provider sem habilitar o chat.

## Banco de dados

Ver diagrama completo em [[data-model]]. A execução da conversa **não** está no Prisma:

| Onde | O quê |
|---|---|
| `ai_conversations` (Prisma, schema `public`) | Só metadata: `id`, `userId`, `title`, timestamps. É quem sabe o **dono** da conversa — toda autorização passa por aqui antes de tocar no checkpoint. |
| schema `langgraph` (gerido pela lib) | Mensagens, tool calls, scopes aprovados na conversa, aprovação pendente. |

Não há model Prisma de mensagem: `AiConversation` tem só `id`, `userId`, `title` e timestamps. Os scopes aprovados na conversa vivem no canal `approvedScopes` do estado do grafo, dentro do checkpoint.

Consequências práticas:

- **Sem `createdAt` por mensagem.** O checkpoint guarda timestamp por step, não por mensagem — por isso a UI não exibe horário nas bolhas.
- **Consumo de tokens** não fica em tabela própria: vai no log de auditoria `AI_MESSAGE_SENT` (`metadata.usage`), gravado ao fim de cada turno bem-sucedido.
- **Checkpoint cresce com a conversa** — cada checkpoint guarda o array de mensagens inteiro. Conversa longa ocupa espaço proporcional a turnos × tamanho do histórico; só é liberado ao deletar a conversa. Se virar problema, o lugar de resolver é uma rotina de retenção sobre o schema `langgraph`.
