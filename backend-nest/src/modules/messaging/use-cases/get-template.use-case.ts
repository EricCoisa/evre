import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GetTemplateUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string) {
    const template = await this.prisma.messagingTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException(`template ${id} não encontrado`);
    }
    return template;
  }
}
