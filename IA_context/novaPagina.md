Guia: criar um novo módulo completo (backend + frontend)

Este documento descreve passo-a-passo como adicionar um novo módulo seguindo as convenções do projeto.

Backend (NestJS + Prisma)

1) Model Prisma
- Adicione o `model` em `backend-nest/prisma/schema.prisma`. Use `@@map` e índices conforme padrão do projeto.
- Se estiver em desenvolvimento local, você pode aplicar com:

```bash
npx prisma generate
npx prisma migrate dev --name add_<module>
# ou, se preferir empurrar sem migration: npx prisma db push
```

Exemplo mínimo:

model MyEntity {
	id        String   @id @default(uuid())
	name      String
	data      String?
	createdAt DateTime @default(now())
	@@map("my_entities")
}

2) DTOs, Zod schemas e validação
- Crie `backend-nest/src/modules/<module>/dto/` com:
	- `<module>.dto.ts` (resposta/serialização)
	- `create-<module>.dto.ts` (payload de criação)
	- `update-<module>.dto.ts` (payload de atualização)
- Se precisar de validação de query/body, crie schemas Zod e reutilize `ZodValidationPipe` (ex.: `PaginationQuerySchema` existente).

3) Service
- Crie `backend-nest/src/modules/<module>/<module>.service.ts`:
	- Injetar `PrismaService` (via `PrismaModule`).
	- Implementar `create`, `findAll` (suportar `PaginationQuery`), `findOne`, `update`, `remove` conforme necessário.
	- Para campos JSON em SQLite, armazene como `String` (JSON.stringify/parse), veja `LoggingService.createLog`.

4) Controller
- Crie `backend-nest/src/modules/<module>/<module>.controller.ts`:
	- Use decoradores `GetApi`/`PostApi` (padrão do projeto) para documentação Swagger.
	- Use `ZodValidationPipe` para validar queries/body.
	- Controle acesso usando Guards/Decorators do projeto (ex.: roles, jwt guard). Garanta que os endpoints tenham `authenticated` e checagens de permissão apropriadas.

Exemplo de rota list:

@GetApi({ summary: 'Listar <module>', authenticated: true, queries: commonPaginationQueries })
async findAll(@Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery) {
	return this.service.findAll(query);
}

5) Module
- Crie `backend-nest/src/modules/<module>/<module>.module.ts`:
	- Importar `PrismaModule` e quaisquer outros módulos.
	- Providers: Service. Controllers: Controller.
	- Exporte o Service se for usado por outros módulos.

6) Internationalização e mensagens
- Adicione chaves i18n no backend (se houver mensagens geradas) e também no frontend para o namespace do módulo.

7) Testes e Seeds
- Se necessário, atualize `prisma/seed.ts` para popular dados de exemplo.
- Adicione testes unitários/e2e em `test/` seguindo a convenção do projeto.

Frontend (Next.js, TanStack Query)

1) Tipos
- Crie `frontend-next/src/lib/actions/<module>/types.ts` espelhando o DTO do backend (IDs, enums, createdAt string → Date no consumo se preferir).

2) API server-action
- Crie `frontend-next/src/lib/actions/<module>/api.ts` com funções `get<Module>`, `create<Module>`, etc., usando o helper `GET`/`POST` do projeto.

Exemplo:

"use server"
import { GET } from '../../api/api';
export async function getMyEntities(params) {
	return GET(`/my-entity`, { params });
}

3) Queries (React Query)
- Crie `frontend-next/src/lib/actions/<module>/queries.ts` com hooks `useMyEntities` que usam `Collector(() => getMyEntities(params))` e `getQueryConfig('MY_ENTITY')`.

4) Página e componentes
- Crie a página `frontend-next/src/app/(private)/<module>/page.tsx` usando `DataTable` (padrão do projeto).
- Crie `components/<module>-columns.tsx` com as colunas do `DataTable`, use `DataCell`, `DataCellModal`, `Tree` quando necessário.

5) Filtros e paginação
- Siga o padrão: `page` e `limit`, `pagination: true`, `search` para pesquisa global, `filter: JSON.stringify({...})` para filtros específicos.

6) SystemConfiguration e i18n
- Se houver configurações de UI, usar `SystemConfiguration` com `labelKey` existente.
- Adicione chaves de tradução no diretório de mensagens do frontend e use `useTranslation('module')`.

Boas práticas e observações
- Reutilize `PaginationQuerySchema`, `PaginatedResponse` e componentes `DataTable`.
- Mantenha enums sincronizados entre Prisma e frontend (ou usar codegen para gerar types).
- Trate `createdAt` como ISO string no transporte; parse no frontend se for renderizar como Date.
