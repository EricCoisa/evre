import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessagingConnectionService } from '../messaging-connection.service';
import { MessagingEventsService } from '../messaging-events.service';
import { catalogName, categoryChangeData } from '../providers/template.util';
import type { LinkRemoteTemplateDto } from '../dto/messaging-remote-template.dto';

@Injectable()
export class LinkRemoteTemplateUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: MessagingConnectionService,
    private readonly events: MessagingEventsService,
  ) {}

  async execute(connectionId: string, dto: LinkRemoteTemplateDto) {
    const connection = await this.connections.getActive(connectionId);
    const provider = this.connections.use(connection);
    if (!provider.fetchTemplateStatuses) {
      throw new BadRequestException(
        'Esta conexão não possui suporte a catálogo remoto',
      );
    }

    const template = await this.prisma.messagingTemplate.findUnique({
      where: { id: dto.templateId },
    });
    if (!template) {
      throw new NotFoundException(
        `Template local ${dto.templateId} não encontrado`,
      );
    }

    // Consulta os templates na Meta para obter o status e a categoria atuais do template remoto
    const remoteList = await provider.fetchTemplateStatuses();
    const remote = remoteList.find(
      (r) => r.providerTemplateId === dto.remoteTemplateId,
    );
    if (!remote) {
      throw new NotFoundException(
        `Template ${dto.remoteTemplateId} não foi encontrado na WABA do provedor`,
      );
    }

    // Validação estrita: somente templates com correspondência exata de nome e idioma podem ser vinculados
    const isExactMatch =
      template.language === remote.language &&
      catalogName(template.key) === remote.name.toLowerCase();

    if (!isExactMatch) {
      throw new BadRequestException(
        `O template local "${template.key}" (${template.language}) não é compatível com o template remoto "${remote.name}" (${remote.language}). Somente correspondências exatas são permitidas.`,
      );
    }

    // Upsert na submissão: vincula o template local com a conexão e o ID do template no provider
    const submission = await this.prisma.messagingTemplateSubmission.upsert({
      where: {
        templateId_connectionId: {
          templateId: dto.templateId,
          connectionId,
        },
      },
      create: {
        templateId: dto.templateId,
        connectionId,
        providerTemplateId: remote.providerTemplateId,
        status: remote.status,
        reason: remote.reason ?? null,
        submittedAt: new Date(),
        reviewedAt: new Date(),
        outOfSync: false,
      },
      update: {
        providerTemplateId: remote.providerTemplateId,
        status: remote.status,
        reason: remote.reason ?? null,
        reviewedAt: new Date(),
        outOfSync: false,
      },
    });

    // Se a Meta classificou em categoria diferente da local, sincroniza
    const categoryChange = categoryChangeData(
      template.category,
      remote.category,
    );
    if (categoryChange) {
      await this.prisma.messagingTemplate.update({
        where: { id: template.id },
        data: categoryChange,
      });
    }

    // Notifica via SSE que o catálogo de templates mudou
    this.events.emit({ type: 'templates' });

    return {
      submissionId: submission.id,
      templateId: template.id,
      connectionId,
      providerTemplateId: remote.providerTemplateId,
      status: submission.status,
    };
  }
}
