import { Controller, Query, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SystemConfigurationService } from './system-configuration.service';
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
import { SystemConfigurationDto } from './dto/system-configuration.dto';
import { CreateSystemConfigurationDto } from './dto/create-system-configuration.dto';
import { UpdateSystemConfigurationDto } from './dto/update-system-configuration.dto';
import type { PaginatedResponse } from '../../common/types/pagination.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';

@ApiTags('system-configuration')
@Controller('system-configuration')
export class SystemConfigurationController {
  constructor(
    private readonly systemConfigurationService: SystemConfigurationService,
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
            dto: SystemConfigurationDto,
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
    PaginatedResponse<SystemConfigurationDto> | SystemConfigurationDto[]
  > {
    return await this.systemConfigurationService.findAll(query);
  }

  @GetApi({
    path: 'signup',
    summary: 'Busca configuração de signup',
    description: 'Retorna a configuração do sistema para signup',
    status: 'OK',
    authenticated: false,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Configuração encontrada',
          schema: { dto: SystemConfigurationDto },
        },
      ],
    },
  })
  async findSignupConfiguration() {
    return await this.systemConfigurationService.findByLabelKey(
      'SYSTEM_USER_CREATE',
    );
  }

  @GetApi({
    path: 'default-theme',
    summary: 'Busca configuração de tema padrão',
    description: 'Retorna a configuração do sistema para tema padrão',
    status: 'OK',
    authenticated: false,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Configuração encontrada',
          schema: { dto: SystemConfigurationDto },
        },
      ],
    },
  })
  async findDefaultThemeConfiguration() {
    return await this.systemConfigurationService.findByLabelKey(
      'SYSTEMCONFIG_THEME',
    );
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
          schema: { dto: SystemConfigurationDto },
        },
      ],
    },
  })
  async findById(@Param('id') id: string): Promise<SystemConfigurationDto> {
    return await this.systemConfigurationService.findOne(id);
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
          schema: { dto: SystemConfigurationDto },
        },
      ],
    },
  })
  async findByLabelKey(@Param('labelKey') labelKey: string) {
    return await this.systemConfigurationService.findByLabelKey(labelKey);
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
          schema: { dto: SystemConfigurationDto },
        },
      ],
    },
  })
  async create(
    @Body() createDto: CreateSystemConfigurationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<SystemConfigurationDto> {
    return await this.systemConfigurationService.create(
      createDto,
      currentUser.id,
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
          schema: { dto: SystemConfigurationDto },
        },
      ],
    },
  })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSystemConfigurationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<SystemConfigurationDto> {
    return await this.systemConfigurationService.update(
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
    await this.systemConfigurationService.remove(id, currentUser.id);
  }
}
