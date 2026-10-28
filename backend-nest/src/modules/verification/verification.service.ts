import { Injectable } from '@nestjs/common';
import { VerificationChannel } from '@prisma/client';
import {
  RequestVerificationUseCase,
  type RequestVerificationInput,
  type RequestVerificationOutput,
} from './use-cases/request-verification.use-case';
import {
  ConfirmVerificationUseCase,
  type ConfirmVerificationInput,
} from './use-cases/confirm-verification.use-case';
import {
  IsVerifiedUseCase,
  type IsVerifiedInput,
} from './use-cases/is-verified.use-case';
import {
  MarkConfirmedUseCase,
  type MarkConfirmedInput,
} from './use-cases/mark-confirmed.use-case';
import {
  CheckChannelHealthUseCase,
  type ChannelHealth,
} from './use-cases/check-channel-health.use-case';

/** Ponto de entrada para outros módulos pedirem/confirmarem/consultarem verificação por injeção. */
@Injectable()
export class VerificationService {
  constructor(
    private readonly requestUseCase: RequestVerificationUseCase,
    private readonly confirmUseCase: ConfirmVerificationUseCase,
    private readonly isVerifiedUseCase: IsVerifiedUseCase,
    private readonly markConfirmedUseCase: MarkConfirmedUseCase,
    private readonly checkChannelHealthUseCase: CheckChannelHealthUseCase,
  ) {}

  async request(
    input: RequestVerificationInput,
  ): Promise<RequestVerificationOutput> {
    return this.requestUseCase.execute(input);
  }

  async confirm(input: ConfirmVerificationInput): Promise<void> {
    return this.confirmUseCase.execute(input);
  }

  /** `true` se já existe uma confirmação válida para este (userId, purpose, target). */
  async isConfirmed(input: IsVerifiedInput): Promise<boolean> {
    return this.isVerifiedUseCase.execute(input);
  }

  /** Para quem já provou o alvo por outro meio confiável — ver MarkConfirmedUseCase. */
  async markConfirmed(input: MarkConfirmedInput): Promise<void> {
    return this.markConfirmedUseCase.execute(input);
  }

  /** "Pronto para enviar" — ver CheckChannelHealthUseCase para o que isso cobre (e o que não cobre). */
  async checkChannelHealth(
    channel: VerificationChannel,
  ): Promise<ChannelHealth> {
    return this.checkChannelHealthUseCase.execute(channel);
  }
}
