---
title: Auth no Frontend
tags: [frontend, auth, security]
---

# Auth no Frontend

Sem token no `localStorage`. A sessão vive em **cookies HttpOnly** setados pelo backend (`access_token` 15 min, `refresh_token` 7 dias — ambos configuráveis por env). Ver [[auth-rbac]].

## Login (proxy via API route do Next)

`src/app/api/auth/login/route.ts` recebe o POST do cliente, chama `POST {API}/auth/login` no backend, e **repassa os `set-cookie`** do backend para o browser. Assim o cookie HttpOnly é definido no domínio do front.

Rotas de auth análogas: `app/api/auth/{login,logout,refresh,cms}`.

## Login por provider externo (OAuth)

Mesmo padrão de proxy, por duas rotas:

- `app/api/auth/oauth/[provider]/start/route.ts` — pergunta a URL de autorização ao backend (server-side, porque `NEXT_PUBLIC_API_URL` pode ser um host interno inalcançável pelo browser) e responde `302` para o provider.
- `app/api/auth/oauth/callback/route.ts` — é o `redirect_uri` registrado no provider. Repassa `code`+`state` ao backend, propaga os `Set-Cookie` e redireciona ao destino (`/redirect` por padrão).
- Se o OAuth exigir consentimento para cadastro/convite, o token de uso único fica em cookie HttpOnly restrito à rota `app/api/auth/oauth/signup/complete`; não é colocado na URL nem enviado ao componente cliente. A rota BFF consome e limpa esse cookie ao concluir o consentimento.
- `app/api/auth/invite/accept/route.ts` encaminha o aceite do convite e repassa o novo cookie de acesso emitido pelo backend após atualizar a role. Assim, o usuário permanece autenticado com as permissões atualizadas.

O callback mora **aqui e não no backend** exatamente pelo motivo da seção acima: o cookie HttpOnly precisa nascer no domínio do front.

Os botões saem de `components/auth/oauth-buttons.tsx`, alimentados por `getOAuthProviders()` na `login/page.tsx`. Lista vazia (feature flag desligada ou provider sem credencial) ⇒ nada é renderizado. Ver [[oauth]].

## Leitura server-side dos tokens

`src/lib/actions/auth/server-auth.ts` (`"use server"`) centraliza cookies:

- `getServerAccessToken()` / `getServerRefreshToken()` — lê o cookie
- `setServerAccessToken()` / `setServerRefreshToken()` — grava (HttpOnly, secure, sameSite lax)
- `getAuthHeaders()` — monta `{ Authorization }`
- `validateRouteAccess(pathname, context)` — carrega o usuário e checa acesso à rota; redireciona p/ `/login` se não autenticado. **Sem uso hoje** (só o próprio teste a referencia): quem guarda as rotas é o middleware

Os nomes dos cookies vêm de `ACCESS_TOKEN_COOKIE_NAME` / `REFRESH_TOKEN_COOKIE_NAME` (default `access_token` / `refresh_token`).

## Middleware (guarda de rotas **e** renovação da sessão)

`src/middleware.ts` roda em toda navegação (exceto assets/`api`):

1. Injeta header `x-pathname` (usado por layouts).
2. Rotas **públicas** passam direto: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/access-denied`, `/admin`, `/legal`, `/mcp`, `/oauth`, `/.well-known` (e tudo abaixo delas), mais a raiz `/` como match exato. `/mcp`, `/oauth` e `/.well-known` são o conector MCP, que traz autenticação Bearer/PKCE própria — ver [[mcp]]. `/admin` é público porque é a rota nativa do Payload, mas navegação direta a ela (documento, não iframe) é redirecionada para `/cms` — ver [[frontend-overview#Payload CMS]].
3. Sem `access_token` **e** sem `refresh_token` → redireciona p/ `/login?callbackUrl=...`.
4. Sem `access_token` mas **com** `refresh_token` → **renova aqui** (via `lib/api/session-refresh.ts`, ver seção abaixo) e segue. Falhou a renovação → `/login?callbackUrl=...&expired=1`, descartando os cookies mortos.
5. Com `access_token` → valida acesso por caminho: `GET {API}/user-route-access/me?path=<pathname>` — o **pathname inteiro**, para o backend poder casar subrota. Ver [[auth-rbac#Route-access (autorização por rota/tela)]].
   - Sucesso (`2xx`): a permissão vem no **corpo** (`true`/`false`).
   - `401`: **token morto, não falta de permissão** — tenta renovar uma vez e repete o check; se ainda assim falhar → `/login?...&expired=1`.
   - `403`, ou corpo `false`: negação real → `/access-denied`.
6. **Fail-open em qualquer outro caso:** `429` do throttler, `5xx`, timeout ou corpo ilegível não bloqueiam ninguém. Já aconteceu de um usuário com permissão cair em `/access-denied` só porque o navegador passou de 100 req/min (polling de pareamento, reconexão de SSE, navegação somada) — tratar falha de infra como negação tranca quem nunca perdeu acesso.

`UNCHECKED_PRIVATE_PATHS` lista as telas privadas que **não** têm linha em `Route` — hoje só `/redirect`, que é despacho: ele resolve a home do usuário e rebate para um caminho que passa pelo check na requisição seguinte. Tela privada nova precisa de uma `Route` cadastrada, senão o middleware a nega.

### Por que a renovação mora aqui

O middleware é o único ponto que roda **server-side, antes de todos os portões** (layout privado, RSC, Server Actions) e ainda consegue escrever cookies na resposta.

Renovar só no cliente não cobre o caso: o layout privado (`app/(private)/layout.tsx`) decide via `isServerAuthenticated()` **antes** de qualquer componente montar. Com o access token vencido e a renovação no cliente, ele manda o usuário ao `/login` e o código capaz de renovar nunca chega a rodar — sessão válida, usuário deslogado.

Ao renovar, o middleware escreve o token novo em **dois lugares**:

- no header `cookie` da própria request, para o RSC deste mesmo render enxergar o token novo (senão leria o cookie antigo, já morto);
- no `set-cookie` da resposta, para o browser guardar.

> ⚠️ Negação de acesso **não** pode redirecionar para `/redirect`: ela é rota privada, reentra no middleware, recebe o mesmo veredito e redireciona para si mesma — `ERR_TOO_MANY_REDIRECTS`. Por isso o destino é `/access-denied`, que é público.

### `null` é o único veredito que não bloqueia

`checkRouteAccess` devolve `{ status, allowed }` em sucesso, `401` e `403` — e `null` para **qualquer outro status ou erro de rede**. Só duas respostas negam de verdade: corpo `false` num `2xx`, ou `403`. Tudo o mais (`429`, `5xx`, timeout) é falha de infra disfarçada de "não", e tratá-la como negação já trancou usuário com permissão fora da aplicação inteira (ver ponto 6 acima).

O menu/telas que o usuário vê vêm de `auth/me` (rotas do papel ∪ rotas do usuário). Modelo em [[data-model]].

## Ponte de sessão: rotas que o navegador chama direto

Cookie HttpOnly significa que o JavaScript do browser não lê o token — o que é um problema sempre que o navegador precisa montar a requisição **sozinho**, sem passar por uma Server Action: `<img src>`, `<audio src>`, upload de arquivo, e qualquer `EventSource` (SSE). `lib/api/session-proxy.ts` resolve isso com uma função só, `proxyWithSession(req, path, { forwardBody })`, usada por toda rota de API do Next que serve esses casos (mídia/upload e SSE da mensageria, SSE do agente de IA).

O que ela faz:

1. Lê o `access_token` do cookie (`getServerAccessToken()`) e repassa a requisição ao backend com `Authorization: Bearer`.
2. `401` do backend → renova pelo mesmo helper do middleware (`lib/api/session-refresh.ts`, ver abaixo), repete a requisição **uma vez** com o token novo, e propaga o `set-cookie` novo na resposta ao navegador.
3. Falha na renovação → `401` limpo ao navegador, sem laço de retentativa.
4. **Corpo em stream nunca é repetido.** `req.body` é um `ReadableStream`; depois de consumido na primeira tentativa (upload, ou POST do agente) não há como relê-lo. Nessas rotas (`forwardBody: true`), um 401 do backend vira 401 direto ao navegador — quem repete é o `Collector`/`Alive()` do lado do cliente, não a ponte.
5. A resposta segue em `backendRes.body` sem buffer — essencial para SSE chegar token a token e para `Range` de mídia/áudio funcionar.

### `session-refresh.ts`: um único renovador, single-flight por token

`lib/api/session-refresh.ts` é o único lugar que chama `POST {API}/auth/refresh` no backend. O middleware, a ponte (`session-proxy.ts`) e a rota `app/api/auth/refresh/route.ts` (a que o `refresh()` do cliente chama) passam todos por ele — nenhum reimplementa a chamada.

A renovação é **single-flight, chaveada pelo valor do `refresh_token`**: N requisições concorrentes com o mesmo token compartilham uma única chamada ao backend em vez de disparar N rotações. A chave não pode ser global — o processo Node atende vários usuários ao mesmo tempo, e um lock global vazaria o token renovado de um usuário para a requisição de outro. Isso é segurança, não otimização: sem o single-flight, N conexões SSE caindo juntas (token expirado) disparam N rotações concorrentes do mesmo refresh token, e a detecção de reuso do backend (ver [[auth-rbac]]) pode derrubar a sessão inteira do usuário.

## Renovação reativa no cliente (single-flight)

A sessão também pode vencer **sem navegação nenhuma**, com o usuário parado na mesma tela. Quem cobre isso é `Alive()` em `lib/api/collector.ts`: ao receber 401 de uma server action, chama `refresh()` e repete a ação uma vez; se a renovação falhar, avisa e desloga.

`refresh()` (`lib/actions/auth/auth-action.ts`) é **single-flight** — uma única promise em voo compartilhada por todos os chamadores. Sem isso, uma página com N queries paralelas dispara N renovações ao expirar, e as perdedoras recebem 401 que o `Alive()` interpretaria como "sessão expirada", deslogando o usuário no meio do uso.

O backend tolera o resto da corrida (outras abas) com a janela de graça da rotação — ver [[auth-rbac]].

Este é um guarda **do browser** (uma promise por aba); a ponte de sessão, acima, tem o seu próprio **no processo do Next** — guardam caminhos diferentes (server action vs. rota chamada direto pelo navegador) e nenhum substitui o outro.

Adicionar uma tela protegida ponta a ponta: [[add-a-protected-route]].
