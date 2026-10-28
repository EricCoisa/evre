---
title: Estrutura de Página Frontend
tags: [frontend, convenção, componentes]
---

# Estrutura de Página Frontend

**Regra:** página = composição. Conteúdo de tab, seção ou coluna vive em `./components/`.

## Padrão

```
app/(private)/(admin)/user/
├── page.tsx              ← só Tabs + <UserTab /> + <InviteTab />
└── components/
    ├── user-tab.tsx      ← toda a lógica e JSX da aba Usuários
    └── invite-tab.tsx    ← toda a lógica e JSX da aba Convites
```

### page.tsx — o que fica aqui
- **É Server Component** (sem `'use client'`) quando há flag/permissão para ler antes de decidir o que existe — ver [[#Gating é decisão do servidor]]. Página sem nada a esconder (ex.: `access/page.tsx`, que usa `useTour`) pode ser Client Component
- `<Container>`, `<SubNavLayout>` (navegação com sidebar + drawer mobile) ou `<TabsShell>` (casca mínima, sem sidebar, para poucas abas)
- A leitura de feature flags / permissões que decide **quais** abas existem
- Tour registration (`registerTour`)
- **Nada de DataTable, useState de lista ou lógica de fetch**

### components/*.tsx — o que vai aqui
- `useState` de paginação/filtro
- Chamadas a hooks de query (`useLogging`, `useUserRole`…)
- `<DataTable>` com colunas
- Diálogos e modais disparados pela tab

## Exemplos implementados

| Página | Tab (componente) |
|---|---|
| `user/page.tsx` | `user-tab.tsx`, `invite-tab.tsx` |
| `access/page.tsx` | `user-role-tab.tsx`, `routes-tab.tsx`, `main-screen-tab.tsx` |
| `settings/page.tsx` | `system-config-tab.tsx`, `user-default-config-tab.tsx`, `email-config-tab.tsx`, `storage-config-tab.tsx`, … (uma por seção da sidebar) |

## Por que

Páginas que misturam composição com lógica de dados ficam longas e difíceis de ler num diff. Extrair mantém a página como um mapa de navegação e isola cada tab para teste/evolução independente.

## Gating é decisão do servidor

**Regra:** o que o usuário não pode ver não sai do servidor.

Esconder uma aba com `useFeatureFlag()` no browser significa que a resposta da API com a
lista de flags já chegou ao cliente, que o componente da aba já está no bundle, e que a
decisão é reversível com o DevTools aberto. O backend continua recusando a chamada — mas a
tela entregou o mapa do que existe. Por isso a decisão sobe para o `page.tsx`, que é RSC.

### As três peças

| Peça | Onde | Papel |
|---|---|---|
| `lib/server-context.ts` | `serverMe()`, `serverFeatureFlags()`, `serverFeatureFlag(key)`, `serverCanAccessRoute(path)` | O que o servidor sabe do usuário desta request |
| `components/sub-nav-layout.tsx` | `<SubNavLayout sections defaultTab="…">` | Casca cliente da navegação por abas (sidebar desktop + drawer mobile): guarda só o `?tab=`. `TabsShell` é a mesma ideia sem sidebar, para poucas abas |
| `components/ui/langLabel.tsx` | `<LangLabel text="…" langJson="…" />` | Rótulo traduzido dentro de RSC |

```tsx
// app/(private)/(admin)/settings/page.tsx — Server Component
import { SubNavLayout, type SubNavSection, TabsContent } from '@/components/sub-nav-layout';
import LangLabel from '@/components/ui/langLabel';
import { serverFeatureFlags } from '@/lib/server-context';

export default async function SettingsPage() {
  const flags = await serverFeatureFlags();
  const aiAgentEnabled = flags['AI_AGENT'] ?? false;

  const sections: SubNavSection[] = [
    { items: [
      { id: 'systemConfig', label: <LangLabel text="systemConfiguration" langJson="settings" /> },
      { id: 'agenteConfig', label: <LangLabel text="agentConfiguration" langJson="settings" />, hidden: !aiAgentEnabled },
    ] },
  ];

  return (
    <SubNavLayout sections={sections} defaultTab="systemConfig">
      <TabsContent value="systemConfig"><SystemConfig /></TabsContent>
      {aiAgentEnabled && <TabsContent value="agenteConfig"><AiConfig /></TabsContent>}
    </SubNavLayout>
  );
}
```

Com a flag desligada, `AiConfig` não aparece no HTML **nem no payload RSC** — o browser
nunca soube que a aba existe. `hidden` só filtra o item da navegação; o `TabsContent`
correspondente continua precisando do próprio `{aiAgentEnabled && …}` para não viajar no payload.

### Os dois eixos

Gating tem duas perguntas, e o helper é simétrico nas duas:

```tsx
await serverFeatureFlag('AI_AGENT')     // o recurso está ligado para a role dele?
await serverCanAccessRoute('/agent')    // ele alcança essa tela?
```

`serverCanAccessRoute` lê a mesma `me.routes` que monta o menu lateral e que o middleware
confirma no backend — não é uma terceira fonte de verdade. Use para atalhos e elementos que
**levam** a outra tela; guardar a tela em si já é trabalho do middleware, antes de qualquer
RSC rodar ([[frontend-auth]]).

### O portão mora na feature, não em quem a posiciona

`components/agent/agent-window.tsx` combina os dois eixos e é RSC; `agent-window-chat.tsx` ao lado
é o `'use client'` com o balão e o chat. O layout privado só escreve `<AgentWindow />` — não
importa flag, não conhece `/agent`, não tem `canUseAgent`.

Vale a regra geral: **um componente com condição de acesso carrega a própria condição**. Quem
compõe a tela fica com composição, e a condição não se espalha para cada lugar que usa o
componente. É o mesmo desenho do `page.tsx` do `/agent`, que decide e delega para
`components/agent-route.tsx`.

### Página inteira atrás de uma flag

Não é `useEffect` + `router.push`: é `redirect()` no RSC, antes de qualquer byte sair.

```tsx
export default async function AgentPage() {
  if (!(await serverFeatureFlag('AI_AGENT'))) redirect('/home');
  return <AgentRoute />;   // components/agent-route.tsx é o 'use client'
}
```

### Detalhe (`[id]/page.tsx`) busca no servidor

```tsx
export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await getUser(id);
  if (!response.success || !response.data) return <ItemNotFound … />;
  return <SubNavLayout sections={userDetailSections} defaultTab="user">…</SubNavLayout>;
}
```

O registro chega renderizado; o cliente não dispara `GET /user/:id` por conta própria.

### Três armadilhas

**`t()` não roda no servidor.** O i18n aqui é `react-i18next` puro, sem SSR ([[i18n-frontend]]).
Em RSC o rótulo vai em `<LangLabel>`, que é o Client Component mínimo que traduz uma chave.

**RSC não passa função para Client Component.** Um tab não recebe `t` por prop: ele chama
`useTranslation('<namespace>')` ele mesmo. É o padrão dos tabs em `settings/components/`.

**`<Feature flag>` não serve em RSC.** Ele é `'use client'`: compila, parece certo e não protege
nada — `children` já foi avaliado, viaja no payload e só some no browser. Em Server Component a
forma é `{enabled && <X />}` com a flag lida por `serverFeatureFlag()`.

### O que continua no cliente

Interação é cliente e está certo assim: paginação e filtro de `DataTable`, modais, formulários,
o estado do `?tab=`. O que sobe para o servidor é só **o que existe na tela**, não **como ela
reage**.

O menu lateral (`components/app-sidebar.tsx`) sempre seguiu esta regra: é RSC e monta os itens a
partir de `user.routes`, então rota sem acesso nunca vira link.

### Mudou o dado: como a tela server-side reage

Gating no servidor tem um preço que não existia no cliente: `queryClient.invalidateQueries()`
**não move nada disso**. A decisão já virou payload RSC, e o TanStack não tem observador nenhum
ali. Desligar `AI_AGENT` atualizava a query e o balão continuava na tela.

A ferramenta é `router.refresh()`: refaz o render do servidor da rota atual (layouts inclusive)
preservando o estado do cliente — nada de `window.location.reload()`. Como toda rota privada é
dinâmica e `cache()` vale por request, o refresh lê o valor novo.

**Regra:** quem invalida uma query que também alimenta RSC chama `router.refresh()` junto.
Hoje são dois pontos, e ambos já fazem isso:

| Origem da mudança | Onde |
|---|---|
| Mutação na tela de flags | `useFeatureFlagSync()` em `lib/actions/feature-flag/queries.ts` |
| Tool do agente (`invalidates` via SSE) | `lib/actions/ai/use-ai-stream.ts` — refresh quando `invalidates` vem não-vazio |

No caminho do agente não há lista de chaves a manter: a tool já declarou que mudou algo, e tool
de leitura pura manda `invalidates: []` ([[ai-tools]]). Coberto por regressão em
`use-ai-stream.test.tsx`.

### E os outros usuários?

`router.refresh()` conserta a aba de quem agiu. Quem já está logado em outra máquina pega a
mudança **na próxima navegação**, porque toda rota privada é dinâmica e reavalia as flags no
servidor a cada render.

É melhor do que depender do cache do cliente: `lib/queryClient.ts` roda com `staleTime` de 5 min,
`refetchOnMount: false` e `refetchOnWindowFocus: false`, então uma aba aberta pode segurar uma flag
antiga por bastante tempo. Derrubar na hora, sem navegação, exigiria um canal push (SSE/WebSocket)
por usuário — o template não tem um, e não precisa.

### Custo: uma chamada por request, não por componente

`serverMe()` e `serverFeatureFlags()` são embrulhados em `cache()` do React. Layout privado,
sidebar e página pedem o mesmo dado e o backend responde uma vez só. É dedupe **dentro da
request** — não é cache entre requests, flag alterada aparece na navegação seguinte. Precisa ser
explícito porque os actions usam axios, que não passa pelo cache de `fetch` do Next.

## Página customizável pelo usuário

Uma página pode, opcionalmente, delegar o corpo para o layout que o usuário montou ([[page-builder]]). A convenção acima não muda: a versão em código continua existindo e vira o `fallback`.

```tsx
export default function DashboardPage() {
  return <PageRenderer pageKey="/dashboard" fallback={<DefaultDashboard />} />;
}
```

É **opt-in por página** — só as páginas listadas em `lib/page-builder/pages.ts` são customizáveis. Nada de transformar o app inteiro em JSON.

O `fallback` não é só rede de segurança para JSON quebrado: ele é o último elo de uma cadeia (**layout do usuário → layout padrão do sistema → esta página em código**). Ou seja, a versão em código continua sendo a que aparece por padrão numa instalação nova, e continua valendo a pena escrevê-la bem.
