---
title: Auth & RBAC
tags: [architecture, backend, auth, security]
---

# Auth & RBAC

Autenticação por **JWT**. O token viaja em **cookie HttpOnly** (`access_token`) ou header `Authorization: Bearer`. Dois níveis de autorização convivem: **roles** (papel do usuário) e **route-access** (quais telas/rotas o usuário enxerga).

Duas portas de entrada emitem esses tokens: email/senha (abaixo) e **OAuth/OIDC** (Google, Microsoft, …) — ver [[oauth]]. As duas terminam no mesmo `LoginUseCase`, então daqui para frente a sessão é idêntica.

## Tokens

`modules/auth/use-cases/login.use-case.ts`:

- `access_token` — assinado com `JWT_SECRET`, expira em `JWT_EXPIRES_IN` (default **15 min**).
- `refresh_token` — assinado com `JWT_REFRESH_SECRET`, expira em `JWT_REFRESH_EXPIRES_IN` (default **7 dias**), persistido em `RefreshToken` (Prisma).
- Payload: `{ sub, email, roleId, roleName }` — o refresh carrega também um `jti`, que distingue dois tokens assinados no mesmo segundo (sem ele as strings sairiam idênticas e colidiriam com o `@unique` de `token`).

As duas TTLs são **configuráveis por env**: baixe-as para segundos quando precisar exercitar expiração sem esperar 15 minutos.

`auth.controller.ts` seta ambos como cookie `httpOnly, secure, sameSite: 'lax'`. O `maxAge` sai do `exp` do próprio JWT (`common/utils/jwt-exp.util.ts`) — não há constante duplicada para sair de sincronia com a env.

O cookie do refresh ganha de propósito uma sobrevida (`REFRESH_COOKIE_GRACE_MS`, 1 dia) além do token que carrega. Se os dois morressem juntos, o browser simplesmente esqueceria a sessão e o front não teria como distinguir *"sua sessão expirou"* de *"você nunca entrou"* — o usuário cairia num `/login` mudo. Com a sobrevida, o backend ainda é consultado uma última vez, responde 401, e o usuário é avisado. Ver [[frontend-auth]].

### Rotação do refresh token (e detecção de reuso)

`refresh` **rotaciona**: cada uso emite um sucessor e marca o token apresentado. É o que o OAuth 2.0 Security BCP (RFC 9700 §4.14.2) prescreve para clientes públicos — rotação **e** detecção de reuso juntas.

Implementação em `modules/auth/use-cases/refresh-token.use-case.ts` (`rotate`). Cinco colunas sustentam isso em `RefreshToken`:

| Coluna | Papel |
|---|---|
| `familyId` | a sessão lógica — todos os tokens descendentes de um mesmo login |
| `replacedAt` | quando este token foi rotacionado |
| `replacedById` | o sucessor emitido, devolvido a quem perdeu a corrida |
| `sourceIpHash` / `sourceUaHash` | SHA-256 (`common/utils/request-source.util.ts`) do IP e User-Agent de quem emitiu o token — nunca o valor cru |

**Renovação concorrente é o caso normal, não a exceção:** várias abas, ou várias queries da mesma página, apresentam o mesmo token no mesmo instante. O fluxo trata isso sem derrubar ninguém:

1. Emite o sucessor **antes** de marcar o antigo, para `replacedAt` e `replacedById` serem gravados juntos — nunca existe um estado em que o token está marcado mas o sucessor é desconhecido.
2. Marca o antigo com um **compare-and-swap** (`updateMany where replacedAt: null`): só a primeira requisição concorrente vence.
3. Quem perde descarta o próprio sucessor e devolve o do vencedor — a família converge num token só.
4. Reapresentar um token já rotacionado **dentro** de `REFRESH_REUSE_GRACE_MS` (30s) **e da mesma origem** (IP + User-Agent batem com `sourceIpHash`/`sourceUaHash` do token original) devolve o mesmo sucessor.
5. **Fora** da janela, ou de outra origem, não há explicação legítima: é tratado como vazamento, e a **família inteira é revogada** (401 `auth.token.reuse_detected`).

`logout` também revoga a família, não só a linha apresentada — com rotação, apagar um token só deixaria os sucessores vivos.

Tokens rotacionados continuam no banco até vencerem; a limpeza é do cron diário `refreshTokenClear.task.ts` (ver [[queues-and-jobs]]), que apaga por `expiresAt`.

> ⚠️ Não troque a rotação por "emitir só um access token novo". Some a corrida, mas some junto a detecção de reuso — um refresh token roubado passa a valer pelos 7 dias inteiros sem deixar rastro.

## Validação do token (guard de autenticação)

`JwtAuthGuard` (`modules/auth/guards/jwt-auth.guard.ts`) = `AuthGuard('jwt')`, delega à `JwtStrategy`:

`modules/auth/strategies/jwt.strategy.ts` extrai o token do cookie `access_token` **ou** do header Bearer, e no `validate()`:

1. Carrega o usuário por `sub`, trazendo `roleRecord.name`.
2. Rejeita se o usuário não existe, se `deletedAt != null` ou se `status != ACTIVE`.
3. Retorna `{ id, email, roleId, roleName }` → vira `request.user` (`AuthenticatedUser`).

`roleName` sai de `roleRecord.name`; sem vínculo com `Role`, cai no `roleName` do payload e, na
ausência dele, em `'USER'`.

Acesse o usuário no controller com `@CurrentUser()` (`modules/auth/decorators/current-user.decorator.ts`).

## Roles (autorização por papel)

Papéis: **ADMIN · USER · MODERATOR**. Eles vivem na tabela `Role` (criada pelo seed, `isSystem: true`) e o usuário aponta para uma por `User.roleId`. Os nomes também existem como constante TypeScript em `domain/auth/userRole.const.ts`, para o código referenciá-los sem string solta — **não há enum `UserRole` no Prisma**.

`RolesGuard` (`common/guards/roles.guard.ts`) lê a metadata de `@Roles(...)` e compara com `request.user.roleName`. Não bate → `ForbiddenException`.

Na prática você não usa os guards direto — declara no decorator de rota (ver [[request-lifecycle]]):

```ts
@PostApi({ path: 'invite-token', roles: ['ADMIN'], authenticated: true, ... })
```

> [!warning] Omitir `roles` remove o RolesGuard do pipeline
> `authenticated: true` sem `roles` libera a rota para **qualquer** usuário
> autenticado. Use assim só quando a rota age sobre o próprio requisitante.
> Rota que escreve estado compartilhado exige `roles` explícito.

### Ownership

Para "dono do recurso **ou** admin", use `assertOwnershipOrRole(currentUserId, targetId, roleName)` (`common/utils/ownership.util.ts`). Ex.: `user.controller.ts` em `getById`, `updateProfile`.

## Route-access (autorização por rota/tela)

Modela o menu e o acesso por caminho. Ver [[data-model]]:

- `Route` — árvore de rotas (`path`, `labelKey`, `icon`, `parentId`, `isActive`, `showSideBar`…). `isHome` **não é coluna**: é computado por papel a partir de `SystemConfiguration` (`RoleHomeService`), não do `Route` — ver [[data-model]].
- `RoleRouteAccess` — rotas liberadas para um papel.
- `UserRouteAccess` — rotas liberadas para um usuário específico.

`modules/auth/use-cases/get-user-routes.use-case.ts` **une** as rotas do papel + as do usuário (ativas), deduplicadas. É o que `auth/me` e `auth/login` devolvem para o front montar o menu.

Duas rotas devolvem o menu, e a diferença entre elas é de peso:

| Rota | Devolve | Custo |
|---|---|---|
| `auth/me` | o `AuthenticatedUser` do JWT (`id`, `email`, `roleId`, `roleName`) + menu | não busca o perfil no banco |
| `auth/user` | o perfil completo (`FindOneUserUseCase`) + menu | uma consulta a mais |

Use `auth/me` para sessão e menu — é o caminho quente, chamado a cada navegação. `auth/user` só quando precisar de `name`, `status`, `imageUrl` ou datas.

O frontend valida acesso por caminho chamando `GET /user-route-access/me?path=` (usado no middleware — ver [[frontend-auth]]).

### Subrotas: o caminho mais específico decide

`Route` é uma **árvore** (`parentId`), e o `path` do filho é o caminho completo — `/area` → `/area/detalhe`. `CheckAccessUseCase` recebe o **pathname inteiro** e resolve assim:

1. Monta os prefixos do mais específico ao mais genérico: `/a/b/c`, `/a/b`, `/a`.
2. Busca todos de uma vez (`path: { in: [...] }` — uma consulta, não uma por nível).
3. A **primeira linha encontrada** decide, e ninguém olha acima dela.

As duas consequências que importam:

- **Subrota não herda o pai.** Ter `/area` não libera `/area/detalhe` se essa linha existe e não foi concedida — nem `isActive: false` nela é contornável subindo um nível.
- **Segmento dinâmico cai no ancestral.** `/user/<uuid>` não tem linha própria, então quem decide é `/user`. É o que mantém as telas de detalhe funcionando sem cadastrar um `Route` por registro.

> [!warning] Rota pai é uma tela de verdade
> Não existe nó só-de-agrupamento: o item pai da sidebar é um link para o `path` dele. Ver [[add-a-protected-route#Subrota]].

### Contrato dos dois módulos de acesso

Ambos tratam o vínculo como recurso de **chave composta**, e põem operação em massa na raiz com query param — o desenho e o porquê estão em [[api-conventions]].

| Operação | `role-route-access` | `user-route-access` |
|---|---|---|
| Conceder | `POST /role-route-access` | `POST /user-route-access` |
| Listar | `GET /role-route-access` | `GET /user-route-access?userId=` |
| Ler um vínculo | `GET /role-route-access/:roleId/:routeId` | — |
| Consultar o próprio acesso | — | `GET /user-route-access/me?path=` |
| Remover um vínculo | `DELETE /role-route-access/:roleId/:routeId` | `DELETE /user-route-access/:userId/:routeId` |
| Remover todos | `DELETE /role-route-access?roleId=` | `DELETE /user-route-access?userId=` |

O query param dos deletes em massa é validado com Zod: ausente vira `where: { campo: undefined }` no Prisma, que apagaria a tabela inteira.

> [!warning] `GET /role-route-access/role/:roleId` ainda é sub-rota de dois segmentos
> Funciona só porque está declarado **antes** de `:roleId/:routeId`. Mover a
> declaração quebra silenciosamente. Os specs de roteamento de cada módulo
> (`*.routing.spec.ts`) travam esses matches.

### Teto de código: RouteCeilingRegistry

Route-access e roles de controller eram dois eixos independentes: nada impedia o ADMIN de conceder uma `Route` a um papel cujos controllers a rejeitam — ex.: liberar `/logging` para `USER` quando `LoggingController` só aceita `roles: ['ADMIN', 'MODERATOR']`, dando acesso à tela sem acesso ao dado que ela mostra.

`RouteCeilingRegistry` (`common/infrastructure/route-ceiling/`, `@Global()`, mesmo padrão do `CapabilityRegistry` — ver [[capabilities]]) fecha esse buraco: um registro em memória de `path → allowedRoles`, populado em código, não no banco. Cada módulo dono de uma tela restrita declara o teto no próprio `onModuleInit`, ex. `LoggingRouteCeiling` em `modules/logging/logging.route-ceiling.ts` registra `/logging` → `['ADMIN', 'MODERATOR']`. Path sem registro devolve `[]` (sem teto).

`CreateRoleRouteAccessUseCase` e `GrantAccessUseCase` (user-route-access) chamam `registry.allowedRolesFor(route.path)` e `isRoleAllowedForRoute` (`common/utils/route-roles.util.ts`) antes de gravar, rejeitando com `ForbiddenException` quando o papel está fora do teto. `FindByRoleUseCase` (grade da tela por papel, `/access`) e `FindAllRoutesWithUserAccessUseCase` (grade por usuário, `/user/:id?tab=access`) fazem o mesmo filtro na leitura: a rota fora do teto do papel (do papel em si, ou do papel do usuário dono da grade) nem aparece na lista — não só fica com o toggle desabilitado.

A checagem mora no **use-case**, não num guard de controller: `grant_role_route_access`/`grant_user_route_access` (AI tools) chamam o use-case direto e pulariam um guard.

Por que registry e não coluna no banco: o teto já existe em código, no `roles: [...]` do controller — uma coluna `Route.allowedRoles` obrigaria declarar o mesmo valor duas vezes (controller e seed), podendo divergir sem aviso. O registry mantém uma declaração só. `FindByRoleUseCase`/`FindAllRoutesWithUserAccessUseCase` buscam as rotas no Prisma (sem o teto na query, já que ele não é coluna) e filtram em memória antes de paginar.

Ao registrar uma `Route` para uma tela cujos endpoints usam `roles: [...]`, crie um `<modulo>.route-ceiling.ts` (`OnModuleInit`) no módulo dono e adicione-o aos `providers` — ver [[add-a-protected-route]]. Hoje têm teto: `/logging` (`ADMIN`, `MODERATOR`), `/cms` (`ADMIN`, `MODERATOR`), `/user`, `/access`, `/settings`, `/feature-flags`, `/comunicacao`, `/comunicacao/templates` (`ADMIN`). As demais rotas seguem sem teto até serem revisadas.

`/cms` é o caso sem `@Roles` num controller: `CmsController.getCredentials` é só `authenticated: true` — quem decide é `CheckCmsAccessUseCase`, que já fazia a verificação de route-access e agora também chama `isRoleAllowedForRoute` com o teto do registry antes de liberar. É o papel que, nas demais rotas, o guard do REST endpoint cumpriria.

## Login por provider externo (OAuth/OIDC)

`auth/oauth/*` — fluxo authorization-code genérico via OpenID Connect Discovery, gateado pela feature flag `OAUTH_LOGIN`. O usuário é resolvido por e-mail verificado (sem tabela de identidades). Para e-mail desconhecido, o callback nunca cria conta: com `SYSTEM_USER_CREATE` e a capability `EMAIL` operacionais, inicia um consentimento explícito de cadastro; a criação acontece somente após aceite dos termos. O token transitório de consentimento é mantido em cookie HttpOnly restrito à rota BFF de conclusão, nunca na URL. Veja [[oauth]].

Detalhes de fluxo, state, configuração e como adicionar um provider: [[oauth]].

## Cadastro e confirmação de e-mail

- Cadastro autônomo é controlado por `SYSTEM_USER_CREATE`, cuja dependência existente é a capability `EMAIL`. Quando habilitado, o cadastro por senha envia link de confirmação de uso único via `EmailService.send()` (fila quando habilitada); emissões concorrentes para o mesmo e-mail são serializadas por um lock consultivo transacional do PostgreSQL e respeitam cooldown. Esse lock funciona como uma fila temporária por e-mail: uma requisição conclui a verificação/criação da intenção antes de outra requisição para o mesmo endereço, evitando links duplicados. A conta `USER` só nasce após a confirmação e o aceite dos termos.
- O cadastro por provider requer uma identidade OIDC válida e confirmação explícita de criação/termos, sem e-mail de confirmação adicional. A verificação criptográfica do token do provider é obrigatória.
- `SYSTEM_USER_CREATE=false` fecha apenas cadastro autônomo. Um convite administrativo válido continua permitindo a criação da conta com a role definida no convite.
- Convites são credenciais bearer mantidas apenas como hash na linha vigente. O ADMIN recebe o novo link na emissão; listagens nunca retornam `actionUrl` ou hash. Reemissão invalida o link anterior; se renderização/envio falhar, o estado anterior do convite é restaurado.
- Conta já existente precisa autenticar antes de aceitar convite; somente a sessão cujo e-mail corresponde ao convidado pode receber a role do convite. Após a mudança, o backend atualiza o cookie de acesso para refletir a role sem forçar logout.

## Reset de senha & convites

- `PasswordResetToken` (hash + expiração) alimenta `forgot-password` / `reset-password`.
- Convites: `auth/invite-token` (ADMIN gera) → `auth/accept-invite`. O envio do convite é síncrono para que falhas sejam reportadas imediatamente; confirmações de cadastro e reset de senha usam a fila (ver [[queues-and-jobs]]).

O convite carrega uma **role**: é o que diferencia o convidado de um cadastro comum. Na tela do convite (`/signup?inviteToken=`), conta nova pode ser criada por senha ou provider OAuth; conta existente precisa autenticar. No fluxo OAuth, o e-mail precisa estar verificado e corresponder ao convidado. Ver [[oauth]].

## Rotas sensíveis: rate limit

Endpoints de auth sobrescrevem o throttler global com `@Throttle`: login/reset `5/min`, forgot-password `3/min`. Ver [[observability]].
