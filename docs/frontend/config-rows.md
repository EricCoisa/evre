---
title: Config Rows
tags: [frontend, configuration, componentes]
---

# Config Rows

Camada de componentes que renderiza uma linha de configuração editável (título, descrição,
controle) a partir de uma chave de `SystemConfiguration` ou `UserConfiguration`. É o mesmo motor
nos dois casos — a única coisa que muda é de onde o valor vem. Ver [[system-configuration]] e
[[data-model]] para o lado dos dados; esta nota é só a camada de UI.

## As camadas

```
<ConfigList>                                  layout: separa as linhas por divisor
  <ConfigRow title description>               layout: título + descrição + controle, Suspense/erro próprios
    <ConfigurationRow requirements>           opcional — capability gating (hidden/disabled/hint)
      <SystemConfiguration | UserConfiguration>   busca o valor, persiste o update
        <BaseConfiguration>                   desenha o campo certo pelo valueType/forceType
```

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| `ConfigRow` / `ConfigList` | `components/config-row.tsx` | Layout genérico de uma linha (ou lista de linhas). Não sabe o que é "configuração" — envolve qualquer `children`. |
| `ConfigurationRow` | `components/configuration-row.tsx` | Aplica `requirements` de uma capability: esconde a linha (`hidden`) ou gerencia desabilitação (`disableOnRequirement`) e aviso (`warning`/`warningReason`/`fixPath`). Ver [[capabilities]]. |
| `SystemConfiguration` / `SystemConfigurationRow` | `components/system-configuration.tsx`, `system-configuration-row.tsx` | Lê/grava uma chave de `SystemConfiguration`. Desabilita o controle caso a capability requerida esteja indisponível (`disableOnRequirement: true`). |
| `UserConfiguration` / `UserConfigurationRow` | `components/user-configuration.tsx`, `user-configuration-row.tsx` | Lê/grava uma chave de `UserConfiguration` por usuário. **Permite ao usuário alterar a sua preferência apesar da indisponibilidade** (`disableOnRequirement: false`) e suprime o warn para não-ADMIN. |
| `BaseConfiguration` | `components/base-configuration.tsx` | Motor agnóstico de renderização: escolhe o campo pelo `valueType`/`forceType`, cuida de autosave com debounce, `manualSave` com confirmar/cancelar, e segredo mascarado. Não sabe se o dado é de system ou user config. |

`ConfigRow`/`ConfigurationRow` aceitam um `id`, usado como âncora DOM para deep-link: a busca
global do header (`components/resource-search.tsx`) navega para `?tab=…#<id>` e `flashHashTarget()`
(`lib/hash-target.ts`) faz o scroll e destaca a linha ao chegar.

## Duas formas de compor

**Manual** — quando a linha não depende de nenhuma capability:

```tsx
<ConfigRow title={t('minha_chave')} description={t('minha_chave_desc')}>
  <SystemConfiguration disableLabel labelKey="MINHA_CHAVE" />
  {/* ou <UserConfiguration disableLabel labelKey={...} /> para uma preferência por usuário */}
</ConfigRow>
```

**Com gate de capability** — quando a chave tem `requires()` registrado (ver [[capabilities]]):

```tsx
<SystemConfigurationRow
  title={t('minha_chave')}
  description={t('minha_chave_desc')}
  disableLabel
  labelKey="MINHA_CHAVE"
/>
```

`*ConfigurationRow` busca `requirements` com a mesma query que o controle usa por baixo (sem
request extra) e monta o `<ConfigurationRow>` + o controle por você. Não componha `<ConfigRow>`
manualmente em volta dele — ele já é a linha inteira.

## `forceType` — como o campo é escolhido

Por padrão o campo vem do `valueType` da chave (`STRING` → input, `BOOLEAN` → checkbox, `ENUM` →
select, `DATE` → date/time picker). `forceType` sobrescreve quando o padrão não serve:

| `forceType` | Render | Quando |
|---|---|---|
| *(ausente)* | derivado do `valueType` | caso comum |
| `switch` / `toggle` | `SwitchField` | booleano de ligar/desligar — os dois valores renderizam igual hoje; `toggle` existe no tipo por compatibilidade, sem comportamento próprio |
| `checkbox` | `Checkbox` (shadcn) | booleano simples, sem o rótulo de estado que o `SwitchField` mostra ao lado |
| `button` | botão com check embutido | booleano que também é a ação |
| `textarea` | textarea de 6 linhas | texto longo — combine com `<ConfigRow wide>` |

Nos testes, consulte o controle pelo `role` correspondente (`switch` ou `checkbox` conforme o
`forceType`) dentro da linha, e exercite o valor oposto ao atual para verificar a persistência.

`manualSave` troca o autosave com debounce de 1s por confirmar/cancelar explícito (✓/✗) — útil pra
texto longo ou qualquer valor que não deveria gravar a cada tecla.

## Duas armadilhas já encontradas

### `disableLabel` só esconde o `<Label>`, não a `<Description>`

`disableLabel` existe porque o `ConfigRow`/`ConfigurationRow` já desenha `title` como rótulo da
linha — sem ele, o `BaseConfiguration` desenharia o mesmo texto de novo dentro do controle (via
`t(labelKey)`). Mas ele só suprime o `<Label>`; a `<Description>` interna do `BaseConfiguration`
continua condicionada só a `description` ser truthy, independente de `disableLabel`.

**Regra:** quando a linha já mostra `description` (passada pro `ConfigRow`/`*ConfigurationRow`),
**não repasse `description` de novo pro `<SystemConfiguration>`/`<UserConfiguration>`** — senão ela
aparece duas vezes (uma no cabeçalho da linha, outra dentro do controle). A composição manual do
exemplo acima já segue essa regra (passa `description` só pro `ConfigRow`). Os wrappers
`*ConfigurationRow` recebem um único `description` do chamador e cuidam de **não** repassá-lo ao
controle filho — ao usá-los, basta passar `description` uma vez, como no exemplo.

### `SystemConfiguration`/`UserConfiguration` são dois arquivos espelhados — mantenha os props simétricos

Os dois implementam a mesma interface (`OtherConfigurationProps`) e repassam pro mesmo
`BaseConfiguration`, mas são arquivos separados (fontes de dado diferentes: `system_configurations`
vs `user_configurations`). Ao adicionar ou mudar um prop que afeta o `BaseConfiguration`
(`disableLabel`, `className`, `disabled`, `manualSave`, `forceType`, `showMessage`...), confira os
**dois** arquivos — não só o que você está editando. O mesmo vale para o par
`system-configuration-row.tsx`/`user-configuration-row.tsx`. Não existe teste que trave essa
simetria hoje; revisão manual é o que a mantém.

## Adicionar uma linha nova

1. A chave já existe — `SystemConfiguration` (ver [[system-configuration]]) ou
   `UserConfigurationDefinition` (ver [[data-model]]).
2. A chave depende de uma capability pra funcionar de verdade (credencial, conexão)? Registre
   `requires()` no módulo dono (ver [[capabilities]]) e use `*ConfigurationRow`. Senão, `<ConfigRow>`
   manual + `<SystemConfiguration>`/`<UserConfiguration>`.
3. Escolha `forceType` pela tabela acima se o padrão do `valueType` não servir.
4. Label e descrição em `src/locales/{en,pt-BR}/<namespace>.json`.

## Arquivos de referência

| Peça | Arquivo |
|---|---|
| Layout genérico | `components/config-row.tsx` |
| Gate de capability | `components/configuration-row.tsx` |
| System: controle / linha | `components/system-configuration.tsx`, `components/system-configuration-row.tsx` |
| User: controle / linha | `components/user-configuration.tsx`, `components/user-configuration-row.tsx` |
| Motor de renderização | `components/base-configuration.tsx` |
| Switch com label/descrição | `components/switch-field.tsx` |
