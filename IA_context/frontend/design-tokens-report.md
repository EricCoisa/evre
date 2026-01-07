# Design Tokens Report

Resumo dos tokens de design usados na aplicação e exemplos de uso (exemplos representativos).

## Visão geral
- As variáveis estão centralizadas em `frontend-next/src/app/globals.css` e mapeadas para o Tailwind em `frontend-next/tailwind.config.ts`.

## Tokens e finalidades

- **Primary**: cor de ação principal / destaque interativo. Usado em botões primários, seleção, indicadores ativos.
  - Definição: [frontend-next/src/app/globals.css](frontend-next/src/app/globals.css#L144-L161)
  - Exemplos de uso: [frontend-next/src/components/ui/button.tsx](frontend-next/src/components/ui/button.tsx#L12), [frontend-next/src/components/sidebar-nav.tsx](frontend-next/src/components/sidebar-nav.tsx#L64), [frontend-next/src/components/ui/checkbox.tsx](frontend-next/src/components/ui/checkbox.tsx#L17)

- **Secondary**: subtom de ênfase secundária (menor destaque que `primary`).
  - Definição e valores: [frontend-next/src/app/globals.css](frontend-next/src/app/globals.css#L149-L152)

- **Accent**: cor de destaque de suporte — ranges, estados intermediários e espaços de realce.
  - Uso nos calendários, skeletons e estados abertos: [frontend-next/src/components/ui/calendar.tsx](frontend-next/src/components/ui/calendar.tsx#L207), [frontend-next/src/components/ui/skeleton.tsx](frontend-next/src/components/ui/skeleton.tsx#L7)

- **Muted**: texto/elementos de baixa hierarquia (placeholders, instruções, ícones secundários).
  - Ex.: `text-muted-foreground` em [frontend-next/src/components/data-table.tsx](frontend-next/src/components/data-table.tsx#L175)

- **Destructive**: semanticamente *danger* / ação destrutiva — botões e mensagens de erro.
  - Ex.: botão destrutivo em [frontend-next/src/components/ui/button.tsx](frontend-next/src/components/ui/button.tsx#L14), alertas em [frontend-next/src/components/data-table.tsx](frontend-next/src/components/data-table.tsx#L343-L345)

- **Sidebar-***: paleta dedicada ao painel lateral (`--sidebar`, `--sidebar-accent`, `--sidebar-primary`, `--sidebar-foreground`, `--sidebar-border`, `--sidebar-ring`).
  - Centralizado em: [frontend-next/src/app/globals.css](frontend-next/src/app/globals.css#L167-L174)
  - Uso extensivo em: [frontend-next/src/components/ui/sidebar.tsx](frontend-next/src/components/ui/sidebar.tsx#L173-L173) e [frontend-next/src/components/sidebar-nav.tsx](frontend-next/src/components/sidebar-nav.tsx#L43-L44)

- **Popover / Card / Input / Ring / Border**: tokens de superfície e foco para containers, bordas e anéis de foco.
  - Mapeamento no Tailwind: [frontend-next/tailwind.config.ts](frontend-next/tailwind.config.ts#L84-L92)
  - Uso em popovers/dropdowns: [frontend-next/src/components/ui/popover.tsx](frontend-next/src/components/ui/popover.tsx#L33)

- **Success / Warning / Info**: cores semânticas para estados de sucesso/aviso/info.
  - Ex.: `switch` usa `success` em [frontend-next/src/components/ui/switch.tsx](frontend-next/src/components/ui/switch.tsx#L16)

## Utilitários visuais importantes
- `nav-active-glow` / `shadow-glow-primary`: efeitos visuais baseados em `--primary` definidos em `globals.css` (efeitos de glow e sombras).
  - Definições: [frontend-next/src/app/globals.css](frontend-next/src/app/globals.css#L401-L416)

- Gradientes e variantes light/dark: definidos em `globals.css` e aplicados via classes/Tailwind tokens.
  - Ver seção de temas: [frontend-next/src/app/globals.css](frontend-next/src/app/globals.css#L144-L161)

## Observações e recomendações rápidas
- A semântica dos tokens está consistente: `primary`, `muted`, `destructive`, `success` seguem usos esperados.
- A separação de `sidebar-*` é útil para manter a paleta do layout apartada das cores globais.
- Como próximo passo, posso gerar uma lista completa (CSV/JSON) com todas as ocorrências token → arquivo:linha se você quiser análise exaustiva.

---