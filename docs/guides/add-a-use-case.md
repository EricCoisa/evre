---
title: Guia — Adicionar um use-case
tags: [guide, backend]
---

# Guia — Adicionar um use-case

Um use-case = uma classe `@Injectable()` com `execute(input): Promise<Output>`. Padrão em [[use-cases]].

## Gerar

```bash
cd backend-nest
npm run plop        # escolha "use-case"
# Nome (kebab): ex. archive-product
# Módulo alvo: ex. product
```

Cria `src/modules/<modulo>/use-cases/<nome>.use-case.ts` + `.spec.ts`.

## Escrever

```ts
@Injectable()
export class ArchiveProductUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string): Promise<Product> {
    return this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }
}
```

## Ligar

1. Registre no array `providers` do `<modulo>.module.ts` (junto do service e dos outros use-cases).
2. Injete no controller e chame:

```ts
constructor(private readonly archiveProductUseCase: ArchiveProductUseCase) {}

@PatchApi({ path: ':id/archive', roles: ['ADMIN'], authenticated: true, ... })
archive(@Param('id') id: string) {
  return this.archiveProductUseCase.execute(id);
}
```

## Não fazer

Não criar interfaces `IUseCase`, repositórios, ou camadas application/domain/infra. Injete `PrismaService` direto.
