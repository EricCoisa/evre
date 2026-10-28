import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ConflictException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/auth.types';

interface RequestWithUser {
  body: Record<string, unknown>;
  user: AuthenticatedUser;
}

/** Garante que phone (único no banco) ainda está livre, usado pelo guard e por UpdateProfileUseCase. */
export async function assertPhoneAvailable(
  prisma: PrismaService,
  i18n: I18nService,
  phone: string,
  userId: string,
): Promise<void> {
  const owner = await prisma.user.findUnique({ where: { phone } });
  if (owner && owner.id !== userId) {
    throw new ConflictException(i18n.t('user.phone_invalid'));
  }
}

/** Rejeita telefone já usado por outro usuário antes de gastar o ciclo de verificação. */
@Injectable()
export class PhoneAvailabilityGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const phone = request.body?.phone;
    if (typeof phone !== 'string' || phone.length === 0) return true;

    await assertPhoneAvailable(this.prisma, this.i18n, phone, request.user.id);
    return true;
  }
}
