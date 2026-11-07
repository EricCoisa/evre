import { Controller, Body, Param, Query, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
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
import { PaginationQuerySchema } from '../../common/schemas/pagination.schema';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import type { PaginatedResponse } from '../../common/types/pagination.types';
import { FindAllUserRouteAccessUseCase } from './use-cases/find-all.use-case';
import { FindAllByOneUseCase } from './use-cases/find-all-by-one.use-case';
import { GrantAccessUseCase } from './use-cases/grant-access.use-case';
import { RevokeAccessUseCase } from './use-cases/revoke-access.use-case';
import { RevokeAllAccessUseCase } from './use-cases/revoke-all-access.use-case';
import { CheckAccessUseCase } from './use-cases/check-access.use-case';

import { RouteAccess } from 'src/common/decorators/route-access.decorator';
import { RoutePathConst } from 'src/domain/route/route-path.const';

const CheckAccessQuerySchema = z.object({ path: z.string().min(1) });
const RevokeAllQuerySchema = z.object({ userId: z.string().min(1) });
const ListQuerySchema = PaginationQuerySchema.extend({
  userId: z.string().min(1).optional(),
});
type ListQuery = z.infer<typeof ListQuerySchema>;

@ApiTags('user-route-access')
@Controller('user-route-access')
@RouteAccess(RoutePathConst.ACCESS)
export class UserRouteAccessController {
  private readonly logger = new Logger(UserRouteAccessController.name);

  constructor(
    private readonly findAllUseCase: FindAllUserRouteAccessUseCase,
    private readonly findAllByOneUseCase: FindAllByOneUseCase,
    private readonly grantAccessUseCase: GrantAccessUseCase,
    private readonly revokeAccessUseCase: RevokeAccessUseCase,
    private readonly revokeAllAccessUseCase: RevokeAllAccessUseCase,
    private readonly checkAccessUseCase: CheckAccessUseCase,
  ) {}

  @PostApi({
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
    return await this.grantAccessUseCase.execute(dto, currentUser.id);
  }

  @GetApi({
    summary: 'user_route_access.list.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    queries: [
      ...commonPaginationQueries,
      {
        name: 'userId',
        required: false,
        type: String,
        description: 'Filtra os vinculos de um usuario',
      },
    ],
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
    @Query(new ZodValidationPipe(ListQuerySchema)) query: ListQuery,
  ): Promise<PaginatedResponse<UserRouteAccessDto> | UserRouteAccessDto[]> {
    const { userId, ...pagination } = query;
    return userId
      ? await this.findAllByOneUseCase.execute(userId, pagination)
      : await this.findAllUseCase.execute(pagination);
  }

  @GetApi({
    path: 'me',
    summary: 'Verifica o acesso do usuário à rota',
    description:
      'Valida se o usuário autenticado tem permissão para acessar uma rota específica. Considera tanto permissões individuais quanto permissões da role.',
    status: 'OK',
    authenticated: true,
    queries: [
      {
        name: 'path',
        required: true,
        type: String,
        description: 'Caminho da tela, ex.: /dashboard',
      },
    ],
    response: {
      success: [
        {
          status: 'OK',
          description:
            'Retorna true se o usuário tem acesso, false caso contrário',
          type: Boolean,
        },
      ],
    },
  })
  async checkAccess(
    @Query(new ZodValidationPipe(CheckAccessQuerySchema))
    query: { path: string },
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<boolean> {
    const path = query.path.startsWith('/') ? query.path : `/${query.path}`;
    return await this.checkAccessUseCase.execute(
      currentUser.id,
      path,
      currentUser.roleId,
    );
  }

  @DeleteApi({
    path: ':userId/:routeId',
    summary: 'user_route_access.revoke.title',
    description: 'user_route_access.revoke.description',
    status: 'NO_CONTENT',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async revoke(
    @Param('userId') userId: string,
    @Param('routeId') routeId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return await this.revokeAccessUseCase.execute(
      userId,
      routeId,
      currentUser.id,
    );
  }

  @DeleteApi({
    summary: 'user_route_access.revoke_all.title',
    description: 'user_route_access.revoke_all.description',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    queries: [
      {
        name: 'userId',
        required: true,
        type: String,
        description: 'Usuario cujos vinculos serao removidos',
      },
    ],
  })
  async revokeAll(
    @Query(new ZodValidationPipe(RevokeAllQuerySchema))
    query: { userId: string },
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return await this.revokeAllAccessUseCase.execute(
      query.userId,
      currentUser.id,
    );
  }
}
