---
title: Testes (frontend)
tags: [frontend, testing, vitest]
---

# Testes (frontend)

**Vitest + jsdom + Testing Library.** Config: `frontend-next/vitest.config.ts`. Setup global: `frontend-next/src/test-setup.ts`.

```bash
npm run test           # watch mode
npm run test:ci        # roda uma vez (--run)
npm run test:coverage  # roda uma vez + relatório de cobertura (v8)
```

`@vitest/coverage-v8` é devDependency explícita — sem ela `test:coverage` falha com "Failed to load url @vitest/coverage-v8".

## Escopo da cobertura

`coverage.include` em `vitest.config.ts` é `src/components/**` + `src/lib/**`. `coverage.exclude` tira três famílias que não compensam testar:

| Exclusão | Por quê |
|---|---|
| `src/components/ui/**` | shadcn — componente de terceiro, não é código deste projeto |
| `src/lib/generated/**` | cliente Orval — "Do not edit manually", regenerado por `npm run generate:api` a cada mudança de contrato; teste quebraria a cada regeneração sem cobrir risco real |
| `src/lib/seeds/**` | seed data do Payload, roda uma vez no boot — dado estático, não lógica |

Arquivo `*/types.ts` que só tem `export type`/`export interface` erasa no compile e não tem o que cobrir — não precisa de teste. Mas cheque antes: vários têm um `enum`, `const` ou re-export real no meio (ex.: `EmailTemplateType`, `MCP_SCOPES`) — esses sim merecem um teste de uma linha confirmando o valor.

## Antes de criar um teste: verifique se já existe

Cobertura parcial (nem 0%, nem 100%) é sinal de que **já existe** um `*.test.ts(x)` para aquele arquivo — procure antes de usar o Write tool para criar um novo, ou você sobrescreve testes existentes em silêncio. `Edit`/estenda o arquivo encontrado.

## Setup global (`src/test-setup.ts`)

### Mocks automáticos em todo teste

- `next/navigation`: `useRouter`/`usePathname`/`useSearchParams`/`useParams`.
- `@/lib/actions/auth/queries`: `useMe` (retorna `{data: null, isLoading: false}`).
- `@/lib/actions/auth/auth-action`: só `refresh`.

**Gotcha:** testando o próprio módulo que o setup global automockka (ex.: `auth-action.ts`, `auth/queries.ts`)? O mock se aplica por caminho resolvido, não pela string do import — então o SEU teste também recebe o mock em vez do código real, a não ser que adicione `vi.unmock('@/lib/actions/auth/auth-action')` no topo do próprio arquivo de teste.

### Polyfills de ambiente

jsdom não implementa tudo que o browser real tem. Já cobertos aqui, não precisa repetir por teste:

| Polyfill | Por quê |
|---|---|
| `window.matchMedia` | usado por hooks de responsividade |
| `AbortSignal.any` | combina o signal do chamador com um timeout interno (ex.: `apiNext.ts`) |
| `DragEvent`, `ClipboardEvent` | `@lexical/rich-text` checa `event instanceof DragEvent/ClipboardEvent` para distinguir origem do paste; sem a classe, vira `ReferenceError` em vez de só dar `false` |
| `DataTransfer` | jsdom não implementa a API; o teste de paste do Lexical passa o mesmo objeto de transferência em `clipboardData` e `dataTransfer`, pois `eventFiles()` pode identificar o evento sintético como `ClipboardEvent` ou `DragEvent` |

O teste `src/components/rich-text-input.test.tsx` fornece `clipboardData` e `dataTransfer` com o mesmo objeto de transferência no evento sintético de paste. Assim, o `eventFiles()` do Lexical encontra `.types` independentemente de qual tipo de evento o jsdom expõe.

## Mock de tradução

Padrão usado em toda a suíte — `t(key)` devolve a própria chave, e anexa os valores dos params quando existem (permite afirmar texto sem depender do i18n real nem decorar todas as chaves):

```ts
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))
```

## Testando `lib/actions/<módulo>/api.ts`

Este projeto tem **três camadas HTTP** diferentes — confira o import no topo do arquivo antes de mockar, não assuma:

| Camada | Import | Quando |
|---|---|---|
| `GET`/`POST` de `@/lib/api/api` | `import { GET, POST } from '@/lib/api/api'` | módulos antigos, pré-Orval (`access/*`, `userConfiguration`, `verification`, `notification`, `pageBuilder`, …) |
| `APINEXT` de `@/lib/api/apiNext` | `import { APINEXT } from '@/lib/api/apiNext'` | chamadas à própria rota Next (`/api/...`), não direto ao backend |
| Cliente gerado do Orval | `import { getX } from '@/lib/generated/x/x'` | a maioria dos módulos novos — mocka a função factory (`getX: () => mockClient`) |
| `customInstance` de `@/lib/api/orval-instance` | `import { customInstance } from '@/lib/api/orval-instance'` | módulos que pulam o cliente gerado e chamam o mutator Orval direto |

Teste o retorno no formato `ProviderResult` (`{success, data, message, status}`): um caminho de sucesso por função exportada é o mínimo; cubra também o caminho de erro em funções com lógica real de formatação de payload/resposta. Exemplos reais: `src/lib/actions/user/api.test.ts`, `src/lib/actions/messaging/api.test.ts`, `src/lib/api/api.test.ts`, `src/lib/api/apiNext.test.ts`.

## Testando `lib/actions/<módulo>/queries.ts`

Hooks de React Query — `renderHook` do `@testing-library/react` com um `QueryClientProvider`:

```tsx
function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}
const { result } = renderHook(() => useAlgumaCoisa(), { wrapper })
await waitFor(() => expect(result.current.isSuccess).toBe(true))
```

Mocke o `./api` irmão, não a camada HTTP — é um nível de indireção mais alto e mais estável.

**Gotcha:** `Collector`/`EmulateMutationError` (de `@/lib/api/collector`) chamam `useApp()` de `@/contexts/appProvider` internamente — toda `queries.ts` que passa por `Collector` precisa de `vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn(() => ({ emulateError: false })) }))`, senão o hook real estoura "must be used within an AppProvider" fora do contexto. Para cobrir o branch de `emulateError: true` (toast + throw simulado, sem chamar a action real), troque o retorno do mock numa `it` específica.

Exemplo completo com várias hooks + mutations + invalidação de cache: `src/lib/actions/messaging/queries.test.tsx`, `src/lib/actions/access/roleRouteAccess/queries.test.tsx`.

## Testando componente que consome hook de query

Mocke o hook direto, não a cadeia HTTP inteira — ver `src/components/agent/conversation-list.test.tsx` (padrão `setup()` + `userEvent`).

## Ver também

[[http-client-orval]] para a camada de API no cliente, [[async-boundary]] para o padrão `useQuery` × `useSuspenseQuery` que também importa na hora de escolher como mockar.
