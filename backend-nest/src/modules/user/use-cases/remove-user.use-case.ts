import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class RemoveUserUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(id: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }

    // Exclusão pelo admin inativa e soft-deleta o usuário, sem anonimizar o email.
    await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({ where: { userId: id } }),
      this.prisma.user.update({
        where: { id },
        data: { status: 'INACTIVE', deletedAt: new Date() },
      }),
    ]);
  }
}
