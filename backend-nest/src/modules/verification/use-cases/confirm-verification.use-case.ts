import { Injectable, BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { hashVerificationCode } from '../verification.util';
import { VerificationHandlerRegistry } from '../verification-handler.registry';

export interface ConfirmVerificationInput {
  userId: string;
  purpose: string;
  code: string;
}

/** Sempre olha a linha mais recente de (userId, purpose) e invoca o handler registrado para o purpose, se houver. */
@Injectable()
export class ConfirmVerificationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly i18n: I18nService,
    private readonly handlers: VerificationHandlerRegistry,
  ) {}

  async execute(input: ConfirmVerificationInput): Promise<void> {
    const { userId, purpose, code } = input;

    const latest = await this.prisma.verificationCode.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest || latest.consumedAt) {
      throw new BadRequestException(this.i18n.t('verification.no_pending'));
    }
    if (latest.expiresAt < new Date()) {
      throw new BadRequestException(this.i18n.t('verification.expired'));
    }
    if (latest.attempts >= latest.maxAttempts) {
      throw new BadRequestException(
        this.i18n.t('verification.too_many_attempts'),
      );
    }

    if (hashVerificationCode(code) !== latest.codeHash) {
      await this.prisma.verificationCode.update({
        where: { id: latest.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException(this.i18n.t('verification.invalid_code'));
    }

    await this.prisma.verificationCode.update({
      where: { id: latest.id },
      data: { consumedAt: new Date() },
    });

    await this.loggingService.create(
      {
        module: 'VERIFICATION',
        action: LogActions.VERIFICATION_CONFIRMED,
        message: `Código de verificação confirmado (purpose=${purpose})`,
        metadata: { userId, purpose },
      },
      userId,
    );

    await this.handlers.invoke(purpose, { userId, target: latest.target });
  }
}
