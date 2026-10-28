import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { I18nService } from 'nestjs-i18n';
import { LogActions } from 'src/domain/logging/log-actions';

@Injectable()
export class LogoutUseCase {
  constructor(
    private prisma: PrismaService,
    private loggingService: LoggingService,
    private i18n: I18nService,
  ) {}

  async execute(token: string, performedById?: string) {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    // Derruba a família inteira, não só o token apresentado: com rotação, a sessão
    // pode ter sucessores já emitidos, e apagar só esta linha deixaria a sessão viva.
    const result = await this.prisma.refreshToken.deleteMany({
      where: tokenRecord ? { familyId: tokenRecord.familyId } : { token },
    });

    if (tokenRecord && result.count > 0) {
      await this.loggingService.create(
        {
          module: 'AUTH',
          action: LogActions.LOGOUT,
          message: `Usuário ${tokenRecord.user.email} efetuou logout`,
          metadata: {
            userId: tokenRecord.user.id,
            userEmail: tokenRecord.user.email,
          },
        },
        performedById || tokenRecord.user.id,
      );
    }

    return result.count;
  }
}
