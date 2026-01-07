# Module Creation Workflow

## Complete Step-by-Step Guide

This guide provides a complete workflow for creating a new module from Prisma to frontend, using a **Product** module as example.

## Prerequisites

- PostgreSQL database running
- Backend and frontend dev servers running
- Basic understanding of TypeScript, NestJS, and Next.js

## Workflow Overview

```
1. Prisma Model
   ↓
2. Domain Entity
   ↓
3. Backend DTOs
   ↓
4. Backend Service
   ↓
5. Backend Controller
   ↓
6. Backend Module
   ↓
7. Backend i18n
   ↓
8. Frontend Types
   ↓
9. Frontend API
   ↓
10. Frontend Hooks
    ↓
11. Frontend Components
    ↓
12. Frontend Pages
    ↓
13. Frontend i18n
    ↓
14. Testing
```

## Step 1: Create Prisma Model

### 1.1 Add Enum (if needed)
**File**: `backend-nest/prisma/schema.prisma`

```prisma
enum ProductStatus {
  ACTIVE
  INACTIVE
  OUT_OF_STOCK
}
```

### 1.2 Add Model
```prisma
model Product {
  id          String        @id @default(uuid())
  name        String
  description String?
  price       Int           // Price in cents
  stock       Int           @default(0)
  status      ProductStatus @default(ACTIVE)
  categoryId  String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  category    Category?     @relation(fields: [categoryId], references: [id])
  
  @@index([categoryId])
  @@index([status])
  @@map("products")
}
```

### 1.3 Create Migration
```bash
cd backend-nest
npx prisma migrate dev --name create_product
npx prisma generate
```

### 1.4 Update LogModule Enum
```prisma
enum LogModule {
  USER
  AUTH
  SYSTEM
  PRODUCT  // Add new module
  // ... other modules
}
```

## Step 2: Create Domain Entity

### 2.1 Create Entity File
**File**: `backend-nest/src/domain/product/product.entity.ts`

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
    example: 'Laptop Dell XPS 13',
  })
  name: string;

  @ApiProperty({
    description: 'Product description',
    example: 'High-performance laptop for developers',
    required: false,
    nullable: true,
  })
  description?: string | null;

  @ApiProperty({
    description: 'Price in cents',
    example: 199900,
  })
  price: number;

  @ApiProperty({
    description: 'Stock quantity',
    example: 50,
  })
  stock: number;

  @ApiProperty({
    enum: ['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'],
  })
  status: string;

  @ApiProperty({ required: false })
  categoryId?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
```

### 2.2 Create Constants (if needed)
**File**: `backend-nest/src/domain/product/productStatus.const.ts`

```typescript
export const ProductStatusConst = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
} as const;

export type ProductStatus = keyof typeof ProductStatusConst;
```

## Step 3: Create Backend DTOs

### 3.1 Create DTO Directory
```bash
mkdir -p backend-nest/src/modules/product/dto
```

### 3.2 Create DTOs
**File**: `backend-nest/src/modules/product/dto/create-product.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateProductSchema = z
  .object({
    name: z.string().min(1, 'validation.name.required'),
    description: z.string().optional(),
    price: z.number().int().positive('validation.price.positive'),
    stock: z.number().int().min(0, 'validation.stock.min'),
    categoryId: z.string().uuid().optional(),
  })
  .strict();

export class CreateProductDto extends createZodDto(CreateProductSchema) {}
```

**File**: `backend-nest/src/modules/product/dto/update-product.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { ProductStatusConst } from 'src/domain/product/productStatus.const';
import { z } from 'zod';

const UpdateProductSchema = z
  .object({
    name: z.string().min(1, 'validation.name.required').optional(),
    description: z.string().optional(),
    price: z.number().int().positive('validation.price.positive').optional(),
    stock: z.number().int().min(0, 'validation.stock.min').optional(),
    status: z.nativeEnum(ProductStatusConst).optional(),
    categoryId: z.string().uuid().optional(),
  })
  .strict();

export class UpdateProductDto extends createZodDto(UpdateProductSchema) {}
```

**File**: `backend-nest/src/modules/product/dto/product.dto.ts`

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
      categoryId: product.categoryId ?? null,
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

  @ApiProperty({ required: false, nullable: true })
  categoryId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
```

## Step 4: Create Backend Service

**File**: `backend-nest/src/modules/product/product.service.ts`

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
import { ProductStatus } from '@prisma/client';

@Injectable()
export class ProductService
  implements IBaseService<Product, CreateProductDto, UpdateProductDto>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async findAll(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<Product> | Product[]> {
    const { page, limit, pagination, search, filter } = query;

    const where: {
      OR?: Array<{ name?: { contains: string }; description?: { contains: string } }>;
      status?: ProductStatus;
      categoryId?: string;
    } = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (filter?.status) {
      where.status = filter.status as ProductStatus;
    }

    if (filter?.categoryId) {
      where.categoryId = filter.categoryId;
    }

    const select = {
      id: true,
      name: true,
      description: true,
      price: true,
      stock: true,
      status: true,
      categoryId: true,
      createdAt: true,
      updatedAt: true,
    };

    if (!pagination) {
      const data = await this.prisma.product.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' },
      });
      return data;
    }

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
        status: Object.values(ProductStatus),
      },
    };
  }

  async findOne(id: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(
        this.i18n.t('product.not_found', { args: { id } }),
      );
    }

    return product;
  }

  async create(
    data: CreateProductDto,
    performedById: string,
  ): Promise<Product> {
    const product = await this.prisma.product.create({
      data: {
        ...data,
        status: 'ACTIVE',
      },
    });

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

  async update(
    id: string,
    data: UpdateProductDto,
    performedById: string,
  ): Promise<Product> {
    await this.findOne(id);

    const product = await this.prisma.product.update({
      where: { id },
      data,
    });

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

  async remove(
    performedById: string,
    id: string,
  ): Promise<{ status: boolean; message: string }> {
    await this.findOne(id);

    await this.prisma.product.delete({
      where: { id },
    });

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

## Step 5: Create Backend Controller

**File**: `backend-nest/src/modules/product/product.controller.ts`

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
import { ProductStatusConst } from 'src/domain/product/productStatus.const';

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
    @Query(new ZodValidationPipe(PaginationQuerySchema))
    query: PaginationQuery,
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
    path: 'statuses',
    summary: 'List product statuses',
    description: 'Returns all available product statuses',
    status: 'OK',
    authenticated: true,
  })
  getStatuses() {
    return Object.values(ProductStatusConst).map((status) => ({
      value: status,
      label: status,
    }));
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

## Step 6: Create Backend Module

**File**: `backend-nest/src/modules/product/product.module.ts`

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

### Register in app.module.ts
**File**: `backend-nest/src/app.module.ts`

```typescript
import { ProductModule } from './modules/product/product.module';

@Module({
  imports: [
    // ... other modules
    ProductModule,
  ],
})
export class AppModule {}
```

## Step 7: Add Backend i18n

**File**: `backend-nest/src/i18n/en/product.json`

```json
{
  "not_found": "Product not found",
  "created": "Product created successfully",
  "updated": "Product updated successfully",
  "deleted": "Product deleted successfully",
  "name_required": "Product name is required",
  "price_positive": "Price must be a positive number",
  "stock_min": "Stock must be at least 0"
}
```

**File**: `backend-nest/src/i18n/pt-BR/product.json`

```json
{
  "not_found": "Produto não encontrado",
  "created": "Produto criado com sucesso",
  "updated": "Produto atualizado com sucesso",
  "deleted": "Produto excluído com sucesso",
  "name_required": "Nome do produto é obrigatório",
  "price_positive": "Preço deve ser um número positivo",
  "stock_min": "Estoque deve ser no mínimo 0"
}
```

## Step 8: Create Frontend Types

**File**: `frontend-next/src/lib/actions/product/types.ts`

```typescript
export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  status: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDto {
  name: string;
  description?: string;
  price: number;
  stock: number;
  categoryId?: string;
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
  categoryId?: string;
}

export const ProductStatusColors = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  OUT_OF_STOCK: 'bg-red-100 text-red-800',
};
```

## Step 9: Create Frontend API

**File**: `frontend-next/src/lib/actions/product/api.ts`

```typescript
"use server";

import { GET, POST, PATCH, DELETE } from '@/lib/api/api';
import type { ApiResponse } from '@/lib/api/api';
import type {
  PaginatedResponse,
  PaginationParams,
} from '@/lib/types/pagination.types';
import type { Product, CreateProductDto, UpdateProductDto } from './types';

export async function getProducts(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<Product> | Product[]>> {
  return await GET<PaginatedResponse<Product> | Product[]>('/product', {
    params,
  });
}

export async function getProduct(id: string): Promise<ApiResponse<Product>> {
  return await GET<Product>(`/product/${id}`);
}

export async function createProduct(
  data: CreateProductDto,
): Promise<ApiResponse<Product>> {
  return await POST<Product>('/product', data);
}

export async function updateProduct(
  id: string,
  data: UpdateProductDto,
): Promise<ApiResponse<Product>> {
  return await PATCH<Product>(`/product/${id}`, data);
}

export async function deleteProduct(
  id: string,
): Promise<ApiResponse<{ status: boolean; message: string }>> {
  return await DELETE<{ status: boolean; message: string }>(`/product/${id}`);
}

export async function getProductStatuses(): Promise<
  ApiResponse<{ value: string; label: string }[]>
> {
  return await GET<{ value: string; label: string }[]>('/product/statuses');
}
```

## Step 10: Create Frontend Hooks

**File**: `frontend-next/src/lib/actions/product/queries.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStatuses,
} from './api';
import type { PaginationParams } from '@/lib/types/pagination.types';
import type { CreateProductDto, UpdateProductDto } from './types';
import { Collector, Alive, EmulateMutationError } from '@/lib/api/collector';
import { getQueryConfig } from '@/lib/config/performance.config';
import { useApp } from '@/contexts/app-context';

export function useProducts(params?: PaginationParams) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: Collector(() => getProducts(params)),
    ...getQueryConfig('PRODUCTS'),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: Collector(() => getProduct(id)),
    ...getQueryConfig('PRODUCT', 'PRODUCT'),
    enabled: !!id,
  });
}

export function useProductStatuses() {
  return useQuery({
    queryKey: ['products', 'statuses'],
    queryFn: Collector(getProductStatuses),
    staleTime: 1000 * 60 * 60,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: (data: CreateProductDto) => {
      EmulateMutationError(emulateError, 'Emulated error from useCreateProduct');
      return Alive(() => createProduct(data))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductDto }) => {
      EmulateMutationError(emulateError, 'Emulated error from useUpdateProduct');
      return Alive(() => updateProduct(id, data))();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', id] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: (id: string) => {
      EmulateMutationError(emulateError, 'Emulated error from useDeleteProduct');
      return Alive(() => deleteProduct(id))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
```

## Step 11: Create Frontend Components

### Create Directory
```bash
mkdir -p frontend-next/src/app/\(private\)/products/components
```

### Products Table Component
See Step 4 in `4_FRONTEND_GUIDE.md` for complete implementation.

### Product Form Component
See Step 5 in `4_FRONTEND_GUIDE.md` for complete implementation.

## Step 12: Create Frontend Pages

### 12.1 List Page (Client Component)
**File**: `src/app/(private)/products/page.tsx`

```typescript
'use client';

import { ProductsTable } from './components/products-table';
import { Container } from '@/components/container';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default function ProductsPage() {
  return (
    <Container>
      <div className="flex justify-between items-center mb-6">
        <PageTitle title="Products" />
        <Link href="/products/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Product
          </Button>
        </Link>
      </div>
      
      <ProductsTable />
    </Container>
  );
}
```

**Why Client Component:**
- Needs DataTable with pagination state
- Needs filter and search state
- Needs real-time updates
- Interactive user actions

### 12.2 Detail Page (Server Component - RECOMMENDED)
**File**: `src/app/(private)/products/[id]/page.tsx`

```typescript
// No 'use client' - this is a Server Component
import { getProduct } from '@/lib/actions/product/api';
import { ProductEditPage } from '../components/product-edit';
import { notFound } from 'next/navigation';

export default async function ProductDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  // Next.js 15+ requires awaiting params
  const { id } = await params;

  // Call API directly in Server Component
  const response = await getProduct(id);

  // Handle not found
  if (!response.success || !response.data) {
    notFound();
  }

  const product = response.data;

  // Pass data to Client Component
  return <ProductEditPage product={product} />;
}
```

**Why Server Component:**
- ✅ Better performance (less JavaScript)
- ✅ No loading state needed
- ✅ SEO friendly
- ✅ Simpler code

### 12.3 Client Component Receives Props
**File**: `src/app/(private)/products/components/product-edit.tsx`

```typescript
'use client';

import { Product } from '@/lib/actions/product/types';
import { ProductForm } from './product-form';

interface ProductEditPageProps {
  product: Product; // From Server Component
}

export function ProductEditPage({ product }: ProductEditPageProps) {
  return (
    <div>
      <h2>Edit Product: {product.name}</h2>
      <ProductForm product={product} />
    </div>
  );
}
```

### Page Structure Summary

**List Pages → Client Components:**
```
src/app/(private)/products/
└── page.tsx          # 'use client' + ProductsTable
```

**Detail Pages → Server Components + Client Components:**
```
src/app/(private)/products/
├── [id]/
│   └── page.tsx      # async, calls getProduct(id)
└── components/
    └── product-edit.tsx  # 'use client', receives props
```

## Step 13: Add Frontend i18n

**Files**:
- `frontend-next/src/locales/en/products.json`
- `frontend-next/src/locales/pt-BR/products.json`

See Step 7 in `4_FRONTEND_GUIDE.md` for complete translations.

## Step 14: Testing

### Backend Testing
```bash
# Test endpoints
curl http://localhost:3001/api/product
curl http://localhost:3001/api/product/:id

# Check Swagger
http://localhost:3001/api/docs
```

### Frontend Testing
1. Navigate to `/products`
2. Test pagination
3. Test search
4. Test filtering
5. Test create
6. Test edit
7. Test delete
8. Test mobile responsiveness
9. Test translations (en/pt-BR)

## Complete Checklist

### Backend
- [ ] Prisma model created
- [ ] Migration generated and applied
- [ ] Domain entity created
- [ ] DTOs created (Create, Update, Response)
- [ ] Service implemented
- [ ] Controller created
- [ ] Module created and registered
- [ ] i18n translations added
- [ ] Swagger documentation verified
- [ ] Endpoints tested

### Frontend
- [ ] TypeScript types created
- [ ] API functions created
- [ ] React Query hooks created
- [ ] DataTable component created
- [ ] Form component created
- [ ] List page created
- [ ] Detail/edit page created
- [ ] i18n translations added
- [ ] All CRUD operations tested
- [ ] Mobile responsiveness verified

## Common Issues

### Backend
- **Migration fails**: Check Prisma schema syntax
- **Service errors**: Check PrismaService injection
- **i18n not working**: Check translation files exist
- **Swagger 404**: Check module is registered in app.module.ts

### Frontend
- **API errors**: Check backend is running and CORS configured
- **React Query not updating**: Check invalidateQueries calls
- **Types mismatch**: Ensure frontend types match backend DTOs
- **Translations missing**: Check translation files and keys

## Next Steps
- Read `6_CONVENTIONS.md` for naming conventions
- Read `7_EXAMPLES.md` for more examples
- Customize and extend as needed
