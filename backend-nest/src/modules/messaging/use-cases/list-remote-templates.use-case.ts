import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessagingConnectionService } from '../messaging-connection.service';
import { catalogName } from '../providers/template.util';
import type { RemoteTemplateItemDto } from '../dto/messaging-remote-template.dto';

@Injectable()
export class ListRemoteTemplatesUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: MessagingConnectionService,
  ) {}

  async execute(connectionId: string): Promise<RemoteTemplateItemDto[]> {
    const connection = await this.connections.getActive(connectionId);
    const provider = this.connections.use(connection);
    if (!provider.fetchTemplateStatuses) {
      throw new BadRequestException(
        'Esta conexão não possui suporte a consulta de catálogo remoto',
      );
    }

    // Busca os templates diretamente da WABA da Meta
    const remoteTemplates = await provider.fetchTemplateStatuses();

    // Busca templates locais e submissões já existentes para esta conexão
    const [localTemplates, submissions] = await Promise.all([
      this.prisma.messagingTemplate.findMany({
        select: {
          id: true,
          key: true,
          language: true,
          category: true,
        },
      }),
      this.prisma.messagingTemplateSubmission.findMany({
        where: { connectionId },
        include: {
          template: {
            select: { id: true, key: true },
          },
        },
      }),
    ]);

    const submissionByRemoteId = new Map(
      submissions
        .filter((s) => s.providerTemplateId)
        .map((s) => [s.providerTemplateId as string, s]),
    );

    return remoteTemplates.map((remote): RemoteTemplateItemDto => {
      const submission = submissionByRemoteId.get(remote.providerTemplateId);

      // Localiza templates locais candidatos:
      // Apenas correspondência exata: mesmo idioma e mesmo nome de catálogo (catalogName(local.key) === remote.name)
      const exactMatches = localTemplates.filter(
        (local) =>
          local.language === remote.language &&
          catalogName(local.key) === remote.name.toLowerCase(),
      );

      const suggestedTemplates = exactMatches.map((local) => ({
        id: local.id,
        key: local.key,
        language: local.language,
        category: local.category,
        exactMatch: true,
      }));

      return {
        providerTemplateId: remote.providerTemplateId,
        name: remote.name,
        language: remote.language,
        status: remote.status,
        reason: remote.reason,
        category: remote.category,
        linkedTemplateId: submission?.templateId,
        linkedTemplateKey: submission?.template?.key,
        suggestedTemplates,
      };
    });
  }
}
