import { Controller, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  GetApi,
  PostApi,
  PatchApi,
  DeleteApi,
} from '../../common/decorators/api-method.decorator';
import { FeatureFlagService } from './feature-flag.service';
import { FindOneFeatureFlagUseCase } from './use-cases/find-one.use-case';
import { CreateFeatureFlagUseCase } from './use-cases/create.use-case';
import { UpdateFeatureFlagUseCase } from './use-cases/update.use-case';
import { RemoveFeatureFlagUseCase } from './use-cases/remove.use-case';
import { SetFeatureFlagRolesUseCase } from './use-cases/set-roles.use-case';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { SetFeatureFlagRolesDto } from './dto/set-feature-flag-roles.dto';
import { FeatureFlagDto } from './dto/feature-flag.dto';
import { McpScopes } from '../../domain/api-key/mcp-scopes.const';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';

@ApiTags('feature-flags')
@Controller('feature-flags')
export class FeatureFlagController {
  constructor(
    private readonly service: FeatureFlagService,
    private readonly findOne$: FindOneFeatureFlagUseCase,
    private readonly create$: CreateFeatureFlagUseCase,
    private readonly update$: UpdateFeatureFlagUseCase,
    private readonly remove$: RemoveFeatureFlagUseCase,
    private readonly setRoles$: SetFeatureFlagRolesUseCase,
  ) {}

  @GetApi({
    path: 'me',
    summary: 'Retorna flags avaliadas para o usuário autenticado',
    status: 'OK',
    authenticated: true,
  })
  async getForMe(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Record<string, boolean>> {
    return this.service.evaluateForRole(user.roleName);
  }

  // Única rota de flag alcançável por API key. As escritas não declaram
  // `scope`, e o ScopeGuard é default-deny para chave.
  @GetApi({
    summary: 'Lista todas as feature flags (admin)',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.FEATURE_FLAGS_READ,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Lista de feature flags',
          schema: { dto: FeatureFlagDto, isArray: true },
        },
      ],
    },
  })
  async findAll(): Promise<FeatureFlagDto[]> {
    return this.service.findAll();
  }

  @GetApi({
    path: ':id',
    summary: 'Busca feature flag por ID (admin)',
    status: 'OK',
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Feature flag',
          schema: { dto: FeatureFlagDto },
        },
      ],
    },
  })
  async findOne(@Param('id') id: string): Promise<FeatureFlagDto> {
    return this.findOne$.execute(id);
  }

  @PostApi({
    summary: 'Cria feature flag (admin)',
    status: 'CREATED',
    roles: ['ADMIN'],
    body: CreateFeatureFlagDto,
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Feature flag criada',
          schema: { dto: FeatureFlagDto },
        },
      ],
    },
  })
  async create(@Body() dto: CreateFeatureFlagDto): Promise<FeatureFlagDto> {
    return this.create$.execute(dto);
  }

  @PatchApi({
    path: ':id',
    summary: 'Atualiza feature flag (admin)',
    status: 'OK',
    roles: ['ADMIN'],
    body: UpdateFeatureFlagDto,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Feature flag atualizada',
          schema: { dto: FeatureFlagDto },
        },
      ],
    },
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFeatureFlagDto,
  ): Promise<FeatureFlagDto> {
    return this.update$.execute(id, dto);
  }

  @DeleteApi({
    path: ':id',
    summary: 'Remove feature flag (admin)',
    status: 'NO_CONTENT',
    roles: ['ADMIN'],
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.remove$.execute(id);
  }

  @PatchApi({
    path: ':id/roles',
    summary: 'Define allowlist de roles para a flag (admin)',
    status: 'OK',
    roles: ['ADMIN'],
  })
  async setRoles(
    @Param('id') id: string,
    @Body() dto: SetFeatureFlagRolesDto,
  ): Promise<FeatureFlagDto> {
    return this.setRoles$.execute(id, dto.roleIds);
  }
}
