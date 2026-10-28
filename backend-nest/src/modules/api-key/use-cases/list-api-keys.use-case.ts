import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ListApiKeysUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string, isAdmin: boolean) {
    return this.prisma.apiKey.findMany({
      where: isAdmin ? undefined : { userId },
      omit: { keyHash: true }, // nunca expor o hash
      include: isAdmin
        ? { user: { select: { id: true, email: true } } }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }
}
