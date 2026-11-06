import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type {
  TemplateButton,
  TemplateDefinition,
  TemplateHeader,
} from 'src/domain/interface/messaging-provider.interface';
import {
  RESERVED_LIST,
  effectiveVariables,
} from 'src/domain/messaging/messaging-variables.const';
import {
  buttonSlotVariables,
  effectiveButtonSlots,
  type StoredTypeButton,
} from 'src/domain/messaging/messaging-buttons.const';
import { MessagingConnectionService } from '../messaging-connection.service';
import type { SubmitTemplateDto } from '../dto/messaging-template-submission.dto';
import type { TemplateVariable } from '../dto/messaging-template-type.dto';
import { ProviderRequestError } from '../providers/provider-http.util';
import {
  checkMetaTemplateRules,
  metaErrors,
} from '../providers/meta-template-rules';
import {
  catalogName,
  extractPlaceholders,
  formatValues,
} from '../providers/template.util';
import { NotificationService } from 'src/modules/notification/notification.service';
import { notifyTemplateReviewed } from '../providers/template-notification.util';

/** Exemplo de cada reservada, pela própria declaração — o operador nunca digita o de first_name. */
const RESERVED_EXAMPLES = Object.fromEntries(
  RESERVED_LIST.map((v) => [v.name, v.example]),
);

/** Sufixo de exemplo enviado à Meta para links controlados pelo sistema. */
const URL_SUFFIX_EXAMPLE = 'abc123';

/** Cria ou edita o template na WABA. `name`/`key` são imutáveis por desenho do DTO — nada aqui os toca. */
@Injectable()
export class SubmitTemplateUseCase {
  private readonly logger = new Logger(SubmitTemplateUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: MessagingConnectionService,
    private readonly notifications: NotificationService,
  ) {}

  async execute(templateId: string, dto: SubmitTemplateDto) {
    const template = await this.prisma.messagingTemplate.findUnique({
      where: { id: templateId },
      include: { type: true },
    });
    if (!template) {
      throw new NotFoundException(`template ${templateId} não encontrado`);
    }

    if (template.invalidatedAt) {
      throw new BadRequestException(
        `template ${template.key} (${template.language}) requer ajuste antes de ser submetido: ${template.invalidReason ?? 'o tipo foi alterado'}`,
      );
    }

    const connectionId = dto.connectionId;
    const connection = await this.connections.getActive(connectionId);
    const provider = this.connections.use(connection);
    if (!provider.submitTemplate) {
      throw new BadRequestException(
        'esta conexão não tem fluxo de aprovação de templates',
      );
    }

    const header =
      (template.header as unknown as TemplateHeader | null) ?? undefined;
    const buttons =
      (template.buttons as unknown as TemplateButton[] | null) ?? undefined;
    // Só o que o texto realmente usa precisa de exemplo — variável do tipo que este template não cita
    // não deve travar a submissão. AUTHENTICATION tem corpo fixo da Meta: nada nosso é enviado.
    const used = new Set(
      template.category === 'AUTHENTICATION'
        ? []
        : [
            template.body,
            header?.kind === 'TEXT' ? header.text : undefined,
            template.footer,
            ...(buttons ?? []).map((b) =>
              b.kind === 'URL' ? b.url : undefined,
            ),
          ]
            .filter((text): text is string => !!text)
            .flatMap(extractPlaceholders),
    );
    // O sufixo de um link do sistema não é digitado pelo operador: a Meta pede um exemplo plausível.
    const slots = effectiveButtonSlots(
      template.type.buttons as unknown as StoredTypeButton[],
    ).filter((slot) => used.has(slot.key));
    const slotExamples = Object.fromEntries(
      slots
        .filter((s) => s.kind === 'URL')
        .map((s) => [s.key, URL_SUFFIX_EXAMPLE]),
    );
    // Regras que a Meta aplica na revisão e que dá para saber de antemão: barra aqui, com o motivo
    // de cada uma, em vez de gastar uma submissão (e esperar a reprovação) para descobrir.
    const blocking = metaErrors(
      checkMetaTemplateRules({
        category: template.category,
        body: template.body,
        header,
        footer: template.footer,
        buttons,
      }),
    );
    if (blocking.length > 0) {
      throw new BadRequestException(
        `O template não passa nas regras da Meta: ${blocking.map((i) => i.message).join(' ')}`,
      );
    }

    const effective = [
      ...effectiveVariables(
        template.type.variables as unknown as TemplateVariable[],
      ),
      ...buttonSlotVariables(slots),
    ].filter((variable) => used.has(variable.name));
    const examples = formatValues(effective, {
      ...slotExamples,
      ...dto.examples,
      ...RESERVED_EXAMPLES,
    });

    const existing = await this.prisma.messagingTemplateSubmission.findUnique({
      where: { templateId_connectionId: { templateId, connectionId } },
    });

    const definition: TemplateDefinition = {
      name: catalogName(template.key),
      language: template.language,
      category: template.category,
      header,
      body: template.body,
      footer: template.footer ?? undefined,
      buttons,
      examples,
    };

    let providerTemplateId: string;
    try {
      ({ providerTemplateId } = await provider.submitTemplate(
        definition,
        existing?.providerTemplateId ?? undefined,
      ));
    } catch (error) {
      throw this.toHttpError(error);
    }

    const submission = await this.prisma.messagingTemplateSubmission.upsert({
      where: { templateId_connectionId: { templateId, connectionId } },
      create: {
        templateId,
        connectionId,
        providerTemplateId,
        status: 'PENDING',
      },
      update: {
        providerTemplateId,
        status: 'PENDING',
        reason: null,
        reviewedAt: null,
        outOfSync: false,
        submittedAt: new Date(),
      },
    });

    return this.syncRemoteStatus(provider, submission, template.key);
  }

  /** Consulta o status remoto uma vez logo após gravar, para não perder decisão que a Meta avisa antes de a submissão existir. */
  private async syncRemoteStatus<
    T extends {
      id: string;
      providerTemplateId: string | null;
      status: string;
    },
  >(
    provider: ReturnType<MessagingConnectionService['use']>,
    submission: T,
    templateKey: string,
  ): Promise<T> {
    if (!provider.fetchTemplateStatuses) return submission;
    try {
      const remote = (await provider.fetchTemplateStatuses()).find(
        (r) => r.providerTemplateId === submission.providerTemplateId,
      );
      if (!remote || remote.status === 'PENDING') return submission;
      const updated = (await this.prisma.messagingTemplateSubmission.update({
        where: { id: submission.id },
        data: {
          status: remote.status,
          reason: remote.reason ?? null,
          reviewedAt: new Date(),
        },
      })) as unknown as T;
      await notifyTemplateReviewed(this.notifications, {
        status: remote.status,
        previousStatus: submission.status,
        templateKey,
        reason: remote.reason ?? null,
      });
      return updated;
    } catch (error) {
      this.logger.warn(
        `Sem status remoto logo após submeter: ${String(error)}`,
      );
      return submission;
    }
  }

  /** 4xx do provider é o operador corrigir (mensagem vai à tela); 5xx/rede é o provider fora do ar. */
  private toHttpError(error: unknown): Error {
    if (error instanceof ProviderRequestError) {
      return error.status >= 400 && error.status < 500
        ? new BadRequestException(`Recusado pelo provider: ${error.detail}`)
        : new BadGatewayException(`Provider indisponível: ${error.detail}`);
    }
    const reason = error instanceof Error ? error.message : String(error);
    return new BadGatewayException(`Falha ao falar com o provider: ${reason}`);
  }
}
