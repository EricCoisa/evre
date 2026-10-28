import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';

@Injectable()
export class ResetAllUserConfigurationsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(userId: string, performedById?: string) {
    await this.prisma.userConfiguration.deleteMany({
      where: { userId },
    });

    await this.loggingService.create(
      {
        module: 'USER_CONFIGURATION',
        action: LogActions.RESET_ALL_CONFIGURATIONS,
        message: 'Todas as configurações foram resetadas',
        metadata: { userId },
      },
      performedById || userId,
    );

    return {
      message: this.i18n.t('user_configuration.all_configurations_reset'),
    };
  }
}
