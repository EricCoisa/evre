import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class UpdateCompanyMemberUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(
    companyId: string,
    membershipId: string,
    dto: { canSeeCommercials?: boolean; canComment?: boolean },
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, companyId },
    });
    if (!membership) {
      throw new NotFoundException(this.i18n.t('company.member_not_found'));
    }

    return this.prisma.membership.update({
      where: { id: membershipId },
      data: {
        ...(dto.canSeeCommercials !== undefined && {
          canSeeCommercials: dto.canSeeCommercials,
        }),
        ...(dto.canComment !== undefined && { canComment: dto.canComment }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            status: true,
            imageUrl: true,
            roleRecord: { select: { name: true } },
          },
        },
      },
    });
  }
}
