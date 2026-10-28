---
title: Guia — Criar um módulo frontend (plop)
tags: [guide, frontend]
---

# Guia — Criar um módulo frontend (plop)

Use o gerador **plop**. Ele cria o esqueleto completo da feature e já faz o wiring de i18n, rotas e permissões.

> [!warning] Pré-requisito: o módulo backend já tem que existir e já tem que estar gerado no Orval
> `types.ts` e `api.ts` nascem **já implementados**, importando direto de
> `@/lib/generated/<kebab>/<kebab>` e `@/lib/generated/schemas` — o client que `npm run generate:api`
> cria a partir do `openapi.json` do backend. Se o módulo backend correspondente ainda não existe, ou
> existe mas o client ainda não foi gerado para ele, o módulo frontend nasce com imports quebrados.
> Ordem: [[add-a-module]] (backend) → `openapi:export` → `generate:api` → **então** este gerador.

```bash
cd frontend-next
npm run plop        # escolha "module"
# Nome do módulo (PascalCase): ex. Product
# Área: Admin ou Client
```

## O que o gerador cria

| Arquivo gerado | O que é |
|----------------|---------|
| `src/lib/actions/<kebab>/types.ts` | Reexporta `<Nome>`/`Create<Nome>Dto`/`Update<Nome>Dto` de `@/lib/generated/schemas` (não são tipos à mão) |
| `src/lib/actions/<kebab>/api.ts` | Server Actions já implementadas — chamam o client Orval gerado (`get<Nome>Factory`) |
| `src/lib/actions/<kebab>/queries.ts` | Hooks React Query (useQuery/useMutation) já prontos para o CRUD padrão |
| `src/app/(private)/(<area>)/<kebab>/page.tsx` | Página lista — **Server Component**: composição + gating |
| `src/app/(private)/(<area>)/<kebab>/components/<kebab>-tab.tsx` | Corpo cliente: DataTable, filtros, modais |
| `src/app/(private)/(<area>)/<kebab>/components/<kebab>-columns.tsx` | Colunas do DataTable |
| `src/app/(private)/(<area>)/<kebab>/components/<kebab>-edit.tsx` | Formulário de edição |
| `src/app/(private)/(<area>)/<kebab>/[id]/page.tsx` | Página de detalhe |
| `src/locales/en/<camel>.json` | Tradução inglês |
| `src/locales/pt-BR/<camel>.json` | Tradução português |

## O que o gerador modifica

| Arquivo | O que adiciona |
|---------|---------------|
| `src/lib/translation-utils.ts` | Imports + entradas no objeto `resources` (en e pt-BR) |
| `src/lib/config/performance.config.ts` | Chaves de cache (`CACHE_TIMES` e `GC_TIMES`) |
| `src/lib/types/routepages.types.ts` | Import da api + entrada em `RoutePagesList` (breadcrumb) |
| `src/locales/{en,pt-BR}/labelKey.json` | Chave `ROUTE_<CONSTANTE>` para o label do menu |
| `../backend-nest/prisma/seeds/routes.seed.ts` | `Route.upsert` + permissão de acesso por área (admin/client) |

## Passos obrigatórios depois do plop

O gerado já funciona de ponta a ponta para o shape padrão (`name`/`description`/`isActive`, igual ao
scaffold do backend em [[add-a-module]]). Só mexa em `types.ts`/`api.ts`/`queries.ts` quando a
entidade tiver campos diferentes desse padrão.

1. **Se a entidade tiver campos além do padrão**, ajuste os re-exports em `types.ts` e as chamadas
   em `api.ts`/`queries.ts` de acordo. Ver [[server-actions]] · [[http-client-orval]].
2. **Ajuste as colunas** do DataTable em `<kebab>-columns.tsx` (o gerado mostra `name`/`description`/
   `isActive`/`createdAt`).
3. **Rode o seed** (ou registre a rota manualmente via `/access`) para o menu aparecer.
4. **Adicione as traduções** reais nos JSONs de i18n. Ver [[i18n-frontend]].
5. **Se a feature for opcional** (atrás de feature flag ou de permissão), leia a condição no
   `page.tsx`, que já nasce Server Component — o `serverFeatureFlag()`/`serverCanAccessRoute()`
   mantém fora do browser o que o usuário não pode ver. O template deixa o exemplo comentado.
   Ver [[page-structure]].
6. **Mudou o contrato do backend depois de gerar o módulo?** Regenere o client antes de tocar em
   `api.ts`/`types.ts` de novo:
   ```bash
   cd backend-nest && npm run openapi:export
   cd ../frontend-next && npm run generate:api
   ```

## Estrutura gerada (exemplo: Product, area admin)

```
src/
├── lib/actions/product/
│   ├── types.ts
│   ├── api.ts
│   └── queries.ts
├── app/(private)/(admin)/product/
│   ├── page.tsx                  # RSC — composição e gating
│   ├── [id]/page.tsx             # RSC — busca o registro no servidor
│   └── components/
│       ├── product-tab.tsx       # 'use client' — tabela, filtros, modais
│       ├── product-columns.tsx
│       └── product-edit.tsx
└── locales/
    ├── en/product.json
    └── pt-BR/product.json
```

Ver [[add-a-module]] para criar o módulo backend correspondente.
