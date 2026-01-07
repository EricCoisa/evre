# Documentation for AI-Assisted Development

## Overview
This folder contains comprehensive documentation designed to help AI assistants (LLMs) and developers create new modules following the established patterns in this NestJS + Next.js full-stack application.

## Purpose
Enable consistent, high-quality module creation by providing:
- **Clear patterns and conventions**
- **Step-by-step workflows**
- **Real code examples**
- **Best practices**

## Tech Stack
- **Backend**: NestJS + Prisma ORM + PostgreSQL
- **Frontend**: Next.js 14+ (App Router) + React Query + Tailwind CSS
- **Authentication**: JWT with RBAC
- **Internationalization**: i18next
- **Type Safety**: TypeScript throughout

## Documentation Structure

### 1. [Project Overview](1_PROJECT_OVERVIEW.md)
**Purpose**: High-level understanding of architecture and patterns

**Contains**:
- Architecture summary
- Tech stack details
- Directory structure
- Key architectural patterns
- Data flow diagrams
- Core concepts (pagination, auth, i18n, error handling)
- Environment variables
- Development workflow overview

**Read this first** to understand the project structure.

---

### 2. [Prisma Guide](2_PRISMA_GUIDE.md)
**Purpose**: Database modeling with Prisma ORM

**Contains**:
- Schema structure
- Creating enums
- Creating models with relations
- Field types reference
- Relation patterns (1:1, 1:N, N:M)
- Cascade delete strategies
- Index optimization
- Migration workflow
- Seeding data
- Prisma Client usage patterns

**Start here** when adding new database tables.

---

### 3. [Backend Guide](3_BACKEND_GUIDE.md)
**Purpose**: NestJS module creation

**Contains**:
- Module structure
- Domain entity creation
- DTO patterns (Create, Update, Response)
- Service implementation
- Controller patterns
- Custom decorators (@GetApi, @PostApi, etc.)
- Module registration
- Internationalization (i18n)
- Error handling
- Logging patterns

**Follow this** when creating backend endpoints.

---

### 4. [Frontend Guide](4_FRONTEND_GUIDE.md)
**Purpose**: Next.js frontend module creation

**Contains**:
- TypeScript type definitions
- API function patterns ("use server")
- React Query hooks (queries & mutations)
- DataTable component usage
- Form component patterns
- Page component structure
- Translation setup
- Error handling (Collector/Alive)

**Follow this** when creating frontend pages and components.

---

### 5. [Module Creation Workflow](5_MODULE_CREATION_WORKFLOW.md)
**Purpose**: Complete end-to-end workflow

**Contains**:
- Step-by-step guide from Prisma to frontend
- Complete Product module example
- Checklists for each step
- Common issues and solutions
- Testing guidelines

**Use this** for creating a complete module from scratch.

---

### 6. [Conventions](6_CONVENTIONS.md)
**Purpose**: Naming conventions and best practices

**Contains**:
- File naming conventions
- Code naming conventions (variables, functions, classes)
- API endpoint conventions
- Response format standards
- Component structure patterns
- Import organization
- Translation key conventions
- Git commit conventions
- Code quality best practices
- Performance optimization
- Security best practices

**Reference this** to ensure consistency.

---

### 7. [Examples](7_EXAMPLES.md)
**Purpose**: Real, complete code examples

**Contains**:
- Complete User module (Prisma to frontend)
- Custom decorator implementation
- Error handling examples
- Pagination implementation
- React Query patterns
- DataTable advanced usage
- Form with file upload
- Real code from the project

**Copy from here** when implementing similar features.

---

## Quick Start Guide

### For AI Assistants
When asked to create a new module:

1. **Read** [1_PROJECT_OVERVIEW.md](1_PROJECT_OVERVIEW.md) to understand the architecture
2. **Follow** [5_MODULE_CREATION_WORKFLOW.md](5_MODULE_CREATION_WORKFLOW.md) for step-by-step instructions
3. **Reference** [2_PRISMA_GUIDE.md](2_PRISMA_GUIDE.md), [3_BACKEND_GUIDE.md](3_BACKEND_GUIDE.md), [4_FRONTEND_GUIDE.md](4_FRONTEND_GUIDE.md) for specific patterns
4. **Check** [6_CONVENTIONS.md](6_CONVENTIONS.md) for naming and conventions
5. **Copy** from [7_EXAMPLES.md](7_EXAMPLES.md) for proven patterns

### For Developers
1. Start with [1_PROJECT_OVERVIEW.md](1_PROJECT_OVERVIEW.md)
2. Use [5_MODULE_CREATION_WORKFLOW.md](5_MODULE_CREATION_WORKFLOW.md) as your checklist
3. Reference other guides as needed
4. Follow examples in [7_EXAMPLES.md](7_EXAMPLES.md)

## Document Usage

### When Creating a New Entity (e.g., "Product")

1. **Database** → Read [2_PRISMA_GUIDE.md](2_PRISMA_GUIDE.md)
   - Create Prisma model
   - Add enums if needed
   - Define relations
   - Run migration

2. **Backend** → Read [3_BACKEND_GUIDE.md](3_BACKEND_GUIDE.md)
   - Create domain entity
   - Create DTOs
   - Implement service
   - Create controller
   - Register module
   - Add translations

3. **Frontend** → Read [4_FRONTEND_GUIDE.md](4_FRONTEND_GUIDE.md)
   - Create types
   - Create API functions
   - Create React Query hooks
   - Create components (DataTable, Form)
   - Create pages
   - Add translations

4. **Testing** → Follow checklist in [5_MODULE_CREATION_WORKFLOW.md](5_MODULE_CREATION_WORKFLOW.md)

### When Modifying Existing Code

1. Find similar code in [7_EXAMPLES.md](7_EXAMPLES.md)
2. Check conventions in [6_CONVENTIONS.md](6_CONVENTIONS.md)
3. Follow the established patterns

### When Troubleshooting

1. Check "Common Issues" sections in workflow guide
2. Verify conventions are followed
3. Compare with working examples

## Key Concepts

### Dynamic Routes (URL Parameters)
```typescript
// Folder structure: src/app/(private)/user/[id]/page.tsx
// URL: /user/123

// Server Component (Recommended)
export default async function UserDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params; // Next.js 15+ requires await
  
  // Call API directly - no loading state needed
  const response = await getUser(id);
  const user = response.data;

  // Pass data to Client Components
  return <UserEditPage user={user} />;
}

// Client Component (Alternative)
export default function UserDetailPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const { data, isLoading } = useUser(params.id);
  
  if (isLoading) return <Loading />;
  return <UserEditPage user={data} />;
}
```

### DataTable with Pagination & Filters
```typescript
const [pagination, setPagination] = useState<PaginationState>({ 
  pageIndex: 0, 
  pageSize: 10 
});
const [globalFilter, setGlobalFilter] = useState('');
const [filters, setFilters] = useState<Record<string, string>>({});

// Build query params
const queryParams = {
  page: pagination.pageIndex + 1,  // Convert 0-based to 1-based
  limit: pagination.pageSize,
  pagination: true,
  ...(globalFilter && { search: globalFilter }),
  ...(filters && { filter: JSON.stringify(filters) }),
};

const { data } = useUsers(queryParams);

// Use with compound components
<DataTable
  columns={columns}
  data={data}
  pagination={pagination}
  onPaginationChange={setPagination}
  globalFilter={globalFilter}
  onGlobalFilterChange={setGlobalFilter}
  filters={filters}
  onFiltersChange={setFilters}
>
  <DataTable.Input placeholder="Search..." />
  <DataTable.Select<User> accessorKey="role" placeholder="Filter by role" />
  <DataTable.Actions>
    <Button>Create User</Button>
  </DataTable.Actions>
</DataTable>
```

### Type Safety
```typescript
// Backend
interface User {
  id: string;
  email: string;
  name: string | null;
}

// Frontend (matches backend)
interface User {
  id: string;
  email: string;
  name: string | null;
}
```

### Pagination
```typescript
// Backend
async findAll(query: PaginationQuery): Promise<PaginatedResponse<T> | T[]>

// Frontend
const { data } = useUsers({
  page: 1,
  limit: 10,
  pagination: true,
  search: 'john',
  filter: { role: 'ADMIN' }
});
```

### Error Handling
```typescript
// Backend
throw new NotFoundException(
  this.i18n.t('user.not_found', { args: { id } })
);

// Frontend
const { data, error, isLoading } = useQuery({
  queryKey: ['user', id],
  queryFn: Collector(() => getUser(id)), // Handles errors
});
```

### Custom Decorators
```typescript
@GetApi({
  summary: 'List users',
  authenticated: true,
  roles: ['ADMIN'],
  queries: commonPaginationQueries,
  response: {
    success: [{
      status: 'OK',
      schema: { dto: UserDto, isArray: true, isPagination: true }
    }]
  }
})
async findAll() {}
```

## Best Practices Summary

### Always
- ✅ Use TypeScript types everywhere
- ✅ Validate input with Zod schemas
- ✅ Handle errors with i18n messages
- ✅ Use custom decorators in controllers
- ✅ Implement pagination for lists
- ✅ Use React Query for data fetching
- ✅ Transform Prisma entities to DTOs
- ✅ Log important actions to SystemLog
- ✅ Follow naming conventions
- ✅ Add translations (en and pt-BR)

### Never
- ❌ Return Prisma entities directly from controllers
- ❌ Use `any` type
- ❌ Hardcode strings (use i18n)
- ❌ Skip input validation
- ❌ Expose passwords in DTOs
- ❌ Ignore error handling
- ❌ Mix naming conventions
- ❌ Skip migrations after schema changes

## Maintenance

### Adding New Patterns
When adding new patterns:
1. Document in appropriate guide
2. Add examples to [7_EXAMPLES.md](7_EXAMPLES.md)
3. Update this README if needed

### Updating Documentation
Keep documentation synchronized with code:
- Update guides when patterns change
- Add new examples from production code
- Remove deprecated patterns

## Support

### For Questions
- Check relevant guide section
- Look for similar examples in [7_EXAMPLES.md](7_EXAMPLES.md)
- Review existing modules in codebase

### For Issues
- Check "Common Issues" in workflow guide
- Verify conventions are followed
- Compare with working examples

## Version History

- **v1.0** (2026-01-07): Initial documentation
  - Complete coverage of Prisma, Backend, Frontend patterns
  - Full workflow guide
  - Conventions and examples

## Contributing

When contributing new modules:
1. Follow the patterns in this documentation
2. Update documentation if introducing new patterns
3. Add examples of complex features

---

## Quick Reference Card

```
New Module Workflow:
1. Prisma model → migration
2. Domain entity → @ApiProperty
3. DTOs → Zod schemas
4. Service → implements IBaseService
5. Controller → custom decorators
6. Module → register in app.module
7. i18n → en + pt-BR
8. Frontend types → match backend
9. API functions → "use server"
10. React Query hooks → Collector/Alive
11. Components → DataTable + Form
12. Pages → use components
13. i18n → en + pt-BR
14. Test → all CRUD operations

Key Files:
- schema.prisma
- [entity].entity.ts
- [entity].service.ts
- [entity].controller.ts
- [entity].module.ts
- types.ts
- api.ts
- queries.ts
- [entity]-table.tsx
- page.tsx

Commands:
- npx prisma migrate dev --name <name>
- npx prisma generate
- npm run dev (backend)
- npm run dev (frontend)
```

---

**Ready to create your first module? Start with [5_MODULE_CREATION_WORKFLOW.md](5_MODULE_CREATION_WORKFLOW.md)!**
