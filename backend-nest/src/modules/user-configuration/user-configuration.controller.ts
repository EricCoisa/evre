import { Controller, Query, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserConfigurationService } from './user-configuration.service';
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
import { CreateUserConfigurationDefinitionDto } from './dto/create-user-configuration-definition.dto';
import { UpdateUserConfigurationDefinitionDto } from './dto/update-user-configuration-definition.dto';
import { SetUserConfigurationDto } from './dto/set-user-configuration.dto';
import type { PaginatedResponse } from '../../common/types/pagination.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import { UserConfigurationDefinition } from '@prisma/client';
import { UserConfigurationDto } from './dto/user-configuration.dto';

@ApiTags('user-configuration')
@Controller('user-configuration')
export class UserConfigurationController {
  constructor(private readonly service: UserConfigurationService) {}

  // ===== DEFINITIONS (Admin only) =====
  @PostApi({
    path: 'definitions',
    summary: 'Cria definição de configuração de usuário',
    description: `Cria uma nova definição de configuração disponível para usuários`,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Definição criada com sucesso',
          schema: { dto: CreateUserConfigurationDefinitionDto },
        },
      ],
    },
  })
  async createDefinition(
    @Body() dto: CreateUserConfigurationDefinitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.service.createDefinition(dto, user.id);
  }

  @GetApi({
    path: 'definitions',
    summary: 'Lista definições de configurações de usuário',
    description: 'Retorna uma lista de definições de configurações disponíveis',
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
            dto: UserConfigurationDto,
            isArray: true,
            isPagination: true,
          },
        },
      ],
    },
  })
  async findAllDefinitions(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<
    | PaginatedResponse<UserConfigurationDefinition>
    | UserConfigurationDefinition[]
  > {
    return await this.service.findAllDefinitions(query);
  }

  @GetApi({
    path: 'definitions/:id',
    summary: 'Busca definição por ID',
    description: 'Retorna uma definição de configuração pelo ID',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Definição encontrada',
          schema: { dto: CreateUserConfigurationDefinitionDto },
        },
      ],
    },
  })
  async findOneDefinition(@Param('id') id: string) {
    return await this.service.findOneDefinition(id);
  }

  @PatchApi({
    path: 'definitions/:id',
    summary: 'Atualiza definição de configuração',
    description: 'Atualiza uma definição de configuração existente',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Definição atualizada com sucesso',
          schema: { dto: CreateUserConfigurationDefinitionDto },
        },
      ],
    },
  })
  async updateDefinition(
    @Param('id') id: string,
    @Body() dto: UpdateUserConfigurationDefinitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.service.updateDefinition(id, dto, user.id);
  }

  @DeleteApi({
    path: 'definitions/:id',
    summary: 'Remove definição de configuração',
    description: 'Remove uma definição de configuração',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Definição removida com sucesso',
        },
      ],
    },
  })
  async removeDefinition(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.service.removeDefinition(id, user.id);
  }

  // ===== USER CONFIGURATIONS =====
  @GetApi({
    path: 'me',
    summary: 'Obtém configurações do usuário logado',
    description: `Retorna todas as configurações disponíveis com os valores do usuário ou valores padrão`,
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Configuração encontrada',
          schema: {
            dto: UserConfigurationDto,
            isArray: true,
            isPagination: false,
          },
        },
      ],
    },
  })
  async getUserConfigurations(@CurrentUser() user: AuthenticatedUser) {
    return await this.service.getUserConfigurations(user.id);
  }

  @GetApi({
    path: 'key/:labelKey',
    summary: 'Obtém configurações do usuário logado',
    description: `Retorna todas as configurações disponíveis com os valores do usuário ou valores padrão`,
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Configuração encontrada',
          schema: { dto: UserConfigurationDto },
        },
      ],
    },
  })
  async getUserConfigurationsKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('labelKey') labelKey: string,
  ) {
    const x = await this.service.getUserConfigurationsKey(user.id, labelKey);
    return x;
  }

  @PostApi({
    path: 'me',
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
    @Body() dto: SetUserConfigurationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.service.setUserConfiguration(user.id, dto);
  }

  @DeleteApi({
    path: 'me/:definitionId',
    summary: 'Reseta configuração específica',
    description: 'Remove a customização e volta para o valor padrão',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Configuração resetada com sucesso',
        },
      ],
    },
  })
  async resetUserConfiguration(
    @Param('definitionId') definitionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.service.resetUserConfiguration(user.id, definitionId);
  }

  @DeleteApi({
    path: 'me',
    summary: 'Reseta todas as configurações',
    description: 'Remove todas as customizações do usuário',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Todas as configurações resetadas com sucesso',
        },
      ],
    },
  })
  async resetAllUserConfigurations(@CurrentUser() user: AuthenticatedUser) {
    return await this.service.resetAllUserConfigurations(user.id);
  }
}
