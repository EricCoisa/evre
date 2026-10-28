import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { VerificationMethod } from '../verification-method.enum';

export interface IsVerifiedInput {
  userId: string;
  /** Chave TS do módulo chamador (ex. UserVerificationPurpose.PHONE_CONFIRMATION). */
  purpose: string;
  target: string;
  /** Default: PERMANENT. */
  method?: VerificationMethod;
  /** Obrigatório quando method === TTL. */
  ttlSeconds?: number;
}

/** Único lugar que define "confirmado": existe um VerificationCode com consumedAt preenchido para (userId, purpose, target). */
@Injectable()
export class IsVerifiedUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: IsVerifiedInput): Promise<boolean> {
    const method = input.method ?? VerificationMethod.PERMANENT;

    const confirmed = await this.prisma.verificationCode.findFirst({
      where: {
        userId: input.userId,
        purpose: input.purpose,
        target: input.target,
        consumedAt:
          method === VerificationMethod.TTL
            ? { gte: new Date(Date.now() - (input.ttlSeconds ?? 0) * 1000) }
            : { not: null },
        ...(method === VerificationMethod.ONCE ? { usedAt: null } : {}),
      },
      orderBy: { consumedAt: 'desc' },
    });
    if (!confirmed) return false;

    if (method === VerificationMethod.ONCE) {
      await this.prisma.verificationCode.update({
        where: { id: confirmed.id },
        data: { usedAt: new Date() },
      });
    }

    return true;
  }
}
