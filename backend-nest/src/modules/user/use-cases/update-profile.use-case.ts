import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { UpdateProfileDto } from '../dto/update-user.dto';
import type { UserDto } from '../dto/user.dto';
import { StorageService } from '../../storage/storage.service';
import { assertPhoneAvailable } from '../phone-availability.guard';

// Magic-number MIME check — covers jpeg/png/webp, add more if needed
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class UpdateProfileUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly storageService: StorageService,
  ) {}

  async execute(
    id: string,
    data: UpdateProfileDto & { contentType?: string },
  ): Promise<UserDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }

    if (data.phone && data.phone !== user.phone) {
      // Mesma checagem do PhoneAvailabilityGuard (que já rejeitou antes do ciclo de verificação
      // começar) — repetida aqui como defesa contra corrida entre as duas chamadas.
      await assertPhoneAvailable(this.prisma, this.i18n, data.phone, id);
    }

    let imageUrl: string | null | undefined = undefined;

    if (data.image != null) {
      if (!(data.image instanceof Buffer || data.image instanceof Uint8Array)) {
        throw new BadRequestException(this.i18n.t('user.image_invalid'));
      }
      if (data.image.length === 0) {
        throw new BadRequestException(this.i18n.t('user.image_invalid'));
      }
      const maxSize = 5 * 1024 * 1024;
      if (data.image.length > maxSize) {
        throw new BadRequestException(this.i18n.t('user.image_too_large'));
      }

      const contentType = data.contentType ?? 'image/jpeg';
      const ext = MIME_TO_EXT[contentType];
      if (!ext) {
        throw new BadRequestException(this.i18n.t('user.image_invalid'));
      }

      if (user.imageUrl) {
        const oldKey = await this.storageService.resolveKeyFromUrl(
          user.imageUrl,
        );
        if (oldKey?.startsWith('avatars/')) {
          await this.storageService.delete(oldKey);
        }
      }

      const key = this.storageService.buildKey('avatars', ext);
      await this.storageService.upload(
        key,
        Buffer.from(data.image),
        contentType,
      );
      imageUrl = await this.storageService.getPublicUrl(key);
    } else if (data.image === null) {
      imageUrl = null;
    }

    // `VerificationGuard` (ver @RequireVerification na rota) já bloqueou a requisição se `phone`
    // mudou sem um código confirmado para o valor exato — chegando aqui, já está provado. Esta
    // use-case não precisa espelhar nada: "confirmado" só existe dentro do VerificationModule.
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        name: data.name ?? user.name,
        phone: data.phone ?? user.phone,
        ...(imageUrl !== undefined ? { imageUrl } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        roleRecord: { select: { name: true } },
        status: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const { roleRecord, ...rest } = updatedUser;
    return { ...rest, role: roleRecord?.name ?? '' };
  }
}
