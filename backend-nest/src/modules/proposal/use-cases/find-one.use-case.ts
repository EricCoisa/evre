import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { Proposal } from 'src/domain/proposal/proposal.entity';

@Injectable()
export class FindOneProposalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly resourceAccess: ResourceAccessService,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<Proposal> {
    const found = await this.prisma.proposal.findUnique({
      where: { id },
    });

    if (!found) {
      throw new NotFoundException(this.i18n.t('proposal.not_found'));
    }

    await this.resourceAccess.assertCanRead(user, {
      companyId: found.companyId,
    });

    return found as unknown as Proposal;
  }
}
