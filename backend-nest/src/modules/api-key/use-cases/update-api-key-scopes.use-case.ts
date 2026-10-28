import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

import { PrismaService } from 'src/prisma/prisma.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { LoggingService } from '../../logging/logging.service';

@Injectable()
export class UpdateApiKeyScopesUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(
    id: string,
    scopes: string[],
    userId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });

    if (!key) {
      throw new NotFoundException(this.i18n.t('common.errors.not_found'));
    }

    if (!isAdmin && key.userId !== userId) {
      throw new ForbiddenException(this.i18n.t('user.forbidden'));
    }

    await this.prisma.apiKey.update({ where: { id }, data: { scopes } });

    await this.loggingService.create(
      {
        module: 'API_KEY',
        action: LogActions.API_KEY_REVOKED,
        message: `Escopos da chave de API atualizados: ${key.name}`,
        metadata: { apiKeyId: key.id, newScopes: scopes },
      },
      userId,
    );
  }
}
