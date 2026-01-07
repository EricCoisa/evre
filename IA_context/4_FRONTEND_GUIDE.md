# Frontend Next.js Module Creation Guide

## Overview
This guide covers creating frontend modules that integrate with the NestJS backend, following Next.js App Router patterns.

## Module Structure

### Standard Frontend Module Organization
```
src/lib/actions/[module]/
├── api.ts        # Server actions (API calls)
├── queries.ts    # React Query hooks
└── types.ts      # TypeScript interfaces

src/app/(private)/[module]/
├── page.tsx      # Main page component
├── [id]/
│   └── page.tsx  # Detail page
└── components/
    ├── [module]-table.tsx
    ├── [module]-form.tsx
    └── [module]-card.tsx
```

## Step 1: Create TypeScript Types

### Types Pattern
**File**: `src/lib/actions/[module]/types.ts`

```typescript
// Entity interface (matches backend DTO)
export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  status: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
  createdAt: string;
  updatedAt: string;
}

// Create DTO (matches backend CreateProductDto)
export interface CreateProductDto {
  name: string;
  description?: string;
  price: number;
  stock: number;
}

// Update DTO (matches backend UpdateProductDto)
export interface UpdateProductDto {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
}

// UI Helper types
export const ProductStatusColors = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  OUT_OF_STOCK: 'bg-red-100 text-red-800',
};

export interface ProductWithRelations extends Product {
  category?: {
    id: string;
    name: string;
  };
}
```

### Real Example: User Types
```typescript
export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  name?: string;
  role?: Role;
  status?: UserStatus;
}

export interface UpdateUserDto {
  email?: string;
  password?: string;
  name?: string;
  role?: Role;
  status?: UserStatus;
}

export const UserStatusColors = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  SUSPENDED: 'bg-red-100 text-red-800',
};
```

## Step 2: Create API Functions

### API Pattern
**File**: `src/lib/actions/[module]/api.ts`

```typescript
"use server";

import { GET, POST, PATCH, DELETE } from '@/lib/api/api';
import type { ApiResponse } from '@/lib/api/api';
import type { PaginatedResponse, PaginationParams } from '@/lib/types/pagination.types';
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

// Optional: Get filter options
export async function getProductStatuses(): Promise<
  ApiResponse<{ value: string; label: string }[]>
> {
  return await GET<{ value: string; label: string }[]>('/product/statuses');
}
```

### API Best Practices

1. **"use server" Directive**: All API files are server actions
2. **Type Safety**: Use TypeScript generics for responses
3. **Consistent Naming**: `get[Entity]`, `create[Entity]`, etc.
4. **Error Handling**: Handled by API client (api.ts)
5. **Pagination**: Support optional pagination params
6. **Return ApiResponse**: Consistent response structure

### Real Example: User API
```typescript
"use server";

import { GET, POST, PATCH, DELETE } from '@/lib/api/api';
import type { ApiResponse } from '@/lib/api/api';
import type { PaginatedResponse, PaginationParams } from '@/lib/types/pagination.types';
import type { User, CreateUserDto, UpdateUserDto } from './types';

export async function getUsers(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<User> | User[]>> {
  return await GET<PaginatedResponse<User> | User[]>('/user', {
    params,
  });
}

export async function getUser(id: string): Promise<ApiResponse<User>> {
  return await GET<User>(`/user/${id}`);
}

export async function updateUser(
  id: string,
  data: UpdateUserDto,
): Promise<ApiResponse<User>> {
  return await PATCH<User>(`/user/${id}`, data);
}

export async function getRoles(): Promise<
  ApiResponse<{ value: string; label: string }[]>
> {
  return await GET<{ value: string; label: string }[]>('/user/roles');
}

export async function getStatus(): Promise<
  ApiResponse<{ value: string; label: string }[]>
> {
  return await GET<{ value: string; label: string }[]>('/user/status');
}
```

## Step 3: Create React Query Hooks

### Queries Pattern
**File**: `src/lib/actions/[module]/queries.ts`

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
import { Collector, Alive } from '@/lib/api/collector';
import { getQueryConfig } from '@/lib/config/performance.config';
import { useApp } from '@/contexts/app-context';
import { EmulateMutationError } from '@/lib/api/collector';

// Query: List products
export function useProducts(params?: PaginationParams) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: Collector(() => getProducts(params)),
    ...getQueryConfig('PRODUCTS'),
  });
}

// Query: Get single product
export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: Collector(() => getProduct(id)),
    ...getQueryConfig('PRODUCT', 'PRODUCT'),
    enabled: !!id,
  });
}

// Query: Get product statuses
export function useProductStatuses() {
  return useQuery({
    queryKey: ['products', 'statuses'],
    queryFn: Collector(getProductStatuses),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

// Mutation: Create product
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

// Mutation: Update product
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

// Mutation: Delete product
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

### React Query Best Practices

1. **Query Keys**: Use array format `['entity', params]`
2. **Collector Wrapper**: Use for queries (error handling)
3. **Alive Wrapper**: Use for mutations (error handling)
4. **Query Config**: Use getQueryConfig for performance settings
5. **Invalidate Queries**: Update cache after mutations
6. **Enabled Option**: Conditional queries (e.g., `enabled: !!id`)
7. **Stale Time**: Set for static data (roles, statuses)

## Step 4: Create DataTable Component

### DataTable Usage Pattern
**File**: `src/app/(private)/products/components/products-table.tsx`

```typescript
'use client';

import { DataTable } from '@/components/data-table';
import { type ColumnDef } from '@tanstack/react-table';
import type { Product } from '@/lib/actions/product/types';
import { useProducts, useDeleteProduct } from '@/lib/actions/product/queries';
import { useState } from 'react';
import type { PaginationState } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProductStatusColors } from '@/lib/actions/product/types';
import { useTranslation } from '@/hooks/use-translation';
import { formatCurrency } from '@/lib/utils';

export function ProductsTable() {
  const { t } = useTranslation();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [globalFilter, setGlobalFilter] = useState('');

  const { data, isLoading, error } = useProducts({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true,
    search: globalFilter,
    filter: filters,
  });

  const deleteMutation = useDeleteProduct();

  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: 'name',
      header: t('products.name'),
    },
    {
      accessorKey: 'description',
      header: t('products.description'),
      cell: ({ row }) => row.original.description || '-',
    },
    {
      accessorKey: 'price',
      header: t('products.price'),
      cell: ({ row }) => formatCurrency(row.original.price),
    },
    {
      accessorKey: 'stock',
      header: t('products.stock'),
    },
    {
      accessorKey: 'status',
      header: t('products.status'),
      cell: ({ row }) => (
        <Badge className={ProductStatusColors[row.original.status]}>
          {t(`products.status.${row.original.status}`)}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleEdit(row.original.id)}>
              <Edit className="mr-2 h-4 w-4" />
              {t('common.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDelete(row.original.id)}
              className="text-red-600"
            >
              <Trash className="mr-2 h-4 w-4" />
              {t('common.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const handleEdit = (id: string) => {
    // Navigate to edit page or open modal
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('products.confirm_delete'))) {
      await deleteMutation.mutateAsync(id);
    }
  };

  return (
    <DataTable
      columns={columns}
      data={data}
      error={error}
      queryKey={['products']}
      isLoading={isLoading}
      pagination={pagination}
      onPaginationChange={setPagination}
      globalFilter={globalFilter}
      onGlobalFilterChange={setGlobalFilter}
      filters={filters}
      onFiltersChange={setFilters}
      enableGlobalFilter
      searchPlaceholder={t('products.search_placeholder')}
      entityName={t('products.entity')}
      entityNamePlural={t('products.entity_plural')}
    />
  );
}
```

### DataTable with Filters (Advanced Pattern)
**Using DataTable.Input and DataTable.Select subcomponents**

```typescript
'use client';

import { DataTable } from '@/components/data-table';
import { type ColumnDef } from '@tanstack/react-table';
import type { User } from '@/lib/actions/user/types';
import { useUsers, useRoles, useStatus } from '@/lib/actions/user/queries';
import { useState, useMemo, useCallback } from 'react';
import type { PaginationState } from '@tanstack/react-table';
import { getUserColumns } from './user-columns';
import { useTranslation } from 'react-i18next';

export function UsersTable() {
  const { t } = useTranslation('users');
  
  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({ 
    pageIndex: 0, 
    pageSize: 10 
  });
  
  // Filter states
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Build query params
  const queryParams = useMemo(() => ({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true,
    ...(globalFilter && { search: globalFilter }),
    ...(Object.keys(filters).length > 0 && { filter: JSON.stringify(filters) }),
  }), [pagination.pageIndex, pagination.pageSize, globalFilter, filters]);

  // Fetch data
  const { data, error } = useUsers(queryParams);
  
  // Fetch filter options
  const { data: rolesData } = useRoles();
  const { data: statusData } = useStatus();

  // Define columns
  const columns = useMemo(() => 
    getUserColumns({ t, onEdit, onViewRoutes }), 
    [t]
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      error={error}
      queryKey={['users']}
      pagination={pagination}
      onPaginationChange={setPagination}
      globalFilter={globalFilter}
      onGlobalFilterChange={setGlobalFilter}
      filters={filters}
      onFiltersChange={setFilters}
      enableGlobalFilter
      entityName={t('entity')}
      entityNamePlural={t('entity_plural')}
    >
      {/* Search Input - uses globalFilter */}
      <DataTable.Input 
        title={t('search')}
        placeholder={t('searchPlaceholder')} 
      />

      {/* Role Filter - uses filters state */}
      <DataTable.Select<User>
        title={t('filterByRole')}
        accessorKey="role"
        placeholder={t('allRoles')}
      />

      {/* Status Filter - uses filters state */}
      <DataTable.Select<User>
        title={t('filterByStatus')}
        accessorKey="status"
        placeholder={t('allStatuses')}
      />

      {/* Custom Actions */}
      <DataTable.Actions>
        <Button onClick={handleCreateUser}>
          <Plus className="mr-2 h-4 w-4" />
          {t('createUser')}
        </Button>
      </DataTable.Actions>
    </DataTable>
  );
}
```

### DataTable Features

1. **Pagination**: Built-in pagination state and UI
   - `pagination` prop: `{ pageIndex: 0, pageSize: 10 }`
   - `onPaginationChange` prop: setState function
   - Automatically syncs with backend `page` and `limit` params

2. **Search**: Global search across columns
   - `globalFilter` prop: search string state
   - `onGlobalFilterChange` prop: setState function
   - `enableGlobalFilter` prop: enable/disable search
   - `DataTable.Input` component: pre-built search input

3. **Filters**: Column-specific filters
   - `filters` prop: `Record<string, string>` state
   - `onFiltersChange` prop: setState function
   - `DataTable.Select<T>` component: pre-built select filter with `accessorKey`

4. **Compound Components** (children):
   - `DataTable.Input`: Search input (uses `globalFilter`)
   - `DataTable.Select<T>`: Filter dropdown (uses `filters[accessorKey]`)
   - `DataTable.Actions`: Custom action buttons (rendered normally on mobile)

5. **Actions Column**: Edit, delete, custom actions
6. **Loading States**: Automatic loading indicators
7. **Error Handling**: Error display via StateMaster
8. **Empty States**: Custom empty messages
9. **Responsive**: Mobile-friendly layout
10. **Query Key**: For React Query cache invalidation

## Step 5: Create Form Component

### Form Pattern
**File**: `src/app/(private)/products/components/product-form.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/use-translation';
import {
  useCreateProduct,
  useUpdateProduct,
} from '@/lib/actions/product/queries';
import type { Product } from '@/lib/actions/product/types';

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price: z.coerce.number().positive('Price must be positive'),
  stock: z.coerce.number().min(0, 'Stock must be non-negative'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK']).optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormProps {
  product?: Product;
  onSuccess?: () => void;
}

export function ProductForm({ product, onSuccess }: ProductFormProps) {
  const { t } = useTranslation();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || '',
      description: product?.description || '',
      price: product?.price || 0,
      stock: product?.stock || 0,
      status: product?.status || 'ACTIVE',
    },
  });

  const onSubmit = async (data: ProductFormValues) => {
    try {
      if (product) {
        await updateMutation.mutateAsync({
          id: product.id,
          data,
        });
      } else {
        await createMutation.mutateAsync(data);
      }
      onSuccess?.();
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('products.name')}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('products.name_placeholder')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('products.description')}</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder={t('products.description_placeholder')}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('products.price')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="stock"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('products.stock')}</FormLabel>
              <FormControl>
                <Input {...field} type="number" placeholder="0" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {product && (
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('products.status')}</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="ACTIVE">
                      {t('products.status.ACTIVE')}
                    </SelectItem>
                    <SelectItem value="INACTIVE">
                      {t('products.status.INACTIVE')}
                    </SelectItem>
                    <SelectItem value="OUT_OF_STOCK">
                      {t('products.status.OUT_OF_STOCK')}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {product ? t('common.update') : t('common.create')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

### Form Best Practices

1. **Zod Schema**: Validate with Zod
2. **React Hook Form**: Use for form state
3. **shadcn/ui Form**: Use Form components
4. **Mutations**: Use React Query mutations
5. **Loading States**: Disable buttons during submission
6. **Success Callback**: Trigger on successful submission
7. **Error Handling**: Handled by mutation wrapper

## Step 6: Create Page Component

### Page Pattern
**File**: `src/app/(private)/products/page.tsx`

```typescript
import { PageTitle } from '@/components/page-title';
import { Container } from '@/components/container';
import { ProductsTable } from './components/products-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default function ProductsPage() {
  return (
    <Container>
      <div className="flex justify-between items-center mb-6">
        <PageTitle
          title="Products"
          description="Manage your products"
        />
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

### Detail Page Pattern (Client Component)
**File**: `src/app/(private)/products/[id]/page.tsx`

```typescript
'use client';

import { useProduct } from '@/lib/actions/product/queries';
import { Container } from '@/components/container';
import { PageTitle } from '@/components/page-title';
import { StateMaster } from '@/components/state-master';
import { ProductForm } from '../components/product-form';
import { useRouter } from 'next/navigation';

export default function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { data: product, isLoading, error } = useProduct(params.id);

  return (
    <Container>
      <PageTitle title="Edit Product" />
      
      <StateMaster
        isLoading={isLoading}
        error={error}
        data={product}
        loadingMessage="Loading product..."
        entityName="Product"
      >
        {product && (
          <ProductForm
            product={product}
            onSuccess={() => router.push('/products')}
          />
        )}
      </StateMaster>
    </Container>
  );
}
```

### Detail Page Pattern (Server Component - Recommended)
**File**: `src/app/(private)/products/[id]/page.tsx`

**This is the PREFERRED pattern** - Server Components that fetch data directly and pass to Client Components:

```typescript
// No 'use client' directive - this is a Server Component
import { getProduct } from '@/lib/actions/product/api';
import { ProductEditPage } from '../components/product-edit';
import { notFound } from 'next/navigation';

export default async function ProductDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  // Await params (Next.js 15+ requirement)
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

**Real Example from User Module:**
```typescript
import { getUser } from '@/lib/actions/user/api';
import { UserEditPage } from '../components/user-edit';
import UsersRolesPage from '../components/user-roles';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LangLabel from '@/components/ui/langLabel';

export default async function UserDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const data = (await getUser(id)).data;

  return (
    <Tabs defaultValue="user">
      <TabsList>
        <TabsTrigger value="user">
          <LangLabel text="title" langJson="users" />
        </TabsTrigger>
        <TabsTrigger value="access">
          <LangLabel text="access" langJson="users" />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="user">
        <UserEditPage user={data} />
      </TabsContent>
      <TabsContent value="access">
        <UsersRolesPage user={data} />
      </TabsContent>
    </Tabs>
  );
}
```

**Why prefer Server Components:**
- ✅ Better performance (less JavaScript sent to client)
- ✅ Direct database access capability
- ✅ No loading states needed
- ✅ SEO friendly
- ✅ Simplified error handling
- ✅ Data fetched before page render

**When to use Client Components:**
- Need real-time updates
- Need interactive state (filters, sorting)
- Need React hooks (useState, useEffect)
- List pages with DataTable (requires client-side state)

## Step 7: Add Translations

### Frontend Translations
**File**: `src/locales/en/products.json`

```json
{
  "entity": "Product",
  "entity_plural": "Products",
  "name": "Name",
  "description": "Description",
  "price": "Price",
  "stock": "Stock",
  "status": {
    "label": "Status",
    "ACTIVE": "Active",
    "INACTIVE": "Inactive",
    "OUT_OF_STOCK": "Out of Stock"
  },
  "search_placeholder": "Search products...",
  "name_placeholder": "Enter product name",
  "description_placeholder": "Enter product description",
  "confirm_delete": "Are you sure you want to delete this product?",
  "created": "Product created successfully",
  "updated": "Product updated successfully",
  "deleted": "Product deleted successfully"
}
```

**File**: `src/locales/pt-BR/products.json`

```json
{
  "entity": "Produto",
  "entity_plural": "Produtos",
  "name": "Nome",
  "description": "Descrição",
  "price": "Preço",
  "stock": "Estoque",
  "status": {
    "label": "Status",
    "ACTIVE": "Ativo",
    "INACTIVE": "Inativo",
    "OUT_OF_STOCK": "Sem Estoque"
  },
  "search_placeholder": "Buscar produtos...",
  "name_placeholder": "Digite o nome do produto",
  "description_placeholder": "Digite a descrição do produto",
  "confirm_delete": "Tem certeza que deseja excluir este produto?",
  "created": "Produto criado com sucesso",
  "updated": "Produto atualizado com sucesso",
  "deleted": "Produto excluído com sucesso"
}
```

## Checklist for New Frontend Module

- [ ] Create TypeScript types matching backend DTOs
- [ ] Create API functions with "use server"
- [ ] Create React Query hooks (queries and mutations)
- [ ] Create DataTable component with columns
- [ ] Add actions column (edit, delete)
- [ ] Create form component with Zod validation
- [ ] Create list page with DataTable
- [ ] Create detail/edit page
- [ ] Add create page or modal
- [ ] Add translations (en and pt-BR)
- [ ] Test all CRUD operations
- [ ] Handle loading and error states
- [ ] Test pagination and filtering
- [ ] Test mobile responsiveness

## Next Steps
- Read `5_MODULE_CREATION_WORKFLOW.md` for complete workflow
- Read `6_CONVENTIONS.md` for naming conventions
- See `7_EXAMPLES.md` for complete examples
