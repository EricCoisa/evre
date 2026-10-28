---
title: Tour Guiado (HelpButton & TourProvider)
tags: [frontend, tour, tutorial, onboarding, componentes]
---

# Tour Guiado (Walkthroughs & HelpButton)

Sistema agnóstico de tutoriais interativos passo a passo da aplicação. Permite guiar o usuário pelos recursos de qualquer tela via destaque visual (spotlight) e cards contextuais, adaptando-se automaticamente entre Desktop e Mobile.

Fonte da verdade: `frontend-next/src/components/tour.tsx`  
Envoltório no layout: `frontend-next/src/components/ui/reactTour.tsx` (envolve as rotas privadas em `app/(private)/layout.tsx`).

---

## 1. As Camadas

```
<TourProvider>                          Contexto global: registro de tours, step ativo, responsividade
  <TourOverlay>                         Backdrop com spotlight (clipPath) + Card explicativo
    <HelpButton tourId="..." />         Gatilho drop-in (?) ao lado de títulos de páginas/seções
```

| Componente / Interface | Arquivo | Responsabilidade |
|---|---|---|
| `TourProvider` | `components/tour.tsx` | Armazena o registro de tours (`registerTour`), controla o passo atual (`startTour`, `nextStep`, `previousStep`, `endTour`), escuta eventos de resize/scroll com capture, e dispara o `onEnter` de cada passo. |
| `TourStep` | `components/tour.tsx` | Contrato TypeScript de cada passo do tour. Totalmente agnóstico a regras de negócio. |
| `TourOverlay` | `components/tour.tsx` | Renderiza o backdrop escuro com recorte transparente (`clipPath: polygon`) em volta do elemento alvo e posiciona o card com animações Fluid via `motion/react`. |
| `HelpButton` | `components/tour.tsx` | Botão drop-in com ícone `CircleHelp`. Pode abrir o modal de introdução (`TourAlertDialog`) ou iniciar o tour direto (`startDirect`). |
| `useTour` | `components/tour.tsx` | Hook para registrar tours, iniciar tours programaticamente ou inspecionar o estado ativo. |
| `ignoreTourInteraction` | `components/tour.tsx` | Helper para evitar que cliques na interface do tour fechem modais do Radix (`onInteractOutside`). |

---

## 2. Contrato de um Passo (`TourStep`)

```ts
export interface TourStep {
  content: React.ReactNode;         // Conteúdo explicativo (texto, JSX ou CompositeLangLabel)
  selectorId: string;               // ID do elemento HTML alvo no Desktop
  mobileSelectorId?: string;        // ID alternativo no Mobile (opcional, para layouts responsivos)
  position?: "top" | "bottom" | "left" | "right"; // Posição preferida no Desktop (padrão: "bottom")
  width?: number;                   // Largura customizada da área destacada (opcional)
  height?: number;                  // Altura customizada da área destacada (opcional)
  onClickWithinArea?: () => void;   // Ação disparada ao clicar na área destacada (opcional)
  onEnter?: () => void;             // Hook de ciclo de vida: executado quando o passo fica ativo

  // --- Suporte a Capabilities & Feature Flags ---
  hidden?: boolean;                 // Se true, omite o passo do tour
  capability?: string;              // Ex: CAPABILITIES.messaging. Se available === false, omite o passo
  capabilities?: string[];          // Lista de capabilities: se alguma falhar, omite o passo
  condition?: boolean | (() => boolean); // Avaliação booleana dinâmica
  tabId?: string;                   // ID da aba correspondente (sincroniza com SubNavSection)
}
```

---

## 3. Integração com Capabilities e Feature Flags (Agnóstico)

O tour entende o sistema de capabilities e feature flags da aplicação: passos associados a recursos desabilitados ou que o usuário não tem permissão para visualizar **não são exibidos**.

### Como funciona:
1. **No nível do passo (`capability: CAPABILITIES.x`)**:
   O `TourProvider` consulta o cache de capabilities (`useCapabilities`). Se o status indicar `available: false`, o passo é filtrado e o contador `(X / total)` se ajusta automaticamente.
2. **No nível de abas (`filterStepsBySubNavSections`)**:
   Ao usar `SubNavLayout`, passe as seções para o helper `filterStepsBySubNavSections(steps, sections)`. Se a aba tiver `hidden: true` (por flag ou role), o passo daquela aba é sumariamente removido do tour.
3. **Títulos compostos (`CompositeLangLabel`)**:
   Para agrupamentos como *"IA & Canais"* em `/settings`, utilize `CompositeLangLabel` dentro do `content` do passo. O título se adapta dinamicamente (ex: se apenas Canais estiver ativo, o texto exibe *"Canais"* em vez de *"IA & Canais"*).

```tsx
import { filterStepsBySubNavSections } from '@/components/tour';
import { CAPABILITIES } from '@/types/capabilities';

const steps = filterStepsBySubNavSections([
  {
    content: t('tour_email'),
    tabId: 'emailConfig',
    capability: CAPABILITIES.email,
    selectorId: 'settings-tab-emailConfig',
    onEnter: () => setActiveTab('emailConfig'),
  },
  {
    content: t('tour_messaging'),
    tabId: 'messagingConfig',
    capability: CAPABILITIES.messaging,
    hidden: !flags.messaging,
    selectorId: 'settings-tab-messagingConfig',
    onEnter: () => setActiveTab('messagingConfig'),
  },
  {
    content: t('tour_ai'),
    tabId: 'agenteConfig',
    hidden: !flags.aiAgent,
    selectorId: 'settings-tab-agenteConfig',
    onEnter: () => setActiveTab('agenteConfig'),
  },
], sections);

registerTour('settings-general', steps);
```

---

## 3. Comportamento Responsivo Automático

O motor em `tour.tsx` detecta a viewport (`< 768px`) e altera o paradigma de exibição automaticamente:

* **No Desktop ($\ge 768px$)**:
  - Apresentação em *tooltip/popover flutuante* ancorado ao redor do elemento alvo (`top`, `bottom`, `left`, `right`).
  - Coordenadas calculadas em relação à viewport (`position: fixed`) com proteção de bordas (`Math.min` / `Math.max`).
* **No Mobile ($< 768px$)**:
  - Apresentação em *bottom card / bottom sheet* fixado no rodapé (`fixed bottom-4 left-4 right-4`).
  - Os botões de navegação ficam posicionados na área de alcance do polegar.
  - Auto-scroll suave (`element.scrollIntoView({ behavior: 'smooth', block: 'start' })`) rola o elemento destacado para o terço superior da tela, impedindo que o card inferior o cubra.
* **Fallback Gracioso (Elemento Oculto ou Dinâmico)**:
  - Se um elemento não for encontrado no DOM ou estiver com `display: none` / `visibility: hidden` (dimensões `0x0`), o tour **não quebra**:
  - Não renderiza recorte vazio ou distorcido em `(0,0)`.
  - Exibe o card explicativo normalmente (centralizado no desktop ou no rodapé no mobile), garantindo que o usuário consiga ler a instrução e avançar.

---

## 4. Como Implementar em uma Nova Tela

### Cenário A: Tela com Abas (`SubNavLayout` ou Radix Tabs)

Quando o tour explica abas diferentes, use o `onEnter` para alternar a aba ativa. No mobile, aponte `mobileSelectorId` para a área de conteúdo da aba:

```tsx
'use client';

import { useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { SubNavLayout, TabsContent } from '@/components/sub-nav-layout';
import { HelpButton, useTour } from '@/components/tour';
import { useTabParam } from '@/hooks/use-tab-param';
import { useTranslation } from '@/hooks/use-translation';

export default function MinhaPagina() {
  const { t } = useTranslation('meu-namespace');
  const { registerTour } = useTour();
  const [activeTab, setActiveTab] = useTabParam('geral');

  useEffect(() => {
    registerTour('meu-tour-id', [
      {
        content: t('tour_step_geral'),
        selectorId: 'tab-trigger-geral',
        mobileSelectorId: 'content-tab-geral',
        position: 'bottom',
        onEnter: () => setActiveTab('geral'),
      },
      {
        content: t('tour_step_configuracoes'),
        selectorId: 'tab-trigger-config',
        mobileSelectorId: 'content-tab-config',
        position: 'bottom',
        onEnter: () => setActiveTab('config'),
      },
    ]);
  }, [registerTour, t, setActiveTab]);

  return (
    <div>
      <PageHeader
        title={t('title')}
        actions={<HelpButton tourId="meu-tour-id" startDirect />}
      />

      <SubNavLayout
        sections={sections}
        defaultTab="geral"
        tab={activeTab}
        onTabChange={setActiveTab}
      >
        <TabsContent value="geral" id="content-tab-geral">
          {/* Conteúdo geral */}
        </TabsContent>
        <TabsContent value="config" id="content-tab-config">
          {/* Conteúdo config */}
        </TabsContent>
      </SubNavLayout>
    </div>
  );
}
```

### Cenário B: Página Estática ou Formulário

```tsx
useEffect(() => {
  registerTour('tour-cadastro', [
    {
      content: t('tour_nome_empresa'),
      selectorId: 'input-nome-empresa',
      position: 'right', // No mobile vira bottom card automaticamente
    },
    {
      content: t('tour_botao_salvar'),
      selectorId: 'btn-salvar-cadastro',
      position: 'top',
    },
  ]);
}, [registerTour, t]);
```

### Cenário C: Tour dentro de Modal ou Stepper

Se o formulário for dividido em passos de um wizard/stepper, use `onEnter` para mover o stepper:

```tsx
{
  content: t('tour_credenciais'),
  selectorId: 'input-api-token',
  onEnter: () => stepper.goTo('credentials'),
}
```

---

## 5. Boas Práticas e Armadilhas Conhecidas

1. **Sempre use `onEnter` ao transicionar telas/abas**:
   Se um passo descreve elementos que só existem numa aba específica, garanta que `onEnter` ative essa aba para que o elemento seja montado no DOM antes do spotlight.
2. **Atenção a elementos com `hidden md:block`**:
   Em componentes responsivos (como barras laterais que viram drawers no mobile), o elemento do desktop recebe `display: none` no mobile. Utilize `mobileSelectorId` para apontar para o botão móvel ou para o container de conteúdo visível no celular.
3. **Modais do Radix UI (`Dialog` / `Sheet`)**:
   Se um tour for aberto dentro de um Dialog, certifique-se de ignorar o evento de clique fora no dialog:
   ```tsx
   <DialogContent onInteractOutside={ignoreTourInteraction}>
   ```
   Isso impede que clicar nos botões "Próximo" / "Anterior" do tour feche o modal.
4. **Traduções**:
   Sempre registre os textos dos passos nos arquivos de tradução (`locales/pt-BR/<namespace>.json` e `locales/en/<namespace>.json`), acessando via `t('minha_chave')`.

