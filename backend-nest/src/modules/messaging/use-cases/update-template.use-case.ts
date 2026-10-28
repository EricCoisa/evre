import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { UpdateMessagingTemplateDto } from '../dto/messaging-template.dto';
import { conformTemplateToType } from '../providers/template-conformance.util';

@Injectable()
export class UpdateTemplateUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string, dto: UpdateMessagingTemplateDto) {
    const existing = await this.prisma.messagingTemplate.findUnique({
      where: { id },
      include: { type: true },
    });
    if (!existing) {
      throw new NotFoundException(`template ${id} não encontrado`);
    }

    // Botões do tipo só são exigidos quando vêm no pedido (ou o template está inválido e precisa ser
    // ajustado): template antigo continua editável em outros campos.
    const enforce = dto.buttons !== undefined || !!existing.invalidatedAt;
    const { buttons } = conformTemplateToType(
      existing.type,
      {
        category: dto.category ?? existing.category,
        body: dto.body ?? existing.body,
        header: (dto.header !== undefined
          ? dto.header
          : existing.header) as never,
        footer: dto.footer !== undefined ? dto.footer : existing.footer,
        buttons: dto.buttons !== undefined ? dto.buttons : existing.buttons,
      },
      { slots: enforce ? 'enforce' : 'skip' },
    );
    const merged = {
      body: dto.body ?? existing.body,
      header: dto.header !== undefined ? dto.header : existing.header,
      footer: dto.footer !== undefined ? dto.footer : existing.footer,
      buttons: buttons ?? null,
    };

    const updated = await this.prisma.messagingTemplate.update({
      where: { id },
      data: {
        ...(dto.category !== undefined
          ? { category: dto.category as never }
          : {}),
        body: merged.body,
        header: (merged.header ?? null) as never,
        footer: merged.footer ?? null,
        buttons: (merged.buttons ?? null) as never,
        ...(dto.bypassOptOut !== undefined
          ? { bypassOptOut: dto.bypassOptOut }
          : {}),
        // Passou pelo contrato do tipo: deixa de estar "requer ajuste".
        ...(enforce ? { invalidatedAt: null, invalidReason: null } : {}),
        // "Ciente" do alerta de reclassificação pela Meta.
        ...(dto.acknowledgeCategoryChange
          ? { previousCategory: null, categoryChangedAt: null }
          : {}),
      },
    });

    // Editar aqui NÃO altera a Meta: lá segue a versão anterior, com o status real dela. Só marca
    // que há diferença; sincronizar (reenviar para revisão) é decisão do operador, confirmada na tela.
    const contentChanged =
      dto.category !== undefined ||
      dto.body !== undefined ||
      dto.header !== undefined ||
      dto.footer !== undefined ||
      dto.buttons !== undefined;
    if (contentChanged) {
      await this.prisma.messagingTemplateSubmission.updateMany({
        where: { templateId: id },
        data: { outOfSync: true },
      });
    }

    return updated;
  }
}
