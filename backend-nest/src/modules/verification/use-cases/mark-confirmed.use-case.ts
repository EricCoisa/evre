import { Injectable } from '@nestjs/common';
import { VerificationChannel } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { VerificationHandlerRegistry } from '../verification-handler.registry';
import {
  generateVerificationCode,
  hashVerificationCode,
} from '../verification.util';

export interface MarkConfirmedInput {
  userId: string;
  purpose: string;
  channel: VerificationChannel;
  target: string;
}

/** Assume o lugar do par request+confirm para quem já provou o alvo por outro meio confiável. */
@Injectable()
export class MarkConfirmedUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly handlers: VerificationHandlerRegistry,
  ) {}

  async execute(input: MarkConfirmedInput): Promise<void> {
    const { userId, purpose, channel, target } = input;
    const now = new Date();

    await this.prisma.verificationCode.create({
      data: {
        userId,
        purpose,
        channel,
        target,
        codeHash: hashVerificationCode(generateVerificationCode()),
        expiresAt: now,
        consumedAt: now,
      },
    });

    await this.loggingService.create(
      {
        module: 'VERIFICATION',
        action: LogActions.VERIFICATION_CONFIRMED,
        message: `Verificação marcada como confirmada sem código (purpose=${purpose}, channel=${channel})`,
        metadata: { userId, purpose, channel },
      },
      userId,
    );

    await this.handlers.invoke(purpose, { userId, target });
  }
}
