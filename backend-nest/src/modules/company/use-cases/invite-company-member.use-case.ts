import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { GenerateInviteUseCase } from '../../auth/use-cases/generate-invite.use-case';

@Injectable()
export class InviteCompanyMemberUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly generateInvite: GenerateInviteUseCase,
  ) {}

  async execute(
    companyId: string,
    dto: { email: string; name?: string | null },
    createdById: string,
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException(this.i18n.t('company.not_found'));
    }

    const email = dto.email.trim().toLowerCase();

    const existingMember = await this.prisma.membership.findFirst({
      where: {
        companyId,
        user: { email },
      },
      select: { id: true },
    });
    if (existingMember) {
      throw new ConflictException(this.i18n.t('company.member_already_exists'));
    }

    const userRole = await this.prisma.role.findFirst({
      where: { name: 'USER' },
      select: { id: true },
    });
    if (!userRole) {
      throw new NotFoundException('Role USER not found');
    }

    return this.generateInvite.execute({
      email,
      roleId: userRole.id,
      createdById,
      name: dto.name,
      companyId,
    });
  }
}
