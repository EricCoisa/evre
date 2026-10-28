---
title: OAuth / OIDC (login social)
tags: [backend, auth, oauth, oidc, feature-flags]
---

# OAuth / OIDC (login social)

Login por provider externo (Google, Microsoft, Okta, Keycloak, Auth0, GitLab…) com **uma única
implementação**: o fluxo é OpenID Connect authorization-code puro, e o provider entra por
configuração — não por código.

Ligado/desligado pela feature flag `OAUTH_LOGIN`. Credenciais em `/settings` → aba **Login Social
(OAuth)**. Ver [[auth-rbac]] para o resto da autenticação e [[frontend-auth]] para o lado do browser.

## Por que é agnóstico

Todo provider relevante publica `/.well-known/openid-configuration`. `OidcDiscoveryService`
(`modules/auth/oidc-discovery.service.ts`) busca e valida metadados do issuer, authorization/token
endpoints e JWKS URI — cache Redis por issuer. O ID token é validado com `jose` usando chaves JWKS,
issuer, audience/`azp`, expiração e nonce. Nada no fluxo é específico de um provider: não há
`passport-google-oauth20`, `passport-microsoft` nem strategy por provider.

Um provider é, portanto, só três valores: **issuer**, **client id**, **client secret**.

## O fluxo

```
/login ou /signup ─submit + CAPTCHA─▶ POST /api/auth/oauth/[provider]/start (Next)
                   └─▶ POST /auth/oauth/:id/authorize-url      (Nest)  → { url } + state assinado
                302 ─▶ accounts.google.com | login.microsoftonline.com | …
                302 ─▶ GET /api/auth/oauth/callback?code&state  (Next)   ← redirect_uri registrado
                   └─▶ POST /auth/oauth/callback                (Nest)
                         verifica state → troca code → valida assinatura/claims do id_token
                         → autentica conta existente ou devolve consentimento pendente
                /signup ─ consentimento + termos + CAPTCHA ─▶ POST /auth/oauth/signup/complete
                         cria conta/aceita convite → LoginUseCase → Set-Cookie
                repassa Set-Cookie ─302─▶ callbackUrl (ou /redirect)
```

### Por que o callback cai no frontend

O `redirect_uri` é `{NEXTAUTH_URL}/api/auth/oauth/callback` — **o domínio do front**, não o do backend.
Mesmo motivo do proxy de login em `app/api/auth/login/route.ts`: o cookie HttpOnly precisa nascer no
domínio que o browser navega, e em produção `NEXT_PUBLIC_API_URL` costuma ser um host interno
(`http://backend:3001`) que o browser nem alcança.

`NEXTAUTH_URL` é a URL pública do front — a mesma que os e-mails transacionais usam
(`request-password-reset.use-case.ts`). O fluxo OAuth não introduz variável de ambiente própria.

### O `state`

JWT assinado com `JWT_SECRET`, validade de 10 min, carregando `provider`, `callbackUrl` e `nonce`.
Sem Redis e sem sessão no backend — mas **não sem cookie**: ver a seção abaixo.

Três detalhes de segurança que moram nesse token:

- **`sub` fixo `'oauth-state'`** — se alguém reapresentar o state como `access_token`, a `JwtStrategy`
  procura esse id em `users`, não acha e devolve 401.
- **`purpose: 'oauth_state'`** — o callback recusa qualquer JWT sem essa claim.
- **`callbackUrl` validado na assinatura, não no consumo** — `oauth-authorize-url.use-case.ts` descarta
  destino absoluto ou protocol-relative (mesma regra do `safeCallbackUrl` do front). Como o state é
  assinado por nós, validar uma vez na entrada basta.

O `nonce` vai junto na URL de autorização e é conferido contra o `nonce` do `id_token` no callback.

### O cookie `oauth_state` (login CSRF)

**Um state assinado, sozinho, não protege contra login CSRF** — e é um engano fácil de cometer, porque
o token é imprevisível. O ponto é que o atacante não precisa adivinhá-lo: ele **gera um legítimo**.

O ataque, sem o cookie:

1. O atacante inicia o fluxo no seu app e recebe um `state` S válido.
2. Autentica no provider com a própria conta; o provider redireciona com `code` C e o mesmo S.
3. O atacante interrompe o redirect e guarda o par (C, S) — os dois ainda válidos.
4. Induz a vítima a abrir `/api/auth/oauth/callback?code=C&state=S`.
5. Assinatura ✓, `purpose` ✓, `nonce` do `id_token` bate com o de S ✓ — e a **vítima é logada na conta
   do atacante**, passando a alimentar com seus dados uma conta que o atacante lê depois.

O `nonce` não cobre isso: ele amarra `id_token`↔`state`, não `state`↔browser. É o RFC 6749 §10.12.

A defesa é amarrar o state ao user agent que iniciou o fluxo, com um cookie companheiro
(`src/lib/oauth-state-cookie.ts`):

- `start/route.ts` extrai o `state` da URL de autorização e grava `oauth_state` — `httpOnly`,
  `sameSite: 'lax'`, `path=/api/auth/oauth`, 10 min.
- `callback/route.ts` compara query × cookie **antes** de qualquer chamada ao backend, e expira o cookie
  em todos os caminhos (o state é consumido uma vez só).

A URL forjada chega ao browser da vítima sem o cookie correspondente ⇒ o callback morre em
`/login?error=oauth` sem trocar o code.

> **Por que no Next e não no Nest:** o `authorize-url` responde para o axios do servidor Next, não para
> o browser — um `Set-Cookie` do backend nunca chegaria ao usuário. Quem enxerga o cookie do browser é
> o BFF. O backend segue com suas próprias checagens (assinatura, `purpose`, `nonce`); as duas camadas
> se somam.

> `lax` e não `strict`: o callback chega por navegação top-level vinda do provider, e um cookie
> `strict` não seria enviado nesse redirect cross-site.

### Validação do ID token

Mesmo recebido diretamente do token endpoint, o ID token é validado criptograficamente. Discovery
precisa fornecer issuer e JWKS URI; `jose` valida assinatura e claims (`iss`, `aud`, `azp` quando
aplicável, `exp`). O callback também exige subject, nonce correspondente ao state e
`email_verified === true`; claim ausente ou não verificada é rejeitada.

## Login e cadastro

O vínculo é por e-mail verificado, sem tabela de identidades. `User.salt` e `User.hash` são nullable,
portanto conta OAuth não recebe senha local artificial.

| Situação | O que acontece |
|---|---|
| Email já existe, usuário ativo | Loga |
| Email já existe, `deletedAt` ou status ≠ `ACTIVE` | 401 |
| Email desconhecido no login | Não cria conta no callback. Se cadastro autônomo está disponível, encaminha para consentimento explícito; se não, erro genérico |

Cadastro autônomo via provider obedece `SYSTEM_USER_CREATE` e à dependência existente da capability
`EMAIL`. A interface pergunta se a pessoa quer continuar com o provider e criar a conta; somente após
essa confirmação e o aceite dos termos o backend consome a intenção de uso único e cria uma conta
`USER`. O provider prova a identidade/e-mail; não há confirmação adicional por email. A persistência
comum é `RegisterUseCase`, que copia `roleRouteAccess` e registra o cadastro.

> Precisa de mais de uma identidade por usuário, ou de um IdP sem email verificado? Aí sim vale uma
> tabela `UserIdentity (provider, providerUserId, userId)`.

### Convites

Na tela do convite (`/signup?inviteToken=...`) uma conta nova pode usar senha ou provider; conta já
existente precisa autenticar antes de aceitar. Em ambos os casos o e-mail deve corresponder ao
convidado e a role vem da linha de convite vigente.

O convite viaja com o fluxo:

1. O botão do provider leva o `inviteToken` para `/api/auth/oauth/[provider]/start`.
2. O `authorize-url` **valida o convite ali, na entrada** — token inválido, expirado ou já usado nem
   chega a mandar o usuário para o provider — e assina no state o e-mail, o id e o hash do token atual,
   nunca o token bearer.
3. Na volta, o callback compara esse email com o que o provider confirmou. **Diferente ⇒ recusa**
   (`auth.invite.email_mismatch`).
4. Bateu: a pessoa confirma o aceite e os termos; a role sai da linha `Invite` e a intenção/convite são
   consumidos atomicamente antes de emitir a sessão.

> **Hash do token, nunca o token bearer, vai no state.** O state viaja na URL até o provider, e o token do convite
> é credencial ao portador válida por 2 dias que concede uma role — expô-lo aos logs do IdP, ao
> histórico e ao referrer seria pior que o link do email, que ao menos não passa por terceiros. O email
> não é credencial: para conseguir um state com ele, é preciso apresentar um convite válido no passo 2.

Fora desse fluxo nada é promovido: um login OAuth comum não olha convite nenhum. Um convite novo pode
ser concluído por senha após validar o link ou por provider com e-mail verificado; uma conta existente
só recebe role com sessão autenticada de e-mail correspondente. Reemitir convite troca o hash e invalida
os links anteriores.

#### Ordem e concorrência

Se o convite expirar, for consumido ou reemitido antes do consentimento, a conclusão falha sem criar
conta nem alterar role. A intenção de consentimento e o convite são consumidos por compare-and-set
dentro da mesma transação que cria a conta ou aplica a role; `LogActions.ACCEPT_INVITE` registra o
aceite.

Emitidos os tokens, quem assina é o `LoginUseCase` de sempre — mesmo access/refresh, mesma persistência
de `RefreshToken`, mesmo log de `LOGIN`. Não existe caminho de sessão paralelo.

## A feature flag `OAUTH_LOGIN`

As três rotas são anônimas e usam `@RequireFeature('OAUTH_LOGIN')`. Isso funciona porque o
`FeatureFlagGuard` avalia com `request.user?.roleName ?? ''` e `evaluate()` devolve `true` quando a flag
está `enabled` e **não tem allowlist de roles**.

> ⚠️ **Não associe roles a esta flag.** Com allowlist, a avaliação anônima resolve `false`, o botão some
> do `/login` e as rotas passam a devolver 404 — o login acontece *antes* da autenticação, então não há
> role para casar. O `description` da flag no seed diz isso.

Flag desligada ⇒ 404 em tudo (não 403: não vaza que o endpoint existe), o `/login` recebe lista vazia e
não desenha nada, e a aba de settings some. Ver [[feature-flags-backend]].

## Configuração

Seis chaves `SystemConfiguration` semeadas em `prisma/seeds/system-config.seed.ts`, três por provider:

| Chave | Valor semeado | Secret |
|---|---|---|
| `SYSTEM_OAUTH_GOOGLE_ISSUER` | `https://accounts.google.com` | não |
| `SYSTEM_OAUTH_GOOGLE_CLIENT_ID` | vazio | não |
| `SYSTEM_OAUTH_GOOGLE_CLIENT_SECRET` | vazio | **sim** |
| `SYSTEM_OAUTH_MICROSOFT_ISSUER` | `https://login.microsoftonline.com/common/v2.0` | não |
| `SYSTEM_OAUTH_MICROSOFT_CLIENT_ID` | vazio | não |
| `SYSTEM_OAUTH_MICROSOFT_CLIENT_SECRET` | vazio | **sim** |

Os secrets são gravados criptografados (`CryptoService`) — ver [[system-configuration]].

**Um provider só aparece no `/login` quando issuer + client id + client secret estão os três
preenchidos** — é o `configured` de `GET /auth/oauth/providers`. Permite ao admin preparar as
credenciais sem expor o botão pela metade; a aba de administração lista os dois estados com um badge.

> A rota é anônima e devolve também os não configurados, então o nome dos providers suportados é
> público. São só `id` e `label` — nada sensível, e uma vez configurado o botão revelaria o mesmo.

No Microsoft, restringir o login a uma organização é trocar `common` pelo tenant no issuer — sem chave
extra, sem código.

## O que é validado antes de gravar

`SaveOauthConfigUseCase` só persiste depois de duas checagens contra o provider real — mesmo princípio
dos providers de email, storage e IA ([[ai]]): a tela de configuração de qualquer módulo falha do mesmo
jeito, exibindo a mensagem que o provider devolveu (`ProviderResult` → `assertProviderOk` →
[[error-handling]]).

| # | Checagem | Quem faz | Falha ⇒ |
|---|---|---|---|
| 1 | O **issuer** existe, responde e publica authorization/token endpoint | `OidcDiscoveryService.discover()` | `503` com o issuer no texto |
| 2 | O par **clientId + clientSecret** é aceito pelo provider | `OAuthProviderService.use(...).validateConfiguration()` | `400` com a mensagem do provider |

### Como o clientId/secret é verificado

Nenhum provider expõe um endpoint "confira estas credenciais". O que existe é o próprio RFC 6749: o
token endpoint **autentica o cliente antes de olhar o `code`**. Então a sonda troca um `code`
deliberadamente inválido e lê só o tipo do erro:

| Resposta | Significa |
|---|---|
| `invalid_client` · `unauthorized_client` | credencial recusada ⇒ **falha** |
| qualquer outro erro (`invalid_grant`, …) | o cliente foi autenticado ⇒ **passa** (o `code` é que não presta, como esperado) |

Os dois providers registrados caem nessa regra sem nada específico:

| Provider | clientId errado | clientSecret errado |
|---|---|---|
| Google | `invalid_client` (*The OAuth client was not found*) | `invalid_client` (*Unauthorized*) |
| Microsoft | `unauthorized_client` (AADSTS700016) | `invalid_client` (AADSTS7000215) |

> Por isso **uma** implementação atende Google e Microsoft — e qualquer IdP compatível. Especialize por
> `tokenEndpoint` só se algum provider futuro divergir desses códigos.

O teto continua sendo "o provider aceita estas credenciais": um login de verdade também depende do
`redirect_uri` estar cadastrado, e isso só um round-trip completo prova. `configured` significa
"issuer responde + credenciais aceitas", não "o login com certeza vai funcionar".

### A dica do campo issuer é por provider

O issuer é o campo que mais varia: o Microsoft aceita tenant no lugar de `common`, o Google tem um valor
único. Uma dica só para os dois mandaria metade da instrução para quem não precisa dela, então a tela
procura `system_oauth_issuer_desc_<id>` (`..._google`, `..._microsoft`) e cai em
`system_oauth_issuer_desc` — genérica — quando o provider não tem uma.

Mesma convenção derivada-do-id dos grupos e descrições de tools ([[ai-tools]]): **provider novo não
exige tocar no componente**, só a chave nova se valer a pena. Sem ela, a dica genérica aparece.

## A URL de redirecionamento na tela

A aba de configuração mostra o `redirect_uri` a cadastrar no provider já **resolvido**, não como
placeholder. O valor sai de `window.location.origin` — é o domínio do **frontend**, pela mesma razão da
seção [Por que o callback cai no frontend](#por-que-o-callback-cai-no-frontend): quem serve
`/api/auth/oauth/callback` é o Next, não o Nest.

Lido do `window` de propósito, e não de mais uma env var pública: uma variável a mais sairia de
sincronia com a URL que o admin realmente está acessando — justo o valor que ele precisa copiar. No
servidor o equivalente é `NEXTAUTH_URL`, que é o que `oauthRedirectUri()` usa na troca do code.

## Endpoints

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/auth/oauth/providers` | anônima | Providers registrados: `[{ id, label, configured }]`. Nunca devolve credencial |
| `PUT` | `/auth/oauth/:provider/config` | ADMIN | Valida e grava issuer + clientId + clientSecret (`SaveOauthConfigUseCase`) |
| `POST` | `/auth/oauth/:provider/authorize-url` | anônima + CAPTCHA | `{ url }` para redirecionar o browser. 404 se o provider não está configurado |
| `POST` | `/auth/oauth/callback` | anônima | Body `{ code, state }`. Login existente seta cookies; identidade nova devolve intenção pendente |
| `POST` | `/auth/oauth/signup/complete` | anônima + CAPTCHA | Consome consentimento/termos, cria ou aceita convite e emite cookies |

As quatro rotas anônimas têm `@RequireFeature('OAUTH_LOGIN')`; início, callback e conclusão têm
throttling próprio. `PUT .../config` não passa pela flag (é tela de administração, `roles: ['ADMIN']`),
só pela checagem de credencial descrita em [O que é validado antes de gravar](#o-que-é-validado-antes-de-gravar).

## Arquivos

| Arquivo | O que faz |
|---|---|
| `src/domain/auth/oauthProvider.const.ts` | Registro dos providers, nomes das chaves, `redirect_uri`, constantes do state |
| `src/modules/auth/oidc-discovery.service.ts` | `/.well-known/openid-configuration` + cache Redis 24 h |
| `src/modules/auth/oauth-provider.service.ts` | Valida clientId/secret no token endpoint (`IOAuthProvider`) |
| `src/domain/interface/oauth-provider.interface.ts` | Contrato de validação, espelhando `IAiProvider` |
| `src/modules/auth/use-cases/oauth-providers.use-case.ts` | Fonte única da lista; lê as `SYSTEM_OAUTH_*` e decide quem está utilizável |
| `src/modules/auth/use-cases/oauth-authorize-url.use-case.ts` | Monta a URL de autorização e assina o state |
| `src/modules/auth/use-cases/oauth-callback.use-case.ts` | state → code → ID token verificado → login ou consentimento pendente |
| `src/modules/auth/use-cases/signup.use-case.ts` | Intenções de cadastro/convite de uso único e conclusão após consentimento |
| `src/modules/auth/use-cases/save-oauth-config.use-case.ts` | Valida issuer + credenciais e grava as 3 chaves |
| `src/modules/auth/dto/oauth.dto.ts` | DTOs de request/response |
| `frontend-next/src/lib/oauth-state-cookie.ts` | Nome e opções do cookie que amarra o state ao browser |
| `frontend-next/src/app/api/auth/oauth/[provider]/start/route.ts` | POST protegido por CAPTCHA, pede URL ao backend e grava `oauth_state` |
| `frontend-next/src/app/api/auth/oauth/callback/route.ts` | `redirect_uri`; confere o state × cookie, redireciona consentimento sem cookies ou repassa sessão |
| `frontend-next/src/app/api/auth/oauth/signup/complete/route.ts` | Repasse do consentimento protegido e cookies HttpOnly |
| `frontend-next/src/components/auth/oauth-buttons.tsx` | Botões de login/cadastro/convite; inicia POST protegido e não aparece com lista vazia |
| `frontend-next/src/app/(private)/(admin)/settings/components/oauth-config-tab.tsx` | Aba de credenciais |

## Como adicionar um provider

Nenhuma mudança no fluxo, e **nenhuma no frontend** — só cadastro.

1. **Registro** — `src/domain/auth/oauthProvider.const.ts`, adicione `{ id: 'OKTA', label: 'Okta' }` em
   `OAuthProviders`.
2. **Seed** — `prisma/seeds/system-config.seed.ts`, três chaves `SYSTEM_OAUTH_OKTA_{ISSUER,CLIENT_ID,CLIENT_SECRET}`
   (a de secret com `secret: true`).
3. **No provider** — registre o redirect `{NEXTAUTH_URL}/api/auth/oauth/callback` e habilite os escopos
   `openid email profile`.
4. Preencha as credenciais em `/settings` → **Login Social (OAuth)** — a aba passa a listar o provider
   novo sozinha.
5. *(Opcional)* Dica de issuer própria: `system_oauth_issuer_desc_<id em minúsculo>` em
   `src/locales/{en,pt-BR}/settings.json` — ver abaixo.

O `OAuthProviders` do backend é a **única fonte da lista**. O front consome
`GET /auth/oauth/providers` nos dois lugares onde precisa dela (login e administração), então não há
constante para manter em sincronia — nem como esquecer de atualizá-la.

## Ligar em um ambiente

1. No Google Cloud Console / Entra ID / etc., registre o redirect `{NEXTAUTH_URL}/api/auth/oauth/callback`.
2. `/settings` → **Login Social (OAuth)** → Client ID e Client Secret. A tela mostra o redirect exato a
   cadastrar, e o save só passa se o provider aceitar as credenciais (ver
   [O que é validado antes de gravar](#o-que-é-validado-antes-de-gravar)).
3. Confirme que a flag `OAUTH_LOGIN` está ligada **e sem roles** em `/feature-flags`.
4. O botão aparece no `/login`.

## Testes

- `oauth-authorize-url.use-case.spec.ts` — `redirect_uri`, nonce assinado batendo com o da URL, e a
  rejeição de `callbackUrl` absoluto/protocol-relative.
- `oidc-discovery.service.spec.ts` — assinatura válida, assinatura inválida, issuer/audience/expiração
  divergentes e `azp` inconsistente para múltiplas audiences.
- `oauth-callback.use-case.spec.ts` — login existente, consentimento para nova conta/convite, state
  com purpose errado, nonce divergente, `email_verified` falso, usuário inativo, e o `redirect_uri` da
  troca do code.
- `oauth-provider.service.spec.ts` — a sonda do token endpoint: `invalid_grant` passa, `invalid_client`
  e `unauthorized_client` recusam, endpoint inacessível vira erro legível, e o corpo enviado
  (client id/secret + `redirect_uri`).
- `save-oauth-config.use-case.spec.ts` — provider desconhecido, issuer que não responde, secret em
  branco sem nada guardado, credencial recusada pelo provider, e o caminho feliz gravando as 3 chaves.
- `test/auth.e2e-spec.ts` — as três rotas respondendo sem autenticação com a flag ligada.
- `frontend-next/src/app/api/auth/oauth/callback/callback.route.test.ts` — repasse de cookies e os
  caminhos de erro.
