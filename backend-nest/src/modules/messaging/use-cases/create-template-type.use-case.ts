import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { CreateMessagingTemplateTypeDto } from '../dto/messaging-template-type.dto';

@Injectable()
export class CreateTemplateTypeUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateMessagingTemplateTypeDto) {
    const existing = await this.prisma.messagingTemplateType.findUnique({
      where: { key: dto.key },
    });
    if (existing) {
      throw new ConflictException(`tipo de template ${dto.key} já existe`);
    }

    return this.prisma.messagingTemplateType.create({
      data: {
        key: dto.key,
        name: dto.name,
        variables: dto.variables as never,
        buttons: dto.buttons as never,
      },
    });
  }
}
