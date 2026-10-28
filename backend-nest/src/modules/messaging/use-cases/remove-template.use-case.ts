import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessagingConnectionService } from '../messaging-connection.service';
import { catalogName } from '../providers/template.util';

/** Template que já não existe na WABA (apagado lá, ou nunca chegou) — remover de novo não é falha. */
const ALREADY_GONE = /does not exist|not found|2593002|não existe/i;

@Injectable()
export class RemoveTemplateUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: MessagingConnectionService,
  ) {}

  /** remote (padrão) remove também na WABA de cada conexão submetida e só apaga localmente se todas aceitarem. */
  async execute(id: string, remote = true) {
    const existing = await this.prisma.messagingTemplate.findUnique({
      where: { id },
      include: { submissions: { include: { connection: true } } },
    });
    if (!existing) {
      throw new NotFoundException(`template ${id} não encontrado`);
    }

    if (existing.isSystem) {
      throw new BadRequestException(
        'Templates do sistema não podem ser removidos.',
      );
    }

    if (remote) {
      const failures: string[] = [];
      for (const submission of existing.submissions) {
        const provider = this.connections.use(submission.connection);
        if (!provider.deleteRemoteTemplate) continue;
        const result = await provider
          .deleteRemoteTemplate(
            catalogName(existing.key),
            submission.providerTemplateId ?? undefined,
          )
          .catch((error: unknown) => ({
            status: false,
            data: String((error as Error)?.message ?? error),
          }));
        if (!result.status && !ALREADY_GONE.test(String(result.data))) {
          failures.push(
            `${submission.connection.provider}: ${String(result.data)}`,
          );
        }
      }
      if (failures.length > 0) {
        throw new BadGatewayException(
          `Não foi possível remover na Meta (nada foi apagado): ${failures.join('; ')}`,
        );
      }
    }

    await this.prisma.messagingTemplate.delete({ where: { id } });
    return { status: true, message: 'template removido' };
  }
}
