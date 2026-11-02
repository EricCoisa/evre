---
title: PageBuilder — página customizável por usuário via JSON
tags: [frontend, backend, ai, page-builder]
---

# PageBuilder

Permite que **cada usuário monte a própria versão de uma página** a partir de blocos e de fontes de dados que o backend liberou — montando na mão num **editor visual**, ou pedindo em linguagem natural ao agente de IA ("no dashboard quero um gráfico de cadastros e a tabela de logs").

O JSON salvo descreve **só o visual e de onde vem o dado**. Nenhum valor é gravado nele: cada bloco aponta para uma chave de fonte, e o dado é buscado em runtime pelo cliente tipado de sempre.

> Fonte: `frontend-next/src/lib/page-builder/`, `backend-nest/src/modules/page-builder/`, `backend-nest/src/domain/page-builder/`

## Ideia em uma tela

```
                    ┌── editor visual (painel lateral, arrastar, props)
usuário ────────────┤
                    └── agente ── describe_page_builder ──┬─► PageSourceRegistry (Nest)
                                                          └─► ponte x-agent-secret → Next
                                  set_page_layout ────────────────┐
                                                                  ▼
                                                        PageLayoutValidator
                                                    (a MESMA regra para todos)
                                                                  │
                        ┌─────────────────────────────────────────┴──────────┐
                        ▼                                                    ▼
             UserConfiguration.PAGE_LAYOUTS                    SystemConfiguration.PAGE_LAYOUTS
                  (o layout de UM usuário)                    (o padrão de quem não tem o seu)
                        │                                                    │
                        └────────────────► <PageRenderer> ◄──────────────────┘
                                    usuário → sistema → página em código
```

Não há model Prisma próprio: a persistência reusa `UserConfiguration` e `SystemConfiguration` ([[data-model]], [[system-configuration]]).

## As peças

| Peça | Onde | Papel |
|---|---|---|
| Marcação do endpoint | `common/decorators/api-method.decorator.ts` (`pageSource`) | Diz **quais endpoints podem ser fonte de dados** |
| Catálogo de fontes | `modules/page-builder/page-source-registry.service.ts` | Descobre as marcações em runtime e filtra por role |
| Validação da escrita | `modules/page-builder/page-layout-validator.service.ts` | A **mesma** regra para os três escritores |
| Catálogo de blocos | `frontend-next/src/lib/page-builder/blocks.meta.ts` | Vocabulário visual servido ao agente e ao editor |
| Renderer | `frontend-next/src/lib/page-builder/renderer.tsx` | Transforma o JSON em tela, sem nunca poder quebrar |
| Editor | `frontend-next/src/lib/page-builder/editor/` | Modo de edição visual sobre o renderer real |

## 1. Liberar um endpoint como fonte de dados

Um endpoint só entra no PageBuilder se for **explicitamente marcado**. Sem `pageSource`, ele é invisível para a feature.

```ts
@GetApi({
  summary: 'Lista logs',
  roles: ['ADMIN'],
  queries: commonPaginationQueries,
  pageSource: {
    key: 'logs.list',                                  // contrato: vive no JSON do usuário
    kind: 'list',
    description: 'Logs de auditoria do sistema.',
    fields: ['module', 'action', 'message', 'createdAt'],
    params: PAGINATION_PAGE_SOURCE_PARAMS,
  },
  ...
})
```

O decorator emite duas coisas: `SetMetadata` (lido pelo `PageSourceRegistry` em runtime) e `ApiExtension('x-page-source')`, que sai no `openapi.json` — é por ele que o frontend prova que não divergiu (ver §7).

### `kind` — o contrato de formato

Só existem três, porque o bloco precisa ler o dado **sem um adapter por fonte**:

| `kind` | Shape esperado | Já existe no template? |
|---|---|---|
| `list` | `{ data: T[], meta: { total, page, limit, totalPages } }` — a paginação padrão | sim, todo endpoint paginado |
| `count` | mesmo shape; o bloco usa só `meta.total` | sim (um `list` também serve blocos de contagem) |
| `series` | `{ data: { date: string, value: number }[] }` | exige endpoint de agregação dedicado |

**Endpoint que não devolve um destes shapes não pode ser marcado.** Crie um endpoint de agregação em vez de adaptar formato dentro do bloco — o exemplo no template é `GET /user/stats/signups` (`GetSignupsSeriesUseCase`).

### `fields` e `params` não são opcionais na prática

São a diferença entre acertar e chutar — vale para o modelo **e** para o editor, que usa os dois para montar os controles:

- `fields` alimenta o seletor de colunas do editor (checkbox por campo real). Sem ele, sobra um campo de texto livre e volta o risco de escrever `date` quando o campo é `createdAt` → tabela com coluna vazia;
- `params` alimenta os controles de parâmetro. Sem ele o agente chuta (`page: "3-7"` → `ZodValidationException` no endpoint) e o editor não tem o que oferecer.

Declare `fields` em toda fonte `list` e `params` em toda fonte que aceite query string. Para endpoints paginados, reuse `PAGINATION_PAGE_SOURCE_PARAMS` (`common/schemas/pagination.schema.ts`) — mora ao lado do schema para os dois mudarem juntos.

### RBAC

`listForRole(roleName)` devolve só as fontes que aquele role alcança, comparando com o `roles` do próprio endpoint. Sem esse filtro o catálogo ofereceria blocos que respondem 403. O gate real continua sendo o guard do endpoint — o filtro é para o catálogo não mentir.

## 2. Onde o layout mora, e a precedência

O mesmo formato é guardado em **dois lugares**, sob o labelKey `PAGE_LAYOUTS` (`valueType: JSON`), sempre como um mapa `pageKey → layout` (uma linha cobre **todas** as páginas):

| Onde | Quem escreve | Vale para |
|---|---|---|
| `UserConfiguration` | o próprio usuário (editor ou agente) | só ele |
| `SystemConfiguration` | ADMIN, via "Salvar como Padrão" | todo mundo que não tem o seu |

```json
{
  "/dashboard": {
    "v": 1,
    "blocks": [
      { "id": "b1", "type": "chart.area", "span": 4,
        "props": { "title": "Cadastros" },
        "data": { "source": "users.signups.series", "params": { "days": 30 } } },
      { "id": "b2", "type": "table.basic", "span": 4,
        "props": { "title": "Logs", "columns": ["module", "action", "message"] },
        "data": { "source": "logs.list", "params": { "limit": 10 } } }
    ]
  }
}
```

- `v: 1` no topo — quando o schema mudar, dá para migrar ou descartar layout antigo sem quebrar tela.
- `span` é um **token de grid de 1 a 4**, nunca CSS. Três blocos na vertical = três blocos com `span: 4`.
- O `value` das duas configs é coluna `String`: quem grava serializa com `JSON.stringify`, quem lê pode receber string ou objeto — `asLayoutMap` (backend) e `parsePageLayout` (frontend) aceitam os dois.

### A cadeia de resolução

`resolvePageLayout` (`lib/page-builder/schema.ts`) decide o que vai na tela:

```
layout do usuário (com blocos)  →  layout do sistema (com blocos)  →  página em código
```

Duas regras que não são óbvias:

- **Layout sem bloco nenhum conta como "não tenho o meu"** e cai para o do sistema. É assim que o usuário desfaz a customização pelo editor (apagar tudo e salvar), com o mesmo efeito do botão "Restaurar padrão".
- **Layout inválido do usuário NÃO cai para o sistema.** Ele existe e não pôde ser lido: o dono precisa ver o aviso para corrigir ou restaurar, e mascarar com o do sistema esconderia o problema. Já um layout de *sistema* inválido é problema do admin — cai no fallback em silêncio, sem estragar a tela de quem só está visitando.

> `ponytail:` teto conhecido — sem versionamento/rollback e sem layout padrão *por role*. Migrar para um model `UserPageLayout(userId, pageKey, schema Json, version)` **quando** aparecer a primeira dessas necessidades, não antes.

## 3. Blocos

Dois arquivos de propósito:

- `blocks.meta.ts` — metadados **sem React**, lidos pela rota da ponte (que não pode arrastar recharts para dentro de um route handler) e pelo painel do editor;
- `registry.tsx` — os componentes, com as chaves amarradas por tipo ao `BLOCK_META` (bloco descrito sem componente, ou vice-versa, não compila).

| `type` | Consome (`accepts`) | Base |
|---|---|---|
| `group` | — (é `container`) | `Card` envolvendo outros blocos |
| `stat.card` | `list`, `count` | `Card` + `meta.total` |
| `chart.area` | `series` | `ChartContainer` (recharts AreaChart) |
| `chart.bar` | `series` | `ChartContainer` (recharts BarChart), para dados discretos |
| `chart.line` | `series` | `ChartContainer` (recharts LineChart), para tendências contínuas |
| `list.feed` | `list` | Lista compacta em pilha (`primaryField` e `secondaryField`), ideal para feeds e cartões estreitos |
| `table.basic` | `list` | `Table` (shadcn), somente leitura; paginação aparece quando há mais de uma página e usa skeleton durante a troca |
| `text.rich` | `list`, `count`, `series` (opcional) | Texto rico inline com presets (`heading1`–`heading4`, `paragraph`, `lead`, `caption`, `quote`) e variáveis |
| `divider` | — | `<hr>` com margem vertical configurável (`spacing`) — separa seções sem precisar de título |

Adicionar um bloco = uma entrada em cada arquivo. **O agente e o editor descobrem sozinhos**: as props declaradas em `BLOCK_META` viram os campos do painel sem ninguém escrever formulário por bloco, e nada é hardcoded em `description` de tool.

### `text.rich` com Presets e `divider` — estrutura de seção, não card

O antigo bloco dedicado `heading` foi removido e unificado no bloco de texto (`text.rich`) através de
**Presets** tipográficos e semânticos. O autor pode escolher entre:
- **`heading1`** (`h1` real): título principal da página ou proposta (`text-4xl font-bold tracking-tight`);
- **`heading2`** (`h2` real): título de seção ou rótulo de grupos (`text-2xl font-semibold tracking-tight`);
- **`heading3`** (`h3` real): subtítulos (`text-xl font-semibold`);
- **`heading4`** (`h4` real): títulos menores (`text-lg font-medium`);
- **`paragraph`** (padrão): corpo de texto corrido (`text-sm text-muted-foreground leading-relaxed`);
- **`lead`**: texto de destaque introdutório (`text-base font-normal leading-relaxed`);
- **`caption`**: legendas auxiliares (`text-xs text-muted-foreground`);
- **`quote`**: citações com destaque lateral (`blockquote` com `border-l-2 border-primary/50 pl-4 italic`).

O usuário pode alternar o preset diretamente pela barra flutuante no canvas (`FloatingBlockToolbar`) ou
pelo campo `preset` no painel lateral de propriedades. O bloco `divider` continua separando seções
visualmente com margens verticais ajustáveis (`spacing`). Nenhum dos dois ganha moldura de `Card`:
são estrutura de página pura.

### Apresentação livre × bloco preso a um registro

Um domínio com valor monetário (ou qualquer outro dado "oficial") tende a ganhar dois blocos com
papéis diferentes, e vale nomear o padrão para não reinventá-lo:

| | Serve para | Quantos por página |
|---|---|---|
| **Bloco ligado ao registro** (ex.: `investment`, que lê `totalCents`/`currency`/`recurrence` de `Proposal` por contexto, nunca por prop) | a verdade do negócio: o que soma em relatório, compara entre versões, vai para um contrato | exatamente 1 |
| **Bloco de apresentação livre** (ex.: `price` — `rows` de label+valor digitadas à mão, total destacado) | o que o leitor **vê**: quantas composições de valor a página precisar | 0..N |

O bloco ligado ao registro continua sendo a fonte de verdade — é o que garante que o número que o
funil soma é o mesmo que o cliente lê. O bloco de apresentação livre é só isso, apresentação: não
alimenta nenhum agregado, não é lido por nenhum relatório. Os dois convivem porque resolvem
problemas diferentes — um documento que precisa mostrar "projeto fechado **e** mensalidade" em
blocos separados não cabe num envelope de coluna única, mas também não deveria abandonar o
envelope só por isso.

### Agrupar blocos num mesmo card (`container`)

Por padrão cada bloco é um card independente. Um bloco com `container: true` (hoje só `group`) não tem fonte de dados própria: ele recebe `children` e os renderiza **dentro de um único card**, num grid interno de 4 colunas — é assim que se escreve "um card com o total à esquerda e a lista à direita":

```json
{ "id": "g1", "type": "group", "span": 4, "props": { "title": "Usuários" },
  "children": [
    { "id": "c1", "type": "stat.card",  "span": 2, "props": { "label": "Total" },
      "data": { "source": "users.list", "params": { "limit": 1 } } },
    { "id": "c2", "type": "table.basic", "span": 2,
      "props": { "columns": ["name", "email"] },
      "data": { "source": "users.list", "params": { "limit": 3 } } }
  ]
}
```

Filho renderiza em modo `bare` — sem a casca de `Card` e sem o padding lateral, senão vira card dentro de card. Isso vive no `Panel` de `registry.tsx`, casca única compartilhada por todos os blocos; bloco novo ganha o comportamento de graça.

> `ponytail:` **um** nível de aninhamento — filho não tem `children`. Cobre o caso que motivou o recurso sem schema recursivo nem profundidade indefinida vinda de um LLM. Se pedirem grid dentro de grid, trocar por `z.lazy()` com limite explícito de profundidade.

Assimetria deliberada entre os dois lados: a escrita **recusa** container aninhado; o front, ao ler um layout já gravado, **descarta** o segundo nível em vez de invalidar a página. Escrita é o lugar de reclamar; leitura é o lugar de não quebrar a tela.

**Blocos usam shadcn/ui internamente, mas o JSON nunca nomeia um componente do `components/ui/` direto** — só os `type` curados, com props enumeradas. Passthrough genérico devolveria props livres, sem validação e sem vocabulário fechado.

### Estilo: `className` com vocabulário fechado

Todo bloco aceita `className` no JSON — mas só com as classes de `lib/page-builder/class-names.ts`.

O motivo não é preferência de estilo, é como o Tailwind v4 funciona: ele gera CSS varrendo os **arquivos-fonte** do projeto. Uma classe que só existe numa linha do Postgres nunca é vista e **não vira CSS** — `className` livre seria um no-op. Pior: funcionaria por acaso quando a mesma classe fosse usada em algum componente, e quebraria no dia em que aquele componente mudasse.

A allowlist resolve isso porque é declarada duas vezes, de propósito:

```css
/* app/globals.css — força o Tailwind a emitir estas classes */
@source inline("text-{left,center,right}");
@source inline("font-{normal,medium,semibold,bold}");
```

```ts
// lib/page-builder/class-names.ts — fonte única do vocabulário
export const ALLOWED_CLASS_NAMES = ['text-center', 'font-bold', ...] as const;
```

`class-names.test.ts` amarra as duas: classe permitida sem `@source` vira no-op silencioso; `@source` sem uso vira CSS morto no bundle. **Ao adicionar uma classe, mexa nos dois lugares** — o teste falha se esquecer.

Cores são **semânticas** (`bg-muted`, `text-primary`), nunca da paleta bruta (`bg-red-500`): é o que mantém tema claro/escuro e identidade visual de pé num layout montado pelo usuário. No editor, o campo de estilo é um select da allowlist — não há como digitar classe inválida.

O mesmo raciocínio vale para `span`, que continua sendo token e não classe:

```ts
export const SPAN_CLASS = {
  1: 'lg:col-span-1', 2: 'lg:col-span-2',
  3: 'lg:col-span-3', 4: 'lg:col-span-4',
} as const;
```

Os dois lados tratam classe inválida de forma diferente, de propósito: a escrita **recusa** com a lista do que vale; o renderer **descarta** o token desconhecido (`filterClassName`) e desenha o resto.

### `LayoutProfile` — teto de blocos e origem do dado, por superfície

Cada página customizável pertence a um **profile** (`lib/page-builder/profiles.ts` no frontend,
espelhado em `backend-nest/.../dto/page-layout.dto.ts` — os dois lados têm teste amarrando as
declarações, mesmo mecanismo da allowlist de classe acima). O profile fixa quais `type` de bloco
valem e, crucialmente, **de onde o dado pode vir** via `dataSources`:

| `dataSources` | `data.source` (fonte interna, resolvida em runtime) | `data.inline` (payload colado, gravado no layout) |
|---|---|---|
| `role-filtered` (ex.: `dashboard`) | aceita, filtrado pelo alcance do role de quem grava | **recusa** — dado colado num dashboard seria um número inventado parecendo métrica real |
| `inline-only` (ex.: `proposal`) | **recusa** — nenhum bloco desta superfície busca nada; é o que mantém a página pública segura sem sessão | aceita, validado por shape e tamanho |
| `none` | recusa | recusa — nenhum dado, de forma nenhuma |

`data.source` e `data.inline` são **mutuamente exclusivos** no mesmo bloco — ter os dois é
recusado na escrita. `data.inline` é `z.unknown()` no schema de forma (Zod não descreve as três
shapes possíveis ali, ou qualquer evolução de `kind` viraria mudança de schema de layout publicado
e imutável); a validação **semântica** de shape mora no `PageLayoutValidator`
(`page-layout-validator.service.ts`), contra o `accepts` do bloco:

| `accepts` do bloco | `data.inline.data` esperado |
|---|---|
| `list`, `count` | array de objeto (`Record<string, unknown>[]`) |
| `series` | array de `{ date: string, value: number }` |

Dois tetos de tamanho no mesmo validador: **64 KB por bloco**, **256 KB por layout** (soma de topo
+ `children`) — sem teto, uma página vira um documento de megabytes, porque o `inline` é gravado no
registro **e** servido para quem abre a página. A checagem cobre `children` igual a `data.source`:
um bloco de dado dentro de um `group` carrega dado como qualquer outro.

No editor, quando o profile é `inline-only`, o painel troca o seletor de fonte por um campo de
texto dedicado (JSON colado, com validação na hora e um botão "Exemplo" por `kind`) — não é um
`props` do `BlockPropMeta` (que só descreve `string|number|boolean|string[]`), é `data`, então tem
campo próprio em vez de reusar o gerador de props.

> `data.inline` não é "menos seguro que `data.source`": antes de existir, uma superfície
> `dataSources: 'none'` simplesmente não tinha blocos de dado (tabela, gráfico, feed). Com
> `inline-only`, ela ganha esses blocos sem abrir **nenhum** caminho novo até o banco — o payload é
> literal, do autor, congelado no layout. `'none'` continua existindo para uma superfície que não
> deva nem isso.

## 4. Renderer

```tsx
// app/(private)/(admin)/dashboard/page.tsx
export default function DashboardPage() {
  return <PageRenderer pageKey="/dashboard" fallback={<DefaultDashboard />} />;
}
```

Adesão é **opt-in por página** — a página em código continua existindo e é para onde tudo cai. Página customizável precisa estar em `PAGE_KEYS` (`lib/page-builder/pages.ts`), que é o conjunto fechado de destinos. Convenção de composição de [[page-structure]] preservada.

**A tela não pode quebrar por causa do JSON.** Cada modo de falha tem saída própria:

| Situação | O que acontece |
|---|---|
| Nem o usuário nem o sistema customizaram a página | renderiza o `fallback` |
| Layout do usuário não bate com o schema | alerta + botão "Restaurar padrão" + `fallback` |
| Layout do **sistema** não bate com o schema | `fallback` em silêncio — não é problema de quem está visitando |
| `type` desconhecido | bloco pulado, `console.warn` em dev — nunca `throw` |
| Bloco precisa de fonte e não tem | alerta no lugar do bloco |
| Fonte respondeu **403** | **bloco some da página, sem alerta e sem toast** (ver abaixo) |
| Fonte respondeu outro erro | alerta no lugar do bloco (não parece "sem dados") |
| Bloco estourou em runtime | error boundary isola **aquele** bloco |

### Por que 403 falha em silêncio

Um layout **padrão do sistema** é montado por um admin, cujo alcance de fontes é maior que o de um usuário comum. Quem só está visitando não escolheu aquele bloco e não pode fazer nada a respeito — então avisar é ruído, e três blocos assim virariam três toasts a cada carregamento.

Isso exigiu que o status HTTP sobrevivesse até o componente: `Alive` passou a carimbar `status` no `Error` e a aceitar `silentStatuses` ([[server-actions]]). Erro de verdade (500, rede, param inválido) continua mostrando o alerta, que é o que ajuda a diagnosticar.

**No modo de edição o bloco continua visível**, com a mensagem de "sem acesso": sumir sem deixar rastro impediria de selecionar e remover um bloco herdado do layout do sistema.

### Regras de hooks

Um `useQuery` por bloco exige **um componente por bloco**. Chamar o hook dentro do `.map()` dos blocos quebra as regras de hooks assim que a quantidade de blocos muda. O registry mapeia para dado (`{ kind, fetcher }`), não para comportamento (um hook).

## 5. Editor visual

`lib/page-builder/editor/` — modo de edição por cima do renderer, ligado pelo botão "Editar página".

| Arquivo | Papel |
|---|---|
| `mutations.ts` | **Toda a lógica**, em funções puras `(layout, …) → layout`. Sem React. |
| `context.tsx` | Rascunho local + seleção. Nada é gravado até o "Salvar". |
| `block-chrome.tsx` | Contorno, toolbar de hover e handle de arrastar de um bloco |
| `panel.tsx` | Painel lateral direito: paleta e propriedades |
| `editor.tsx` | `DndContext` + grid + painel |

Três decisões que sustentam o resto:

**O editor renderiza o `BlockGrid` de verdade**, o mesmo do `PageRenderer`, com os dados reais das fontes. Não existe preview separado que possa divergir da tela final — o chrome de edição é só uma casca por cima.

**Botão Preview, na `EditorTopBar`:** abre um modal que renderiza `<LayoutBody layout={editor.draft} profile={editor.profile} proposalTerms={…} />` — o rascunho em edição, incluindo alterações ainda não salvas. `LayoutBody` (`renderer.tsx`) é o componente que renderiza um layout **já resolvido**, sem buscar config nem depender de sessão; o preview do editor é o **segundo** consumidor dele — o primeiro é a página pública, que monta o mesmo componente a partir do layout publicado. É por isso que o preview mostra exatamente o que o leitor final vê, sem reimplementar renderização.

A armadilha: o modal do preview é montado **dentro** do `EditorProvider`, então sem cuidado o `LayoutBody` dentro dele herdaria o contexto do editor e desenharia o `BlockChrome` (contorno, handle de arrastar) por cima — deixando de ser preview. A correção é envolver o `LayoutBody` do modal com `<EditorContext.Provider value={null}>`, o mesmo valor que o contexto tem fora de qualquer editor — `useEditor()` volta a `null` e o `BlockGrid` não desenha chrome nenhum.

> `ponytail:` o preview mostra só o `layout`, sem o que a página pública compõe em volta (header da marca, rodapé, bloco de aceite) — o que varia de uma instância para outra é o layout, e é isso que o preview serve para conferir. Compor a página pública inteira no preview é trazer quando o preview precisar bater 1:1 com o link publicado, não antes.

**O painel não tem código por bloco.** Os campos saem de `BLOCK_META[type].props`, os parâmetros saem da fonte escolhida, o estilo sai de `ALLOWED_CLASS_NAMES` e a largura de `SPANS`. Bloco novo no catálogo ganha UI de edição sem ninguém tocar em `panel.tsx`.

**A lógica não mora em componente.** Mover, adicionar, remover, trocar fonte — tudo em `mutations.ts`, testável sem montar nada. É lá que vivem as regras chatas: teto de blocos por página e de filhos por container (espelhados do backend, para o editor desabilitar o botão em vez de deixar o `Zod` recusar com o trabalho já feito), e o descarte de `params`/colunas ao trocar a fonte de um bloco (pertenciam à fonte anterior).

### Arrastar

`@dnd-kit` com um `SortableContext` por nível. Soltar sobre um bloco = ficar na posição dele, herdando o container dele; soltar sobre o card de um `group` = **entrar** nele. Não há zona de drop separada: o próprio group já é um alvo do dnd-kit.

Duas recusas silenciosas em `moveBlock` — no meio de um arrasto não há onde reclamar: container dentro de container, e destino que estouraria o teto de filhos.

> Use `CSS.Translate.toString(transform)`, **não** `CSS.Transform`. O `Transform` do dnd-kit inclui a escala para o tamanho do alvo, e arrastar um bloco `span: 2` sobre um `span: 4` esticava o bloco (e o texto dentro dele) durante o arrasto.

### Detalhes de layout que já custaram bug

- O chrome envolve o bloco num `<div>`; ele precisa de `h-full` para o `h-full` do `Card` continuar herdando a altura da célula do grid. Sem isso o bloco encolhe para a altura do conteúdo **só** no modo de edição, e desalinha do vizinho.
- `pointer-events-none` no conteúdo vale para bloco folha de dados (para clicar numa linha da tabela selecionar o bloco), mas **não** para container (cujo conteúdo são os filhos) nem para blocos com texto editável (`text.rich`, etc.), permitindo foco imediato e edição direta no canvas.
- **Edição inline e barra suspensa unificada:** Blocos de texto (`text.rich`, botões de ação e cabeçalhos de cards com título/descrição) são editáveis diretamente no canvas via `InlineRichText`. Para não poluir a UI e evitar sobreposição de barras flutuantes, os controles de formatação do rich text e o seletor de presets ficam integrados diretamente na própria barra flutuante do bloco (`FloatingBlockToolbar`). Ao selecionar ou focar em um editor de texto, os botões de formatação (Negrito, Itálico, Riscado, Código, Variáveis) e o dropdown de Presets aparecem na barra do bloco separada por divisores limpos. O seletor avulso de tamanho de fonte foi removido em favor dos Presets, que atuam como fonte única da verdade para tamanho, peso e tags tipográficas (`heading1`–`heading4`, `paragraph`, etc.), eliminando conflitos de estilização. Ao desselecionar ou interagir com blocos de dados não editáveis (tabelas, gráficos), os botões de rich text permanecem ocultos, mantendo a interface leve e sem conflito visual. Edições no canvas e no painel lateral sincronizam em tempo real.
- Filho ancora a toolbar **por dentro** do próprio bloco; bloco de topo pendura acima da borda. Senão as duas se sobrepõem no bloco mais à direita de um group.
- Redimensionamento pela borda inferior (`rowSpan`) empurra os blocos subsequentes para baixo em cascata com absorção de vácuos (respeitando a coluna). Ao expandir para baixo (`delta > 0`), o bloco consome e dissolve progressivamente os espaços vazios existentes (`EmptyGridSlot` / 'Adicionar aqui') logo abaixo dele sem empurrar blocos subsequentes desnecessariamente; quando atinge e colide com um bloco abaixo, empurra-o apenas pelo estritamente necessário, e o bloco empurrado também absorve e dissolve quaisquer espaços vazios existentes abaixo de si antes de empurrar o próximo elemento. Ao reduzir a altura de volta (`delta < 0`), os blocos abaixo retornam para cima.
- **Exclusão com subida e colapso vertical automático (`removeBlockFromGrid`):** Ao deletar um bloco, os elementos abaixo sobem na mesma disposição até encostar no bloco superior ou topo da página. Se o bloco ocupava linhas inteiras (ex.: largura total de 12 colunas), as linhas vazias são 100% colapsadas; se estava em coluna parcial, sobem apenas os blocos no mesmo footprint horizontal, preservando as colunas paralelas e evitando colisões.
- **Compactação automática de linhas vazias órfãs (`compactLayout` / `compactEmptyRows`):** Ao carregar qualquer layout salvo (no editor via `EditorProvider` ou na exibição pública via `BlockGrid` / `GroupBlockRenderer`), linhas horizontais 100% vazias (onde todas as 12 colunas da grade estão livres) são automaticamente colapsadas por gravidade vertical. Isso elimina vácuos gerados por versões legadas ou mudanças no cálculo de altura efetiva dos blocos, impedindo o surgimento de slots gigantes de "Adicionar aqui".
- **Agrupamento de slots vazios contíguos (`mergeContiguousEmptySlots`):** Espaços vazios verticais de múltiplas linhas na mesma coluna são unificados em uma única dropzone/inserter proporcional (`rowSpan`), eliminando pilhas repetidas de botões "+ Adicionar aqui" linha a linha.

> `ponytail:` o painel é `<aside>` fixo, não `<Sheet>` — Sheet é modal (overlay + focus trap) e o ponto do editor é clicar nos blocos com o painel aberto. Abaixo de `lg` o painel cobre a tela: editor é ferramenta de desktop. Se precisar editar no celular, virar `<Drawer>`, que já está no projeto.

### Salvar como Padrão (ADMIN)

Publica o rascunho como layout do **sistema**. Não grava nada no layout pessoal do admin: se ele não tiver um próprio, passa a ver o padrão que acabou de publicar, pela cadeia normal.

Passa por `SystemConfigurationService.update`, então a mudança **entra no log de auditoria** como qualquer alteração de config do sistema. O gate real é o backend (`roles: ['ADMIN']`); o front só evita oferecer um botão que responderia 403.

## 6. Endpoints

| Método | Rota | Auth | Flag | Papel |
|---|---|---|---|---|
| `GET` | `/page-builder/sources` | autenticado | sim | Catálogo filtrado pelo role de quem chamou |
| `PUT` | `/page-builder/layout` | autenticado | sim | Layout do próprio usuário |
| `GET` | `/page-builder/system-layout` | autenticado | **não** | Layout padrão do sistema |
| `PUT` | `/page-builder/system-layout` | **ADMIN** | sim | "Salvar como Padrão" |

O `GET /system-layout` é o único sem gate de flag, de propósito — é caminho de **exibição** (ver §8).

## 7. Fontes no frontend — e a guarda anti-drift

O front chama Orval normalmente, como qualquer outra feature ([[http-client-orval]] · [[server-actions]]): server actions finas em `lib/actions/pageBuilder/api.ts`, amarradas à chave em `lib/page-builder/data-sources.ts`.

Isso cria duas listas — a marcação no backend e o adapter no front. `data-sources.test.ts` lê o `x-page-source` do `openapi.json` e falha se elas divergirem: fonte marcada sem adapter, adapter sem marcação, ou `kind` diferente. **Ao marcar um endpoint novo, rode `openapi:export` e adicione o adapter**, ou o teste quebra (que é o objetivo — o catálogo proporia uma fonte que nunca carrega).

## 8. Feature flag `PAGE_BUILDER`

**A flag tranca a autoria, não a exibição.**

| | Flag ON | Flag OFF |
|---|---|---|
| Renderiza layout salvo (usuário ou sistema) | ✅ | ✅ |
| Botão "Editar página" | ✅ | some |
| `GET /sources` · `PUT /layout` · `PUT /system-layout` | ✅ | 404 |
| `GET /system-layout` | ✅ | ✅ |

**Consequência assumida: não existe kill switch por flag.** Para tirar um layout do ar, apague a config — a do sistema pelo admin ([[system-configuration]]), a do usuário pelo "Restaurar padrão" (que reusa `useResetUserConfiguration`: apaga a linha e devolve o `defaultValue`).

> Flag alterada com a aplicação **já rodando** não aparece na hora: o backend cacheia a lista de flags no Redis por 5 min e o React Query mantém `feature-flags-me` na sessão (`refetchOnMount: false` global). Recarregue a página, ou dê um toggle pela tela de admin, que invalida o cache. Ver [[feature-flags-frontend]].

## 9. Tools do agente

Duas, detalhadas em [[ai-tools]]:

| Tool | Escrita | Faz |
|---|---|---|
| `describe_page_builder` | não | Blocos, páginas e spans (via ponte) + fontes filtradas por role, cada uma com `fields` e `params` |
| `set_page_layout` | **sim** (`user-configuration:write`) | Grava o layout de UMA página **do usuário**, com merge por `pageKey` |

Leitura do layout atual reusa `get_my_configuration_by_key` — não há tool nova para isso. O agente **não** escreve o layout do sistema: publicar padrão para todo mundo é ação de admin, pela UI.

**Por que `set_page_layout` existe em vez de reusar `set_user_configurations`:** o input daquela tool é `value: string`, então o modelo teria que serializar o mapa inteiro a cada edição e **apagaria o layout das outras páginas**. `set_page_layout` recebe objeto e faz merge por `pageKey`.

## 10. Validação na escrita — uma regra, três escritores

Zod garante só a estrutura. O que evita layout que grava mas não renderiza é a checagem semântica do **`PageLayoutValidator`**, contra o mesmo catálogo que o autor consultou. Os três caminhos de escrita passam por ele:

- a tool `set_page_layout` (agente),
- `PUT /page-builder/layout` (editor visual),
- `PUT /page-builder/system-layout` (Salvar como Padrão).

É isso que mantém verdadeiro "o que um consegue gravar, o outro também" — e as recusas idênticas. Ele recusa:

- `pageKey` que nenhuma tela renderiza;
- `type` de bloco que não existe;
- bloco com `accepts` não vazio e **sem** `data.source`;
- fonte de `kind` incompatível com o bloco;
- param não declarado pela fonte, ou com tipo errado;
- `container` sem `children`, `children` em bloco que não é container, ou container dentro de container;
- `className` com classe fora da allowlist publicada pela ponte;
- fonte fora do alcance do role de quem está gravando (inclusive nos filhos de um container);
- `data.source` ou `data.inline` incompatível com o `dataSources` do profile ativo (ver §3), os
  dois no mesmo bloco, shape de `data.inline` que não bate com o `accepts` do bloco, ou acima do
  teto de tamanho.

As mensagens são escritas para o modelo se autocorrigir — voltam como `tool_result` e ele tenta de novo. No editor, viram toast. Exemplo real:

```
bloco "logs_table": param "page" espera number (Página a exibir, inteiro >= 1.
Um bloco mostra UMA página por vez.), recebeu "3-7"
```

> `ponytail:` num layout de **sistema** o alcance conferido é o do admin que gravou, que é um superconjunto. Um bloco cuja fonte um role menor não alcança grava, e para esse usuário o bloco simplesmente some (§4). Validar por role exigiria escolher um role de referência, que não existe. Se virar problema, filtrar pela interseção dos roles.

## 11. Setup

- Flag `PAGE_BUILDER` no seed, liberada para todos os roles.
- `UserConfigurationDefinition` `PAGE_LAYOUTS` (`valueType: JSON`, default `{}`).
- `SystemConfiguration` `PAGE_LAYOUTS` (`valueType: JSON`, valor `{}`) — **sem ela o "Salvar como Padrão" responde pedindo o seed**; a leitura degrada para `{}` sem quebrar tela.
- Namespace i18n `page-builder` (`pt-BR` e `en`), registrado em `lib/translation-utils.ts`. Ver [[i18n-frontend]].

## Fora de escopo (e quando trazer de volta)

| Deixado de fora | Trazer quando |
|---|---|
| Model Prisma dedicado / versionamento de layout | precisar de rollback ou histórico de quem mudou o quê |
| Layout padrão **por role** | um padrão só não servir — hoje é um para todos |
| Blocos que **escrevem** (forms, mutations via JSON) | é outro projeto — o repo já tem `components/form/` |
| Aninhamento de mais de um nível | pedirem grid dentro de grid — hoje `group` resolve linha com colunas |
| Posicionamento livre (x/y/w/h) | usuários pedirem redimensionar com o mouse — hoje `span` 1–4 e arrastar para reordenar |
| Editar no celular | virar necessidade — o painel é desktop-first, `<Drawer>` já está no projeto |
| CSS livre / classe fora da allowlist | nunca — não existiria no CSS gerado (§3). Ampliar = crescer a allowlist |
| URL de dado arbitrária no JSON | nunca no cliente; a whitelist é o registry de fontes |

## Testes

Backend:
- `set-page-layout.use-case.spec.ts` — merge por página e cada recusa da validação semântica;
- `set-system-page-layout.use-case.spec.ts` — merge do layout de sistema, autoria no log, e a leitura que nunca lança;
- `page-source-registry.service.spec.ts` — discovery das marcações e filtro por role.

Frontend:
- `schema.test.ts` — `parsePageLayout` (válido/ausente/inválido/corrompido, aninhamento, spans) e `resolvePageLayout` (a cadeia de precedência);
- `editor/mutations.test.ts` — toda a lógica de edição, incluindo arrastar entre containers e os tetos;
- `editor/editor.test.tsx` — a cola React: paleta → contexto → grid → painel;
- `class-names.test.ts` — allowlist × `@source inline` do globals.css;
- `data-sources.test.ts` — a guarda anti-drift contra o `openapi.json`;
- `api/collector.test.ts` — status preservado no erro e o opt-out de toast que o 403 silencioso usa;
- `use-ai-stream.test.tsx` — invalidação refetchando query inativa.

## Relacionados

[[ai-tools]] · [[page-structure]] · [[http-client-orval]] · [[server-actions]] · [[feature-flags-frontend]] · [[i18n-frontend]] · [[system-configuration]] · [[data-model]]
