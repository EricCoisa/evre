---
title: Server Actions
tags: [frontend]
---

# Server Actions

A ponte do frontend para o backend. Ficam em `src/lib/actions/<feature>/` com a diretiva `"use server"`. As telas (Server e Client Components) importam essas funções em vez de chamar HTTP direto.

## Padrão: adapter fino sobre o client gerado

Um action delega ao cliente tipado do Orval e envelopa o resultado num `ApiResponse<T>` (`{ success, data, message, status }`) para as telas que checam `res.success`.

Os helpers vivem em `src/lib/actions/wrap.ts` e são as **únicas** formas de invocar o client Orval:

### `wrap<T>` — quando os tipos batem

Use quando o tipo retornado pelo Orval já é compatível com o tipo de domínio:

```ts
// src/lib/actions/user/api.ts
import { wrap } from '../wrap';

export async function getRoles(): Promise<ApiResponse<RoleOption[]>> {
  return wrap(() => api.userControllerGetRoles()); // Orval retorna RoleOption[] ✓
}
```

### `wrapAs<T>` — quando o Orval gera tipo incompatível

O Orval às vezes gera tipos mais amplos do que o necessário — `value: { [key: string]: unknown }` para campos genéricos, ou `data?: T[]` (opcional) em vez de `data: T[]` para respostas paginadas. Nesses casos use `wrapAs<T>`: o cast `unknown → T` fica centralizado nele, e os adapters ficam limpos.

```ts
import { wrapAs } from '../wrap';

// Orval gera data?: UserDto[] mas o DataTable espera PaginatedResponse<User>
export async function getUsers(params?): Promise<ApiResponse<PaginatedResponse<User> | User[]>> {
  return wrapAs(() => api.userControllerFindAll(params));
}

// Orval gera value: { [key: string]: unknown } mas o domínio usa SystemConfiguration<T>
export async function getSystemConfiguration<T>(key: string): Promise<ApiResponse<SystemConfiguration<T>>> {
  return wrapAs(() => api.systemConfigurationControllerFindByLabelKey(key));
}
```

**Regra de escolha:** se o call precisaria de `as unknown as Promise<T>` dentro do `wrap`, use `wrapAs<T>` em vez disso.

- Endpoints **no contrato OpenAPI** → use o client gerado (`api.userFindAll`, etc.) com `wrap` ou `wrapAs`.
- Endpoints **no contrato mas com corpo que o Orval não modela** (multipart, blob) → chame `customInstance` direto, com o path vindo de `API_PATHS`. Ex.: upload de avatar e export LGPD em `actions/user/api.ts`.
- Endpoints **fora do `openapi.json`** → wrapper `GET`/`POST` de `lib/api/api.ts`. Hoje só o Authorization Server do OAuth, em `actions/mcp/api.ts`.

A autenticação é transparente: o axios do Orval injeta o cookie de token e `Accept-Language` no servidor. Ver [[http-client-orval]] e [[frontend-auth]].

## O IP do usuário precisa atravessar junto (`lib/api/client-ip.ts`)

Todo action roda no **servidor** Next — para o backend, quem chamou foi o container do Next, não o browser. Sem repassar o IP original, o rate limit do backend passa a contar um balde só para todos os usuários e um atacante derruba o app inteiro. O porquê completo está em [[observability]].

`clientIpHeader()` resolve isso: lê o `x-forwarded-for` que chegou e devolve pronto para espalhar num header de saída.

```ts
import { clientIpHeader } from '@/lib/api/client-ip';

const { data } = await axios.post(url, body, {
  headers: { ...outros, ...(await clientIpHeader()) },
});
```

Já está ligado nos dois interceptors (`orval-instance.ts` e `api.ts`), então **action que passa por `wrap`/`wrapAs` não precisa fazer nada**. A regra vale para quem abre um caminho novo até o backend: route handler em `app/api/**`, axios solto, `fetch` cru.

Três detalhes que não são óbvios:

- **Repassa verbatim, sem anexar o próprio IP.** O backend lê a entrada mais à esquerda da lista; acrescentar o IP do Next só empurra o cliente para longe de onde ele é lido.
- **`middleware.ts` tem a própria cópia** (`forwardedFor()`), porque `next/headers` não existe no runtime do middleware. Mesma lógica, três linhas — não tente compartilhar o módulo.
- **Sem proxy na frente do Next não há IP nenhum.** Next 15+ removeu `NextRequest.ip`, então em dev o header simplesmente não sai. `clientIpHeader()` devolve `{}` e a chamada segue normal.

### O mesmo padrão vale para o captcha

`captchaHeader(token)` (`lib/api/captcha-header.ts`) monta o `x-captcha-token` da mesma forma, e pelo
mesmo motivo: em header, o token não entra em nenhum DTO nem schema zod, e ligar ou desligar captcha
não mexe em contrato.

A diferença é de origem. O IP a Server Action descobre sozinha; o token do captcha **nasce no
browser**, então chega como argumento explícito — é por isso que `signUp` e `forgotPassword` recebem
um segundo parâmetro. As duas seguem usando o client gerado: o mutator do Orval aceita config por
chamada, então o header vai no segundo argumento da própria função gerada
(`api.userControllerSignup(data, { headers: captchaHeader(token) })`). No login o token atravessa o
route handler `app/api/auth/login/route.ts`, que o repassa junto com o IP. Ver [[captcha]].

## Mutation que altera dado de um RSC precisa de `router.refresh()`

Uma tela de detalhe (`proposal/[id]/page.tsx`, `company/[id]/page.tsx`) costuma ser **Server
Component**: busca o registro no servidor e passa o resultado como prop estática. Nesse desenho,
**nenhuma query cliente está montada** na chave que a mutation invalida (`['proposal', id]`,
`['company', id]`) — não existe observador para `invalidateQueries` acordar. `invalidateQueries`
sozinho é **no-op**; a tela só muda com reload manual.

O padrão canônico é `useFeatureFlagSync` (`lib/actions/feature-flag/queries.ts`): o hook de sync
chama `invalidateQueries` **e** `router.refresh()`, que é quem de fato refaz o render do RSC.

```ts
function useFeatureFlagSync() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    router.refresh();
  };
}
```

Toda mutation cujo resultado o RSC de detalhe exibe precisa repetir essa anatomia — `useRouter()`
no hook, `router.refresh()` no `onSuccess`, ao lado do `invalidateQueries`. Hoje é o caso em
`lib/actions/proposal/queries.ts` (`useUpdateProposal`, `useUpdateProposalLayout`,
`useUpdateProposalTerms`, `usePublishProposal`, `useUpdateProposalStatus`,
`useAcceptProposalOffline`) e `lib/actions/company/queries.ts` (`useUpdateCompany`). Ver
[[page-structure]] § "Mudou o dado: como a tela server-side reage" para a mesma regra do lado do
gating por flag.

⚠️ Só nas mutations que mudam o que o RSC entregou. Em toda mutation vira um re-render de página
inteira a cada clique — por isso mutations que só afetam listas (`useArchiveProposal`,
`useDuplicateProposal`) continuam só com `invalidateQueries`.

## Alive e Collector (`lib/api/collector.ts`)

Dois helpers para lidar com `ApiResponse<T>` em mutations client-side.

**`Alive(action)`** — para Server Actions chamadas de fora de hooks React (ex.: `mutationFn`):

```ts
import { Alive } from '@/lib/api/collector';

mutationFn: (dto: CreateDto) => Alive(() => createItem(dto))()
```

- Se `response.success === false`: exibe `toast.error` e lança. `response.message` já é string — o backend serializa todo erro no mesmo envelope, ver [[error-handling]].
- Se status 401: tenta refresh silencioso uma vez, repete; se falhar → redireciona para login.
- Se sucesso: retorna `response.data` diretamente.

**O erro lançado carrega o status HTTP.** Leia com `errorStatus(error)` — sem isso um 403 é indistinguível de um 500, porque só a mensagem chega a quem chamou:

```ts
import { errorStatus } from '@/lib/api/collector';

if (errorStatus(query.error) === 403) { /* trate na sua UI */ }
```

**`silentStatuses`** desliga o toast para os status que você trata sozinho na tela. O erro continua sendo lançado; só o aviso global some:

```ts
Alive(() => fetchAlgo(), { silentStatuses: [403] })
```

Use quando o erro **não é acionável pelo usuário** e a chamada não foi iniciada por ele. O caso típico é o PageBuilder: blocos vindos de um layout padrão podem apontar para fontes que aquele usuário não alcança, e sem `silentStatuses` três blocos assim viram três toasts a cada carregamento. Ver [[page-builder]]. Para ação que o usuário disparou, deixe o toast — ele precisa saber que não funcionou.

O caller **não checa `res.success`** — `mutateAsync` já lança em caso de erro:

```ts
try {
  await createMutation.mutateAsync(data);
  toast.success('Criado!');
} catch {
  // Alive já exibiu o toast de erro
}
```

**`Collector(action, options?)`** — versão hook-based, usa `emulateError` do `AppContext` para simular falhas em dev. Aceita as mesmas `options` do `Alive` e as repassa. Só disponível em Client Components. Para `mutationFn`, use `Alive`.

## Regras

- Um arquivo `api.ts` por feature em `lib/actions/<feature>/`.
- Não montar URL nem header de auth à mão numa tela — passe pelo action.
- Tipos (`User`, `UpdateUserDto`…) vêm de `@/lib/generated`.
- Mutations client-side: use `Alive`; não cheque `res.success` no caller.
