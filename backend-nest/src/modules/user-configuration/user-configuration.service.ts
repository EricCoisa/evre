import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { convertValueByType } from 'src/common/utils/conversor.util';
import { CryptoService } from '../../common/infrastructure/crypto/crypto.service';
import { SetUserConfigurationUseCase } from './use-cases/set-user-configuration.use-case';

/** Métodos de configuração de usuário com chamador interno (módulo de IA / BYOK). */
@Injectable()
export class UserConfigurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly cryptoService: CryptoService,
    private readonly setUserConfiguration: SetUserConfigurationUseCase,
  ) {}

  /** Mantém o valor já gravado quando o campo secreto vem vazio do formulário. */
  async keepStoredWhenBlank(
    userId: string,
    value: string | undefined | null,
    labelKey: string,
  ): Promise<string> {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
    const stored = (await this.getDecryptedValueForUser(userId, labelKey)) as
      string | null;
    return stored ?? '';
  }

  /** Grava várias chaves de configuração do usuário de uma vez, sequencialmente. */
  async setManyByLabelKey(
    userId: string,
    entries: Array<{ labelKey: string; value: string }>,
    performedById?: string,
  ): Promise<void> {
    for (const entry of entries) {
      const definition =
        await this.prisma.userConfigurationDefinition.findFirst({
          where: { labelKey: entry.labelKey },
        });
      if (!definition) {
        throw new NotFoundException(
          this.i18n.t('user_configuration.definition_not_found'),
        );
      }
      await this.setUserConfiguration.execute(
        userId,
        { definitionId: definition.id, value: entry.value },
        performedById,
      );
    }
  }

  /** Retorna o valor descriptografado de uma configuração do usuário, ou null se não personalizada. */
  async getDecryptedValueForUser(
    userId: string,
    labelKey: string,
  ): Promise<unknown> {
    const definition = await this.prisma.userConfigurationDefinition.findFirst({
      where: { labelKey },
    });
    if (!definition) return null;

    const userConfig = await this.prisma.userConfiguration.findFirst({
      where: { userId, definitionId: definition.id },
    });

    if (!userConfig) return null;

    const rawValue = definition.secret
      ? this.cryptoService.tryDecrypt(userConfig.value)
      : userConfig.value;

    return convertValueByType(rawValue, definition.valueType) ?? rawValue;
  }
}
