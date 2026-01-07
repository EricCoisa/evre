# Backend NestJS Module Creation Guide

## Overview
This guide covers creating a complete NestJS module following the project's established patterns.

## Module Structure

### Standard Module Organization
```
src/modules/[module-name]/
├── [module-name].controller.ts    # HTTP endpoints
├── [module-name].service.ts       # Business logic
├── [module-name].module.ts        # Module definition
└── dto/
    ├── create-[entity].dto.ts    # Creation DTO
    ├── update-[entity].dto.ts    # Update DTO
    └── [entity].dto.ts           # Response DTO
```

### Domain Organization
```
src/domain/[module-name]/
├── [entity].entity.ts            # Domain entity with Swagger decorators
├── [entity].const.ts             # Constants (enums, defaults)
└── [entity].types.ts             # Custom types (optional)
```

## Step 1: Create Domain Entity

### Purpose
Domain entities define the shape of data with Swagger documentation.

### Pattern
**File**: `src/domain/[module-name]/[entity].entity.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class Product {
  @ApiProperty({
    description: 'Unique product identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Product name',
    example: 'Laptop',
  })
  name: string;

  @ApiProperty({
    description: 'Product description',
    example: 'High-performance laptop',
    required: false,
    nullable: true,
  })
  description?: string | null;

  @ApiProperty({
    description: 'Product price in cents',
    example: 199900,
  })
  price: number;

  @ApiProperty({
    description: 'Stock quantity',
    example: 50,
  })
  stock: number;

  @ApiProperty({
    description: 'Product status',
    enum: ['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'],
  })
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
```

### Real Example: User Entity
```typescript
import { ApiProperty } from '@nestjs/swagger';
import { UserRoleConst } from 'src/domain/auth/userRole.const';
import { UserStatusConst } from 'src/domain/auth/userStatus.const';

export class User {
  @ApiProperty({
    description: 'ID único do usuário',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Email do usuário',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Hash da senha (não retornado em DTOs públicos)',
    example: '$2b$10$...',
    required: false,
  })
  password?: string;

  @ApiProperty({ required: false, nullable: true })
  name?: string | null;

  @ApiProperty({
    description: 'Imagem de perfil do usuário em formato binário',
    required: false,
    nullable: true,
    type: 'string',
    format: 'binary',
  })
  image?: Buffer | null;

  @ApiProperty({ enum: UserRoleConst })
  role: keyof typeof UserRoleConst;

  @ApiProperty({ enum: UserStatusConst })
  status: keyof typeof UserStatusConst;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
```

## Step 2: Create DTOs

### Create DTO
**File**: `src/modules/[module]/dto/create-[entity].dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateProductSchema = z
  .object({
    name: z.string().min(1, 'validation.name.required'),
    description: z.string().optional(),
    price: z.number().int().positive('validation.price.positive'),
    stock: z.number().int().min(0, 'validation.stock.min'),
  })
  .strict();

export class CreateProductDto extends createZodDto(CreateProductSchema) {}
```

### Update DTO
**File**: `src/modules/[module]/dto/update-[entity].dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateProductSchema = z
  .object({
    name: z.string().min(1, 'validation.name.required').optional(),
    description: z.string().optional(),
    price: z.number().int().positive('validation.price.positive').optional(),
    stock: z.number().int().min(0, 'validation.stock.min').optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK']).optional(),
  })
  .strict();

export class UpdateProductDto extends createZodDto(UpdateProductSchema) {}
```

### Response DTO
**File**: `src/modules/[module]/dto/[entity].dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { Product } from 'src/domain/product/product.entity';

export class ProductDto {
  constructor(product?: Product) {
    if (!product) return;
    Object.assign(this, {
      id: product.id,
      name: product.name,
      description: product.description ?? null,
      price: product.price,
      stock: product.stock,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    });
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true })
  description: string | null;

  @ApiProperty()
  price: number;

  @ApiProperty()
  stock: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
```

### Real Example: User DTOs
```typescript
// user.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/domain/user/user.entity';

export class UserDto {
  constructor(user?: User) {
    if (!user) return;
    Object.assign(this, {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ required: false, nullable: true })
  name: string | null;

  @ApiProperty({ enum: UserRoleConst })
  role: string;

  @ApiProperty({ enum: UserStatusConst })
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
```

## Step 3: Create Service

### Service Pattern
**File**: `src/modules/[module]/[module].service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { IBaseService } from 'src/domain/interface/base-service.interface';
import { Product } from 'src/domain/product/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  PaginatedResponse,
  PaginationQuery,
} from 'src/common/types/pagination.types';

@Injectable()
export class ProductService implements IBaseService<Product, CreateProductDto, UpdateProductDto> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async findAll(query: PaginationQuery): Promise<PaginatedResponse<Product> | Product[]> {
    const { page, limit, pagination, search, filter } = query;

    // Build where clause
    const where: any = {};

    // Global search
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Specific filters
    if (filter?.status) {
      where.status = filter.status;
    }

    const select = {
      id: true,
      name: true,
      description: true,
      price: true,
      stock: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    };

    // Without pagination
    if (!pagination) {
      const data = await this.prisma.product.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' },
      });
      return data;
    }

    // With pagination
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
      filter: {
        status: ['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'],
      },
    };
  }

  async findOne(id: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(
        this.i18n.t('product.not_found', { args: { id } })
      );
    }

    return product;
  }

  async create(data: CreateProductDto, performedById: string): Promise<Product> {
    const product = await this.prisma.product.create({
      data: {
        ...data,
        status: 'ACTIVE',
      },
    });

    // Log the action
    await this.prisma.systemLog.create({
      data: {
        module: 'PRODUCT',
        action: 'CREATE',
        message: 'Product created',
        metadata: JSON.stringify({ productId: product.id }),
        performedById,
      },
    });

    return product;
  }

  async update(id: string, data: UpdateProductDto, performedById: string): Promise<Product> {
    // Check if exists
    await this.findOne(id);

    const product = await this.prisma.product.update({
      where: { id },
      data,
    });

    // Log the action
    await this.prisma.systemLog.create({
      data: {
        module: 'PRODUCT',
        action: 'UPDATE',
        message: 'Product updated',
        metadata: JSON.stringify({ productId: id }),
        performedById,
      },
    });

    return product;
  }

  async remove(performedById: string, id: string): Promise<{ status: boolean; message: string }> {
    // Check if exists
    await this.findOne(id);

    await this.prisma.product.delete({
      where: { id },
    });

    // Log the action
    await this.prisma.systemLog.create({
      data: {
        module: 'PRODUCT',
        action: 'DELETE',
        message: 'Product deleted',
        metadata: JSON.stringify({ productId: id }),
        performedById,
      },
    });

    return {
      status: true,
      message: this.i18n.t('product.deleted'),
    };
  }
}
```

### Key Service Patterns

1. **Implement IBaseService**: Ensures consistency
2. **Use PrismaService**: All database operations
3. **Use I18nService**: All user-facing messages
4. **Error Handling**: Throw appropriate exceptions
5. **Logging**: Log important actions to SystemLog
6. **Select Fields**: Only return needed fields
7. **Pagination**: Support both paginated and non-paginated responses

## Step 4: Create Controller

### Controller Pattern
**File**: `src/modules/[module]/[module].controller.ts`

```typescript
import { Controller, Query, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProductService } from './product.service';
import {
  GetApi,
  PostApi,
  PatchApi,
  DeleteApi,
} from 'src/common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  PaginationQuerySchema,
  type PaginationQuery,
} from 'src/common/schemas/pagination.schema';
import { commonPaginationQueries } from 'src/common/swagger/pagination-queries';
import { ProductDto } from './dto/product.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { plainToInstance } from 'class-transformer';
import type { PaginatedResponse } from 'src/common/types/pagination.types';

@ApiTags('product')
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @GetApi({
    summary: 'List products',
    description: 'Returns a paginated list of products',
    status: 'OK',
    authenticated: true,
    queries: commonPaginationQueries,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Paginated response',
          schema: { dto: ProductDto, isArray: true, isPagination: true },
        },
      ],
    },
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<ProductDto> | ProductDto[]> {
    const result = await this.productService.findAll(query);

    if (Array.isArray(result)) {
      return plainToInstance(ProductDto, result);
    }

    return {
      data: plainToInstance(ProductDto, result.data),
      meta: result.meta,
      ...(result.filter ? { filter: result.filter } : {}),
    };
  }

  @GetApi({
    path: ':id',
    summary: 'Get product by ID',
    description: 'Returns a single product',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Product found',
          schema: { dto: ProductDto },
        },
      ],
    },
  })
  async findOne(@Param('id') id: string): Promise<ProductDto> {
    const product = await this.productService.findOne(id);
    return plainToInstance(ProductDto, product);
  }

  @PostApi({
    summary: 'Create product',
    description: 'Creates a new product',
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
    body: CreateProductDto,
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Product created',
          schema: { dto: ProductDto },
        },
      ],
    },
  })
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductDto> {
    const product = await this.productService.create(dto, user.id);
    return plainToInstance(ProductDto, product);
  }

  @PatchApi({
    path: ':id',
    summary: 'Update product',
    description: 'Updates an existing product',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    body: UpdateProductDto,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Product updated',
          schema: { dto: ProductDto },
        },
      ],
    },
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductDto> {
    const product = await this.productService.update(id, dto, user.id);
    return plainToInstance(ProductDto, product);
  }

  @DeleteApi({
    path: ':id',
    summary: 'Delete product',
    description: 'Deletes a product',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Product deleted',
        },
      ],
    },
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productService.remove(user.id, id);
  }
}
```

### Custom API Decorators

The project uses custom decorators that combine multiple NestJS/Swagger decorators:

```typescript
// @GetApi - For GET endpoints
@GetApi({
  path: ':id',                    // Optional: route path
  summary: 'Get product',         // Required: Swagger summary
  description: 'Returns product', // Optional: Swagger description
  status: 'OK',                   // Optional: HTTP status code
  authenticated: true,            // Optional: requires JWT
  roles: ['ADMIN'],              // Optional: required roles
  queries: commonPaginationQueries, // Optional: query parameters
  response: {                     // Optional: response schema
    success: [
      {
        status: 'OK',
        description: 'Product found',
        schema: { dto: ProductDto },
      },
    ],
  },
})

// @PostApi - For POST endpoints
@PostApi({
  summary: 'Create product',
  body: CreateProductDto,        // Request body schema
  status: 'CREATED',
  authenticated: true,
  roles: ['ADMIN'],
})

// @PatchApi - For PATCH endpoints
@PatchApi({
  path: ':id',
  summary: 'Update product',
  body: UpdateProductDto,
  authenticated: true,
  roles: ['ADMIN'],
})

// @DeleteApi - For DELETE endpoints
@DeleteApi({
  path: ':id',
  summary: 'Delete product',
  authenticated: true,
  roles: ['ADMIN'],
})
```

### Controller Best Practices

1. **Use @ApiTags**: Group endpoints in Swagger
2. **Use Custom Decorators**: `@GetApi`, `@PostApi`, etc.
3. **Use @CurrentUser()**: Get authenticated user
4. **Use ZodValidationPipe**: Validate query parameters
5. **Use plainToInstance**: Transform to DTOs
6. **Return DTOs**: Never return Prisma entities directly
7. **Handle Arrays and Pagination**: Different return types

## Step 5: Create Module

### Module Pattern
**File**: `src/modules/[module]/[module].module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
```

### With Dependencies
```typescript
import { Module, forwardRef } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { CategoryModule } from '../category/category.module';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    forwardRef(() => CategoryModule), // Circular dependency
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
```

### Module Best Practices

1. **Import PrismaModule**: Required for database access
2. **Import Dependencies**: Other modules you need
3. **Use forwardRef**: For circular dependencies
4. **Export Service**: If used by other modules
5. **Register in app.module.ts**: Add to imports array

## Step 6: Add Internationalization

### Backend i18n Files
**File**: `src/i18n/en/product.json`

```json
{
  "not_found": "Product not found",
  "created": "Product created successfully",
  "updated": "Product updated successfully",
  "deleted": "Product deleted successfully",
  "name_required": "Product name is required",
  "price_invalid": "Price must be a positive number",
  "stock_invalid": "Stock must be a non-negative number",
  "already_exists": "Product with this name already exists"
}
```

**File**: `src/i18n/pt-BR/product.json`

```json
{
  "not_found": "Produto não encontrado",
  "created": "Produto criado com sucesso",
  "updated": "Produto atualizado com sucesso",
  "deleted": "Produto deletado com sucesso",
  "name_required": "Nome do produto é obrigatório",
  "price_invalid": "Preço deve ser um número positivo",
  "stock_invalid": "Estoque deve ser um número não-negativo",
  "already_exists": "Produto com este nome já existe"
}
```

### Using i18n in Service
```typescript
throw new NotFoundException(
  this.i18n.t('product.not_found', { args: { id } })
);

// With variables
this.i18n.t('product.stock_low', { 
  args: { name: product.name, stock: product.stock } 
});
```

## Step 7: Register Module

### Add to app.module.ts
```typescript
import { Module } from '@nestjs/common';
import { ProductModule } from './modules/product/product.module';

@Module({
  imports: [
    // ... other modules
    ProductModule,
  ],
})
export class AppModule {}
```

## Checklist for New Backend Module

- [ ] Create Prisma model and run migration
- [ ] Create domain entity with @ApiProperty decorators
- [ ] Create DTOs (Create, Update, Response)
- [ ] Create service implementing IBaseService
- [ ] Implement findAll with pagination support
- [ ] Implement findOne with error handling
- [ ] Implement create with logging
- [ ] Implement update with validation
- [ ] Implement remove with logging
- [ ] Create controller with custom decorators
- [ ] Add @ApiTags and organize endpoints
- [ ] Use @CurrentUser for authenticated requests
- [ ] Transform responses to DTOs with plainToInstance
- [ ] Create module and import dependencies
- [ ] Add i18n translations (en and pt-BR)
- [ ] Register module in app.module.ts
- [ ] Test all endpoints
- [ ] Update Swagger documentation

## Next Steps
- Read `4_FRONTEND_GUIDE.md` for frontend integration
- See `7_EXAMPLES.md` for complete examples
