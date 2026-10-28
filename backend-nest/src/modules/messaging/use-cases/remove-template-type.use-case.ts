import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

/** Quantos nomes de template cabem na mensagem antes de virar "e mais N". */
const LISTED = 5;

@Injectable()
export class RemoveTemplateTypeUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string) {
    const existing = await this.prisma.messagingTemplateType.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`tipo de template ${id} não encontrado`);
    }

    if (existing.isSystem) {
      throw new BadRequestException(
        'Tipos de template do sistema não podem ser removidos.',
      );
    }

    // O banco também recusa (FK Restrict), mas como erro de integridade genérico: o motivo é este.
    const inUse = await this.prisma.messagingTemplate.findMany({
      where: { typeId: id },
      select: { key: true, language: true },
      orderBy: [{ key: 'asc' }, { language: 'asc' }],
    });
    if (inUse.length > 0) {
      const names = inUse
        .slice(0, LISTED)
        .map((t) => `${t.key} (${t.language})`);
      const rest = inUse.length - names.length;
      throw new ConflictException(
        `tipo "${existing.key}" está em uso por ${inUse.length} template(s): ${names.join(', ')}${rest > 0 ? ` e mais ${rest}` : ''}. Remova ou mude o tipo desses templates antes.`,
      );
    }

    await this.prisma.messagingTemplateType.delete({ where: { id } });
    return { status: true, message: 'tipo de template removido' };
  }
}
