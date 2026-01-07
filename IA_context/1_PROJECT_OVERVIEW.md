# Project Overview

## Architecture Summary
Full-stack TypeScript application with:
- **Backend**: NestJS + Prisma ORM + PostgreSQL
- **Frontend**: Next.js 14+ (App Router) + React Query + Tailwind CSS
- **Authentication**: JWT with refresh tokens, role-based access control (RBAC)
- **Internationalization**: i18next on both sides

## Tech Stack

### Backend (NestJS)
- **Framework**: NestJS (Node.js framework)
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod schemas with nestjs-zod
- **Authentication**: JWT tokens with refresh token rotation
- **API Documentation**: Swagger/OpenAPI
- **Internationalization**: nestjs-i18n
- **Testing**: Jest

### Frontend (Next.js)
- **Framework**: Next.js 14+ with App Router
- **State Management**: TanStack React Query
- **Forms**: React Hook Form + Zod validation
- **UI Components**: shadcn/ui + Tailwind CSS
- **Internationalization**: next-i18next
- **Icons**: lucide-react

## Directory Structure

### Backend Structure
```
backend-nest/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── seed.ts                # Development seed
│   ├── seed.production.ts     # Production seed
│   └── migrations/            # Database migrations
├── src/
│   ├── main.ts               # Application entry point
│   ├── app.module.ts         # Root module
│   ├── common/               # Shared utilities
│   │   ├── decorators/      # Custom decorators (@ApiMethod, @Roles)
│   │   ├── filters/         # Exception filters
│   │   ├── guards/          # Guards (RolesGuard, JwtAuthGuard)
│   │   ├── interceptors/    # Interceptors (LoggingInterceptor)
│   │   ├── schemas/         # Zod schemas (pagination)
│   │   ├── swagger/         # Swagger utilities
│   │   └── types/           # Shared types
│   ├── domain/              # Domain entities and constants
│   │   ├── auth/           # Auth-related entities
│   │   ├── interface/      # Service interfaces
│   │   ├── user/           # User entity
│   │   └── [module]/       # Other domain entities
│   ├── i18n/               # Internationalization files
│   │   ├── en/            # English translations
│   │   └── pt-BR/         # Portuguese translations
│   ├── modules/            # Feature modules
│   │   ├── auth/          # Authentication module
│   │   ├── user/          # User management
│   │   └── [module]/      # Other feature modules
│   ├── prisma/            # Prisma service
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   └── utils/             # Utility functions
└── test/                  # E2E tests
```

### Frontend Structure
```
frontend-next/
├── public/                # Static assets
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── layout.tsx   # Root layout
│   │   ├── page.tsx     # Home page
│   │   ├── (private)/   # Protected routes
│   │   ├── login/       # Public auth pages
│   │   └── api/         # API routes
│   ├── components/       # React components
│   │   ├── ui/          # shadcn/ui components
│   │   ├── data-table.tsx
│   │   ├── header.tsx
│   │   └── [component].tsx
│   ├── contexts/         # React contexts
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Business logic
│   │   ├── actions/     # Server actions & API calls
│   │   │   ├── user/
│   │   │   │   ├── api.ts      # API functions
│   │   │   │   ├── queries.ts  # React Query hooks
│   │   │   │   └── types.ts    # TypeScript types
│   │   │   └── [module]/
│   │   ├── api/         # API client configuration
│   │   ├── schemas/     # Zod validation schemas
│   │   └── types/       # Shared TypeScript types
│   ├── locales/         # Translation files
│   └── types/           # Global types
└── types/               # Additional types
```

## Key Architectural Patterns

### Backend Patterns

1. **Module-Based Architecture**: Each feature is a self-contained module
2. **Domain-Driven Design**: Business entities in `domain/` folder
3. **Service Layer**: Business logic in services, controllers handle HTTP
4. **DTO Pattern**: Input/output validation with Zod DTOs
5. **Repository Pattern**: Prisma service acts as repository
6. **Custom Decorators**: `@GetApi`, `@PostApi`, `@PatchApi`, etc.
7. **Interface-Based Services**: All services implement `IBaseService`

### Frontend Patterns

1. **Server Actions**: API calls via "use server" functions
2. **React Query**: Data fetching, caching, and state management
3. **Compound Components**: DataTable with Input/Select/Actions
4. **Context API**: Global state (auth, filters, app config)
5. **Custom Hooks**: Reusable logic (useUsers, useRoles)
6. **Type Safety**: Shared types between API and components
7. **Atomic Design**: Components organized by complexity

## Data Flow

### Backend Request Flow
```
HTTP Request
  → Controller (endpoint)
    → Guard (authentication/authorization)
      → ZodValidationPipe (DTO validation)
        → Service (business logic)
          → PrismaService (database)
            → Response
              → I18n Translation
                → Swagger Documentation
                  → HTTP Response
```

### Frontend Request Flow
```
User Action
  → Component Event Handler
    → React Query Mutation/Query
      → API Function (lib/actions/[module]/api.ts)
        → Axios Request (lib/api/api.ts)
          → NestJS Backend
            → Response
              → Collector/Alive Error Handling
                → React Query Cache Update
                  → Component Re-render
```

## Core Concepts

### 1. Pagination
- **Backend**: Returns `PaginatedResponse<T>` or `T[]`
- **Frontend**: Uses `PaginationParams` and `PaginationState`
- **DataTable**: Built-in pagination UI and state management

### 2. Authentication
- **JWT Access Token**: Short-lived (15m), stored in httpOnly cookie
- **Refresh Token**: Long-lived (7d), stored in database
- **Role-Based Access Control**: `@Roles(['ADMIN'])` decorator
- **Route Protection**: Frontend middleware + backend guards

### 3. Internationalization
- **Backend**: nestjs-i18n with JSON files per module
- **Frontend**: next-i18next with namespace-based translations
- **Language Detection**: Accept-Language header + cookie
- **Translation Keys**: `module.key.subkey` format

### 4. Error Handling
- **Backend**: Global exception filter with i18n messages
- **Frontend**: Collector wrapper for API calls, Alive for mutations
- **User Feedback**: Toast notifications for errors/success
- **Validation**: Zod schemas on both sides

### 5. Type Safety
- **Shared Types**: TypeScript interfaces for entities
- **DTO Validation**: Zod schemas converted to DTOs
- **Prisma Types**: Generated types from schema
- **API Contracts**: TypeScript interfaces for requests/responses

## Environment Variables

### Backend (.env)
```env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

## Development Workflow

1. **Create Prisma Model** → Generate migration
2. **Create Domain Entity** → Define TypeScript class
3. **Create Backend Module** → Service, Controller, DTOs
4. **Add i18n Translations** → Backend messages
5. **Create Frontend Types** → Match backend DTOs
6. **Create API Functions** → lib/actions/[module]/api.ts
7. **Create React Query Hooks** → queries.ts, mutations
8. **Create Components** → UI with DataTable/Forms
9. **Add Translations** → Frontend messages
10. **Test Integration** → E2E tests

## Key Files Reference

### Backend
- `schema.prisma` - Database models
- `base-service.interface.ts` - Service contract
- `api-method.decorator.ts` - HTTP method decorators
- `pagination.schema.ts` - Pagination validation
- `all-exceptions.filter.ts` - Global error handling

### Frontend
- `api.ts` - Axios client with interceptors
- `data-table.tsx` - Reusable table component
- `collector.ts` - Error handling wrapper
- `pagination.types.ts` - Pagination interfaces

## Next Steps
- Read `2_PRISMA_GUIDE.md` for database modeling
- Read `3_BACKEND_GUIDE.md` for NestJS module creation
- Read `4_FRONTEND_GUIDE.md` for Next.js patterns
- Read `5_MODULE_CREATION_WORKFLOW.md` for step-by-step guide
