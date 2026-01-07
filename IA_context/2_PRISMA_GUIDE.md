# Prisma Database Modeling Guide

## Overview
This project uses Prisma ORM with PostgreSQL. All database operations go through Prisma Client, ensuring type safety and consistency.

## File Location
**Path**: `backend-nest/prisma/schema.prisma`

## Schema Structure

### Generator and Datasource
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

## Creating Enums

### Pattern
Enums are defined at the top of the schema, before models.

### Example
```prisma
enum UserRole {
  ADMIN
  USER
  MODERATOR
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

enum LogModule {
  USER
  AUTH
  SYSTEM
  HEALTH
}
```

### Best Practices
- Use SCREAMING_SNAKE_CASE for enum values
- Group related enums together
- Document complex enums with comments
- Keep enum values stable (don't rename in production)

## Creating Models

### Basic Model Pattern
```prisma
model EntityName {
  // Primary Key
  id        String   @id @default(uuid())
  
  // Required Fields
  email     String   @unique
  name      String
  
  // Optional Fields
  description String?
  
  // Enum Fields
  role      UserRole @default(USER)
  status    UserStatus @default(ACTIVE)
  
  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  posts     Post[]
  profile   Profile?
  
  // Indexes
  @@index([email])
  @@index([status, createdAt])
  
  // Table Name Mapping
  @@map("entity_name")
}
```

### Real Example: User Model
```prisma
model User {
  id                  String               @id @default(uuid())
  email               String               @unique
  password            String
  name                String?
  image               Bytes?               // Binary data (max 40MB)
  role                UserRole             @default(USER)
  status              UserStatus           @default(ACTIVE)
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  
  // Relations
  systemLogs          SystemLog[]
  refreshTokens       RefreshToken[]
  passwordResetTokens PasswordResetToken[]
  userRouteAccesses   UserRouteAccess[]
  grantedRouteAccesses UserRouteAccess[]   @relation("GrantedBy")
  userConfigurations  UserConfiguration[]

  @@index([email])
  @@map("users")
}
```

## Field Types Reference

### Common Field Types
```prisma
// Strings
name        String          // Required string
description String?         // Optional string
code        String  @unique // Unique string
longText    String  @db.Text // Long text

// Numbers
age         Int             // Integer
price       Float           // Decimal
count       BigInt          // Large integer

// Booleans
isActive    Boolean @default(true)

// Dates
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
birthDate   DateTime?

// Binary
image       Bytes?          // Binary data (images, files)

// JSON (use with caution)
metadata    Json?           // JSON data

// Enums
role        UserRole @default(USER)
```

## Relations

### One-to-Many (1:N)
```prisma
model User {
  id    String @id @default(uuid())
  posts Post[]
}

model Post {
  id       String @id @default(uuid())
  userId   String
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
}
```

### One-to-One (1:1)
```prisma
model User {
  id      String   @id @default(uuid())
  profile Profile?
}

model Profile {
  id     String @id @default(uuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Many-to-Many (N:M) - Explicit Join Table
```prisma
model User {
  id              String           @id @default(uuid())
  routeAccesses   UserRouteAccess[]
}

model Route {
  id              String           @id @default(uuid())
  userAccesses    UserRouteAccess[]
}

model UserRouteAccess {
  id        String   @id @default(uuid())
  userId    String
  routeId   String
  grantedBy String?
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  route     Route    @relation(fields: [routeId], references: [id], onDelete: Cascade)
  
  @@unique([userId, routeId])
  @@index([userId])
  @@index([routeId])
}
```

### Self-Referencing Relations
```prisma
model User {
  id                   String @id @default(uuid())
  grantedRouteAccesses UserRouteAccess[] @relation("GrantedBy")
}

model UserRouteAccess {
  id            String  @id @default(uuid())
  grantedBy     String?
  grantedByUser User?   @relation("GrantedBy", fields: [grantedBy], references: [id])
}
```

## Cascade Delete Strategies

### onDelete Options
```prisma
// Cascade: Delete related records
user User @relation(fields: [userId], references: [id], onDelete: Cascade)

// SetNull: Set foreign key to null
user User @relation(fields: [userId], references: [id], onDelete: SetNull)

// Restrict: Prevent deletion if related records exist
user User @relation(fields: [userId], references: [id], onDelete: Restrict)

// NoAction: Database default behavior
user User @relation(fields: [userId], references: [id], onDelete: NoAction)
```

### Best Practices
- Use `Cascade` for dependent data (RefreshTokens belong to User)
- Use `SetNull` for optional relations
- Use `Restrict` to prevent accidental deletions
- Always consider data integrity

## Indexes

### Single Column Index
```prisma
model User {
  email String @unique // Automatically indexed
  name  String
  
  @@index([name])
}
```

### Composite Index
```prisma
model SystemLog {
  module    LogModule
  createdAt DateTime
  
  @@index([module, createdAt])
}
```

### Unique Constraint
```prisma
model UserRouteAccess {
  userId  String
  routeId String
  
  @@unique([userId, routeId])
}
```

### When to Add Indexes
- Foreign keys (always)
- Fields used in WHERE clauses
- Fields used in ORDER BY
- Unique business constraints
- Composite keys for queries

## Migrations

### Creating a Migration
```bash
# Generate migration from schema changes
npx prisma migrate dev --name add_user_image

# Apply migrations in production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

### Migration Best Practices
1. **Descriptive Names**: Use clear migration names
   - ✅ `add_user_image`
   - ✅ `create_user_route_access`
   - ❌ `update1`, `fix`

2. **Atomic Changes**: One logical change per migration
3. **Test Migrations**: Test on dev database first
4. **Backup Data**: Always backup before production migrations
5. **Review SQL**: Check generated SQL in `migrations/` folder

### Migration Example
```prisma
// Before
model User {
  id    String @id @default(uuid())
  email String @unique
  name  String?
}

// After - Add image field
model User {
  id    String @id @default(uuid())
  email String @unique
  name  String?
  image Bytes? // New field
}
```

```bash
npx prisma migrate dev --name add_user_image
```

Generated migration:
```sql
-- migrations/20260106162956_add_user_image/migration.sql
ALTER TABLE "users" ADD COLUMN "image" BYTEA;
```

## Seeding Data

### Development Seed
**File**: `prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log('Seed completed:', { admin });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Running Seeds
```bash
# Run development seed
npx prisma db seed

# Seed is also run after: npx prisma migrate reset
```

## Prisma Client Usage

### In NestJS Service
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  // Find all with relations
  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });
  }

  // Find one with error handling
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return user;
  }

  // Create with relations
  async create(data: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: data.role,
      },
    });
  }

  // Update
  async update(id: string, data: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  // Delete
  async remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  // Pagination
  async findAllPaginated(page: number, limit: number) {
    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
```

## Checklist for New Model

- [ ] Define model in `schema.prisma`
- [ ] Add enums if needed
- [ ] Define all fields with correct types
- [ ] Add relations with proper cascade rules
- [ ] Add indexes for foreign keys and query fields
- [ ] Add `@@map()` for table name (snake_case)
- [ ] Generate migration: `npx prisma migrate dev --name <name>`
- [ ] Update seed file if needed
- [ ] Generate Prisma Client: `npx prisma generate`
- [ ] Create corresponding domain entity (next guide)
- [ ] Test migration on dev database
- [ ] Review generated migration SQL

## Common Issues

### Issue: Migration conflicts
**Solution**: Reset dev database or resolve conflicts manually

### Issue: Type errors after schema change
**Solution**: Run `npx prisma generate` to regenerate client

### Issue: Relation errors
**Solution**: Ensure both sides of relation are defined correctly

### Issue: Unique constraint violations
**Solution**: Add `@@unique` or check for existing data

## Next Steps
- Read `3_BACKEND_GUIDE.md` for creating NestJS modules
- See `7_EXAMPLES.md` for complete model examples
