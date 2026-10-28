---
title: Feature Flags (frontend)
tags: [frontend, feature-flags, react-query, hooks]
---

# Feature Flags (frontend)

Consome `GET /feature-flags/me` e expõe a mesma decisão nos dois lados: `serverFeatureFlag()` em Server Components e `useFeatureFlag()` em Client Components. Ver [[feature-flags-backend]] para a lógica de avaliação e endpoints.

> **Escolha primeiro o lado.** Flag que decide **se um elemento existe** (uma aba, uma rota, um bloco) é leitura de servidor — ver [[page-structure#Gating é decisão do servidor]]. Os hooks abaixo são para flag que muda o **comportamento** de algo que o usuário já pode ver.

## Arquivos

| Arquivo | O que faz |
|---------|-----------|
| `frontend-next/src/lib/actions/feature-flag/types.ts` | Tipos (reexportados do Orval): `FeatureFlag` (`category`, `isSystem`, `parentId`, `roles: { id, roleId, role: { name } }[]`), DTOs |
| `frontend-next/src/lib/actions/feature-flag/api.ts` | Server actions (`getMyFeatureFlags`, CRUD) |
| `frontend-next/src/lib/actions/feature-flag/queries.ts` | Hooks React Query |
| `frontend-next/src/lib/server-context.ts` | `serverFeatureFlags()` / `serverFeatureFlag(key)` — leitura em RSC, deduplicada por request |
| `frontend-next/src/components/feature.tsx` | Componente `<Feature>` |
| `frontend-next/src/app/(private)/(admin)/feature-flags/page.tsx` | Tela de administração |

## Em Server Component (preferido para gating)

```tsx
import { serverFeatureFlag, serverFeatureFlags } from '@/lib/server-context';

export default async function MyPage() {
  const enabled = await serverFeatureFlag('MINHA_FLAG');   // uma flag

  const flags = await serverFeatureFlags();                // várias
  const outra = flags['OUTRA_FLAG'] ?? false;

  return enabled ? <MeuComponente /> : null;
}
```

Com a flag desligada, `MeuComponente` não entra no payload RSC — nem markup, nem referência
de componente, nem o bundle dele. É a diferença entre **não existir** e **estar escondido**.

Ambos são embrulhados em `cache()` do React: layout, sidebar e página leem o mesmo mapa e o
backend é chamado uma vez por request. Vale dentro da request apenas — flag alterada aparece na
navegação seguinte.

## Hooks (Client Components)

### `useMyFeatureFlags()`

```ts
import { useMyFeatureFlags } from '@/lib/actions/feature-flag/queries';

const { data } = useMyFeatureFlags();
// data: Record<string, boolean> | undefined
```

QueryKey: `['feature-flags-me']`. Avaliado por role do usuário logado, servido por `GET /feature-flags/me`.

### `useFeatureFlag(key)`

```ts
import { useFeatureFlag } from '@/lib/actions/feature-flag/queries';

const isEnabled = useFeatureFlag('MINHA_FLAG'); // boolean, default false
```

Wrapper sobre `useMyFeatureFlags()` — retorna `data?.[key] ?? false`.

## Componente `<Feature>`

```tsx
import { Feature } from '@/components/feature';

<Feature flag="MINHA_FLAG">
  <MeuComponente />
</Feature>

// Com fallback:
<Feature flag="MINHA_FLAG" fallback={<Alternativo />}>
  <MeuComponente />
</Feature>
```

Internamente chama `useFeatureFlag(flag)` — portanto **só vale dentro de Client Component**. Em
RSC ele esconde sem proteger (o `children` já viajou no payload); lá a forma é
`{enabled && <X />}` com `serverFeatureFlag()`. Props:

| Prop | Tipo | Padrão |
|------|------|--------|
| `flag` | `string` | — |
| `children` | `ReactNode` | — |
| `fallback` | `ReactNode` | `null` |

## Mutations (admin)

Todos os hooks de mutação (`useCreateFeatureFlag`, `useUpdateFeatureFlag`, `useDeleteFeatureFlag`, `useSetFeatureFlagRoles`) usam `Alive()` internamente — ele faz `toast.error` e lança em caso de falha.

Os quatro compartilham o mesmo `onSuccess` (`useFeatureFlagSync`), que invalida as duas queries
**e** chama `router.refresh()`. O refresh não é opcional: o que a flag esconde em Server
Component (abas, balão do agente) veio no payload RSC e não reage a invalidação de query. Ver
[[page-structure#Mudou o dado: como a tela server-side reage]].

**Padrão obrigatório nos callers:**

```ts
try {
  await createFlag.mutateAsync(data);
  toast.success('Criado!');
} catch {
  // Alive já exibiu o toast de erro
}
```

Não checar `res.success` — `mutateAsync` retorna o dado diretamente ou lança.

## Tela de administração

Rota: `/feature-flags` (grupo `(private)/(admin)`)

Funcionalidades:
- Lista flags com `DataTable` (paginação local); flags com `parentId` aparecem em árvore (indentação + colapsar/expandir), filtráveis por `category` e por status; coluna de roles exibe badges por role
- Criar / editar via `FormBuilderModal` (inclui categoria e flag-pai)
- Gerenciar roles por flag via `RolesDialog`: checkboxes com "Selecionar todas" no topo
- Deletar com confirmação via `ConfirmDialog`

## i18n

Namespace: `feature-flags` — arquivos em:
- `frontend-next/src/locales/pt-BR/feature-flags.json`
- `frontend-next/src/locales/en/feature-flags.json`

Chave de rota no menu: `ROUTE_FEATURE_FLAGS` em `labelKey.json`.
