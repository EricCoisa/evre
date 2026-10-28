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
export class RevokeApiKeyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(id: string, userId: string, isAdmin: boolean) {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });

    if (!key) {
      throw new NotFoundException(this.i18n.t('common.errors.not_found'));
    }

    if (!isAdmin && key.userId !== userId) {
      throw new ForbiddenException(this.i18n.t('user.forbidden'));
    }

    await this.prisma.apiKey.delete({ where: { id } });

    await this.loggingService.create(
      {
        module: 'API_KEY',
        action: LogActions.API_KEY_REVOKED,
        message: `API key revogada: ${key.name}`,
        metadata: { apiKeyId: key.id },
      },
      userId,
    );

    return { id: key.id, revoked: true };
  }
}
