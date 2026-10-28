import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessagingConnectionService } from '../messaging-connection.service';
import { MessagingEventsService } from '../messaging-events.service';
import { extractPlaceholders } from '../providers/template.util';
import { parseMetaComponents } from '../providers/meta-components.util';
import type { ImportRemoteTemplateDto } from '../dto/messaging-remote-template.dto';

@Injectable()
export class ImportRemoteTemplateUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: MessagingConnectionService,
    private readonly events: MessagingEventsService,
  ) {}

  async execute(connectionId: string, dto: ImportRemoteTemplateDto) {
    const connection = await this.connections.getActive(connectionId);
    const provider = this.connections.use(connection);
    if (!provider.fetchTemplateStatuses) {
      throw new BadRequestException(
        'Esta conexão não possui suporte a catálogo remoto',
      );
    }

    const remoteList = await provider.fetchTemplateStatuses();
    const remote = remoteList.find(
      (r) => r.providerTemplateId === dto.remoteTemplateId,
    );
    if (!remote) {
      throw new NotFoundException(
        `Template ${dto.remoteTemplateId} não foi encontrado na WABA do provedor`,
      );
    }

    const key = remote.name.toUpperCase();
    const language = remote.language;

    // Converte os componentes estruturais da Meta para os campos locais
    const parsed = parseMetaComponents(remote.components);

    // 1. Resolve ou cria o MessagingTemplateType
    let typeId = dto.typeId;
    if (!typeId) {
      const existingType = await this.prisma.messagingTemplateType.findUnique({
        where: { key },
      });
      if (existingType) {
        typeId = existingType.id;
      } else {
        // Extrai placeholders do corpo, header e urls para declarar as variáveis no tipo
        const usedNames = new Set([
          ...extractPlaceholders(parsed.body),
          ...(parsed.header?.text
            ? extractPlaceholders(parsed.header.text)
            : []),
          ...(parsed.buttons ?? []).flatMap((b) =>
            b.kind === 'URL' ? extractPlaceholders(b.url) : [],
          ),
        ]);

        const inferredVariables = [...usedNames].map((name) => ({
          name,
          type: 'STRING' as const,
          required: true,
        }));

        const newType = await this.prisma.messagingTemplateType.create({
          data: {
            key,
            name: remote.name.replace(/_/g, ' '),
            variables: inferredVariables as never,
            buttons: [],
          },
        });
        typeId = newType.id;
      }
    }

    // 2. Cria ou atualiza o MessagingTemplate local
    let template = await this.prisma.messagingTemplate.findUnique({
      where: { key_language: { key, language } },
    });

    if (!template) {
      template = await this.prisma.messagingTemplate.create({
        data: {
          key,
          language,
          typeId,
          category: (remote.category ?? 'UTILITY') as never,
          header: (parsed.header ?? null) as never,
          body: parsed.body,
          footer: parsed.footer ?? null,
          buttons: (parsed.buttons ?? null) as never,
        },
      });
    }

    // 3. Cria ou atualiza a submissão vinculando o template à conexão
    const submission = await this.prisma.messagingTemplateSubmission.upsert({
      where: {
        templateId_connectionId: {
          templateId: template.id,
          connectionId,
        },
      },
      create: {
        templateId: template.id,
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

    this.events.emit({ type: 'templates' });

    return {
      templateId: template.id,
      templateKey: template.key,
      submissionId: submission.id,
      status: submission.status,
    };
  }
}
