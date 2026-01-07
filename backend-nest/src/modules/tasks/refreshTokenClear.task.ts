import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RefreshTokenClearTask {
  private readonly logger = new Logger(RefreshTokenClearTask.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Executa diariamente à meia-noite
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleRefreshTokenCleanup() {
    try {
      const removed = await this.clearExpiredRefreshTokens();
      this.logger.log(`Cleanup concluído. Tokens removidos: ${removed}`);
    } catch (error) {
      this.logger.error('Erro ao limpar refresh tokens', error);
    }
  }

  /**
   * Lógica de limpeza dos tokens expirados
   */
  private async clearExpiredRefreshTokens(): Promise<number> {
    const now = new Date();

    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });

    return result.count;
  }
}
