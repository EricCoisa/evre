import { Controller, Query, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserConfigurationDefinitionService } from './user-configuration-definition.service';
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
import { UserConfigurationDefinitionsDto } from './dto/user-configuration-definitions.dto';
import { CreateSystemConfigurationDto } from './dto/create-system-configuration.dto';

import type { PaginatedResponse } from '../../common/types/pagination.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';

import { SetSystemConfigurationDto } from './dto/set-user-configuration-definition.dto';
import { UpdateUserConfigurationDefinitionsDto } from './dto/update-user-configuration-definition.dto';

@ApiTags('user-configuration-definitions')
@Controller('user-configuration-definitions')
export class UserConfigurationDefinitionController {
  constructor(
    private readonly userConfigurationDefinitionsService: UserConfigurationDefinitionService,
  ) {}

  @GetApi({
    summary: 'Lista configurações do sistema',
    description: 'Retorna uma lista paginada de configurações do sistema',
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
            dto: UserConfigurationDefinitionsDto,
            isArray: true,
            isPagination: true,
          },
        },
      ],
    },
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<
    | PaginatedResponse<UserConfigurationDefinitionsDto>
    | UserConfigurationDefinitionsDto[]
  > {
    return await this.userConfigurationDefinitionsService.findAll(query);
  }

  @GetApi({
    path: ':id',
    summary: 'Busca configuração por ID',
    description: 'Retorna uma configuração do sistema pelo ID',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Configuração encontrada',
          schema: { dto: UserConfigurationDefinitionsDto },
        },
      ],
    },
  })
  async findById(
    @Param('id') id: string,
  ): Promise<UserConfigurationDefinitionsDto> {
    return await this.userConfigurationDefinitionsService.findOne(id);
  }

  @GetApi({
    path: 'key/:labelKey',
    summary: 'Busca configuração por chave',
    description: 'Retorna uma configuração do sistema pela chave (labelKey)',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Configuração encontrada',
          schema: { dto: UserConfigurationDefinitionsDto },
        },
      ],
    },
  })
  async findByLabelKey(
    @Param('labelKey') labelKey: string,
  ): Promise<UserConfigurationDefinitionsDto> {
    return await this.userConfigurationDefinitionsService.findByLabelKey(
      labelKey,
    );
  }

  @PostApi({
    summary: 'Cria configuração do sistema',
    description: 'Cria uma nova configuração do sistema',
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Configuração criada com sucesso',
          schema: { dto: UserConfigurationDefinitionsDto },
        },
      ],
    },
  })
  async create(
    @Body() createDto: CreateSystemConfigurationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserConfigurationDefinitionsDto> {
    return await this.userConfigurationDefinitionsService.create(
      createDto,
      currentUser.id,
    );
  }

  @PatchApi({
    path: 'set/:definitionId',
    summary: 'Define configuração do usuário',
    description: 'Define ou atualiza uma configuração para o usuário logado',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Configuração definida com sucesso',
        },
      ],
    },
  })
  async setUserConfiguration(
    @Param('definitionId') definitionId: string,
    @Body() dto: SetSystemConfigurationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.userConfigurationDefinitionsService.setUserConfiguration(
      definitionId,
      dto,
      user.id,
    );
  }

  @PatchApi({
    path: ':id',
    summary: 'Atualiza configuração do sistema',
    description: 'Atualiza uma configuração existente do sistema',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Configuração atualizada com sucesso',
          schema: { dto: UserConfigurationDefinitionsDto },
        },
      ],
    },
  })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateUserConfigurationDefinitionsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserConfigurationDefinitionsDto> {
    return await this.userConfigurationDefinitionsService.update(
      id,
      updateDto,
      currentUser.id,
    );
  }

  @DeleteApi({
    path: ':id',
    summary: 'Remove configuração do sistema',
    description: 'Remove uma configuração do sistema',
    status: 'NO_CONTENT',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async delete(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.userConfigurationDefinitionsService.remove(id, currentUser.id);
  }
}
