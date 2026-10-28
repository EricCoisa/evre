import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateConversationDto } from '../dto/create-conversation.dto';

@Injectable()
export class CreateConversationUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateConversationDto, userId: string): Promise<string> {
    const conversation = await this.prisma.aiConversation.create({
      data: {
        userId,
        title: dto.title,
      },
    });

    return conversation.id;
  }
}
