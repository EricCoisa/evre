import { Body, Controller, Query } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { ApiTags } from '@nestjs/swagger';
import { GetApi, PutApi } from '../../common/decorators/api-method.decorator';
import { SaveStorageConfigurationUseCase } from './use-cases/save-configuration.use-case';
import { CheckStorageHealthUseCase } from './use-cases/check-health.use-case';
import { StorageService } from './storage.service';
import { SaveStorageConfigDto } from './dto/save-storage-config.dto';
import {
  PresignedUrlQuerySchema,
  type PresignedUrlQuery,
} from './dto/presigned-url-query.dto';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import type { ProviderResult } from 'src/domain/interface/provider-result';

@ApiTags('storage')
@Controller('storage')
export class StorageController {
  constructor(
    private readonly saveStorageConfiguration: SaveStorageConfigurationUseCase,
    private readonly checkStorageHealth: CheckStorageHealthUseCase,
    private readonly storageService: StorageService,
  ) {}

  /** Valida o formulário contra o provider e persiste só se passar. */
  @PutApi({
    path: 'config',
    summary: 'Valida e salva a configuração de storage',
    status: 'OK',
    roles: ['ADMIN'],
    body: SaveStorageConfigDto,
  })
  async saveConfiguration(
    @Body() dto: SaveStorageConfigDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ProviderResult> {
    return this.saveStorageConfiguration.execute(dto, currentUser.id);
  }

  @GetApi({
    path: 'health',
    summary: 'Saúde do serviço de storage (via cache)',
    status: 'OK',
    authenticated: true,
  })
  async health(): Promise<{ operational: boolean; reason?: string }> {
    return this.checkStorageHealth.execute();
  }

  @GetApi({
    path: 'file',
    summary: 'Obtém URL pré-assinada para acessar arquivo',
    status: 'OK',
    authenticated: false,
    queries: [
      {
        name: 'key',
        required: true,
        type: String,
        description: 'Key do arquivo ou a public URL salva',
      },
    ],
  })
  async getPresignedUrl(
    @Query(new ZodValidationPipe(PresignedUrlQuerySchema))
    query: PresignedUrlQuery,
  ): Promise<{ url: string }> {
    const key = query.key;
    // O front manda a public URL salva; resolveFileFromUrl acha o dono entre S3 e LOCAL.
    const resolved = await this.storageService.resolveFileFromUrl(key);
    const url = resolved
      ? await resolved.provider.getPresignedUrl(resolved.key)
      : await this.storageService.getPresignedUrl(key);
    return { url };
  }
}
