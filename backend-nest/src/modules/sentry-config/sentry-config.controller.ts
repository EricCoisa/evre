import { Body, Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PutApi } from '../../common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import { SaveSentryConfigUseCase } from './use-cases/save-sentry-config.use-case';
import { SaveSentryConfigDto } from './dto/sentry-config.dto';

/** Só o PUT: o DSN não é secret e a leitura sai pelo endpoint genérico de SystemConfiguration. */
@ApiTags('sentry')
@Controller('sentry')
export class SentryConfigController {
  constructor(private readonly saveSentryConfig$: SaveSentryConfigUseCase) {}

  @PutApi({
    path: 'config',
    summary: 'Valida e salva o DSN do Sentry',
    description:
      'Sonda o DSN no endpoint de ingestão do próprio Sentry antes de gravar — nada é persistido se a sonda reprovar. DSN vazio desliga e pula a sonda. O SDK só relê o DSN no boot: exige restart do backend.',
    status: 'OK',
    roles: ['ADMIN'],
    body: SaveSentryConfigDto,
  })
  async saveConfig(
    @Body() dto: SaveSentryConfigDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.saveSentryConfig$.execute(dto, currentUser.id);
  }
}
