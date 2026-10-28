---
title: Guia — Adicionar uma rota protegida
tags: [guide, backend, frontend, auth]
---

# Guia — Adicionar uma rota protegida

Há **dois** eixos de proteção — geralmente você usa os dois. Conceitos em [[auth-rbac]].

## 1. Proteger o endpoint (backend)

Declare auth no decorator de rota — sem `UseGuards` manual:

```ts
// só autenticado
@GetApi({ path: 'me/orders', authenticated: true, ... })

// autenticado + papel específico
@PostApi({ path: 'orders', roles: ['ADMIN'], authenticated: true, ... })
```

- `authenticated: true` → exige JWT válido (`JwtAuthGuard`).
- `roles: [...]` → exige papel (`RolesGuard`).
- `scope: '...'` → escopo exigido quando a requisição vem de API key ([[api-key]]).
- `pageSource: {...}` → libera o endpoint como fonte de dados de bloco do [[page-builder]]. Opcional e default-off: sem ele, o endpoint é invisível para essa feature.
- Dono-ou-admin: chame `assertOwnershipOrRole(user.id, targetId, user.roleName)` no handler.

Pegue o usuário com `@CurrentUser()`. Ver [[request-lifecycle]].

## 2. Proteger a tela (frontend + route-access)

O acesso por **tela** é orientado a dados: o usuário só vê rotas em `RoleRouteAccess` (do seu papel) ∪ `UserRouteAccess` (dele). Ver [[data-model]].

1. **Registre a `Route`** (path, label, ícone, `parentId`, `isActive`) — via endpoints de `RouteModule`/tela de acesso, ou seed. Se os endpoints que a tela consome usam `roles: [...]`, declare o mesmo teto no `RouteCeilingRegistry`: crie `<modulo>.route-ceiling.ts` (`OnModuleInit`, mesmo padrão de `logging.route-ceiling.ts`) registrando `this.routeCeilings.register('/sua-rota', [...])` e adicione a classe aos `providers` do módulo dono — é o teto de quem pode receber a rota via `RoleRouteAccess`/`UserRouteAccess` (ver [[auth-rbac#Teto de código: RouteCeilingRegistry]]).
2. **Conceda acesso:**
   - a um papel → `POST /role-route-access/...`
   - a um usuário → `POST /user-route-access` (`{ userId, routeId }`)
3. **Crie a página** em `src/app/(private)/(admin)/<feature>/page.tsx` (ou `(client)/`). O middleware já bloqueia quem não tem acesso, validando `GET /user-route-access/me?path=<pathname>`. Ver [[frontend-auth]].

O caminho da tela deve casar com o `path` da `Route`. O backend casa a rota cadastrada **mais específica** que cobre a URL, então `/pedidos/rascunhos` é decidido pela própria linha se ela existir, e por `/pedidos` se não existir.

### Subrota

Para pendurar a tela sob outra, o `path` do filho é o caminho **completo** (o path do pai + o segmento novo) e `parentId` aponta a linha do pai:

```ts
const pedidos = await prisma.route.upsert({
  where: { path: '/pedidos' },
  update: {},
  create: { path: '/pedidos', labelKey: 'ROUTE_ORDERS', icon: 'Package', ordem: 3 },
});

await prisma.route.upsert({
  where: { path: '/pedidos/rascunhos' },
  update: {},
  create: {
    path: '/pedidos/rascunhos',
    labelKey: 'ROUTE_ORDERS_DRAFTS',
    icon: 'FileEdit',
    parentId: pedidos.id,
    ordem: 1,
  },
});
```

A página vive em `src/app/(private)/(admin)/pedidos/rascunhos/page.tsx`. A sidebar aninha o filho num colapso e o breadcrumb vira *Pedidos › Rascunhos* sozinho — ver [[frontend-overview#Rotas em árvore]]. Conceda acesso ao filho **explicitamente**: ele não herda o do pai.

> [!warning] Rota pai é uma tela de verdade
> Não existe nó de agrupamento sem página: o item pai da sidebar é um link para o `path` dele. Precisa de um grupo puro? Aponte o pai para a tela de entrada da área.

## 3. Proteger o que a tela mostra

Middleware e backend cuidam de *entrar* na tela e de *chamar* o endpoint. O que a tela **exibe**
— uma aba, um botão, um atalho para outra rota — é decidido no `page.tsx`, que é Server
Component, com `serverFeatureFlag()` / `serverCanAccessRoute()`. Assim o elemento não chega ao
browser em vez de chegar escondido. Ver [[page-structure#Gating é decisão do servidor]].

## 4. Consumir

Exponha a chamada via Server Action (`src/lib/actions/<feature>/`) usando o client gerado. Ver [[server-actions]] · [[http-client-orval]].
