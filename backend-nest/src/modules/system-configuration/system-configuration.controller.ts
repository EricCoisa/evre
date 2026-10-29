import { Controller, Query, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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
import { FindAllSystemConfigurationUseCase } from './use-cases/find-all.use-case';
import { FindOneSystemConfigurationUseCase } from './use-cases/find-one.use-case';
import { FindSystemConfigByLabelKeyUseCase } from './use-cases/find-by-label-key.use-case';
import { CreateSystemConfigurationUseCase } from './use-cases/create.use-case';
import { UpdateSystemConfigurationUseCase } from './use-cases/update.use-case';
import { RemoveSystemConfigurationUseCase } from './use-cases/remove.use-case';
import {
  maskSecretValue,
  maskSecretValues,
} from '../../common/utils/mask-secret-value.util';

@ApiTags('system-configuration')
@Controller('system-configuration')
export class SystemConfigurationController {
  constructor(
    private readonly findAll$: FindAllSystemConfigurationUseCase,
    private readonly findOne$: FindOneSystemConfigurationUseCase,
    private readonly findByLabelKey$: FindSystemConfigByLabelKeyUseCase,
    private readonly create$: CreateSystemConfigurationUseCase,
    private readonly update$: UpdateSystemConfigurationUseCase,
    private readonly remove$: RemoveSystemConfigurationUseCase,
  ) {}

  @GetApi({
    summary: 'Lista configurações do sistema',
    description: 'Retorna uma lista paginada de configurações do sistema',
    status: 'OK',
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
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<
    PaginatedResponse<SystemConfigurationDto> | SystemConfigurationDto[]
  > {
    const result = await this.findAll$.execute(query, {
      roleName: currentUser.roleName,
    });
    return maskSecretValues(result, 'value');
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
    const result = await this.findByLabelKey$.execute('SYSTEM_USER_CREATE');
    return maskSecretValue(result, 'value');
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
    const result = await this.findByLabelKey$.execute('SYSTEMCONFIG_THEME');
    return maskSecretValue(result, 'value');
  }

  @GetApi({
    path: 'app-name',
    summary: 'Busca nome do app',
    description: 'Retorna o nome do app para telas públicas, sem sessão',
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
  async findAppNameConfiguration() {
    const result = await this.findByLabelKey$.execute('SYSTEM_APP_NAME');
    return maskSecretValue(result, 'value');
  }

  @GetApi({
    path: 'app-tagline',
    summary: 'Busca descritor do app',
    description: 'Retorna o descritor do app para telas públicas, sem sessão',
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
  async findAppTaglineConfiguration() {
    const result = await this.findByLabelKey$.execute('SYSTEM_APP_TAGLINE');
    return maskSecretValue(result, 'value');
  }

  @GetApi({
    path: ':id',
    summary: 'Busca configuração por ID',
    description: 'Retorna uma configuração do sistema pelo ID',
    status: 'OK',
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
    const result = await this.findOne$.execute(id);
    return maskSecretValue(result, 'value');
  }

  @GetApi({
    path: 'key/:labelKey',
    summary: 'Busca configuração por chave',
    description: 'Retorna uma configuração do sistema pela chave (labelKey)',
    status: 'OK',
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
  async findByLabelKey(
    @Param('labelKey') labelKey: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const result = await this.findByLabelKey$.execute(labelKey, {
      roleName: currentUser.roleName,
    });
    return maskSecretValue(result, 'value');
  }

  @PostApi({
    summary: 'Cria configuração do sistema',
    description: 'Cria uma nova configuração do sistema',
    status: 'CREATED',
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
    const result = await this.create$.execute(createDto, currentUser.id);
    return maskSecretValue(result, 'value');
  }

  @PatchApi({
    path: ':id',
    summary: 'Atualiza configuração do sistema',
    description: 'Atualiza uma configuração existente do sistema',
    status: 'OK',
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
    const result = await this.update$.execute(id, updateDto, currentUser.id);
    return maskSecretValue(result, 'value');
  }

  @DeleteApi({
    path: ':id',
    summary: 'Remove configuração do sistema',
    description: 'Remove uma configuração do sistema',
    status: 'NO_CONTENT',
    roles: ['ADMIN'],
  })
  async delete(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.remove$.execute(currentUser.id, id);
  }
}
