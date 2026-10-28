---
title: Feature Flags (backend)
tags: [backend, feature-flags, redis, guard]
---

# Feature Flags (backend)

Módulo para controle de funcionalidades em runtime sem redeploy. Avaliação por papel (role), cache Redis, e um guard que retorna 404 (não 403) para esconder que a feature existe.

Arquivo do módulo: `backend-nest/src/modules/feature-flag/feature-flag.module.ts`

## Flag × capability

Feature flag é **rollout de dev** — existe/não existe ainda, independente de quem está logado ou do
que está configurado. É binário e não tem noção de "configurado mas quebrado": uma flag ligada é
ligada. Para "configurado e respondendo" (credencial válida, provider no ar), o padrão é
[[capabilities]], que opera num eixo diferente: `available` (flag) **esconde**, `operational`
(configuração/saúde) **desabilita**. Uma capability pode exigir uma flag ligada antes de rodar seu
check — os dois compõem, não competem.

## Semântica de avaliação (3 estados)

| `enabled` | `roles` associados | Resultado |
|-----------|-------------------|-----------|
| `false` | qualquer | **OFF para todos** (kill-switch) |
| `true` | nenhum | **ON para todos** (inclui chamadas sem role, como cron e webhook) |
| `true` | lista de roles | **ON somente para os roles listados** |

Flag sem roles é global e devolve `enabled` sem filtrar por papel. Para restringir acesso, associe as
roles permitidas; para um kill-switch global, desligue a flag. Não associe roles a flags avaliadas
por chamadas anônimas ou de sistema, pois `roleName` vazio não corresponde a uma allowlist.

### Hierarquia por `parentId`

Uma flag pode apontar para outra via `parentId`. A avaliação exige que a própria flag e todos os
ancestrais estejam habilitados; portanto, desligar o pai desliga as filhas. A allowlist de roles é
avaliada em cada nível. Ciclos e cadeias acima do limite configurado são recusados pelo service.

Exemplo: `MESSAGING_CONTACTS` e `MESSAGING_CHAT` são filhas de `MESSAGING`. As flags-filhas podem
ser ligadas/desligadas separadamente, mas nenhuma funciona enquanto o pai estiver desligado.

A avaliação é feita por `FeatureFlagService.evaluateForRole(roleName)`.

## Endpoints

| Método | Rota | Guard | Descrição |
|--------|------|-------|-----------|
| `GET` | `/feature-flags` | ADMIN + scope `feature-flags:read` | Lista todas as flags com roles |
| `GET` | `/feature-flags/:id` | ADMIN | Busca uma flag por ID |
| `GET` | `/feature-flags/me` | autenticado | Retorna `Record<string, boolean>` para o usuário logado |
| `POST` | `/feature-flags` | ADMIN | Cria uma flag |
| `PATCH` | `/feature-flags/:id` | ADMIN | Atualiza `key`, `description` ou `enabled` |
| `DELETE` | `/feature-flags/:id` | ADMIN | Remove a flag |
| `PATCH` | `/feature-flags/:id/roles` | ADMIN | Substitui a lista de roles da flag |

## FeatureFlagService — avaliação e cache

O service guarda só o que o `FeatureFlagGuard` consome. O CRUD mora em
`use-cases/` e é injetado direto pelo controller e pelas ai-tools (ver [[use-cases]]).

```ts
// Record<flagKey, boolean> para o roleName do usuário (usa cache Redis)
evaluateForRole(roleName: string): Promise<Record<string, boolean>>

// Avalia uma flag específica para o roleName
isEnabled(key: string, roleName: string): Promise<boolean>

// A lista cacheada, compartilhada com a avaliação
findAll(): Promise<FeatureFlagWithRoles[]>

// Público: os use-cases de escrita derrubam o cache
invalidate(): Promise<void>
```

Cache Redis: chave `feature-flags:all`, TTL 300 s. Todo use-case de escrita
(`create`, `update`, `remove`, `set-roles`) chama `invalidate()` no fim.

## Guard `@RequireFeature`

```ts
import { RequireFeature, FeatureFlagGuard } from '@/modules/feature-flag/feature-flag.guard';

@Get('minha-rota')
@UseGuards(JwtAuthGuard, FeatureFlagGuard)
@RequireFeature('MINHA_FLAG')
async minhaRota() { … }
```

> [!warning] A ordem dos decorators decide se o guard funciona
> O `FeatureFlagGuard` lê `request.user.roleName`, que só existe depois da autenticação.
> Guards registram **na ordem de aplicação dos decorators, do mais próximo do método para
> fora** — então, num handler que usa os wrappers de rota, o `@UseGuards(FeatureFlagGuard)`
> tem de ficar **acima** do `@GetApi`/`@PostApi`. Invertido, ele roda antes da autenticação,
> `request.user` é `undefined` e toda flag com allowlist de roles responde 404.
>
> ```ts
> @UseGuards(FeatureFlagGuard)      // ← acima
> @RequireFeature('AI_AGENT')
> @PostApi({ path: '...', authenticated: true })
> async handler() {}
> ```
>
> Exemplos: `ai.controller.ts` e `page-builder.controller.ts`.

- Retorna **404 NotFoundException** (não 403) quando a flag está desabilitada para o role do usuário.
- Motivo: esconde que o endpoint existe para quem não tem acesso.
- Deve ser usado **depois** de guards de autenticação.

## Modelos Prisma

Definidos em `backend-nest/prisma/schema/feature-flag.prisma`:

```
FeatureFlag          — id, key (único), description?, enabled, parentId?, createdAt, updatedAt
FeatureFlagRole      — id, featureFlagId, roleId — único por (featureFlagId, roleId)
```

Ver [[data-model]] para o contexto completo.

## LogModule

Flag: `FEATURE_FLAG` — definida em `backend-nest/src/domain/logging/logModule.const.ts` e no enum Prisma `LogModule` em `base.prisma`.

Rota de menu: `featureFlagsRoute` (ordem 9, path `/feature-flags`).

## Como adicionar uma nova flag

1. Crie via admin (`POST /feature-flags`) ou insira diretamente no banco.
2. Opcionalmente associe um `parentId` para herdar o kill-switch de uma flag pai.
3. Associe roles via admin (`PATCH /feature-flags/:id/roles`) somente se o recurso precisar de allowlist; sem roles, a flag é global.
4. Proteja um endpoint com `@RequireFeature('MINHA_FLAG')` — ver seção Guard acima.
5. No frontend, use `useFeatureFlag` ou `<Feature>` para condicionais de UI — ver [[feature-flags-frontend]].
