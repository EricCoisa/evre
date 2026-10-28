import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { EmailModule } from '../email/email.module';
import { MessagingModule } from '../messaging/messaging.module';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { VerificationGuard } from './verification.guard';
import { VerificationHandlerRegistry } from './verification-handler.registry';
import { RequestVerificationUseCase } from './use-cases/request-verification.use-case';
import { ConfirmVerificationUseCase } from './use-cases/confirm-verification.use-case';
import { IsVerifiedUseCase } from './use-cases/is-verified.use-case';
import { MarkConfirmedUseCase } from './use-cases/mark-confirmed.use-case';
import { CheckChannelHealthUseCase } from './use-cases/check-channel-health.use-case';

@Module({
  imports: [PrismaModule, LoggingModule, EmailModule, MessagingModule],
  controllers: [VerificationController],
  providers: [
    VerificationService,
    VerificationGuard,
    VerificationHandlerRegistry,
    RequestVerificationUseCase,
    ConfirmVerificationUseCase,
    IsVerifiedUseCase,
    MarkConfirmedUseCase,
    CheckChannelHealthUseCase,
  ],
  exports: [
    VerificationService,
    VerificationGuard,
    VerificationHandlerRegistry,
    // VerificationGuard depende disto — quem importa o módulo só por VerificationGuard
    // (ex.: UserModule) precisa que o DI resolva essa dependência também.
    CheckChannelHealthUseCase,
  ],
})
export class VerificationModule {}
