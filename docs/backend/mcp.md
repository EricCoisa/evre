---
title: MCP — conector remoto (Claude Desktop, ChatGPT) e Authorization Server OAuth
tags: [mcp, oauth, ai, integração]
---

# MCP — conector remoto

O backend implementa o servidor MCP; o **front** o expõe. Uma única URL —
`https://<app>/mcp`, no domínio do frontend — é colada em Claude Desktop →
Configurações → Conectores, ou em ChatGPT → Conectores, e o cliente faz todo o resto
sozinho: se registra, abre o login do app, pede as permissões e conecta.

Não há chave para copiar, arquivo de configuração para editar nem pacote para buildar.

> ⚠️ O endereço do backend **nunca** sai para o cliente. O front publica `/mcp`,
> `/oauth/*` e `/.well-known/*` no seu próprio domínio e faz proxy — mesmo motivo do
> proxy em `app/api/auth/login`. Além de não vazar o endereço, é requisito do
> protocolo: o `issuer` dos metadados tem de casar byte-a-byte com a origem que o
> cliente acessou, então anunciar o backend quebraria o fluxo.
>
> ⚠️ **Claude Desktop e ChatGPT recusam `http://`.** Em desenvolvimento, exponha o
> front por um tunnel https (Cloudflare, ngrok) e cole `https://<tunnel>/mcp` — não
> é preciso configurar nada: a origem pública é detectada por request (ver abaixo).

> Fonte: `backend-nest/src/modules/mcp/` e `frontend-next/src/lib/api/mcp-proxy.ts`

## Remoto (HTTP), não stdio

O transporte é **Streamable HTTP**, e não existe pacote de servidor stdio neste repositório.
Um endpoint HTTP atende Claude Desktop, ChatGPT e Claude Code com a mesma URL
(`claude mcp add --transport http <nome> https://<app>/mcp`), sem build local, sem editar
`claude_desktop_config.json` e sem API key colada à mão. É também o único caminho que serve o
ChatGPT, que só consome MCP remoto por URL.

## Tools expostas

Nenhuma própria: o endpoint serve o **ToolRegistry** do agente in-app. Toda classe anotada com
`@AiToolDef` aparece no MCP sem código adicional, com o mesmo filtro de role e as mesmas revogações
por usuário de `/profile?tab=agentPermissions`. Conte quantas são com
`find backend-nest/src -name '*.tool.ts' -not -name '*.spec.ts' | wc -l`.

Criar uma tool nova para o MCP = criar uma `@AiTool`. Ver [[ai-tools]].

## Fluxo de conexão

```
cliente                 front (proxy)        backend              usuário
  │                          │                   │                    │
  ├─ POST /mcp ─────────────>├──> /api/v1/mcp ──>│                    │
  │<─ 401 + WWW-Authenticate ┤<──────────────────┤  resource_metadata=…
  ├─ GET /.well-known/oauth-protected-resource ─>│
  ├─ GET /.well-known/oauth-authorization-server >│
  ├─ POST /oauth/register ──>├──────────────────>│  DCR (RFC 7591)
  ├─ abre /oauth/authorize ─>├──────────────────>│
  │                          │  302 → /profile/connect ───────────>│ login + consentimento
  │                          │<── POST /oauth/authorize/consent ───┤
  │<─ redirect_uri?code=…&state=… ───────────────┤                    │
  ├─ POST /oauth/token ─────>├──────────────────>│  code + verifier (PKCE)
  │<─ access_token + refresh_token ──────────────┤                    │
  ├─ POST /mcp + Bearer ────>├──────────────────>│  tools/list, tools/call
```

O `401` com `WWW-Authenticate: Bearer resource_metadata="…"` (RFC 9728 §5.1) é o gatilho de
tudo. Sem esse header o cliente só reporta "falha de conexão" e nunca tenta autenticar.

Revisões de protocolo negociadas em `MCP_PROTOCOL_VERSIONS` (`2025-11-25`, `2025-06-18`,
`2025-03-26`, `2024-11-05`): o `initialize` devolve a versão do cliente quando a
conhecemos, senão puxa para a mais nova.

### A origem pública vem do request

Os metadados não podem anunciar `localhost`: quem chama o `registration_endpoint` e o
`token_endpoint` é um servidor **remoto** (Anthropic, OpenAI), e `localhost` para ele é
a máquina dele. O sintoma é o cliente dizendo *"não foi possível registrar no serviço
de login"* depois de um discovery que respondeu 200.

Só que o backend, recebendo pelo proxy, vê apenas o host interno. Então quem sabe o
domínio público é o front — e ele o informa a cada request no header
`x-mcp-public-origin` (derivado de `X-Forwarded-Host`/`Host`, preservando a porta).
O backend valida e usa (`appPublicUrl(req)`); `NEXTAUTH_URL` é só o fallback de quando
a requisição não veio pelo proxy.

Resultado: **nenhuma configuração**. O mesmo código serve `localhost:3000`, um tunnel
e produção ao mesmo tempo, cada um anunciando a si mesmo — e o consentimento cai
sempre na origem em que o fluxo começou, o que é obrigatório para a sessão valer.

Depois de aprovar os scopes, a tela mostra uma confirmação; o usuário precisa continuar
para o cliente para entregar o authorization code e concluir a conexão. O botão Cancelar,
antes da aprovação, retorna a `/profile?tab=connectors` sem emitir code.

Na aba Conectores a URL vem de `window.location.origin`, pelo mesmo motivo: o usuário
está olhando a página no exato domínio que vai colar no cliente.

### Agnóstico por construção

Não existe lista de providers conhecidos no código. Qualquer cliente que fale OAuth 2.1 +
DCR + PKCE conecta — Claude Desktop, ChatGPT, Cursor, Claude Code ou o que vier depois.
As `redirect_uris` chegam no registro dinâmico e são validadas por forma, não por origem:

| Forma | Aceita | Por quê |
|---|---|---|
| `https://…` | ✅ | caso geral (Claude, ChatGPT) |
| `http://localhost…`, `http://127.0.0.1…` | ✅ | listener local (Claude Code) — OAuth 2.1 §2.3.1 |
| `http://` em qualquer outro host | ❌ | code em texto claro na rede |
| `cursor://…` e outros schemes de app nativo | ✅ | padrão de app nativo |
| qualquer uma com `#fragmento` | ❌ | RFC 6749 §3.1.2 |

No `/authorize` a `redirect_uri` é comparada por **match exato** com as registradas — é a
defesa real contra desviar o code para terceiro.

### Login e consentimento

A tela de consentimento é o front, em `/profile/connect`
(`frontend-next/src/app/(private)/profile/connect/page.tsx`). Fica sob `/profile` de
propósito: o middleware já exige sessão e, como não há linha em `Route` para
`/profile/connect`, o check cai no ancestral `/profile`, liberado a todos os roles
(ver [[auth-rbac#Subrotas: o caminho mais específico decide]]). Resultado — o login do conector **é** o login do app: senha ou qualquer
provider social configurado (ver [[oauth]]), sem fluxo duplicado.

O pedido pendente trafega pelo browser como JWT de 10 min assinado com um segredo derivado
(`JWT_SECRET` + sufixo próprio), não como linha no banco: ninguém está autenticado ainda
naquele ponto, então persistir deixaria a tabela aberta a lixo de qualquer visitante. O
sufixo garante que esse token seja estruturalmente impossível de apresentar como sessão.

## Endpoints

| Método | Path (no front) | Auth | O quê |
|---|---|---|---|
| `GET` | `/.well-known/oauth-protected-resource[/mcp]` | — | RFC 9728 |
| `GET` | `/.well-known/oauth-authorization-server` | — | RFC 8414 |
| `POST` | `/oauth/register` | — | DCR (RFC 7591), throttle 10/min |
| `GET` | `/oauth/authorize` | — | valida e redireciona ao consentimento |
| `GET` | `/oauth/authorize/request` | — | dados que a tela de consentimento mostra |
| `POST` | `/oauth/authorize/consent` | JWT | usuário aprova → emite o code |
| `POST` | `/oauth/token` | — | `authorization_code` e `refresh_token` |
| `POST` | `/oauth/revoke` | — | RFC 7009 |
| `POST` | `/mcp` | Bearer | JSON-RPC 2.0 (MCP Streamable HTTP) |
| `GET`/`DELETE` | `/mcp` | Bearer | `405` / `204` — sem SSE, sem sessão |

Cada um é proxy fino para o mesmo caminho sob `/api/v1` no backend. Os `.well-known`
vão para a **raiz** dele, fora do prefixo (via `exclude` no `setGlobalPrefix`, em
`main.ts`): os RFCs ancoram esses documentos na raiz do host e nenhum cliente procura
em `/api/v1/.well-known/…`.

Handlers: `app/mcp/route.ts`, `app/oauth/[...segments]/route.ts`,
`app/.well-known/[...segments]/route.ts`, todos sobre `lib/api/mcp-proxy.ts`.

Os três caminhos entram em `PUBLIC_PATHS` do `middleware.ts`. Sem isso o middleware
redirecionaria o cliente MCP para `/login` e ele receberia HTML no lugar do 401 que
inicia o fluxo — é exatamente o sintoma "nenhum servidor respondeu a esta URL". Quem
autentica esses caminhos é o Bearer/PKCE do OAuth, não o cookie de sessão; só
`/profile/connect` exige login.

E, para a aplicação (aba Conectores, via client Orval):

| Método | Path | Auth | O quê |
|---|---|---|---|
| `GET` | `/api/v1/mcp-connections[/endpoint]` | JWT | lista conexões / URL a colar |
| `DELETE` | `/api/v1/mcp-connections/:id` | JWT | revoga uma conexão |

## Scopes

Mesmo vocabulário das API keys (`McpScopes`, em `src/domain/api-key/mcp-scopes.const.ts`).
**Leitura não exige scope**; toda tool de escrita declara `approvalScope` e só roda se o
usuário aprovou aquele scope no consentimento. Sem o scope, o `tools/call` devolve um
resultado `isError` dizendo qual scope falta — não um erro de protocolo, porque o modelo
precisa ler a explicação para se corrigir.

Três camadas independentes barram uma tool, nesta ordem: role do usuário → revogação
individual em `/profile?tab=agentPermissions` → scope aprovado na conexão.

A tela de consentimento nunca marca um checkbox de scope que o cliente não pediu: um
scope pré-marcado concederia acesso de escrita sem escolha do usuário.

## Tokens

| Token | Formato | TTL | Onde vive |
|---|---|---|---|
| authorization code | `mcpac_…` | 5 min, **uso único** | `oauth_grants.codeHash` |
| access token | `mcpat_…` | 1 h | `oauth_grants.accessHash` |
| refresh token | `mcprt_…` | 30 d, rotaciona a cada uso | `oauth_grants.refreshHash` |

Access token é **opaco e guardado como hash**, não JWT: um JWT assinado com o `JWT_SECRET`
da sessão seria aceito pela `JwtStrategy` e viraria sessão completa, furando os scopes.
Mesmo padrão de `ApiKey.keyHash` (ver [[api-key]]).

Uma conexão = uma linha em `oauth_grants`. Revogar zera os três hashes de uma vez, e o
token em uso morre na requisição seguinte.

## Configuração

Não há variável nova, e **nenhuma precisa ser ajustada para trocar de domínio**: a
origem pública é detectada por request (ver acima). `NEXTAUTH_URL` só entra como
fallback quando a requisição não passa pelo proxy do front.

O proxy alcança o backend por `API_URL` (ou `NEXT_PUBLIC_API_URL`), que é interno e
nunca aparece numa resposta.

**Feature flag `MCP_CONNECTORS`** liga o conector. Flag ausente ou desabilitada ⇒
`/api/v1/mcp` responde **404** e a aba Conectores desaparece do perfil. Ela é criada pelo
`prisma/seed.ts` — em base já existente, rode o seed (ou crie a flag em `/feature-flags`),
senão o conector fica invisível sem erro aparente.

## Erros comuns

| Sintoma | Causa |
|---|---|
| Claude Desktop: "Nenhum servidor respondeu a esta URL" | URL `http://` (só aceita https), ou os caminhos fora de `PUBLIC_PATHS` no middleware — aí o cliente recebe HTML do `/login` em vez do 401 |
| "Não foi possível registrar no serviço de login" | discovery respondeu, mas anunciou um endereço que o servidor do cliente não alcança. Confira `x-mcp-public-origin`: se o proxy à frente não repassa `X-Forwarded-Host`/`Host`, os metadados caem no fallback `NEXTAUTH_URL` |
| Cliente alcança a URL mas nunca abre login | `/.well-known/*` inacessível, ou o header `WWW-Authenticate` descartado por algum proxy no caminho |
| `502` em `/mcp` ou `/oauth/*` | o front não alcança o backend: `API_URL`/`NEXT_PUBLIC_API_URL` errado |
| `/api/v1/mcp` responde 404 com token válido | flag `MCP_CONNECTORS` ausente/desabilitada |
| `invalid_request: redirect_uri não confere` | cliente registrou uma URI e usou outra — reconecte para forçar DCR novo |
| `invalid_grant: code_verifier não confere` | PKCE quebrado no cliente |
| Tool de escrita devolve "exige o scope X" | scope não aprovado no consentimento — reconecte marcando o scope |
| Tool não aparece no `tools/list` | role do usuário não permite, ou foi revogada em `/profile?tab=agentPermissions` |

## Implementação

```
backend-nest/src/modules/mcp/
├── mcp.controller.ts             # POST /mcp (JSON-RPC), GET 405, DELETE 204
├── mcp.service.ts                # initialize / tools/list / tools/call → ToolRegistry
├── mcp-auth.guard.ts             # Bearer → user + scopes; 401 com WWW-Authenticate
├── mcp-token.service.ts          # gera/valida/rotaciona tokens opacos
├── mcp-discovery.controller.ts   # /.well-known/* (fora do prefixo)
├── mcp-oauth.controller.ts       # register / authorize / token / revoke
├── mcp-connections.controller.ts # aba Conectores
├── oauth-error.ts                # erro no formato RFC 6749 + filter
└── use-cases/                    # register-client, authorize, exchange-token, connections

frontend-next/src/
├── lib/api/mcp-proxy.ts                    # proxy compartilhado (headers, 302, 502)
├── app/mcp/route.ts                        # /mcp
├── app/oauth/[...segments]/route.ts        # /oauth/*
├── app/.well-known/[...segments]/route.ts  # /.well-known/*
├── app/(private)/profile/connect/page.tsx  # tela de consentimento
└── app/(private)/profile/components/connectors-tab.tsx
```

Sem `@modelcontextprotocol/sdk` no backend: o SDK existe para gerenciar sessões, SSE e
notificações server→client, e um servidor só de tools não tem o que empurrar ao cliente.
Streamable HTTP em modo stateless é JSON-RPC 2.0 no POST — três métodos e um switch. Se um
dia precisar de `notifications/tools/list_changed`, é aí que o SDK passa a valer o peso.

Ver também: [[ai-tools]] (criar tools), [[api-key]] (o outro canal de acesso programático),
[[oauth]] (login social, que o consentimento reusa), [[auth-rbac]] (roles e route-access).
