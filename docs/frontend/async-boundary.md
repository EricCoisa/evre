---
title: Loading e Erro — AsyncBoundary
tags: [frontend, convenção, react-query, suspense]
---

# Loading e Erro — AsyncBoundary

**Regra:** nenhum componente escreve `if (isLoading)` nem `if (error)`. Quem responde "e enquanto o dado não chega?" é um `<AsyncBoundary>` acima na árvore.

Arquivo: `frontend-next/src/components/async-boundary.tsx`

## O mecanismo

`AsyncBoundary` é a composição de três coisas nativas, nesta ordem:

```
QueryErrorResetBoundary   ← limpa o erro no cache (TanStack), habilita o retry
  └─ ErrorBoundary        ← captura o throw, mostra ErrorState
       └─ Suspense        ← captura a suspensão, mostra o skeleton
```

Não existe `queryKey` nele. O boundary não sabe qual query está embaixo, e o componente que busca não sabe que existe boundary acima. É esse desacoplamento que torna a solução global: dá para envolver qualquer trecho, de uma linha a uma página inteira.

```tsx
<AsyncBoundary>
  <QualquerCoisaQueBusca />
</AsyncBoundary>
```

## Quando usar `useSuspenseQuery`

A decisão vive em `lib/actions/*/queries.ts` — **nunca no componente**. Quem escreve o hook escolhe uma vez, e a regra é mecânica:

| Situação | Hook | Por quê |
|---|---|---|
| Query com `enabled` condicional | `useQuery` | Suspender é "espere, vem chegando". Com `enabled: false` o dado **não vem** — a tela travaria esperando algo que ninguém pediu. |
| `undefined` é estado válido da UI | `useQuery` | Ex.: `useMyFeatureFlags` — flag carregando *é* falsa, e é assim que a aba não aparece. Suspender apagaria a página para decidir se mostra uma aba. |
| Dado chega por prop, não por busca | `useQuery` no pai | `DataTable` recebe `data`/`isLoading`; não há o que suspender. |
| **Todo o resto** | `useSuspenseQuery` | O componente recebe `data: T` e não escreve guarda nenhuma. |

O TypeScript cobra a regra sozinho: hook de suspense devolve `data: T`, hook comum devolve `data: T | undefined`. Quem tenta usar o segundo sem tratar não compila. **Ninguém precisa decorar isto.**

> `useSuspenseQuery` não aceita `enabled`, `placeholderData` nem `throwOnError` — os tipos da lib omitem os três.

## Onde colocar o boundary

A unidade de carregamento é o que você quer que apareça junto na tela.

| Boundary | Cobre | Fallback |
|---|---|---|
| `app/(private)/layout.tsx` | `AuthProvider` — `me`, idioma, tema | `FullPageLoader` |
| `settings/page.tsx`, `profile/page.tsx` | a aba ativa | `PanelSkeleton` (default) |
| `ConfigRow` | uma linha de config inteira | `ConfigRowSkeleton` (interno) |
| `PageRenderer` | o layout customizável | `LoadingSkeleton` |

**Boundaries aninhados são o esperado**, não um problema: o mais próximo vence. Uma config que falha mostra o erro na própria linha sem derrubar o formulário; a aba inteira só cai se quem falhar for uma query da aba.

### Quanto da aba suspende depende de onde está o hook

Duas abas de /settings se comportam diferente, e a diferença é só essa:

| Aba | Hook fica | O que some |
|---|---|---|
| `systemConfig` | dentro de cada `ConfigRow` | só as linhas — o `Container` da aba continua na tela |
| `emailConfig`, `storageConfig`, `captchaConfig`, `agenteConfig` | no topo do componente da aba | a aba inteira, **incluindo o `Container` dela** |

Por isso o `PanelSkeleton` desenha o próprio `Container`: ele substitui um painel que sumiu por completo, borda inclusive. Skeleton sem o `Container` apareceria solto na página, destoando da aba já carregada.

### O que fica dentro importa

Suspense troca a **subárvore inteira** pelo fallback. Por isso o boundary do `ConfigRow` envolve título, descrição *e* controle — se envolvesse só o campo, o título apareceria antes e a linha pularia quando o dado chegasse.

Corolário: o boundary da página fica **fora** da navegação de abas (`TabsList` ou a sidebar/drawer do `SubNavLayout` — ver [[page-structure]]), senão a lista de abas pisca a cada troca.

## Fallbacks

O default cobre a maioria — escreva `<AsyncBoundary>` sem props.

| Componente | Quando |
|---|---|
| `PanelSkeleton` | default; `Container` + título + descrição + fileira de controles |
| `ConfigRowSkeleton` | interno ao `ConfigRow` |
| `TableSkeleton` | tabelas (usado direto pelo `DataTable`) |
| `FullPageLoader` | boot do app |

Para o erro, `AsyncBoundary` aceita `errorFallback={(retry) => …}`. É função porque o `retry` depende do reset do cache, que só existe dentro do boundary. Use em boundary pequeno — o `ErrorState` padrão é um card de 400px de altura, que não cabe numa linha (`<ErrorState compact />` resolve).

**Não crie skeleton por tela.** Não existe detecção automática: o fallback renderiza exatamente quando os filhos não conseguem renderizar, então não há árvore para medir. Painel com forma muito diferente passa `fallback` explícito — exceção, não regra.

## O que o lint garante — e o que não dá

`eslint.config.mjs` proíbe importar `useSuspenseQuery`/`useSuspenseQueries` fora de `lib/actions/*/queries.ts`:

```
error  'useSuspenseQuery' import from '@tanstack/react-query' is restricted.
       Hook de suspense só em lib/actions/*/queries.ts — o componente consome
       o hook, não escolhe se ele suspende.
```

Isso prende a regra da seção anterior: a decisão de suspender não vaza para o componente.

**O que nenhum lint consegue checar é se existe um `<AsyncBoundary>` acima.** É relação de árvore, em runtime, montada por composição — e o boundary quase sempre mora no componente pai, não no arquivo que chama o hook. O ESLint lê um arquivo por vez.

Então reconheça o sintoma: **hook de suspense sem boundary faz o app inteiro piscar o `FullPageLoader`** em vez de só o painel que estava carregando. A suspensão sobe até o boundary mais externo, que é o do layout privado. Viu a tela toda apagar ao abrir um painel? Falta `<AsyncBoundary>` em volta dele.

## Armadilha: estado dentro de quem suspende

```tsx
// ❌ trava para sempre
function Painel() {
  const [key] = useState(() => ['algo', Date.now()]);
  const { data } = useSuspenseQuery({ queryKey: key, queryFn });
}
```

O componente suspende **antes** do estado ser commitado. Na retentativa o inicializador do `useState` roda de novo, gera chave nova, e suspende outra vez — em loop. Valor que alimenta a `queryKey` nasce fora: prop, constante ou módulo.

## O que a regra compra

Carregamento, erro e retry ficam num lugar só. Um componente que busca dado não escreve `if (isLoading)`, `if (error)`, `if (!data)` nem `if (isPending)` — ele recebe `data: T` e renderiza.

A consequência prática é que o visual de carregamento é consistente em todo o app sem ninguém mantê-lo, e não há como uma tela ter um tratamento de erro sutilmente diferente (ou errado) das outras.

Ver também: [[http-client-orval]], [[page-structure]], [[service-health-gate]].
