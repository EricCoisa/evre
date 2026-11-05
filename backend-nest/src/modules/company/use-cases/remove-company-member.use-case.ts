import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class RemoveCompanyMemberUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(companyId: string, membershipId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, companyId },
    });
    if (!membership) {
      throw new NotFoundException(this.i18n.t('company.member_not_found'));
    }
    await this.prisma.membership.delete({ where: { id: membershipId } });
  }
}
