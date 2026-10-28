---
title: Testes (backend)
tags: [backend, testing, vitest]
---

# Testes (backend)

Dois escopos com configs separadas — ambos usam **Vitest**.

## Unit tests (`src/**/*.spec.ts`)

Config: `backend-nest/vitest.config.ts`

```bash
npm run test          # roda todos os specs
npm run test:watch    # watch mode
npm run test:cov      # com relatório de cobertura (v8)
```

**Setup:** `test/setup-env.ts` — seta variáveis de ambiente mínimas (`JWT_SECRET`, `JWT_EXPIRATION`, `CRYPTO_SECRET`, etc.) antes de cada suite.

**Cobertura exigida: 100%** em `branches / functions / lines / statements` para:
- `src/modules/**/*.service.ts`
- `src/common/services/**/*.ts`
- `src/common/guards/**/*.ts`
- `src/common/filters/**/*.ts`
- `src/common/interceptors/**/*.ts`
- `src/utils/**/*.ts`

Excluídos por cobertura: `*.module.ts`, `*.dto.ts`, `*.entity.ts`, `*.const.ts`, `*.decorator.ts`, `*.strategy.ts`, etc.

### Padrão de spec

```ts
// common/guards/roles.guard.spec.ts
import { RolesGuard } from './roles.guard';

vi.mock('nestjs-i18n', async () => {
  const actual = await vi.importActual<typeof import('nestjs-i18n')>('nestjs-i18n');
  return { ...actual, I18nContext: { current: vi.fn() } };
});

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  afterEach(() => vi.clearAllMocks());

  it('returns true when no roles decorator is present', () => { ... });
});
```

- Use `vi.mock()` para isolar dependências (sem banco real).
- Use `vi.hoisted()` para mockar módulos que são avaliados antes do setup (ex.: crypto callbacks).
- `vi.fn()` para stubs; `vi.spyOn()` quando precisar inspecionar uma instância real.
- `globals: true` → `describe`, `it`, `expect`, `vi` disponíveis sem import.

### Módulos NestJS no unit test

```ts
const module: TestingModule = await Test.createTestingModule({
  providers: [MyService, { provide: PrismaService, useValue: mockPrisma }],
}).compile();
service = module.get<MyService>(MyService);
```

---

## E2E tests (`test/**/*.e2e-spec.ts`)

Config: `backend-nest/vitest.config.e2e.ts`

```bash
npm run test:e2e           # roda todos os e2e
npm run test:e2e:serial    # roda + gera cobertura
```

**Isolamento real:** `test/vitest-global-setup.ts` provisiona um **container PostgreSQL isolado** via Testcontainers, roda `prisma migrate deploy` + `prisma/seed.ts` antes da suite — banco limpo por run, sem dependência do Postgres local.

**Serialização:** `pool: forks, maxForks: 1` — todos os e2e rodam sequencialmente (uma fila de banco real).

**Timeout:** 30 s por teste / hook.

**Setup:** `test/setup-e2e-env.ts` — seta vars de ambiente básicas (JWT_SECRET, etc.). `DATABASE_URL` é injetado pelo global setup.

```ts
// test/auth.e2e-spec.ts
import request from 'supertest';
import { createTestApp } from './helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });

  it('POST /api/v1/auth/login → 200 + HttpOnly cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'admin123' });
    expect(res.status).toBe(200);
  });
});
```

Seed cria `admin@example.com` / `SEED_USER_PASSWORD` (default `admin123`). Ver [[run-locally]].

---

## Quando escrever o quê

| Cenário | Tipo |
|---------|------|
| Lógica de negócio (service, guard, filter, use-case) | Unit |
| Contrato HTTP de um endpoint (status, body, cookie) | E2E |
| Helpers / utils puros | Unit |
| Fluxo completo ponta a ponta (login → autenticado → recurso) | E2E |

Use-cases gerados pelo plop já vêm com `*.spec.ts` — preencha-o; não deixe em branco.
O generator `module` cria um `use-cases/<nome>.use-cases.spec.ts` cobrindo os cinco.

> [!warning] Teste o corpo que roda, não a cópia
> Quando um service delega ao use-case, o teste vai no **use-case**. Testar o service
> nesse caso cobre uma linha de repasse e dá a falsa impressão de cobertura: a suíte
> fica verde sobre o delegador enquanto o corpo que o controller executa segue sem
> nenhum teste.
