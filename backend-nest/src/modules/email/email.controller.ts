import { Body, Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetApi, PutApi } from '../../common/decorators/api-method.decorator';
import { SaveEmailConfigurationUseCase } from './use-cases/save-configuration.use-case';
import { CheckEmailHealthUseCase } from './use-cases/check-health.use-case';
import { ListEmailTemplatesUseCase } from './use-cases/list-templates.use-case';
import { SaveEmailConfigDto } from './dto/save-email-config.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import type { EmailTemplateInfo } from './email.service';

@ApiTags('email')
@Controller('email')
export class EmailController {
  constructor(
    private readonly saveEmailConfiguration: SaveEmailConfigurationUseCase,
    private readonly checkEmailHealth: CheckEmailHealthUseCase,
    private readonly listEmailTemplates: ListEmailTemplatesUseCase,
  ) {}

  /** Valida a configuração contra o provider e só persiste se passar. */
  @PutApi({
    path: 'config',
    summary: 'Valida e salva a configuração de email',
    status: 'OK',
    roles: ['ADMIN'],
    body: SaveEmailConfigDto,
  })
  async saveConfiguration(
    @Body() dto: SaveEmailConfigDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ProviderResult> {
    return this.saveEmailConfiguration.execute(dto, currentUser.id);
  }

  @GetApi({
    path: 'health',
    summary: 'Saúde do serviço de email (via cache)',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async health(): Promise<{ operational: boolean; reason?: string }> {
    return this.checkEmailHealth.execute();
  }

  /** HTML efetivo (config ou default de disco) dos templates editáveis em `settings?tab=emailConfig`. */
  @GetApi({
    path: 'templates',
    summary: 'Lista o HTML efetivo dos templates de email editáveis',
    status: 'OK',
    roles: ['ADMIN'],
  })
  async templates(): Promise<EmailTemplateInfo[]> {
    return this.listEmailTemplates.execute();
  }
}
