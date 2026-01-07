import { Controller, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoleRouteAccessService } from './role-route-access.service';
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

@ApiTags('role-route-access')
@Controller('role-route-access')
export class RoleRouteAccessController {
  constructor(
    private readonly roleRouteAccessService: RoleRouteAccessService,
  ) {}

  @PostApi({
    summary: 'role_route_access.create.title',
    description: 'role_route_access.create.description',
    body: CreateRoleRouteAccessDto,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async create(
    @Body() dto: CreateRoleRouteAccessDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return await this.roleRouteAccessService.create(dto, currentUser.id);
  }

  @GetApi({
    summary: 'role_route_access.list.title',
    status: 'OK',
    authenticated: true,
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
    return await this.roleRouteAccessService.findAll(query);
  }

  @GetApi({
    path: 'user-roles',
    summary: 'Lista de roles existentes',
    status: 'OK',
    authenticated: true,
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
  findAllUserRole(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): PaginatedResponse<UserRoleDto> | UserRoleDto[] {
    return this.roleRouteAccessService.findAllUserRole(query);
  }

  @GetApi({
    path: 'role/:roleId',
    summary: 'Gerenciamento de rotas do role',
    description:
      'Retorna todas as rotas do sistema marcando quais o role tem acesso',
    status: 'OK',
    authenticated: true,
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
    return await this.roleRouteAccessService.findByRole(roleId, query);
  }

  @GetApi({
    path: ':roleId/:routeId',
    summary: 'role_route_access.find.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async findOne(
    @Param('roleId') roleId: string,
    @Param('routeId') routeId: string,
  ) {
    return await this.roleRouteAccessService.findOne(roleId, routeId);
  }

  @DeleteApi({
    path: ':roleId/:routeId',
    summary: 'role_route_access.delete.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async remove(
    @Param('roleId') roleId: string,
    @Param('routeId') routeId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return await this.roleRouteAccessService.remove(
      currentUser.id,
      roleId,
      routeId,
    );
  }

  @DeleteApi({
    path: 'role/:roleId',
    summary: 'role_route_access.delete_by_role.title',
    description: 'role_route_access.delete_by_role.description',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async removeByRole(
    @Param('roleId') roleId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return await this.roleRouteAccessService.removeByRole(
      roleId,
      currentUser.id,
    );
  }
}
