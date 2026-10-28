---
title: Tratamento de erros
tags: [architecture, backend, frontend, pattern]
---

# Tratamento de erros

Todo erro da API sai no **mesmo envelope** e chega ao usuário pelo **mesmo caminho**. Uma forma só, dos dois lados — nenhuma tela desembrulha nada.

## O envelope

`backend-nest/src/common/filters/all-exceptions.filter.ts` é `@Catch()` sem argumento e registrado como filtro global no `main.ts`. Todo erro passa por ele — de qualquer módulo, guard, pipe ou lib de terceiro:

```json
{
  "statusCode": 400,
  "timestamp": "2026-09-24T04:00:00.000Z",
  "path": "/api/v1/email/configuration",
  "message": "getaddrinfo ENOTFOUND smtp.example.com",
  "errors": [{ "path": ["smtpHost"], "message": "Required" }]
}
```

- **`message` é sempre string pronta para exibir.** Nunca objeto, nunca array, nunca JSON serializado.
- **`errors`** só aparece em falha de validação (Zod), um item por campo.

Contrato tipado: `ApiErrorBody` no próprio filtro; `ApiErrorResponse` em `frontend-next/src/lib/actions/auth/types.ts`.

### O que o filtro normaliza

| O `throw` carrega | Vira |
|---|---|
| `new NotFoundException('Usuário não encontrado')` | `"Usuário não encontrado"` |
| objeto `{ statusCode, message, error }` | o `message` plano |
| array de mensagens (validação) | `"a; b"` |
| `'{"message":"x"}'` vindo de SDK de terceiro | `"x"` |
| chave i18n (`common.errors.forbidden`) | o texto traduzido |
| erro não-HTTP (`TypeError`, falha de driver) | mensagem genérica — detalhe interno fica só no log |

## Como lançar um erro

### Texto direto

O caso mais comum no template. O filtro repassa como está:

```ts
throw new NotFoundException('Conversa não encontrada');
```

### Chave i18n

O filtro traduz usando o idioma resolvido da request (`?lang=`, `Accept-Language` ou `X-Language`):

```ts
throw new ForbiddenException('common.errors.forbidden');
```

Convenção da chave: **`namespace.caminho`**, onde `namespace` é o nome do arquivo em `backend-nest/src/i18n/<lang>/`. `common.errors.forbidden` → `common.json` → `errors.forbidden`.

> ⚠️ Chave que não resolve é exibida **crua** na tela (`errors.forbidden` num toast). Confira que ela existe nos dois idiomas antes de usar.

O filtro só tenta traduzir o que casa com `namespace.caminho` (letras, dígitos, `_`, sem espaço) — uma frase com ponto final não é confundida com chave.

Quando a mensagem precisa de interpolação, traduza no próprio `throw`:

```ts
throw new ForbiddenException(
  i18n.t('common.errors.forbidden', { args: { roles: required.join(', ') } }),
);
```

Ver [[i18n]] para os arquivos e resolvers.

### Validação de serviço externo

Todo provider plugável (email, storage, IA) devolve `ProviderResult` — `backend-nest/src/domain/interface/provider-result.ts`:

```ts
export interface ProviderResult {
  status: boolean;
  data: string;
}
```

**Invariante: quando `status` é `false`, `data` é a mensagem de erro para humano — texto puro, nunca JSON.** É esse texto que chega no toast.

No use-case, use o helper em vez de montar a exceção à mão:

```ts
import { assertProviderOk } from 'src/common/utils/provider-result.util';

const result = await this.emailService.validateCandidate(candidate);
assertProviderOk(result); // 400 com result.data quando status === false
```

Assim a tela de configuração de qualquer módulo falha do mesmo jeito. Ver [[service-health-gate]].

## Log e Sentry

O filtro separa por faixa de status:

| Status | Log | Sentry |
|---|---|---|
| 4xx | `logger.warn`, sem stack — é fluxo normal do cliente | não envia |
| 5xx | `logger.error` com stack | `Sentry.captureException` |

Detalhes em [[observability]].

## No frontend

```
Orval/axios → wrap() → ApiResponse<T> → Alive()/Collector() → toast.error
```

- `lib/actions/wrap.ts` lê `response.data.message` direto — sem desembrulho.
- `lib/api/collector.ts` (`Alive`) exibe o toast e relança o erro com o status carimbado; leia com `errorStatus(err)`.
- As route handlers do Next (`frontend-next/src/app/api/**`) respondem no **mesmo envelope** `{ message }`, então `apiNext.ts` lê o mesmo campo.

Detalhe do caminho em [[server-actions]].

## Regras

1. **`message` é string.** Precisa mandar estrutura? É `errors`, não `message`.
2. **Provider nunca serializa erro em JSON** — devolve `err.message`.
3. **4xx para erro do cliente; 5xx só para bug nosso** — é o que vira alerta no Sentry.
4. **Chave i18n só se ela existir** nos dois idiomas, senão o usuário lê a chave.
