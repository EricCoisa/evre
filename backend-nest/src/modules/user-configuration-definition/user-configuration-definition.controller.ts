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
import { UserConfigurationDefinitionsDto } from './dto/user-configuration-definitions.dto';
import { CreateUserConfigurationDefinitionCreateDto } from './dto/create-system-configuration.dto';

import type { PaginatedResponse } from '../../common/types/pagination.types';
import {
  maskSecretValue,
  maskSecretValues,
} from '../../common/utils/mask-secret-value.util';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';

import { SetDefinitionDefaultDto } from './dto/set-definition-default.dto';
import { UpdateUserConfigurationDefinitionsDto } from './dto/update-user-configuration-definition.dto';
import { FindAllUserConfigDefinitionsUseCase } from './use-cases/find-all.use-case';
import { FindOneUserConfigDefinitionUseCase } from './use-cases/find-one.use-case';
import { CreateUserConfigDefinitionUseCase } from './use-cases/create.use-case';
import { UpdateUserConfigDefinitionUseCase } from './use-cases/update.use-case';
import { RemoveUserConfigDefinitionUseCase } from './use-cases/remove.use-case';
import { FindUserConfigDefinitionByLabelKeyUseCase } from './use-cases/find-by-label-key.use-case';
import { SetDefinitionDefaultUseCase } from './use-cases/set-definition-default.use-case';

@ApiTags('user-configuration-definitions')
@Controller('user-configuration-definitions')
export class UserConfigurationDefinitionController {
  constructor(
    private readonly findAllUseCase: FindAllUserConfigDefinitionsUseCase,
    private readonly findOneUseCase: FindOneUserConfigDefinitionUseCase,
    private readonly createUseCase: CreateUserConfigDefinitionUseCase,
    private readonly updateUseCase: UpdateUserConfigDefinitionUseCase,
    private readonly removeUseCase: RemoveUserConfigDefinitionUseCase,
    private readonly findByLabelKeyUseCase: FindUserConfigDefinitionByLabelKeyUseCase,
    private readonly setDefinitionDefaultUseCase: SetDefinitionDefaultUseCase,
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
    return maskSecretValues(
      await this.findAllUseCase.execute(query),
      'defaultValue',
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
          schema: { dto: UserConfigurationDefinitionsDto },
        },
      ],
    },
  })
  async findById(
    @Param('id') id: string,
  ): Promise<UserConfigurationDefinitionsDto> {
    return maskSecretValue(
      await this.findOneUseCase.execute(id),
      'defaultValue',
    );
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
    return maskSecretValue(
      await this.findByLabelKeyUseCase.execute(labelKey),
      'defaultValue',
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
    @Body() createDto: CreateUserConfigurationDefinitionCreateDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserConfigurationDefinitionsDto> {
    return maskSecretValue(
      await this.createUseCase.execute(createDto, currentUser.id),
      'defaultValue',
    );
  }

  /** Default herdado por quem não personalizou a chave. */
  @PatchApi({
    path: ':id/default',
    summary: 'Altera o default global de uma definição',
    description:
      'Altera o valor padrão herdado por todos os usuários que não personalizaram esta chave',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Default alterado com sucesso',
        },
      ],
    },
  })
  async setDefinitionDefault(
    @Param('id') id: string,
    @Body() dto: SetDefinitionDefaultDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return maskSecretValue(
      await this.setDefinitionDefaultUseCase.execute(id, dto, user.id),
      'defaultValue',
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
    return maskSecretValue(
      await this.updateUseCase.execute(id, updateDto, currentUser.id),
      'defaultValue',
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
    await this.removeUseCase.execute(id, currentUser.id);
  }
}
