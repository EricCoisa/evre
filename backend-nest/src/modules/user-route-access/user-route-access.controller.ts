import { Controller, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRouteAccessService } from './user-route-access.service';
import { GrantUserRouteAccessDto } from './dto/grant-user-route-access.dto';
import { UserRouteAccessDto } from './dto/user-route-access.dto';
import {
  GetApi,
  PostApi,
  DeleteApi,
} from '../../common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  PaginationQuerySchema,
  type PaginationQuery,
} from '../../common/schemas/pagination.schema';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import type { PaginatedResponse } from '../../common/types/pagination.types';

@ApiTags('user-route-access')
@Controller('user-route-access')
export class UserRouteAccessController {
  constructor(
    private readonly userRouteAccessService: UserRouteAccessService,
  ) {}

  @PostApi({
    path: 'grant',
    summary: 'user_route_access.grant.title',
    description: 'user_route_access.grant.description',
    body: GrantUserRouteAccessDto,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async grant(
    @Body() dto: GrantUserRouteAccessDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return await this.userRouteAccessService.grant(dto, currentUser.id);
  }

  @GetApi({
    summary: 'user_route_access.list.title',
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
            dto: UserRouteAccessDto,
            isArray: true,
            isPagination: true,
          },
        },
      ],
    },
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<UserRouteAccessDto> | UserRouteAccessDto[]> {
    return await this.userRouteAccessService.findAll(query);
  }

  @GetApi({
    path: 'user/:userId',
    summary: 'user_route_access.find_by_user.title',
    description: 'user_route_access.find_by_user.description',
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
            dto: UserRouteAccessDto,
            isArray: true,
            isPagination: true,
          },
        },
      ],
    },
  })
  async findByUserId(
    @Param('userId') userId: string,
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<UserRouteAccessDto> | UserRouteAccessDto[]> {
    return await this.userRouteAccessService.findAllByOne(userId, query);
  }

  @DeleteApi({
    path: 'revoke/:userId/:routeId',
    summary: 'user_route_access.revoke.title',
    description: 'user_route_access.revoke.description',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async revoke(
    @Param('userId') userId: string,
    @Param('routeId') routeId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return await this.userRouteAccessService.revoke(
      userId,
      routeId,
      currentUser.id,
    );
  }

  @DeleteApi({
    path: 'revoke-all/:userId',
    summary: 'user_route_access.revoke_all.title',
    description: 'user_route_access.revoke_all.description',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async revokeAll(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return await this.userRouteAccessService.revokeAll(userId, currentUser.id);
  }
}
