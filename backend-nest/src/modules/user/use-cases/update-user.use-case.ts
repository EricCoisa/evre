import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserStatus, UserStatusConst } from 'src/domain/auth/userStatus.const';
import type { User } from 'src/domain/user/user.entity';
import { PayloadUserRepository } from '../../../modules/auth/adapters/payload-user.repository';

@Injectable()
export class UpdateUserUseCase {
  private readonly logger = new Logger(UpdateUserUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly payloadUserRepo: PayloadUserRepository,
  ) {}

  async execute(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }

    const updateData: {
      email?: string;
      name?: string | null;
      phone?: string;
      roleRecord?: { connect: { name: string } };
      status?: UserStatus;
    } = {};

    if (updateUserDto.role)
      updateData.roleRecord = { connect: { name: updateUserDto.role } };
    if (updateUserDto.status)
      updateData.status = updateUserDto.status as UserStatus;
    if (updateUserDto.phone) {
      updateData.phone = updateUserDto.phone;
    }

    if (
      updateUserDto.status &&
      updateUserDto.status !== user.status &&
      (updateUserDto.status === UserStatusConst.INACTIVE ||
        updateUserDto.status === UserStatusConst.SUSPENDED)
    ) {
      await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
      await this.revokePayloadCmsAccess(user.email);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        roleRecord: { select: { name: true } },
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const { roleRecord, ...rest } = updatedUser;
    return { ...rest, role: roleRecord?.name ?? '' };
  }

  /** Suspender apaga a conta do CMS; reativar não faz nada, o próximo acesso recria. ponytail: defesa caso a senha mestra vaze. */
  private async revokePayloadCmsAccess(email: string): Promise<void> {
    try {
      const payloadUser = await this.payloadUserRepo.findByEmail(email);
      if (payloadUser) await this.payloadUserRepo.delete(payloadUser.id);
    } catch (error) {
      // Suspenso aqui e ativo no CMS é divergência de autorização.
      this.logger.error(
        `Falha ao remover conta do CMS (email=${email})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
