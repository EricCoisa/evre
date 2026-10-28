---
title: Frontend — Overview
tags: [frontend]
---

# Frontend — Overview

Next.js 16 (**App Router**) + React 19, em `frontend-next/`. Renderiza as telas e embute o **Payload CMS**. Fala com o backend NestJS via Server Actions + cliente tipado (Orval).

## Route groups (`src/app/`)

| Grupo | Papel |
|-------|-------|
| `(payload)/` | Payload CMS: admin em `/admin`, API própria em `/api/[...slug]` (schema `payload`) |
| `(private)/(admin)/` | Telas administrativas (protegidas) — ex.: `user`, `access`, `logging`, `settings`, `dashboard`, `cms` |
| `(private)/(client)/` | Área do usuário comum (protegida) — ex.: `home` |
| raiz (`login`, `signup`, `forgot-password`, `reset-password`, `page/`) | Páginas públicas de auth |
| `app/api/` | Route handlers do Next (proxy de auth, health, public-proxy) |

Acesso às áreas `(private)` é guardado pelo middleware — ver [[frontend-auth]].

## Anatomia de uma tela

```
(admin)/<feature>/
├── page.tsx            # Server Component — decide o que existe na tela e monta a composição
├── [id]/               # detalhe/edição (também RSC: busca o registro no servidor)
└── components/         # Client Components da feature (interação, tabelas, formulários)
```

Dados vêm de Server Actions (`src/lib/actions/<feature>/`) — ver [[server-actions]].

O `page.tsx` ser RSC não é detalhe de performance: é onde feature flag e permissão são lidas,
para que o que o usuário não pode ver não chegue ao browser. Ver [[page-structure]].

## Camadas de suporte (`src/`)

| Pasta | Papel |
|-------|-------|
| `lib/actions/` | Server Actions — a ponte para o backend |
| `lib/server-context.ts` | `serverMe()` / `serverFeatureFlags()` — o que o servidor sabe do usuário desta request, deduplicado por `cache()` |
| `lib/route-tree.ts` | Menu e navegação a partir de `user.routes` — ver abaixo |
| `lib/generated/` | Client tipado do Orval (gerado; não editar) |
| `lib/api/` | Instâncias/wrappers HTTP — ver [[http-client-orval]] |
| `components/ui/` | Primitivos (Radix + Tailwind + shadcn) |
| `components/form/` | Form builder e campos |
| `components/*.tsx` | Componentes compartilhados entre telas — ver abaixo |
| `contexts/` | Providers React (auth, query, tema, breadcrumb…) |
| `locales/` | i18n (`en/`, `pt-BR/`) |

### Componentes compartilhados

`src/components/ui/` é shadcn puro (não editar à mão). O que está um nível acima, em
`src/components/`, é a composição que o app repete de tela em tela. Antes de escrever markup novo,
procure aqui — estes são os que mais reaparecem:

| Componente | Papel |
|---|---|
| `container.tsx` | Moldura de bloco/card das telas (`variant`, `padding`, `border`) |
| `sub-nav-layout.tsx` | `<SubNavLayout>` — navegação por abas com sidebar (desktop) e drawer (mobile), `?tab=` na URL; é o padrão usado hoje pelas telas com abas — ver [[page-structure]] |
| `tabs-shell.tsx` | Casca mínima de `<Tabs>` com só o `?tab=`, sem sidebar — mesma ideia do `SubNavLayout` para uma lista de abas simples |
| `ui/langLabel.tsx` | Rótulo traduzido usável dentro de RSC (`t()` não roda no servidor) |
| `config-row.tsx` | Linha título + descrição + controle (`ConfigRow`/`ConfigList`); `wide` dá a linha inteira ao controle |
| `switch-field.tsx` | `SwitchField` — switch com label; empilhado ou `inline` |
| `system-configuration.tsx` · `base-configuration.tsx` | Campo ligado a uma chave de config, salvando sozinho — ver [[system-configuration]] |
| `resource-search.tsx` | `<ResourceSearch>` — busca global no header (rotas, abas, config rows, botões); resultado com âncora navega e destaca o alvo via `lib/hash-target.ts` |
| `form/form-builder.tsx` | Formulário a partir de um schema Zod — ver [[i18n-frontend]] para as mensagens |
| `rich-text-input.tsx` | Campo rich text compartilhado pelos chats do agente e da mensageria; serializa a formatação na sintaxe WhatsApp e mantém espaços entre palavras sem estilo |

> Componente com regra de negócio embutida fica fora dessa lista de propósito (`feature-flag-switch.tsx`
> dispara a própria mutation, por exemplo) — reusá-lo fora do contexto dele traz a mutation junto.

## Rotas em árvore

`user.routes` chega **plano** do backend, cada item com `parentId` e um `path` que já é o caminho
completo (`/area/detalhe`). Quem transforma isso em navegação é `lib/route-tree.ts`, e as
três telas que usam rota consomem só ele:

| Função | Quem usa | O que devolve |
|---|---|---|
| `buildRouteTree(routes)` | `app-sidebar.tsx` (RSC) | Árvore aninhada por `parentId`, ordenada por `ordem` em cada nível |
| `breadcrumbTrail(routes, pathname)` | `breadcrumb-nav.tsx` | Um crumb por segmento da URL, resolvido pelo **prefixo acumulado** |
| `matchRoute(routes, pathname)` | `page-title.tsx` | A rota cadastrada mais específica que cobre o pathname |

Nenhuma delas conhece nome de tela: tudo sai do `path` e do `parentId` que o seed gravou.

**Sidebar** (`sidebar-nav.tsx`): item com filhos ganha um botão de colapso ao lado do link. O link
continua navegando para o `path` do pai — não existe nó de agrupamento sem tela. Entrar na subárvore
reabre o grupo; o botão continua mandando enquanto o usuário fica nela. No modo ícone os filhos
somem junto com o rótulo.

**Breadcrumb** (`breadcrumb-nav.tsx`): cada segmento vira o prefixo acumulado até ele (`/area`,
depois `/area/detalhe`). Segmento sem `Route` correspondente é tratado como `[id]`: o nome
é buscado pela entrada de `lib/types/routepages.types.ts` cujo `path` casa com o **prefixo do pai**,
e todas essas buscas saem num `useQueries` só. Sem entrada configurada, o rótulo é o próprio
segmento. O último nome resolvido também alimenta o `BreadProvider`, que é de onde o `PageTitle` lê.

Para cadastrar uma subrota, ver [[add-a-protected-route#Subrota]]; a regra de acesso está em
[[auth-rbac#Subrotas: o caminho mais específico decide]].

## TanStack Query — instância por request no servidor

`getQueryClient()` (`lib/queryClient.ts`) devolve uma instância **nova a cada chamada no servidor** e um
**singleton no navegador** (`isServer` do próprio `@tanstack/react-query`). Um singleton de módulo no
servidor seria compartilhado entre requests concorrentes de usuários diferentes — o cache de uma chave
sensível (ex.: `['me']`) vazaria de um usuário para outro. `QueryClientProvider`
(`contexts/query-provider.tsx`) chama essa função a cada render.

## Payload CMS

Config em `frontend-next/payload.config.ts`: adapter `@payloadcms/db-postgres` (schema **`payload`**, mesmo Postgres do backend), editor Lexical, storage S3 para mídia, plugin SEO. Coleções em `src/collections/` (ex.: `Home`, `Media`). O admin do Payload é servido em `/admin` pelo route group `(payload)`, mas o uso normal é embutido num iframe dentro de `app/(private)/(admin)/cms/page.tsx` (rota `/cms`): `POST /api/auth/cms` grava o cookie de sessão do Payload antes do iframe montar, e tema/idioma são sincronizados por `postMessage`. Navegação direta a `/admin` (nova guia, barra de endereço) é redirecionada para `/cms` pelo `middleware.ts` — ver [[frontend-auth]].

**Separação de schemas:** o backend usa o schema `public`, o Payload usa o schema `payload` — no mesmo banco PostgreSQL, sem conflito de tabelas.

**Migrations do Payload** são gerenciadas separadamente das migrations Prisma:

```bash
cd frontend-next
npm run payload:migrate          # aplica migrations pendentes
npm run payload:migrate:create   # cria nova migration após alterar coleções
npm run payload:migrate:down     # reverte a última migration
```

**Adicionar uma coleção:**

1. Crie `src/collections/<Nome>.ts` com a definição Payload.
2. Registre em `payload.config.ts` → array `collections`.
3. Gere e aplique a migration: `payload:migrate:create` → `payload:migrate`.
4. Personalize componentes admin em `src/payload-components/` se necessário.

**Sincronização de usuários:** o backend mantém credenciais em `public.users`. O `CmsModule` (`/cms`) faz a ponte de autenticação com o Payload — login no Payload usa o mesmo email/senha do backend via `PayloadUserRepository` (raw SQL em `payload.users`).

## i18n

`i18next` + `react-i18next` (`frontend-next/i18n.ts`). `fallbackLng: 'en'`; locale default vem de `next-i18next.config.cjs`. Traduções por área em `src/locales/{en,pt-BR}/*.json`. Independente do i18n do backend ([[i18n]]).
