import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  effectiveButtonSlots,
  slotUrl,
  type StoredTypeButton,
} from 'src/domain/messaging/messaging-buttons.const';
import type { TemplateButton } from 'src/domain/interface/messaging-provider.interface';
import {
  assertSlotKeysFreeOfVariables,
  type UpdateMessagingTemplateTypeDto,
} from '../dto/messaging-template-type.dto';
import { templateProblem } from '../providers/template-conformance.util';

@Injectable()
export class UpdateTemplateTypeUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string, dto: UpdateMessagingTemplateTypeDto) {
    const existing = await this.prisma.messagingTemplateType.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`tipo de template ${id} não encontrado`);
    }

    const nextButtons =
      dto.buttons ?? (existing.buttons as unknown as StoredTypeButton[]);
    const nextVariables =
      dto.variables ?? (existing.variables as unknown as { name: string }[]);

    // Variável e URL de botão dividem o `{{ nome }}`: a colisão é checada nas duas direções.
    const clash = assertSlotKeysFreeOfVariables(nextButtons, nextVariables);
    if (clash) throw new BadRequestException(clash);

    const updated = await this.prisma.messagingTemplateType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.variables !== undefined
          ? { variables: dto.variables as never }
          : {}),
        ...(dto.buttons !== undefined ? { buttons: dto.buttons as never } : {}),
      },
    });

    // Só variáveis e botões são o contrato dos templates; o nome do tipo não mexe em nada.
    if (dto.variables !== undefined || dto.buttons !== undefined) {
      await this.revalidateTemplates(id, {
        variables: nextVariables,
        buttons: nextButtons,
      });
    }
    return updated;
  }

  /** Reavalia cada template do tipo contra o contrato novo e reescreve a URL dos links do sistema. */
  private async revalidateTemplates(
    typeId: string,
    contract: { variables: unknown; buttons: unknown },
  ): Promise<void> {
    const slots = effectiveButtonSlots(contract.buttons as StoredTypeButton[]);
    const templates = await this.prisma.messagingTemplate.findMany({
      where: { typeId },
      select: {
        id: true,
        category: true,
        body: true,
        header: true,
        footer: true,
        buttons: true,
        invalidatedAt: true,
      },
    });

    for (const template of templates) {
      const current =
        (template.buttons as unknown as TemplateButton[] | null) ?? undefined;
      let rewritten = false;
      const buttons = current?.map((button) => {
        const slot = button.slot
          ? slots.find((s) => s.key === button.slot)
          : undefined;
        if (
          slot?.kind === 'URL' &&
          button.kind === 'URL' &&
          button.url !== slotUrl(slot)
        ) {
          rewritten = true;
          return { ...button, url: slotUrl(slot) };
        }
        return button;
      });

      const problem = templateProblem(contract, {
        category: template.category,
        body: template.body,
        header: template.header as never,
        footer: template.footer,
        buttons,
      });

      const becameInvalid = problem !== null && !template.invalidatedAt;
      const stillInvalid = problem !== null && !!template.invalidatedAt;
      const healed = problem === null && !!template.invalidatedAt;
      if (!rewritten && !becameInvalid && !healed && !stillInvalid) continue;

      await this.prisma.messagingTemplate.update({
        where: { id: template.id },
        data: {
          ...(rewritten ? { buttons: buttons as never } : {}),
          ...(problem !== null
            ? {
                // Mantém a data da primeira invalidação; só o motivo acompanha o contrato atual.
                invalidatedAt: template.invalidatedAt ?? new Date(),
                invalidReason: problem,
              }
            : { invalidatedAt: null, invalidReason: null }),
        },
      });
      if (rewritten) {
        await this.prisma.messagingTemplateSubmission.updateMany({
          where: { templateId: template.id },
          data: { outOfSync: true },
        });
      }
    }
  }
}
