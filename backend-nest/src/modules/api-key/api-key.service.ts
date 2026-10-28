import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from 'src/prisma/prisma.service';

export interface ValidatedApiKey {
  user: {
    id: string;
    email: string;
    status: string;
    deletedAt: Date | null;
    roleId: string | null;
    roleRecord: { name: string } | null;
  };
  scopes: string[];
}

@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Gera uma chave crua no formato `ak_<base64url>`. */
  generate(): string {
    return 'ak_' + randomBytes(32).toString('base64url');
  }

  /** Gera o hash SHA-256 da chave crua — o único valor persistido. */
  hash(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  /** Valida uma chave crua (existência e expiração) e retorna o usuário dono e os scopes, ou null se inválida. */
  async validateKey(rawKey: string): Promise<ValidatedApiKey | null> {
    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash: this.hash(rawKey) },
      include: {
        user: {
          include: { roleRecord: { select: { name: true } } },
        },
      },
    });

    if (!key) return null;

    if (key.expiresAt !== null && key.expiresAt < new Date()) return null;

    // Atualização de lastUsedAt é best-effort — não bloqueia a request.
    void this.prisma.apiKey
      .update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => undefined);

    return { user: key.user, scopes: key.scopes };
  }
}
