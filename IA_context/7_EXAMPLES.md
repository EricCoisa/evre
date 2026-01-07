# Complete Code Examples

This document provides real, complete examples from the existing codebase that demonstrate all patterns and conventions.

## Table of Contents
1. [User Module - Complete Example](#user-module---complete-example)
2. [Custom Decorators](#custom-decorators)
3. [Error Handling](#error-handling)
4. [Pagination Implementation](#pagination-implementation)
5. [React Query Patterns](#react-query-patterns)
6. [DataTable Advanced Usage](#datatable-advanced-usage)
7. [Form with File Upload](#form-with-file-upload)
8. [Server Component with Dynamic Routes](#server-component-with-dynamic-routes)

---

## User Module - Complete Example

### 1. Prisma Model
**File**: `backend-nest/prisma/schema.prisma`

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

model User {
  id                  String               @id @default(uuid())
  email               String               @unique
  password            String
  name                String?
  image               Bytes?               // Binary data up to 40MB
  role                UserRole             @default(USER)
  status              UserStatus           @default(ACTIVE)
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  
  // Relations
  systemLogs          SystemLog[]
  refreshTokens       RefreshToken[]
  passwordResetTokens PasswordResetToken[]
  userRouteAccesses   UserRouteAccess[]
  grantedRouteAccesses UserRouteAccess[]  @relation("GrantedBy")
  userConfigurations  UserConfiguration[]

  @@index([email])
  @@map("users")
}
```

### 2. Domain Entity
**File**: `backend-nest/src/domain/user/user.entity.ts`

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

### 3. Constants
**File**: `backend-nest/src/domain/auth/userRole.const.ts`

```typescript
export const UserRoleConst = {
  ADMIN: 'ADMIN',
  USER: 'USER',
  MODERATOR: 'MODERATOR',
} as const;

export type UserRole = keyof typeof UserRoleConst;
```

**File**: `backend-nest/src/domain/auth/userStatus.const.ts`

```typescript
export const UserStatusConst = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export type UserStatus = keyof typeof UserStatusConst;
```

### 4. DTOs
**File**: `backend-nest/src/modules/user/dto/update-user.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { UserRoleConst } from 'src/domain/auth/userRole.const';
import { UserStatusConst } from 'src/domain/auth/userStatus.const';
import { z } from 'zod';

const UpdateUserSchema = z
  .object({
    name: z.string().optional(),
    role: z.nativeEnum(UserRoleConst).optional(),
    status: z.nativeEnum(UserStatusConst).optional(),
  })
  .strict();

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}

const UpdateProfileSchema = UpdateUserSchema.omit({
  role: true,
  status: true,
}).extend({
  image: z.any().optional(), // Buffer for binary image
});

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}

export type UpdateUserDtoType = z.infer<typeof UpdateUserSchema>;

const UpdatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'validation.current_password.required'),
    newPassword: z.string().min(6, 'validation.new_password.min_length'),
    confirmNewPassword: z
      .string()
      .min(6, 'validation.confirm_new_password.min_length'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'validation.new_passwords_do_not_match',
  })
  .strict();

export class UpdatePasswordDto extends createZodDto(UpdatePasswordSchema) {}
```

**File**: `backend-nest/src/modules/user/dto/user.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { UserRoleConst } from 'src/domain/auth/userRole.const';
import { UserStatusConst } from 'src/domain/auth/userStatus.const';
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

### 5. Service with Pagination
**File**: `backend-nest/src/modules/user/user.service.ts` (excerpt)

```typescript
@Injectable()
export class UserService implements Omit<IBaseService<User>, 'create' | 'remove'> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async findAll(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<User> | User[]> {
    const { page, limit, pagination, search, filter } = query;

    // Build where clause
    const where: {
      OR?: Array<{
        email?: { contains: string };
        name?: { contains: string };
      }>;
      role?: UserRole;
      status?: UserStatus;
    } = {};

    // Apply global search
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
      ];
    }

    // Apply specific filters
    if (filter?.role) {
      where.role = filter.role as UserRole;
    }

    if (filter?.status) {
      where.status = filter.status as UserStatus;
    }

    const select = {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    };

    // Without pagination
    if (!pagination) {
      const data = await this.prisma.user.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' },
      });
      return data;
    }

    // With pagination
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const roleSet = Object.values(UserRoleConst);
    const statusSet = Object.values(UserStatusConst);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
      filter: {
        role: Array.from(roleSet),
        status: Array.from(statusSet),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        this.i18n.t('user.not_found', { args: { id } })
      );
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(
        this.i18n.t('user.not_found', { args: { id } })
      );
    }

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  async updateProfile(id: string, data: UpdateProfileDto): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(
        this.i18n.t('user.not_found', { args: { id } })
      );
    }

    // Handle image validation
    if (data.image) {
      const imageBuffer = data.image as Buffer;
      
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new BadRequestException(this.i18n.t('user.image_empty'));
      }

      const maxSize = 40 * 1024 * 1024; // 40MB
      if (imageBuffer.length > maxSize) {
        throw new BadRequestException(this.i18n.t('user.image_too_large'));
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        ...(data.image && { image: data.image as Buffer }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return new UserDto(updatedUser);
  }

  async updatePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
    confirmNewPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(
        this.i18n.t('user.not_found', { args: { id } })
      );
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException(
        this.i18n.t('user.current_password_invalid')
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }
}
```

### 6. Controller with Custom Decorators
**File**: `backend-nest/src/modules/user/user.controller.ts` (excerpt)

```typescript
@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly i18n: I18nService,
    private readonly userRouteAccessService: UserRouteAccessService,
    private readonly systemConfigurationService: SystemConfigurationService,
  ) {}

  @GetApi({
    summary: 'Lista usuários',
    description: 'Retorna uma lista paginada de usuários do sistema',
    status: 'OK',
    authenticated: true,
    queries: commonPaginationQueries,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Resposta paginada',
          schema: { dto: UserDto, isArray: true, isPagination: true },
        },
      ],
    },
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<UserDto> | UserDto[]> {
    const result = await this.userService.findAll(query);

    if (Array.isArray(result)) {
      return plainToInstance(UserDto, result);
    }

    return {
      data: plainToInstance(UserDto, result.data),
      meta: result.meta,
      ...(result.filter ? { filter: result.filter } : {}),
    };
  }

  @GetApi({
    path: 'roles',
    summary: 'Lista de papéis disponíveis',
    description: 'Retorna todos os (roles) de usuário disponíveis no sistema',
    status: 'OK',
    authenticated: true,
  })
  getRoles() {
    return Object.values(UserRoleConst).map((role) => ({
      value: role,
      label: role,
    }));
  }

  @GetApi({
    path: 'status',
    summary: 'Lista de status disponíveis',
    description: 'Retorna todos os status de usuário disponíveis no sistema',
    status: 'OK',
    authenticated: true,
  })
  getStatus() {
    return Object.values(UserStatusConst).map((status) => ({
      value: status,
      label: status,
    }));
  }

  @GetApi({
    path: ':id',
    summary: 'Busca usuário por ID',
    description: 'Retorna os detalhes de um usuário específico',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Usuário encontrado',
          schema: { dto: UserDto },
        },
      ],
    },
  })
  async findOne(@Param('id') id: string): Promise<UserDto> {
    const user = await this.userService.findOne(id);
    return plainToInstance(UserDto, user);
  }

  @PatchApi({
    path: ':id',
    summary: 'Atualiza usuário',
    description: 'Atualiza os dados de um usuário',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    body: UpdateUserDto,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Usuário atualizado',
          schema: { dto: UserDto },
        },
      ],
    },
  })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserDto> {
    const user = await this.userService.update(id, updateUserDto);
    return plainToInstance(UserDto, user);
  }

  @PatchApi({
    path: 'profile/:id',
    summary: 'Atualiza perfil do usuário',
    description: 'Permite ao usuário atualizar seu próprio perfil',
    status: 'OK',
    authenticated: true,
    body: UpdateProfileDto,
  })
  @UseInterceptors(FileInterceptor('image'))
  async updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UserDto> {
    if (file) {
      dto.image = file.buffer;
    }
    return await this.userService.updateProfile(id, dto);
  }

  @PatchApi({
    path: 'password/:id',
    summary: 'Atualiza senha do usuário',
    description: 'Permite ao usuário alterar sua senha',
    status: 'OK',
    authenticated: true,
    body: UpdatePasswordDto,
  })
  async updatePassword(
    @Param('id') id: string,
    @Body() dto: UpdatePasswordDto,
  ) {
    await this.userService.updatePassword(
      id,
      dto.currentPassword,
      dto.newPassword,
      dto.confirmNewPassword,
    );
    return { message: this.i18n.t('user.profile.updated') };
  }

  @GetApi({
    path: ':id/image',
    summary: 'Busca imagem do usuário',
    description: 'Retorna a imagem de perfil do usuário',
    status: 'OK',
    authenticated: true,
  })
  async getUserImage(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<StreamableFile> {
    const imageBuffer = await this.userService.getUserImageById(id);

    if (!imageBuffer) {
      throw new NotFoundException(this.i18n.t('user.image_invalid'));
    }

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `inline; filename="user-${id}.jpg"`,
    });

    return new StreamableFile(imageBuffer);
  }
}
```

---

## Custom Decorators

### API Method Decorator
**File**: `backend-nest/src/common/decorators/api-method.decorator.ts` (excerpt)

```typescript
import {
  Get,
  Post,
  Put,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  applyDecorators,
  Type,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';
import { UserRole } from 'src/domain/auth/userRole.const';

interface ApiMethodConfig {
  path?: string;
  summary: string;
  description?: string;
  roles?: UserRole[];
  authenticated?: boolean;
  status?: keyof typeof HttpStatus;
  response?: ApiResponseConfig;
  queries?: ApiQueryOptions[];
  body?: Type<unknown> | string;
}

const applyMethod = (
  verb: 'Get' | 'Post' | 'Put' | 'Patch' | 'Delete',
  config: ApiMethodConfig,
) => {
  const decorators: Array<
    ClassDecorator | MethodDecorator | PropertyDecorator
  > = [];

  // HTTP Verb
  const methods = { Get, Post, Put, Patch, Delete };
  decorators.push(methods[verb](config.path || ''));

  // HTTP Status Code
  if (config.status) {
    decorators.push(HttpCode(HttpStatus[config.status]));
  }

  // Swagger Operation
  decorators.push(
    ApiOperation({
      summary: config.summary,
      description: config.description,
    }),
  );

  // Authentication & Authorization
  if (config.roles?.length) {
    decorators.push(
      UseGuards(JwtAuthGuard, RolesGuard),
      Roles(...config.roles),
      ApiBearerAuth(),
    );
  } else if (config.authenticated) {
    decorators.push(UseGuards(JwtAuthGuard), ApiBearerAuth());
  }

  // Response Schema
  if (config.response?.success) {
    config.response.success.forEach((item) => {
      decorators.push(
        ApiResponse({
          status: HttpStatus[item.status],
          description: item.description,
          // ... schema configuration
        }),
      );
    });
  }

  // Query Parameters
  if (config.queries) {
    config.queries.forEach((query) => {
      decorators.push(ApiQuery(query));
    });
  }

  // Request Body
  if (config.body) {
    decorators.push(ApiBody({ type: config.body }));
  }

  return applyDecorators(...decorators);
};

export const GetApi = (config: ApiMethodConfig) =>
  applyMethod('Get', config);
export const PostApi = (config: ApiMethodConfig) =>
  applyMethod('Post', config);
export const PatchApi = (config: ApiMethodConfig) =>
  applyMethod('Patch', config);
export const DeleteApi = (config: ApiMethodConfig) =>
  applyMethod('Delete', config);
```

---

## Error Handling

### Global Exception Filter
**File**: `backend-nest/src/common/filters/all-exceptions.filter.ts`

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { I18nService } from 'nestjs-i18n';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && 'message' in exceptionResponse) {
        message = exceptionResponse.message;
      } else {
        message = exceptionResponse as string;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status],
    });
  }
}
```

### Frontend Error Handling
**File**: `frontend-next/src/lib/api/collector.ts`

```typescript
import { toast } from 'sonner';
import type { ApiResponse } from './api';

/**
 * Collector wraps API calls for React Query queries
 * Handles errors and shows toast notifications
 */
export function Collector<T>(fn: () => Promise<ApiResponse<T>>) {
  return async (): Promise<T> => {
    const response = await fn();

    if (!response.success) {
      toast.error(response.message || 'An error occurred');
      throw new Error(response.message);
    }

    return response.data;
  };
}

/**
 * Alive wraps API calls for React Query mutations
 * Similar to Collector but for mutations
 */
export function Alive<T>(fn: () => Promise<ApiResponse<T>>) {
  return async (): Promise<T> => {
    const response = await fn();

    if (!response.success) {
      toast.error(response.message || 'An error occurred');
      throw new Error(response.message);
    }

    toast.success('Operation completed successfully');
    return response.data;
  };
}

/**
 * Emulate error for testing purposes
 */
export function EmulateMutationError(emulate: boolean, message: string) {
  if (emulate) {
    toast.error(message);
    throw new Error(message);
  }
}
```

---

## Pagination Implementation

### Backend Pagination Types
**File**: `backend-nest/src/common/types/pagination.types.ts`

```typescript
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filter?: Record<string, string[]>;
}

export interface PaginationParams {
  page: number;
  limit: number;
  pagination: boolean;
  search?: string;
  filter?: Record<string, string>;
}
```

### Backend Pagination Schema
**File**: `backend-nest/src/common/schemas/pagination.schema.ts`

```typescript
import { z } from 'zod';

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  pagination: z.coerce.boolean().default(true),
  search: z.string().optional(),
  filter: z.record(z.string()).optional(),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
```

### Frontend Pagination Types
**File**: `frontend-next/src/lib/types/pagination.types.ts`

```typescript
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filter?: Record<string, string[]>;
}

export interface PaginationParams {
  page: number;
  limit: number;
  pagination: boolean;
  search?: string;
  filter?: Record<string, string>;
}
```

---

## React Query Patterns

### Complete Query Hook Example
**File**: `frontend-next/src/lib/actions/user/queries.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUsers,
  getUser,
  updateUser,
  getRoles,
  getStatus,
} from './api';
import type { PaginationParams } from '@/lib/types/pagination.types';
import type { UpdateUserDto } from './types';
import { Collector, Alive, EmulateMutationError } from '@/lib/api/collector';
import { getQueryConfig } from '@/lib/config/performance.config';
import { useApp } from '@/contexts/app-context';

// Query: List users with pagination
export function useUsers(params?: PaginationParams) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: Collector(() => getUsers(params)),
    ...getQueryConfig('USERS'),
  });
}

// Query: Get single user
export function useUser(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: Collector(() => getUser(id)),
    ...getQueryConfig('USER', 'USER'),
  });
}

// Query: Get roles (static data)
export function useRoles() {
  return useQuery({
    queryKey: ['users', 'roles'],
    queryFn: Collector(getRoles),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

// Query: Get status (static data)
export function useUserStatus() {
  return useQuery({
    queryKey: ['users', 'status'],
    queryFn: Collector(getStatus),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

// Mutation: Update user
export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserDto }) => {
      EmulateMutationError(emulateError, 'Emulated error from useUpdateUser');
      return Alive(() => updateUser(id, data))();
    },
    onSuccess: (_, { id }) => {
      // Invalidate both list and detail queries
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user', id] });
    },
  });
}
```

---

## DataTable Advanced Usage

### DataTable with Filters and Actions
**File**: Example from project

```typescript
'use client';

import { DataTable } from '@/components/data-table';
import { type ColumnDef } from '@tanstack/react-table';
import type { User } from '@/lib/actions/user/types';
import { useUsers, useUpdateUser } from '@/lib/actions/user/queries';
import { useState } from 'react';
import type { PaginationState } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Shield } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserStatusColors } from '@/lib/actions/user/types';
import { useTranslation } from '@/hooks/use-translation';
import { useRouter } from 'next/navigation';

export function UsersTable() {
  const { t } = useTranslation();
  const router = useRouter();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [globalFilter, setGlobalFilter] = useState('');

  const { data, isLoading, error } = useUsers({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true,
    search: globalFilter,
    filter: filters,
  });

  const updateMutation = useUpdateUser();

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'email',
      header: t('users.email'),
    },
    {
      accessorKey: 'name',
      header: t('users.name'),
      cell: ({ row }) => row.original.name || '-',
    },
    {
      accessorKey: 'role',
      header: t('users.role'),
      cell: ({ row }) => (
        <Badge variant="outline">
          {t(`users.roles.${row.original.role}`)}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: t('users.status'),
      cell: ({ row }) => (
        <Badge className={UserStatusColors[row.original.status]}>
          {t(`users.statuses.${row.original.status}`)}
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
            <DropdownMenuItem onClick={() => router.push(`/users/${row.original.id}`)}>
              <Edit className="mr-2 h-4 w-4" />
              {t('common.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/users/${row.original.id}/routes`)}>
              <Shield className="mr-2 h-4 w-4" />
              {t('users.manage_routes')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      error={error}
      queryKey={['users']}
      isLoading={isLoading}
      pagination={pagination}
      onPaginationChange={setPagination}
      globalFilter={globalFilter}
      onGlobalFilterChange={setGlobalFilter}
      filters={filters}
      onFiltersChange={setFilters}
      enableGlobalFilter
      searchPlaceholder={t('users.search_placeholder')}
      entityName={t('users.entity')}
      entityNamePlural={t('users.entity_plural')}
    >
      {/* Optional: Add filter controls */}
      <DataTable.Select
        title={t('users.filter_by_role')}
        filterKey="role"
        options={[
          { value: 'ADMIN', label: t('users.roles.ADMIN') },
          { value: 'USER', label: t('users.roles.USER') },
          { value: 'MODERATOR', label: t('users.roles.MODERATOR') },
        ]}
      />
      <DataTable.Select
        title={t('users.filter_by_status')}
        filterKey="status"
        options={[
          { value: 'ACTIVE', label: t('users.statuses.ACTIVE') },
          { value: 'INACTIVE', label: t('users.statuses.INACTIVE') },
          { value: 'SUSPENDED', label: t('users.statuses.SUSPENDED') },
        ]}
      />
    </DataTable>
  );
}
```

---

## Form with File Upload

### Backend Controller with File Upload
```typescript
@PatchApi({
  path: 'profile/:id',
  summary: 'Update user profile',
  status: 'OK',
  authenticated: true,
  body: UpdateProfileDto,
})
@UseInterceptors(FileInterceptor('image'))
async updateProfile(
  @Param('id') id: string,
  @Body() dto: UpdateProfileDto,
  @UploadedFile() file?: Express.Multer.File,
): Promise<UserDto> {
  if (file) {
    dto.image = file.buffer;
  }
  return await this.userService.updateProfile(id, dto);
}
```

### Frontend Form with File Upload
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
import { Button } from '@/components/ui/button';
import { useUpdateProfile } from '@/lib/actions/user/queries';
import type { User } from '@/lib/actions/user/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState } from 'react';

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  image: z.instanceof(File).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  user: User;
  onSuccess?: () => void;
}

export function ProfileForm({ user, onSuccess }: ProfileFormProps) {
  const updateMutation = useUpdateProfile();
  const [preview, setPreview] = useState<string | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name || '',
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue('image', file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      await updateMutation.mutateAsync({
        id: user.id,
        data: {
          name: data.name,
          image: data.image,
        },
      });
      onSuccess?.();
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage
              src={preview || `/api/user/${user.id}/image`}
              alt={user.name || user.email}
            />
            <AvatarFallback>
              {user.name?.charAt(0) || user.email.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <Input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Enter your name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

---

## Server Component with Dynamic Routes

### Pattern: Server Component Calling API Directly (RECOMMENDED)

**File**: `src/app/(private)/user/[id]/page.tsx`

This is the **preferred pattern** for detail pages - Server Components that fetch data and pass to Client Components.

```typescript
import LangLabel from "@/components/ui/langLabel";
import { UserEditPage } from "../components/user-edit";
import UsersRolesPage from "../components/user-roles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUser } from "@/lib/actions/user/api";

export default async function UsersPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  // Next.js 15+ requires awaiting params
  const { id } = await params;

  // Call API directly in Server Component - no loading state needed!
  const data = (await getUser(id)).data;

  // Pass data to Client Components
  return (
    <Tabs defaultValue="user" className="">
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

### Why This Pattern is Better

**Advantages:**
- ✅ **Better Performance**: Less JavaScript sent to client
- ✅ **No Loading States**: Data fetched before render
- ✅ **SEO Friendly**: Content available immediately
- ✅ **Simpler Code**: No useEffect, useState for loading
- ✅ **Type Safety**: Direct type inference from API
- ✅ **Error Handling**: Can use Next.js error boundaries
- ✅ **Streaming**: Can use React Suspense

**Folder Structure for Dynamic Routes:**
```
src/app/(private)/user/
├── page.tsx              # List page (/user)
├── [id]/
│   └── page.tsx         # Detail page (/user/123)
├── [id]/edit/
│   └── page.tsx         # Edit page (/user/123/edit)
└── components/
    ├── user-table.tsx   # Client component
    ├── user-edit.tsx    # Client component
    └── user-columns.tsx
```

### Client Components Receive Props

**File**: `src/app/(private)/user/components/user-edit.tsx`

```typescript
'use client';

import { User } from '@/lib/actions/user/types';
import { useUpdateUser } from '@/lib/actions/user/queries';
import { UserForm } from './user-form';

interface UserEditPageProps {
  user: User; // Received from Server Component
}

export function UserEditPage({ user }: UserEditPageProps) {
  const updateMutation = useUpdateUser();

  const handleSubmit = async (data: UpdateUserDto) => {
    await updateMutation.mutateAsync({ id: user.id, data });
  };

  return (
    <div>
      <h2>Edit User: {user.name}</h2>
      <UserForm user={user} onSubmit={handleSubmit} />
    </div>
  );
}
```

### When to Use Each Pattern

**Use Server Components (async) when:**
- Detail pages with URL parameters
- Initial data load only
- SEO is important
- Want best performance

**Use Client Components ('use client') when:**
- Need real-time updates
- Need interactive state (pagination, filters, sorting)
- List pages with DataTable
- Need React hooks (useState, useEffect, useRef)
- Forms with complex validation

### API Function Pattern

**File**: `src/lib/actions/user/api.ts`

```typescript
"use server";
import { GET, PATCH, DELETE, POST, ApiResponse } from '../../api/api';
import type { User, UpdateUserDto } from './types';

// These functions work in BOTH Server and Client Components!
export async function getUser(id: string): Promise<ApiResponse<User>> {
  return await GET<User>(`/user/${id}`);
}

export async function updateUser(
  id: string, 
  data: UpdateUserDto
): Promise<ApiResponse<User>> {
  return await PATCH<User>(`/user/${id}`, data);
}
```

### Error Handling in Server Components

```typescript
import { notFound } from 'next/navigation';

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const response = await getUser(id);
  
  // Handle not found
  if (!response.success || !response.data) {
    notFound(); // Shows 404 page
  }
  
  const user = response.data;
  
  return <UserEditPage user={user} />;
}
```

### Multiple Data Sources in Server Component

```typescript
export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Fetch multiple data sources in parallel
  const [userResponse, routesResponse] = await Promise.all([
    getUser(id),
    getUserRoutes(id),
  ]);
  
  const user = userResponse.data;
  const routes = routesResponse.data;
  
  return (
    <div>
      <UserEditPage user={user} />
      <UserRoutesPage routes={routes} />
    </div>
  );
}
```

---

## Summary

This document provides complete, real-world examples from the existing codebase. These patterns should be followed for all new modules to maintain consistency and quality.

### Key Takeaways
1. **Follow established patterns**: Use these examples as templates
2. **Type safety**: Always use TypeScript properly
3. **Error handling**: Use Collector/Alive wrappers
4. **Pagination**: Implement consistently on both sides
5. **File uploads**: Handle binary data correctly
6. **React Query**: Proper cache invalidation
7. **Custom decorators**: Simplify controller code
8. **i18n**: Translate all user-facing strings
9. **Server Components**: Prefer for detail pages with URL parameters
10. **DataTable**: Use compound components (Input, Select, Actions)

### Architecture Patterns

**For List Pages (with filters/pagination):**
- ✅ Use Client Components (`'use client'`)
- ✅ Use React Query hooks (useUsers, useProducts)
- ✅ Use DataTable with state management
- ✅ Example: `/user` page

**For Detail Pages (with URL parameters):**
- ✅ Use Server Components (async, no `'use client'`)
- ✅ Call API directly (getUser, getProduct)
- ✅ Pass data as props to Client Components
- ✅ Example: `/user/[id]` page

**Data Flow:**
```
Server Component (page.tsx)
  ↓ await getUser(id)
  ↓ Pass as props
Client Component (user-edit.tsx)
  ↓ Uses React Query for mutations
  ↓ Updates data
Backend API
```

### Next Steps
- Use these examples when creating new modules
- Prefer Server Components for detail pages
- Use Client Components for interactive lists
- Follow DataTable compound component pattern
- Maintain consistency with existing code
