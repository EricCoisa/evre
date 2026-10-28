import { Injectable, NotFoundException } from '@nestjs/common';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import {
  OAuthProviders,
  oauthConfigKeys,
} from '../../../domain/auth/oauthProvider.const';

export interface OAuthProviderConfig {
  id: string;
  label: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
}

/** O que sai pela API — nunca inclui credencial. */
export interface OAuthProviderSummary {
  id: string;
  label: string;
  configured: boolean;
  enabled: boolean;
}

/** Lê as chaves `SYSTEM_OAUTH_*` e resolve quais providers OAuth estão utilizáveis. */
@Injectable()
export class OauthProvidersUseCase {
  constructor(private readonly sysConfig: SystemConfigurationService) {}

  async list(): Promise<OAuthProviderSummary[]> {
    const configs = await Promise.all(
      OAuthProviders.map((provider) => this.read(provider.id)),
    );
    const enabledFlags = await Promise.all(
      OAuthProviders.map((provider) => this.isEnabled(provider.id)),
    );
    return OAuthProviders.map((provider, index) => ({
      id: provider.id,
      label: provider.label,
      configured: configs[index] !== null,
      enabled: enabledFlags[index],
    }));
  }

  async getConfiguredOrThrow(id: string): Promise<OAuthProviderConfig> {
    const config = await this.read(id);
    if (!config) {
      throw new NotFoundException(`Provider OAuth não configurado: ${id}`);
    }
    if (!(await this.isEnabled(id))) {
      throw new NotFoundException(`Provider OAuth desativado: ${id}`);
    }
    return config;
  }

  /** Chave ausente (banco sem o seed novo) = comportamento anterior: habilitado. */
  private async isEnabled(id: string): Promise<boolean> {
    try {
      const config = await this.sysConfig.findByLabelKey(
        oauthConfigKeys(id).enabled,
      );
      return config.value !== false;
    } catch {
      return true;
    }
  }

  private async read(id: string): Promise<OAuthProviderConfig | null> {
    const provider = OAuthProviders.find((p) => p.id === id);
    if (!provider) return null;

    const keys = oauthConfigKeys(provider.id);
    const [issuer, clientId, clientSecret] = await Promise.all([
      this.value(keys.issuer),
      this.value(keys.clientId),
      this.value(keys.clientSecret),
    ]);

    if (!issuer || !clientId || !clientSecret) return null;
    return {
      id: provider.id,
      label: provider.label,
      issuer,
      clientId,
      clientSecret,
    };
  }

  private async value(labelKey: string): Promise<string> {
    try {
      const config = await this.sysConfig.findByLabelKey(labelKey);
      return typeof config.value === 'string' ? config.value.trim() : '';
    } catch {
      // chave ausente (provider não semeado) conta como não configurado
      return '';
    }
  }
}
