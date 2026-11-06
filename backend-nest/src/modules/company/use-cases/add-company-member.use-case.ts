import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class AddCompanyMemberUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(
    companyId: string,
    dto: {
      userId: string;
      canSeeCommercials?: boolean;
      canComment?: boolean;
    },
  ) {
    const [company, user] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      }),
      this.prisma.user.findUnique({
        where: { id: dto.userId },
        select: { id: true, email: true, name: true },
      }),
    ]);
    if (!company) {
      throw new NotFoundException(this.i18n.t('company.not_found'));
    }
    if (!user) {
      throw new NotFoundException(this.i18n.t('company.member_user_not_found'));
    }

    const existing = await this.prisma.membership.findFirst({
      where: { userId: dto.userId, companyId },
    });
    if (existing) {
      throw new ConflictException(this.i18n.t('company.member_already_exists'));
    }

    return this.prisma.membership.create({
      data: {
        userId: dto.userId,
        companyId,
        canSeeCommercials: dto.canSeeCommercials ?? false,
        canComment: dto.canComment ?? false,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            imageUrl: true,
            roleRecord: { select: { name: true } },
          },
        },
      },
    });
  }
}
