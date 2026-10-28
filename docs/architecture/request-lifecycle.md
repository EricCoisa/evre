---
title: Ciclo de vida de uma request
tags: [architecture, backend]
---

# Ciclo de vida de uma request

Todas as rotas vivem sob **`/api/v1`** (`main.ts` → `setGlobalPrefix('api/v1')`).

```
request
  → helmet + cookieParser + CORS            (main.ts)
  → ThrottlerGuard (global)                 (rate limit — app.module.ts)
  → JwtOrApiKeyAuthGuard + ScopeGuard       (por rota, via decorator)
  → RolesGuard                              (SÓ quando a rota declara `roles`)
  → ZodValidationPipe                       (valida body/query contra o DTO Zod)
  → Controller (método)
  → Use-case.execute(...)                   (regra de negócio)
  → PrismaService                           (banco)
  ← LoggingInterceptor / AllExceptionsFilter (log + shape de erro)
```

## Peças (arquivos)

| Etapa | Arquivo |
|-------|---------|
| Bootstrap, middlewares, CORS, Swagger | `backend-nest/src/main.ts` |
| Guard global de rate limit | `app.module.ts` (`APP_GUARD` → `ThrottlerGuard`) |
| Auth/roles por rota | `common/decorators/api-method.decorator.ts` |
| Validação | `ZodValidationPipe` (nestjs-zod), global em `main.ts` |
| Erros | `common/filters/all-exceptions.filter.ts` — envelope único, ver [[error-handling]] |
| Log de request | `common/interceptors/logging.interceptor.ts` |

## O decorator de rota

Controllers não usam `@Get`/`@Post` direto. Usam os wrappers de `api-method.decorator.ts`:
`GetApi`, `PostApi`, `PutApi`, `PatchApi`, `DeleteApi`. Cada um recebe um objeto de config que define método HTTP, path, status, autenticação, roles, e o schema de resposta do Swagger num só lugar.

```ts
@PostApi({
  path: 'signup',
  summary: 'Register a new user',
  authenticated: false,                    // rota pública
  status: 'CREATED',
  response: { success: [{ status: 'CREATED', description: '...', schema: { dto: UserDto } }] },
})
async signup(@Body() dto: SignUpDto) {
  return this.signupUseCase.execute(dto);
}
```

Flags de auth no config (resolvidas em `applyMethod`, `api-method.decorator.ts`):

| Config | Guards aplicados |
|---|---|
| nenhuma | nenhum — rota pública |
| `authenticated: true` | `JwtOrApiKeyAuthGuard`, `ScopeGuard` |
| `roles: [...]` | `JwtOrApiKeyAuthGuard`, `ScopeGuard`, **`RolesGuard`** + `@Roles(...)` |

> [!warning] `authenticated: true` sozinho não autoriza nada
> O `RolesGuard` entra no pipeline **apenas** quando `config.roles?.length` é
> verdadeiro. Sem `roles`, qualquer usuário autenticado alcança a rota — inclusive
> role `USER`. O único guard global da aplicação é o `ThrottlerGuard`.
>
> Isso é correto para rota que age sobre o próprio requisitante (`/me`, ou `:id`
> com `assertOwnershipOrRole`). **Rota mutativa que escreve estado compartilhado
> precisa de `roles` explícito** — não existe default-deny aqui.

`ScopeGuard` é no-op para sessão JWT (`if (authType !== 'api-key') return true`).
Ele só age em requisição por API key, onde é default-deny: endpoint sem metadata
de `scope` é inalcançável por chave.

Detalhes de auth em [[auth-rbac]]. Padrão controller→use-case em [[use-cases]].

## Formato de resposta paginada

Endpoints de lista usam `commonPaginationQueries` + `PaginationQuerySchema` e retornam:

```json
{ "data": [...], "meta": { "total", "page", "limit", "totalPages" } }
```

Ex.: `modules/user/use-cases/find-all-users.use-case.ts`.
