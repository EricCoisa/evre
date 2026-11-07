import { Controller, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CreateRoleRouteAccessDto } from './dto/create-role-route-access.dto';
import { RoleRouteAccessDto } from './dto/role-route-access.dto';
import {
  GetApi,
  PostApi,
  DeleteApi,
} from '../../common/decorators/api-method.decorator';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  PaginationQuerySchema,
  type PaginationQuery,
} from '../../common/schemas/pagination.schema';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import type { PaginatedResponse } from '../../common/types/pagination.types';
import { UserRoleDto } from './dto/user-role.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import { FindAllRoleRouteAccessUseCase } from './use-cases/find-all.use-case';
import { FindOneRoleRouteAccessUseCase } from './use-cases/find-one.use-case';
import { CreateRoleRouteAccessUseCase } from './use-cases/create.use-case';
import { RemoveRoleRouteAccessUseCase } from './use-cases/remove.use-case';
import { FindAllUserRoleUseCase } from './use-cases/find-all-user-role.use-case';
import { FindByRoleUseCase } from './use-cases/find-by-role.use-case';
import { RemoveByRoleUseCase } from './use-cases/remove-by-role.use-case';

import { RouteAccess } from 'src/common/decorators/route-access.decorator';
import { RoutePathConst } from 'src/domain/route/route-path.const';

const RemoveByRoleQuerySchema = z.object({ roleId: z.string().min(1) });
type RemoveByRoleQuery = z.infer<typeof RemoveByRoleQuerySchema>;

@ApiTags('role-route-access')
@Controller('role-route-access')
@RouteAccess(RoutePathConst.ACCESS)
export class RoleRouteAccessController {
  constructor(
    private readonly findAllUseCase: FindAllRoleRouteAccessUseCase,
    private readonly findOneUseCase: FindOneRoleRouteAccessUseCase,
    private readonly createUseCase: CreateRoleRouteAccessUseCase,
    private readonly removeUseCase: RemoveRoleRouteAccessUseCase,
    private readonly findAllUserRoleUseCase: FindAllUserRoleUseCase,
    private readonly findByRoleUseCase: FindByRoleUseCase,
    private readonly removeByRoleUseCase: RemoveByRoleUseCase,
  ) {}

  @PostApi({
    summary: 'role_route_access.create.title',
    description: 'role_route_access.create.description',
    body: CreateRoleRouteAccessDto,
    status: 'CREATED',
    roles: ['ADMIN'],
  })
  async create(
    @Body() dto: CreateRoleRouteAccessDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return await this.createUseCase.execute(dto, currentUser.id);
  }

  @GetApi({
    summary: 'role_route_access.list.title',
    status: 'OK',
    roles: ['ADMIN'],
    queries: commonPaginationQueries,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Resposta paginada',
          schema: {
            dto: RoleRouteAccessDto,
            isArray: true,
            isPagination: true,
          },
        },
      ],
    },
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<RoleRouteAccessDto> | RoleRouteAccessDto[]> {
    return await this.findAllUseCase.execute(query);
  }

  @GetApi({
    path: 'user-roles',
    summary: 'Lista de roles existentes',
    status: 'OK',
    roles: ['ADMIN'],
    queries: commonPaginationQueries,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Resposta paginada',
          schema: {
            dto: RoleRouteAccessDto,
            isArray: true,
            isPagination: true,
          },
        },
      ],
    },
  })
  async findAllUserRole(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<UserRoleDto> | UserRoleDto[]> {
    return this.findAllUserRoleUseCase.execute(query);
  }

  @GetApi({
    path: 'role/:roleId',
    summary: 'Gerenciamento de rotas do role',
    description:
      'Retorna todas as rotas do sistema marcando quais o role tem acesso',
    status: 'OK',
    roles: ['ADMIN'],
    queries: commonPaginationQueries,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Resposta paginada',
          schema: {
            dto: RoleRouteAccessDto,
            isArray: true,
            isPagination: true,
          },
        },
      ],
    },
  })
  async findByRole(
    @Param('roleId') roleId: string,
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<RoleRouteAccessDto> | RoleRouteAccessDto[]> {
    return await this.findByRoleUseCase.execute(roleId, query);
  }

  @GetApi({
    path: ':roleId/:routeId',
    summary: 'role_route_access.find.title',
    status: 'OK',
    roles: ['ADMIN'],
  })
  async findOne(
    @Param('roleId') roleId: string,
    @Param('routeId') routeId: string,
  ) {
    return await this.findOneUseCase.execute(roleId, routeId);
  }

  @DeleteApi({
    path: ':roleId/:routeId',
    summary: 'role_route_access.delete.title',
    status: 'NO_CONTENT',
    roles: ['ADMIN'],
  })
  async remove(
    @Param('roleId') roleId: string,
    @Param('routeId') routeId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return await this.removeUseCase.execute(currentUser.id, roleId, routeId);
  }

  @DeleteApi({
    summary: 'role_route_access.delete_by_role.title',
    description: 'role_route_access.delete_by_role.description',
    status: 'OK',
    roles: ['ADMIN'],
    queries: [
      {
        name: 'roleId',
        required: true,
        type: String,
        description: 'Role cujos acessos serão revogados',
      },
    ],
  })
  async removeByRole(
    @Query(new ZodValidationPipe(RemoveByRoleQuerySchema))
    query: RemoveByRoleQuery,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return await this.removeByRoleUseCase.execute(query.roleId, currentUser.id);
  }
}
