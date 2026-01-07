# DataTable - Guia de Uso com Search e Filtros

## Visão Geral

O componente `DataTable` é uma tabela reutilizável que suporta:
- **Paginação** (manual via backend)
- **Busca global** (`search`) - pesquisa em múltiplos campos
- **Filtros específicos** (`filter`) - filtros por colunas individuais
- **Ordenação** (sorting)
- **Agrupamento** (grouping)

## Estados Necessários

Para usar search e filtros, você precisa de 3 estados na sua página:

```tsx
const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
const [globalFilter, setGlobalFilter] = useState('');
const [filters, setFilters] = useState<Record<string, string>>({});
```

## Query Parameters

Os filtros devem ser enviados para o backend da seguinte forma:

```tsx
const queryParams = {
  page: pagination.pageIndex + 1,
  limit: pagination.pageSize,
  pagination: true,
  ...(globalFilter && { search: globalFilter }),
  ...(Object.keys(filters).length > 0 && { filter: JSON.stringify(filters) }),
};

const { data, error } = useYourQuery(queryParams);
```

### Por que `JSON.stringify(filters)`?

O objeto `filters` é serializado como JSON string porque:
- Axios serializa objetos como `filter[key]=value`, o que não é o formato esperado
- O backend recebe como string e faz parse automaticamente
- Garante que múltiplos filtros sejam enviados corretamente

## Uso do DataTable

```tsx
<DataTable
  columns={columns}
  data={data}
  error={error}
  queryKey={['users', queryParams]}
  pagination={pagination}
  onPaginationChange={setPagination}
  globalFilter={globalFilter}
  onGlobalFilterChange={setGlobalFilter}
  filters={filters}
  onFiltersChange={setFilters}
  enableGlobalFilter={true}
  loadingMessage={t('loading')}
  emptyMessage={t('noUsers')}
  entityName={t('entity')}
  entityNamePlural={t('entityPlural')}
>
  {/* Componentes filhos */}
</DataTable>
```

## Componentes Filhos

### DataTable.Input - Busca Global

Usado para pesquisa em múltiplos campos (email, nome, etc):

```tsx
<DataTable.Input 
  placeholder="Buscar usuários..."
  className="border-border/50 focus:border-primary/50 focus:ring-primary/20"
/>
```

**Comportamento:**
- Atualiza o estado `globalFilter`
- Envia `search` para o backend
- Backend busca em múltiplos campos usando `OR`

### DataTable.Select - Filtro por Coluna

Usado para filtrar por valores específicos de uma coluna:

```tsx
<DataTable.Select 
  accessorKey="role" 
  placeholder="Filtrar por Role"
  className="border-border/50"
/>

<DataTable.Select 
  accessorKey="status" 
  placeholder="Filtrar por Status"
  className="border-border/50"
/>
```

**Comportamento:**
- Extrai valores únicos da coluna automaticamente
- Atualiza o estado `filters` com a chave sendo o `accessorKey`
- Envia `filter` como JSON string para o backend
- Backend aplica filtros usando `AND`

**Múltiplos Selects:**
```tsx
// Exemplo com 2 filtros
filters = {
  role: "ADMIN",
  status: "ACTIVE"
}

// Enviado como:
filter={"role":"ADMIN","status":"ACTIVE"}
```

## Backend - Recebimento dos Filtros

### Schema de Validação (pagination.schema.ts)

```typescript
export const PaginationQuerySchema = z.object({
  page: z.string().optional().default('1').transform((v) => Number(v)),
  limit: z.string().optional().default('10').transform((v) => Number(v)),
  pagination: z.union([z.string(), z.boolean()]).optional().default('true'),
  search: z.string().trim().optional(),
  filter: z
    .union([z.string(), z.record(z.string(), z.string())])
    .optional()
    .transform((v): Record<string, string> => {
      if (typeof v === 'string') {
        try {
          const parsed = JSON.parse(v) as unknown;
          if (typeof parsed === 'object' && parsed !== null) {
            return parsed as Record<string, string>;
          }
          return {};
        } catch {
          return {};
        }
      }
      return v || {};
    }),
});
```

### Service - Aplicação dos Filtros

```typescript
async findAll(query: PaginationQuery): Promise<PaginatedResponse<UserDto> | UserDto[]> {
  const { page, limit, pagination, search, filter } = query;

  // Constrói a cláusula where separando search e filter
  const where: {
    OR?: Array<{
      email?: { contains: string };
      name?: { contains: string };
    }>;
    role?: UserRole;
    status?: UserStatus;
  } = {};

  // Aplica filtro de busca global (search)
  if (search) {
    where.OR = [
      { email: { contains: search } },
      { name: { contains: search } },
    ];
  }

  // Aplica filtros específicos (filter)
  if (filter?.role) {
    where.role = filter.role as UserRole;
  }

  if (filter?.status) {
    where.status = filter.status as UserStatus;
  }

  // Executa a query
  const data = await this.prisma.user.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
  });
  
  return data;
}
```

## Funcionamento Completo

### 1. Usuário Digita no Input
```
DataTable.Input → setGlobalFilter("João") → queryParams.search = "João" → Backend
```

**Backend WHERE:**
```sql
WHERE email LIKE '%João%' OR name LIKE '%João%'
```

### 2. Usuário Seleciona no Select
```
DataTable.Select (role) → setFilters({role: "ADMIN"}) → queryParams.filter = '{"role":"ADMIN"}' → Backend
```

**Backend WHERE:**
```sql
WHERE role = 'ADMIN'
```

### 3. Ambos Juntos
```
Input = "João"
Select (role) = "ADMIN"
Select (status) = "ACTIVE"
```

**Backend WHERE:**
```sql
WHERE (email LIKE '%João%' OR name LIKE '%João%')
  AND role = 'ADMIN' 
  AND status = 'ACTIVE'
```

## Exemplo Completo - Página de Usuários

```tsx
export default function UsersPage() {
  const { t } = useTranslation('users');
  
  // Estados necessários
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Query params com filtros
  const queryParams = {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true,
    ...(globalFilter && { search: globalFilter }),
    ...(Object.keys(filters).length > 0 && { filter: JSON.stringify(filters) }),
  };

  // Fetch data
  const { data, error } = useUsers(queryParams);

  return (
    <DataTable
      columns={columns}
      data={data}
      error={error}
      queryKey={['users', queryParams]}
      pagination={pagination}
      onPaginationChange={setPagination}
      globalFilter={globalFilter}
      onGlobalFilterChange={setGlobalFilter}
      filters={filters}
      onFiltersChange={setFilters}
      enableGlobalFilter={true}
      loadingMessage={t('loading')}
      emptyMessage={t('noUsers')}
    >
      <DataTable.Input placeholder={t('searchPlaceholder')} />
      <DataTable.Select accessorKey="role" placeholder="Filtrar por Role" />
      <DataTable.Select accessorKey="status" placeholder="Filtrar por Status" />
    </DataTable>
  );
}
```

## Boas Práticas

1. **Sempre use `enableGlobalFilter={true}`** quando usar `DataTable.Input`
2. **Inclua `queryParams` na `queryKey`** para invalidar cache quando filtros mudarem
3. **Use `JSON.stringify(filters)`** ao enviar para o backend
4. **No backend, separe `search` (OR) e `filter` (AND)** para lógica correta
5. **Valide e faça parse do `filter`** no schema de validação

## Diferenças entre Search e Filter

| Aspecto | Search (globalFilter) | Filter (filters) |
|---------|----------------------|------------------|
| **Componente** | `DataTable.Input` | `DataTable.Select` |
| **Estado** | `string` | `Record<string, string>` |
| **Backend Param** | `search` | `filter` (JSON string) |
| **Lógica SQL** | `OR` (múltiplos campos) | `AND` (campos específicos) |
| **Uso** | Busca livre | Filtro por valores fixos |
| **Exemplo** | "João Silva" | role: "ADMIN" |

## Troubleshooting

### Filtros não estão funcionando
- ✅ Verifique se `globalFilter` e `filters` estão sendo passados para o `DataTable`
- ✅ Confirme que `queryParams` inclui os filtros
- ✅ Verifique se `queryKey` inclui `queryParams` para invalidar cache
- ✅ No backend, confira se o schema está fazendo parse do JSON

### Tabela vazia inicialmente
- ✅ Use `...(globalFilter && { search: globalFilter })` para não enviar search vazio
- ✅ Use `...(Object.keys(filters).length > 0 && { filter: ... })` para não enviar filter vazio

### Select mostra valores estranhos
- ✅ Verifique se o `accessorKey` está correto
- ✅ O componente extrai valores únicos dos dados atuais da tabela
- ✅ Se os dados não carregaram, o select estará vazio
