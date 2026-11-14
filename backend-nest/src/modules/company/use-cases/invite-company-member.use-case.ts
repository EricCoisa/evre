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
    dto: { channel?: 'EMAIL' | 'WHATSAPP'; email?: string | null; phone?: string | null; name?: string | null },
    createdById: string,
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException(this.i18n.t('company.not_found'));
    }

    const channel = dto.channel ?? 'EMAIL';

    const userRole = await this.prisma.role.findFirst({
      where: { name: 'USER' },
      select: { id: true },
    });
    if (!userRole) {
      throw new NotFoundException('Role USER not found');
    }

    if (channel === 'WHATSAPP') {
      const phone = dto.phone?.trim();
      if (!phone) throw new ConflictException(this.i18n.t('company.phone_required'));

      const existingMember = await this.prisma.membership.findFirst({
        where: { companyId, user: { phone } },
        select: { id: true },
      });
      if (existingMember) {
        throw new ConflictException(this.i18n.t('company.member_already_exists'));
      }

      return this.generateInvite.execute({
        channel: 'WHATSAPP',
        phone,
        roleId: userRole.id,
        createdById,
        name: dto.name,
        companyId,
      });
    }

    const email = dto.email?.trim().toLowerCase();
    if (!email) throw new ConflictException(this.i18n.t('company.email_required'));

    const existingMember = await this.prisma.membership.findFirst({
      where: { companyId, user: { email } },
      select: { id: true },
    });
    if (existingMember) {
      throw new ConflictException(this.i18n.t('company.member_already_exists'));
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
