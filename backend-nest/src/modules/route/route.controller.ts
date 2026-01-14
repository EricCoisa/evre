import { Controller, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RouteService } from './route.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RouteDto } from './dto/route.dto';
import {
  GetApi,
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

@ApiTags('route')
@Controller('route')
export class RouteController {
  constructor(private readonly routeService: RouteService) {}

  @GetApi({
    path: 'test-log/:msg',
    summary: 'Rota home do usuário',
    description: 'Retorna a rota home do usuário autenticado',
  })
  testLog(@Param('msg') msg: string) {
    console.warn('TEST LOG', msg);
    return { success: true, msg };
  }

  @PostApi({
    summary: 'route.create.title',
    description: 'route.create.description',
    body: CreateRouteDto,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async create(
    @Body() dto: CreateRouteDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return await this.routeService.create(dto, currentUser.id);
  }

  @GetApi({
    summary: 'route.list.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
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
    return await this.routeService.findAll(query);
  }

  @GetApi({
    path: 'home-route',
    summary: 'Rota home do usuário',
    description: 'Retorna a rota home do usuário autenticado',
    authenticated: true,
  })
  async getHomeRoute(@CurrentUser() user: AuthenticatedUser) {
    return await this.routeService.findHome(user);
  }

  @GetApi({
    path: ':id',
    summary: 'route.find.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async findOne(@Param('id') id: string) {
    return await this.routeService.findOne(id);
  }

  @PatchApi({
    path: ':id',
    summary: 'route.update.title',
    body: UpdateRouteDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRouteDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return await this.routeService.update(id, dto, currentUser.id);
  }

  @DeleteApi({
    path: ':id',
    summary: 'route.delete.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return await this.routeService.remove(id, currentUser.id);
  }
}
