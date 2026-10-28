import { Body, Controller, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyScopesDto } from './dto/update-api-key-scopes.dto';
import { CreateApiKeyUseCase } from './use-cases/create-api-key.use-case';
import { ListApiKeysUseCase } from './use-cases/list-api-keys.use-case';
import { RevokeApiKeyUseCase } from './use-cases/revoke-api-key.use-case';
import { UpdateApiKeyScopesUseCase } from './use-cases/update-api-key-scopes.use-case';
import {
  DeleteApi,
  GetApi,
  PatchApi,
  PostApi,
} from '../../common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';

@ApiTags('api-keys')
@Controller('api-keys')
export class ApiKeyController {
  constructor(
    private readonly createApiKeyUseCase: CreateApiKeyUseCase,
    private readonly listApiKeysUseCase: ListApiKeysUseCase,
    private readonly revokeApiKeyUseCase: RevokeApiKeyUseCase,
    private readonly updateApiKeyScopesUseCase: UpdateApiKeyScopesUseCase,
  ) {}

  @PostApi({
    path: '',
    summary: 'Create API key',
    authenticated: true,
    status: 'CREATED',
  })
  async create(
    @Body() dto: CreateApiKeyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.createApiKeyUseCase.execute(dto, user.id);
  }

  @GetApi({ path: '', summary: 'List API keys', authenticated: true })
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.listApiKeysUseCase.execute(user.id, user.roleName === 'ADMIN');
  }

  @DeleteApi({
    path: ':id',
    status: 'NO_CONTENT',
    summary: 'Revoke API key',
    authenticated: true,
  })
  async revoke(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.revokeApiKeyUseCase.execute(
      id,
      user.id,
      user.roleName === 'ADMIN',
    );
  }

  @PatchApi({
    path: ':id/scopes',
    summary: 'Update API key scopes',
    authenticated: true,
    status: 'OK',
  })
  async updateScopes(
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyScopesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.updateApiKeyScopesUseCase.execute(
      id,
      dto.scopes,
      user.id,
      user.roleName === 'ADMIN',
    );
  }
}
