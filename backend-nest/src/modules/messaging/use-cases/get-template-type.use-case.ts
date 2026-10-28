import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GetTemplateTypeUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string) {
    const row = await this.prisma.messagingTemplateType.findUnique({
      where: { id },
      include: { _count: { select: { templates: true } } },
    });
    if (!row) {
      throw new NotFoundException(`tipo de template ${id} não encontrado`);
    }
    const { _count, ...type } = row;
    return { ...type, templatesCount: _count.templates };
  }
}
