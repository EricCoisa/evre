import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CryptoService } from '../../../common/infrastructure/crypto/crypto.service';
import { NotificationService } from '../../notification/notification.service';
import { UserNotificationType } from 'src/domain/user/user-notification-types.const';

@Injectable()
export class UpdatePasswordUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly cryptoService: CryptoService,
    private readonly notifications: NotificationService,
  ) {}

  async execute(
    id: string,
    currentPassword: string,
    newPassword: string,
    confirmNewPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }

    const passwordOk = await this.cryptoService.verifyPassword(
      currentPassword,
      user.hash || '',
      user.salt || '',
    );
    if (!passwordOk) {
      throw new UnauthorizedException(
        this.i18n.t('user.current_password_invalid'),
      );
    }

    const isSame = await this.cryptoService.verifyPassword(
      newPassword,
      user.hash || '',
      user.salt || '',
    );
    if (isSame) {
      throw new BadRequestException(
        this.i18n.t('user.new_password_same_as_current'),
      );
    }

    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException(
        this.i18n.t('user.new_passwords_do_not_match'),
      );
    }

    const { hash, salt } =
      await this.cryptoService.generatePasswordHash(newPassword);
    await this.prisma.user.update({
      where: { id },
      data: { salt, hash },
    });

    await this.notifications.notify({
      type: UserNotificationType.PASSWORD_CHANGED,
      recipients: { userIds: [id] },
      // titleKey/messageKey: resolvidos de novo a cada leitura, no idioma de quem lê (ver
      // docs/backend/notifications.md) — title/message aqui só alimentam o e-mail (que precisa de
      // texto já resolvido) e servem de defaultValue se a key não resolver por algum motivo.
      titleKey: 'user.password_changed_title',
      title: this.i18n.t('user.password_changed_title'),
      messageKey: 'user.password_changed_message',
      message: this.i18n.t('user.password_changed_message'),
      channels: { email: true },
    });
  }
}
