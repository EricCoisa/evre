import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertProviderOk } from 'src/common/utils/provider-result.util';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { OidcDiscoveryService } from '../oidc-discovery.service';
import { OAuthProviderService } from '../oauth-provider.service';
import {
  OAuthProviders,
  oauthConfigKeys,
} from '../../../domain/auth/oauthProvider.const';
import type { SaveOauthConfigDto } from '../dto/oauth.dto';

/** Valida as credenciais de um provider OAuth (issuer via OIDC Discovery, depois clientId/clientSecret) e só então grava. */
@Injectable()
export class SaveOauthConfigUseCase {
  constructor(
    private readonly sysConfig: SystemConfigurationService,
    private readonly discovery: OidcDiscoveryService,
    private readonly oauthProvider: OAuthProviderService,
  ) {}

  async execute(
    providerId: string,
    dto: SaveOauthConfigDto,
    performedById: string,
  ) {
    const provider = OAuthProviders.find((p) => p.id === providerId);
    if (!provider) {
      throw new NotFoundException(`Provider OAuth desconhecido: ${providerId}`);
    }

    const keys = oauthConfigKeys(provider.id);

    // Segredo em branco = manter o gravado (o GET devolve `****`, nunca o valor).
    const clientSecret = await this.sysConfig.keepStoredWhenBlank(
      dto.clientSecret,
      keys.clientSecret,
    );
    if (!clientSecret) {
      throw new BadRequestException('clientSecret é obrigatório');
    }

    // Deixa o erro do discovery subir — é a mensagem que o admin precisa ler para corrigir o campo.
    const { tokenEndpoint } = await this.discovery.discover(dto.issuer);

    assertProviderOk(
      await this.oauthProvider
        .use({ tokenEndpoint, clientId: dto.clientId, clientSecret })
        .validateConfiguration(),
    );

    await this.sysConfig.setManyByLabelKey(
      [
        { labelKey: keys.issuer, value: dto.issuer },
        { labelKey: keys.clientId, value: dto.clientId },
        { labelKey: keys.clientSecret, value: clientSecret, secret: true },
      ],
      performedById,
    );

    return { status: true, data: 'Configuração salva' };
  }
}
