---
title: Padrão de Use Cases
tags: [backend]
---

# Padrão de Use Cases

Um use case = uma classe `@Injectable()` com **um** método público `execute(input): Promise<Output>`.

**Localização:** `src/modules/<modulo>/use-cases/<nome>.use-case.ts`

O **controller** só orquestra: valida a entrada (DTO Zod), resolve auth via decorator, e chama `useCase.execute(...)`. A regra de negócio e o acesso ao Prisma ficam no use-case.

```ts
// controller
constructor(private readonly signupUseCase: SignupUseCase) {}

@PostApi({ path: 'signup', authenticated: false, status: 'CREATED', ... })
async signup(@Body() dto: SignUpDto) {
  return this.signupUseCase.execute(dto);
}
```

O use-case é registrado no array `providers` do `*.module.ts`. Injete `PrismaService` e o que mais precisar.

## Quando existe um `<nome>.service.ts`

**Só quando há chamador interno.** Service é para lógica que outro módulo consome
por injeção; nunca para o que o controller já obtém do use-case.

| Situação | O que fazer |
|---|---|
| Só o controller usa o fluxo | use-case, sem service |
| Outro módulo precisa ler/escrever isso | service que **delega** ao use-case |
| Service existe e duplica o corpo do use-case | apagar o método do service |

Exemplos de service legítimo: `SystemConfigurationService` (30+ módulos leem config),
`UserConfigurationService` (o módulo de IA lê a credencial BYOK), `LoggingService`
(todo use-case grava auditoria), `FeatureFlagService` (avaliação + cache que o
`FeatureFlagGuard` consome), `CaptchaService` (`verify` para o `CaptchaGuard`).

Nos três primeiros o service **delega** ao use-case no que o controller também
expõe — `SystemConfigurationService.create/update/findOne` são uma linha cada.

Módulos sem service, porque nada externo os consome: `auth`, `user`, `role`,
`role-route-access`, `route`, `user-route-access`, `user-configuration-definition`,
`api-key`, `page-builder`.

> [!tip] Dois pontos de entrada, um use-case
> Um `ai-tools/*.tool.ts` injeta o **mesmo** use-case que o controller — nunca um
> service só para ele. É por isso que a regra mora no use-case e não no controller:
> HTTP, agente e MCP compartilham o corpo. Ex.: `ListUsersTool` → `FindAllUsersUseCase`.

> [!warning] Extrair é **mover**, não copiar
> Ao transformar um método de service em use-case, o método sai do service no mesmo
> commit. Duas cópias do mesmo fluxo divergem em silêncio: o controller chama uma,
> os testes apontam para a outra, e a suíte fica verde cobrindo o lado que não roda
> — inclusive quando a correção de um bug cai na cópia morta.

Fachada que só repassa (`service.findAll()` → `findAllUseCase.execute()`, sem nenhuma
lógica) também não se justifica: o controller injeta o use-case direto.

## Ordem dos parâmetros

`execute(id, ...dados, performedById)` — o identificador primeiro, quem executou por
último. Manter igual entre os use-cases do mesmo módulo: ordem divergente obriga quem
chama a compensar, e a compensação é onde o argumento troca de lugar sem ninguém ver.

## Paginação

Endpoint paginado não monta o envelope à mão. Use `paginate` de
`common/utils/paginate.util.ts`:

```ts
return paginate(query, {
  findMany: (p) => this.prisma.route.findMany({ where, orderBy, ...p }),
  count: () => this.prisma.route.count({ where }),
  map: toRouteDto,          // opcional, aplicado nos dois caminhos
});
```

O `map` vale para a resposta paginada **e** para a lista sem paginação — é o que
evita o mesmo registro sair em dois formatos conforme `?pagination=`.

Formato do envelope em [[request-lifecycle]].

## Gerar

`npm run plop` → `use-case` para um avulso, ou `module` para o CRUD completo — o
generator de módulo cria os cinco use-cases (`find-all`, `find-one`, `create`,
`update`, `remove`) com o spec, e **nenhum service**. Ver [[add-a-use-case]] ·
[[add-a-module]].

**Não criar:** interfaces `IUseCase`, repositórios, camadas application/domain/infra.

Exemplos reais: `modules/auth/use-cases/login.use-case.ts`, `modules/user/use-cases/find-all-users.use-case.ts`. Ciclo completo em [[request-lifecycle]].
