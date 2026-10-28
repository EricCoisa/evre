---
title: Cliente HTTP & Orval
tags: [frontend]
---

# Cliente HTTP & Orval

O contrato entre front e back é gerado, não escrito à mão.

## Geração (Orval)

`frontend-next/orval.config.ts`:

- **Input:** `../backend-nest/openapi.json` (exportado pelo backend: `npm run openapi:export`).
- **Output:** `src/lib/generated/` — modo `tags-split` (um arquivo por tag/módulo); os schemas saem em `src/lib/generated/schemas/`, um arquivo por tipo, reexportados por `schemas/index.ts`.
- **Client:** axios, com **mutator** `customInstance` de `src/lib/api/orval-instance.ts`.

Regenerar: `npm run generate:api` (no `frontend-next/`). **Não edite** `lib/generated/` à mão.

Fluxo do contrato:

```
backend (@nestjs/swagger)  →  openapi.json  ─┬→  orval                     →  src/lib/generated/*      (funcoes + tipos)
                                             └→  scripts/generate-api-paths.mjs  →  src/lib/generated/paths.ts  (constantes de rota)
```

`npm run generate:api` roda os dois passos. O segundo existe para as camadas que **não podem** usar as funções geradas — `middleware.ts` (edge runtime) e `app/api/**` (precisam de fetch cru para repassar `Set-Cookie` e streaming). Elas importam `API_PATHS`:

```ts
import { API_PATHS } from '@/lib/generated/paths';

fetch(`${BASE_URL}${API_PATHS.AUTH_REFRESH}`);
fetch(`${BASE_URL}${API_PATHS.AI_CONVERSATIONS_BY_ID_MESSAGES(id)}`);
```

**Nenhum path do backend é escrito à mão no frontend.** `src/__tests__/api-paths.test.ts` falha se aparecer um, ou se `paths.ts` sair de sincronia com o `openapi.json`. Regra completa em [[api-conventions]].

## Como o `openapi:export` funciona

O script `backend-nest/scripts/export-openapi.ts` sobe um módulo NestJS mínimo, gera o documento Swagger e grava `openapi.json`. Duas restrições de infraestrutura moldam esse script:

### Por que `ts-node` e não `tsx`

`tsx` usa esbuild internamente e **não emite `emitDecoratorMetadata`**. Sem isso, o NestJS não consegue resolver os tokens de DI — todos os `design:paramtypes` aparecem como `undefined` e a injeção falha com `UndefinedDependencyException`. O `ts-node` usa o compilador TypeScript real e emite corretamente.

O script usa um tsconfig separado (`backend-nest/tsconfig.scripts.json`) com `module: CommonJS` + `moduleResolution: node`, porque o `tsconfig.json` principal usa `nodenext`, que é incompatível com `ts-node`:

```json
// tsconfig.scripts.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "resolvePackageJsonExports": false
  }
}
```

### Por que `AppOpenApiModule` em vez de `AppModule`

`AppModule` usa `RedisThrottlerStorage` (cria conexão ioredis sem handler de erro) e registra filas BullMQ que exigem Redis real — com ele, o export só roda onde há Redis de pé.

`AppOpenApiModule` (`backend-nest/src/app-openapi.module.ts`) é um módulo dedicado que:
- Substitui o BullMQ connection por `ioredis-mock` (in-memory, sem Redis real)
- Usa `ThrottlerModule.forRoot([...])` com storage padrão em memória
- Importa todos os módulos de negócio **sem alteração** — o contrato Swagger é idêntico ao de produção

```ts
BullModule.forRoot({ connection: new RedisMock() as any })
ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])
```

Nenhum módulo de negócio precisa de tratamento especial para o export.

## `openapi.json` é um artefato commitado

O arquivo `backend-nest/openapi.json` é versionado no repositório. O motivo é arquitetural: o Dockerfile do frontend o copia em build-time para rodar o Orval — não é possível gerá-lo durante o `docker build` porque os dois serviços têm contextos de build independentes e o NestJS não pode ser inicializado sem banco/Redis durante um build Docker convencional.

**Workflow após mudar o contrato backend:**

```bash
# 1. No backend-nest/
npm run openapi:export

# 2. No frontend-next/
npm run generate:api

# 3. Commitar os dois arquivos juntos
git add backend-nest/openapi.json frontend-next/src/lib/generated/
```

**Check de drift sugerido para CI:**

```bash
cd backend-nest && npm run openapi:export
git diff --exit-code backend-nest/openapi.json
```

Falha se `openapi.json` no repo estiver desatualizado em relação ao código.

**CI: gerar antes de lint/test, não só no build.** `src/lib/generated/` é gitignored e só existe via `orval` — o `prebuild` do `package.json` roda isso automaticamente antes do `next build`, mas o job de CI roda `lint`/`vitest` **antes** do `build`. Sem um passo explícito de `pnpm generate:api` logo após o `pnpm install`, qualquer teste ou rota que importe de `@/lib/generated/*` quebra em CI com `Failed to resolve import` — mesmo passando localmente (onde o dev já rodou `generate:api` alguma vez). Ver `.github/workflows/ci.yml`, job `frontend`.

**Falha no `openapi:export` é silenciosa rio abaixo.** O script carrega o `AppOpenApiModule` inteiro, então qualquer erro de import num arquivo transitivamente alcançado derruba o export — mesmo um arquivo sem relação com o contrato HTTP, como uma tool de IA em `modules/*/ai-tools/`. Quando isso acontece o `openapi.json` simplesmente para de acompanhar o código, e o sintoma aparece longe dali: uma rota ou scope novo que não chega à UI. O `git diff --exit-code` acima é o detector.

A causa mais comum de `MODULE_NOT_FOUND` aqui é um import relativo com extensão explícita (`./x.js`): válido sob o `moduleResolution: nodenext` do `tsconfig.json` principal, inválido sob o `moduleResolution: node` do `tsconfig.scripts.json`. **A convenção do repositório é importar sempre sem extensão.**

## As quatro camadas HTTP (`src/lib/api/`)

Documentadas no topo de `orval-instance.ts`:

| Arquivo | Papel |
|---------|-------|
| `orval-instance.ts` | Axios usado pelos clients gerados. Injeta `Authorization: Bearer` (cookie) e `Accept-Language` no server. **Camada padrão.** |
| `api.ts` | Helper axios cru (`GET`/`POST`). Só para superfície **fora do `openapi.json`** — hoje apenas o Authorization Server do OAuth. Não use para a API da aplicação. |
| `apiNext.ts` | `fetch` para as **API routes do próprio Next** (`/api/...`), client-side, com timeout e erro padronizados (`ApiNextError`). |
| `collector.ts` | `Alive`/`Collector`: desembrulham o `ApiResponse<T>`, exibem `toast.error`, renovam a sessão uma vez no 401 e relançam o erro com o status carimbado. Ver [[server-actions]] · [[error-handling]]. |

## customInstance (o mutator)

```ts
// orval-instance.ts
const instance = axios.create({ baseURL: NEXT_PUBLIC_API_URL, withCredentials: true });
instance.interceptors.request.use(async (config) => {
  const token = await getServerAccessToken();          // cookie HttpOnly
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  config.headers['Accept-Language'] = (await getServerLang()) ?? 'pt-BR';
  return config;
});
```

O mutator aceita um **segundo parâmetro** com opções por chamada, e o Orval o repassa em toda função gerada. É o que permite mandar header específico de uma request (captcha, por exemplo) sem sair do client tipado:

```ts
api.authControllerForgotPassword(dto, { headers: captchaHeader(token) });
```

`BASE_URL` = `NEXT_PUBLIC_API_URL` (default `http://localhost:3001/api/v1`). Auth em [[frontend-auth]]; consumo em [[server-actions]].
