# Naming Conventions and Best Practices

## File Naming Conventions

### Backend (NestJS)

#### Files
- **Modules**: `[entity].module.ts` (e.g., `user.module.ts`)
- **Controllers**: `[entity].controller.ts` (e.g., `user.controller.ts`)
- **Services**: `[entity].service.ts` (e.g., `user.service.ts`)
- **Entities**: `[entity].entity.ts` (e.g., `user.entity.ts`)
- **DTOs**: `[action]-[entity].dto.ts` (e.g., `create-user.dto.ts`)
- **Constants**: `[entity][Type].const.ts` (e.g., `userRole.const.ts`)
- **Interfaces**: `[name].interface.ts` (e.g., `base-service.interface.ts`)
- **Decorators**: `[name].decorator.ts` (e.g., `api-method.decorator.ts`)
- **Guards**: `[name].guard.ts` (e.g., `roles.guard.ts`)
- **Filters**: `[name].filter.ts` (e.g., `all-exceptions.filter.ts`)
- **Interceptors**: `[name].interceptor.ts` (e.g., `logging.interceptor.ts`)

#### Folders
- **Domain**: `src/domain/[entity]/`
- **Modules**: `src/modules/[entity]/`
- **DTOs**: `src/modules/[entity]/dto/`
- **i18n**: `src/i18n/[lang]/[module].json`

### Frontend (Next.js)

#### Files
- **Pages**: `page.tsx` (Next.js convention)
- **Layouts**: `layout.tsx` (Next.js convention)
- **Components**: `[component-name].tsx` (kebab-case)
- **API Actions**: `api.ts`
- **React Query Hooks**: `queries.ts`
- **Types**: `types.ts`
- **Utilities**: `[name].ts` or `[name].util.ts`
- **Schemas**: `[name].schema.ts`

#### Folders
- **App Routes**: `src/app/(private)/[entity]/`
- **Components**: `src/components/`
- **Actions**: `src/lib/actions/[entity]/`
- **Types**: `src/types/` or `src/lib/types/`
- **Translations**: `src/locales/[lang]/[module].json`

## Code Naming Conventions

### TypeScript/JavaScript

#### Variables and Constants
```typescript
// Variables: camelCase
const userName = 'John';
const isActive = true;

// Constants: SCREAMING_SNAKE_CASE (enums, config)
const MAX_RETRIES = 3;
export const UserRoleConst = {
  ADMIN: 'ADMIN',
  USER: 'USER',
} as const;

// Private properties: _camelCase (by convention)
private _internalState = {};
```

#### Functions and Methods
```typescript
// Functions: camelCase, verb + noun
function getUserById(id: string) {}
function createProduct(data: CreateProductDto) {}
function validateEmail(email: string) {}

// Boolean functions: is/has/should prefix
function isValidEmail(email: string) {}
function hasPermission(role: string) {}
function shouldRetry(attempt: number) {}

// Event handlers: handle + Event
function handleClick() {}
function handleSubmit() {}
function handleChange() {}
```

#### Classes and Interfaces
```typescript
// Classes: PascalCase
class UserService {}
class ProductController {}
class AuthGuard {}

// Interfaces: PascalCase (no I prefix)
interface User {}
interface CreateUserDto {}
interface PaginatedResponse<T> {}

// Type aliases: PascalCase
type UserRole = keyof typeof UserRoleConst;
type ApiResponse<T> = { success: boolean; data: T };
```

#### React Components
```typescript
// Components: PascalCase
function UserTable() {}
function ProductForm() {}
function DataTable<T>() {}

// Component files: kebab-case
// user-table.tsx
// product-form.tsx
// data-table.tsx
```

### Database (Prisma)

#### Models and Fields
```prisma
// Models: PascalCase (singular)
model User {}
model Product {}
model OrderItem {}

// Fields: camelCase
model User {
  firstName String
  lastName  String
  createdAt DateTime
}

// Enums: PascalCase
enum UserRole {
  ADMIN
  USER
  MODERATOR
}

// Table names: snake_case (plural)
@@map("users")
@@map("order_items")
```

## API Conventions

### REST Endpoints

#### URL Structure
```
GET    /api/[resource]              # List all
GET    /api/[resource]/:id          # Get one
POST   /api/[resource]              # Create
PATCH  /api/[resource]/:id          # Update (partial)
PUT    /api/[resource]/:id          # Update (full replace)
DELETE /api/[resource]/:id          # Delete

# Nested resources
GET    /api/[resource]/:id/[nested] # Get nested
POST   /api/[resource]/:id/[nested] # Create nested

# Actions (not CRUD)
POST   /api/[resource]/:id/[action] # Perform action
```

#### Examples
```
GET    /api/user
GET    /api/user/:id
POST   /api/user
PATCH  /api/user/:id
DELETE /api/user/:id

GET    /api/user/:id/routes
POST   /api/user/:id/routes/:routeId

POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
```

### HTTP Status Codes
```typescript
200 OK          // Successful GET, PATCH, PUT
201 CREATED     // Successful POST
204 NO_CONTENT  // Successful DELETE
400 BAD_REQUEST // Validation error
401 UNAUTHORIZED // Not authenticated
403 FORBIDDEN    // Not authorized
404 NOT_FOUND    // Resource not found
409 CONFLICT     // Resource conflict
500 INTERNAL_SERVER_ERROR // Server error
```

## Response Conventions

### Success Response
```typescript
// Single entity
{
  id: "uuid",
  name: "John",
  email: "john@example.com",
  // ... other fields
}

// Array (no pagination)
[
  { id: "uuid1", name: "John" },
  { id: "uuid2", name: "Jane" }
]

// Paginated response
{
  data: [
    { id: "uuid1", name: "John" },
    { id: "uuid2", name: "Jane" }
  ],
  meta: {
    total: 100,
    page: 1,
    limit: 10,
    totalPages: 10
  },
  filter: {
    role: ["ADMIN", "USER"],
    status: ["ACTIVE", "INACTIVE"]
  }
}

// Action response
{
  status: true,
  message: "User deleted successfully"
}
```

### Error Response
```typescript
{
  statusCode: 400,
  message: "Validation failed",
  error: "Bad Request"
}

// With validation details
{
  statusCode: 400,
  message: [
    "email must be a valid email",
    "password must be at least 6 characters"
  ],
  error: "Bad Request"
}
```

## Component Structure Conventions

### React Component Pattern
```typescript
'use client'; // If client component

import { /* imports */ } from '...';

// Types/Interfaces
interface ComponentProps {
  prop1: string;
  prop2?: number;
}

// Component
export function ComponentName({ prop1, prop2 }: ComponentProps) {
  // Hooks
  const { t } = useTranslation();
  const [state, setState] = useState();
  
  // Queries/Mutations
  const { data, isLoading } = useQuery();
  const mutation = useMutation();
  
  // Handlers
  const handleClick = () => {};
  const handleSubmit = () => {};
  
  // Effects
  useEffect(() => {}, []);
  
  // Render helpers
  const renderItem = () => {};
  
  // Early returns
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage />;
  
  // Main render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### NestJS Service Pattern
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class EntityService implements IBaseService<Entity> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  // Public methods
  async findAll() {}
  async findOne() {}
  async create() {}
  async update() {}
  async remove() {}
  
  // Private methods
  private async validateSomething() {}
  private buildWhereClause() {}
}
```

## Import Organization

### Import Order
```typescript
// 1. Node/External libraries
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

// 2. Internal absolute imports
import { PrismaService } from 'src/prisma/prisma.service';
import { UserDto } from './dto/user.dto';

// 3. Relative imports
import { helper } from '../utils/helper';

// 4. Types (if separate)
import type { User } from './types';
```

## Translation Key Conventions

### Backend (i18n)
```json
{
  // Entity operations
  "not_found": "Entity not found",
  "created": "Entity created successfully",
  "updated": "Entity updated successfully",
  "deleted": "Entity deleted successfully",
  
  // Validation
  "name_required": "Name is required",
  "email_invalid": "Invalid email format",
  
  // Business logic
  "stock_low": "Stock is low for {{name}}"
}
```

### Frontend (i18n)
```json
{
  // Entity info
  "entity": "Product",
  "entity_plural": "Products",
  
  // Fields
  "name": "Name",
  "description": "Description",
  
  // Nested keys
  "status": {
    "label": "Status",
    "ACTIVE": "Active",
    "INACTIVE": "Inactive"
  },
  
  // Actions
  "search_placeholder": "Search products...",
  "confirm_delete": "Are you sure?"
}
```

## Git Commit Conventions

### Commit Message Format
```
type(scope): subject

body (optional)

footer (optional)
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code restructuring
- `perf`: Performance improvements
- `test`: Adding tests
- `chore`: Maintenance tasks

### Examples
```
feat(user): add user profile image upload
fix(auth): correct token refresh logic
docs(readme): update installation instructions
refactor(product): simplify product service logic
```

## Code Quality Best Practices

### TypeScript
```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
  email: string;
}

function getUser(id: string): Promise<User> {
  // Implementation
}

// ❌ Bad
function getUser(id: any): any {
  // Implementation
}
```

### Error Handling
```typescript
// ✅ Good - Backend
throw new NotFoundException(
  this.i18n.t('user.not_found', { args: { id } })
);

// ✅ Good - Frontend
try {
  await mutation.mutateAsync(data);
} catch (error) {
  // Error handled by Alive wrapper
}

// ❌ Bad
throw new Error('User not found');
```

### Async/Await
```typescript
// ✅ Good
async function createUser(data: CreateUserDto) {
  const user = await this.prisma.user.create({ data });
  await this.logAction('CREATE', user.id);
  return user;
}

// ❌ Bad
function createUser(data: CreateUserDto) {
  return this.prisma.user.create({ data }).then(user => {
    return this.logAction('CREATE', user.id).then(() => user);
  });
}
```

### Destructuring
```typescript
// ✅ Good
const { page, limit, search } = query;
const { data, isLoading, error } = useUsers();

// ❌ Bad
const page = query.page;
const limit = query.limit;
const search = query.search;
```

### Optional Chaining
```typescript
// ✅ Good
const name = user?.profile?.name;
const count = items?.length ?? 0;

// ❌ Bad
const name = user && user.profile && user.profile.name;
const count = items ? items.length : 0;
```

## Documentation Conventions

### JSDoc Comments
```typescript
/**
 * Creates a new user in the system
 * @param data - User creation data
 * @param performedById - ID of user performing the action
 * @returns Created user entity
 * @throws {NotFoundException} When email already exists
 */
async create(data: CreateUserDto, performedById: string): Promise<User> {
  // Implementation
}
```

### Inline Comments
```typescript
// ✅ Good - Explain why, not what
// Cache roles for 1 hour since they rarely change
staleTime: 1000 * 60 * 60

// ❌ Bad - Obvious comment
// Set stale time to 3600000
staleTime: 3600000
```

## Performance Best Practices

### Database Queries
```typescript
// ✅ Good - Select only needed fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
  },
});

// ❌ Bad - Select all fields
const users = await prisma.user.findMany();
```

### React Query
```typescript
// ✅ Good - Appropriate stale time
export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: Collector(getRoles),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

// ❌ Bad - No stale time for static data
export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: Collector(getRoles),
  });
}
```

### Component Optimization
```typescript
// ✅ Good - Memoize expensive computations
const sortedItems = useMemo(
  () => items.sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);

// ✅ Good - Memoize callbacks
const handleClick = useCallback(() => {
  // Handler logic
}, [dependency]);
```

## Security Best Practices

### Authentication
```typescript
// ✅ Good - Use decorators
@GetApi({
  authenticated: true,
  roles: ['ADMIN'],
})

// ❌ Bad - Manual checks in every method
async findAll() {
  if (!user) throw new UnauthorizedException();
  if (user.role !== 'ADMIN') throw new ForbiddenException();
}
```

### Validation
```typescript
// ✅ Good - Zod validation
const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
}).strict();

// ❌ Bad - Manual validation
if (!data.email || !data.email.includes('@')) {
  throw new Error('Invalid email');
}
```

### SQL Injection Prevention
```typescript
// ✅ Good - Prisma parameterized queries
await prisma.user.findMany({
  where: { email: { contains: search } }
});

// ❌ Bad - Raw SQL with string interpolation
await prisma.$executeRaw`SELECT * FROM users WHERE email LIKE '%${search}%'`;
```

## Summary

### Key Principles
1. **Consistency**: Follow established patterns
2. **Type Safety**: Use TypeScript properly
3. **Clarity**: Write self-documenting code
4. **Performance**: Optimize queries and renders
5. **Security**: Validate input, authenticate users
6. **Maintainability**: Keep code DRY and modular
7. **Documentation**: Comment complex logic
8. **Testing**: Write testable code

### Quick Reference
- **Files**: kebab-case or entity.type.ts
- **Variables**: camelCase
- **Classes**: PascalCase
- **Constants**: SCREAMING_SNAKE_CASE
- **Functions**: camelCase, verb + noun
- **Components**: PascalCase
- **Database**: snake_case tables, PascalCase models
- **Imports**: External → Internal → Relative
- **Commits**: type(scope): subject

## Next Steps
- See `7_EXAMPLES.md` for complete code examples
- Review existing modules for reference
- Follow these conventions for all new code
