import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { CreateMessagingTemplateDto } from '../dto/messaging-template.dto';
import { conformTemplateToType } from '../providers/template-conformance.util';

@Injectable()
export class CreateTemplateUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateMessagingTemplateDto) {
    const type = await this.prisma.messagingTemplateType.findUnique({
      where: { id: dto.typeId },
    });
    if (!type) {
      throw new NotFoundException(
        `tipo de template ${dto.typeId} não encontrado`,
      );
    }

    const existing = await this.prisma.messagingTemplate.findUnique({
      where: { key_language: { key: dto.key, language: dto.language } },
    });
    if (existing) {
      throw new ConflictException(
        `template ${dto.key} já existe no idioma ${dto.language}`,
      );
    }

    // Contrato do tipo (variáveis e botões) validado aqui, no servidor — o front só antecipa.
    const { buttons } = conformTemplateToType(type, dto);

    return this.prisma.messagingTemplate.create({
      data: {
        typeId: dto.typeId,
        key: dto.key,
        language: dto.language,
        category: dto.category as never,
        header: (dto.header ?? null) as never,
        body: dto.body,
        footer: dto.footer ?? null,
        buttons: (buttons ?? null) as never,
        bypassOptOut: dto.bypassOptOut ?? false,
      },
    });
  }
}
