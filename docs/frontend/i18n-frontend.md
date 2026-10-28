---
title: i18n (frontend)
tags: [frontend, i18n]
---

# i18n (frontend)

**i18next** + **react-i18next**. Independente do i18n do backend ([[i18n]]).

## Configuração

| Arquivo | Papel |
|---------|-------|
| `frontend-next/i18n.ts` | Inicializa i18next com os recursos e config |
| `frontend-next/next-i18next.config.cjs` | Locale default e lista de locales |
| `frontend-next/src/lib/translation-utils.ts` | Importa e exporta o objeto `resources` (namespace → JSON) |
| `frontend-next/src/locales/{en,pt-BR}/*.json` | Arquivos de tradução por namespace |

Locale default: `pt-BR`. Fallback: `en`.

## Namespaces disponíveis

| Namespace | Arquivo |
|-----------|---------|
| `common` | `common.json` |
| `labelKey` | `labelKey.json` — labels do menu de rotas |
| `users`, `access`, `logging`, `settings`, `profile` | feature-specific |
| `login`, `signup`, `forgotPassword`, `resetPassword` | fluxos de auth |
| `feature-flags` | tela de feature flags |
| `dashboard`, `home` | páginas principais |
| `tour` | textos do onboarding guiado (`components/tour.tsx`) |
| `agent` | chat do agente de IA |
| `page-builder` | editor/renderer de página customizável — ver [[page-builder]] |
| `messaging`, `notification` | mensageria e notificação in-app |

## Usar em componentes

```tsx
import { useTranslation } from 'react-i18next';

export function MyComponent() {
  const { t } = useTranslation('common');
  return <p>{t('save')}</p>;
}
```

Múltiplos namespaces:

```tsx
const { t } = useTranslation(['common', 'users']);
t('common:save');
t('users:title');
```

Hook customizado: `frontend-next/src/hooks/use-translation.ts` (wrapper sobre `useTranslation`).

## Adicionar tradução

1. Adicione a chave em `src/locales/en/<namespace>.json` **e** `src/locales/pt-BR/<namespace>.json`.
2. Pronto — sem precisar alterar mais nada.

Para interpolar valores dinâmicos, use `{{nome}}` no JSON e passe o valor ao chamar `t`:

```json
{ "confirmationPending": "Enviaremos um link para {{email}}." }
```

```tsx
t('confirmationPending', { email });
```

## Adicionar um namespace novo (sem plop)

1. Crie `src/locales/en/<namespace>.json` e `src/locales/pt-BR/<namespace>.json`.
2. Importe e registre em `src/lib/translation-utils.ts`:

```ts
import ptBRMeuModulo from '../locales/pt-BR/meuModulo.json';
import enMeuModulo from '../locales/en/meuModulo.json';

export const resources = {
  'pt-BR': { ..., meuModulo: ptBRMeuModulo },
  en:      { ..., meuModulo: enMeuModulo },
};
```

> O plop frontend faz esse wiring automaticamente ao criar um módulo — ver [[add-a-frontend-module]].

## Mensagens de validação (Zod)

Os formulários usam `zodResolver`, e todo schema sem `message:` explícito exibiria o texto cru do Zod na
tela — em inglês, com vocabulário de biblioteca:

```
Too small: expected string to have >=1 characters
```

O Zod 4 já traz os locales, então `i18n.ts` registra um **error map global** amarrado ao idioma da
sessão, em vez de espalhar `t('...')` em cada `.min()` / `.url()` / `.email()`.

Mas o locale do Zod é escrito para quem conhece a biblioteca. Traduzido, o erro de tamanho vira:

```
Muito pequeno: esperado que string tivesse >=1 caracteres
```

Quem preenche um formulário não lê `>=1`. Então o error map intercepta **só os casos de tamanho em
string** — os únicos que vazam notação — e delega o resto ao locale, que já resolve bem (`URL inválido`,
`endereço de e-mail inválido`):

| Caso | Mensagem |
|---|---|
| `too_small` em string, `min <= 1` | `validation_required` — "Preencha este campo" |
| `too_small` em string, `min > 1` | `validation_min_chars` — "Use pelo menos {count} caracteres" |
| `too_big` em string | `validation_max_chars` — "Use no máximo {count} caracteres" |
| qualquer outro | locale do Zod (`z.locales.pt()` / `z.locales.en()`) |

As três chaves ficam no namespace `common`, e a interpolação usa `{count}` via `applyParams` — a mesma
convenção do resto do app, não o `{{count}}` cru do i18next.

> `min(1)` vira "preencha este campo", não "mínimo de 1 caractere": em formulário, `.min(1)` nunca
> significa tamanho, significa obrigatório.

O error map é resolvido **no parse**, não na criação do schema — schemas declarados no escopo do módulo
(o padrão nas abas de `/settings`) seguem a troca de idioma normalmente.

> Consequência prática: um schema novo **não precisa** de `message:` para ficar traduzido. Passe uma
> mensagem própria só quando o texto genérico não disser o suficiente (ex.: `t('emailRequired')` em vez
> de "preencha este campo"), e aí ela vem do namespace da própria tela.

Regressão em `src/__tests__/zod-messages.test.ts` — inclusive a troca de idioma em runtime.

## Rótulos do menu (`labelKey`)

As rotas no banco (`Route.labelKey`) referenciam chaves do namespace `labelKey`. Ex.: `ROUTE_FEATURE_FLAGS` → `"Feature Flags"`. Cada módulo novo precisa adicionar sua chave em `src/locales/{en,pt-BR}/labelKey.json`.

## Diferença do backend

| | Frontend | Backend |
|---|---|---|
| Lib | i18next / react-i18next | nestjs-i18n |
| Localização dos arquivos | `src/locales/` | `src/i18n/` |
| Resolver | locale default do config | QueryResolver / AcceptLanguageResolver / HeaderResolver |
| Namespace | manual via `translation-utils.ts` | automático por pasta/arquivo |
