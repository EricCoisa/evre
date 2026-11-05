import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { CryptoService } from 'src/common/infrastructure/crypto/crypto.service';

@Injectable()
export class GetInfoRequestValueUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly crypto: CryptoService,
  ) {}

  async execute(projectId: string, requestId: string) {
    const infoReq = await this.prisma.projectInfoRequest.findUnique({
      where: { id: requestId },
    });
    if (!infoReq || infoReq.projectId !== projectId) {
      throw new NotFoundException(
        this.i18n.t('project.info_request_not_found'),
      );
    }
    if (!infoReq.encryptedValue) {
      return { value: null };
    }
    return { value: this.crypto.decryptString(infoReq.encryptedValue) };
  }
}
