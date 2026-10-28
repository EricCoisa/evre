---
title: Guia — Criar um módulo
tags: [guide, backend]
---

# Guia — Criar um módulo

Use o gerador **plop**. Ele cria o esqueleto completo e já faz a fiação no `AppModule`.

```bash
cd backend-nest
npm run plop        # escolha "module"
# Nome do módulo (PascalCase): ex. Product
```

## O que o gerador cria/altera

`backend-nest/plopfile.js` → generator `module`:

- `src/domain/<nome>/<nome>.entity.ts` + `isActiveStatus.const.ts`
- `src/modules/<nome>/` → `dto/` (create/update/response), `<nome>.controller.ts`, `<nome>.module.ts`, `<nome>.route-ceiling.ts`
- `src/modules/<nome>/use-cases/` → `find-all`, `find-one`, `create`, `update`, `remove` + `<nome>.use-cases.spec.ts`
- `src/i18n/en/<nome>.json` e `src/i18n/pt-BR/<nome>.json`
- Adiciona `model <Nome>` em `prisma/schema/<area>.prisma` e o valor no enum `LogModule`
- Importa e registra `<Nome>Module` em `src/app.module.ts` **e** em `src/app-openapi.module.ts` (módulo
  paralelo que só serve pra gerar o `openapi.json` — sem esse segundo registro o controller não
  aparece no contrato e o Orval nunca gera client pro módulo)
- Adiciona a chave em `domain/logging/logModule.const.ts`
- Adiciona o path em `domain/route/route-path.const.ts` e registra o teto em `RouteCeilingRegistry`
  (`<nome>.route-ceiling.ts`, `providers` do `.module.ts`) com `['ADMIN']` — o controller gerado usa
  `roles: ['ADMIN']` fixo em toda rota, então sem o teto um ADMIN poderia conceder a `Route` a
  MODERATOR/USER via `RoleRouteAccess`/`UserRouteAccess` e a tela ficaria visível sem acesso ao dado.
  Se você ampliar os `roles` do controller depois, amplie o teto também. Ver
  [[auth-rbac#Teto de código: RouteCeilingRegistry]].

## Passos obrigatórios depois

```bash
npx prisma migrate dev --name create_<nome>
npx prisma generate
```

Depois, customize o gerado:

1. Ajuste os campos na Entity e no `model` Prisma.
2. Valide a entrada nos DTOs (Zod — ver [[use-cases]]).
3. Preencha a regra de negócio nos **use-cases** gerados e o spec deles. O gerador
   **não** cria service: crie um só quando outro módulo for consumir a lógica, e aí
   ele delega ao use-case. Padrão em [[use-cases]] · [[add-a-use-case]].
4. Declare auth/roles nas rotas via o decorator (`@GetApi`/`@PostApi`…). Ver [[request-lifecycle]] · [[auth-rbac]].

## Expor no frontend

O contrato muda → regenere o client tipado:

```bash
cd backend-nest && npm run openapi:export     # atualiza openapi.json
cd ../frontend-next && npm run generate:api    # regenera src/lib/generated/
```

Crie os Server Actions da feature em `src/lib/actions/<feature>/`. Ver [[server-actions]].
