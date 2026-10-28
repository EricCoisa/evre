import { Controller, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RouteDto } from './dto/route.dto';
import { SaveRoleHomeDto } from './dto/role-home.dto';
import { RoleHomeService } from './role-home.service';
import {
  GetApi,
  PutApi,
  PostApi,
  PatchApi,
  DeleteApi,
} from '../../common/decorators/api-method.decorator';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  PaginationQuerySchema,
  type PaginationQuery,
} from '../../common/schemas/pagination.schema';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import type { PaginatedResponse } from '../../common/types/pagination.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import { FindAllRoutesUseCase } from './use-cases/find-all.use-case';
import { FindOneRouteUseCase } from './use-cases/find-one.use-case';
import { FindHomeRouteUseCase } from './use-cases/find-home.use-case';
import { FindByPathUseCase } from './use-cases/find-by-path.use-case';
import { CreateRouteUseCase } from './use-cases/create.use-case';
import { UpdateRouteUseCase } from './use-cases/update.use-case';
import { RemoveRouteUseCase } from './use-cases/remove.use-case';

@ApiTags('route')
@Controller('route')
export class RouteController {
  constructor(
    private readonly findAllRoutes: FindAllRoutesUseCase,
    private readonly findOneRoute: FindOneRouteUseCase,
    private readonly findHomeRoute: FindHomeRouteUseCase,
    private readonly roleHome: RoleHomeService,
    private readonly findByPath: FindByPathUseCase,
    private readonly createRoute: CreateRouteUseCase,
    private readonly updateRoute: UpdateRouteUseCase,
    private readonly removeRoute: RemoveRouteUseCase,
  ) {}

  @PostApi({
    summary: 'route.create.title',
    description: 'route.create.description',
    body: CreateRouteDto,
    status: 'CREATED',
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Rota criada',
          schema: { dto: RouteDto },
        },
      ],
    },
  })
  async create(
    @Body() dto: CreateRouteDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return await this.createRoute.execute(dto, currentUser.id);
  }

  @GetApi({
    summary: 'route.list.title',
    status: 'OK',
    roles: ['ADMIN'],
    scope: 'routes:read',
    queries: commonPaginationQueries,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Resposta paginada',
          schema: { dto: RouteDto, isArray: true, isPagination: true },
        },
      ],
    },
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<RouteDto> | RouteDto[]> {
    return await this.findAllRoutes.execute(query);
  }

  @GetApi({
    path: 'home-route',
    summary: 'Rota home do usuário',
    description: 'Retorna a rota home do usuário autenticado',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Rota',
          schema: { dto: RouteDto },
        },
      ],
    },
  })
  async getHomeRoute(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.findHomeRoute.execute(user);
    return result;
  }

  @GetApi({
    path: 'role-home',
    summary: 'Home configurada de cada role',
    roles: ['ADMIN'],
    status: 'OK',
  })
  async getRoleHomes(): Promise<Record<string, string>> {
    return this.roleHome.map();
  }

  @PutApi({
    path: 'role-home',
    summary: 'Define a home de cada role',
    roles: ['ADMIN'],
    status: 'OK',
  })
  async saveRoleHomes(
    @Body() dto: SaveRoleHomeDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<Record<string, string>> {
    return this.roleHome.save(dto.homes, currentUser.id);
  }

  @GetApi({
    path: 'path/:path',
    summary: 'Rota pelo caminho',
    description: 'Retorna a rota pelo caminho especificado',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Rota',
          schema: { dto: RouteDto },
        },
      ],
    },
  })
  async getRouteByPath(@Param('path') path: string) {
    const result = await this.findByPath.execute(path);
    return result;
  }

  @GetApi({
    path: ':id',
    summary: 'route.find.title',
    status: 'OK',
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Rota',
          schema: { dto: RouteDto },
        },
      ],
    },
  })
  async findOne(@Param('id') id: string) {
    return await this.findOneRoute.execute(id);
  }

  @PatchApi({
    path: ':id',
    summary: 'route.update.title',
    body: UpdateRouteDto,
    status: 'OK',
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Rota atualizada',
          schema: { dto: RouteDto },
        },
      ],
    },
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRouteDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return await this.updateRoute.execute(id, dto, currentUser.id);
  }

  @DeleteApi({
    path: ':id',
    summary: 'route.delete.title',
    status: 'NO_CONTENT',
    roles: ['ADMIN'],
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return await this.removeRoute.execute(id, currentUser.id);
  }
}
