import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import { SystemConfigurationService } from '../system-configuration/system-configuration.service';
import {
  CaptchaProviderIds,
  CaptchaProviders,
  captchaConfigKeys,
  type CaptchaProviderId,
} from '../../domain/auth/captcha.const';

/** Resposta do siteverify — idêntica nos três providers. */
interface SiteVerifyResponse {
  success?: boolean;
  score?: number;
  'error-codes'?: string[];
}

export type CaptchaFailure =
  'missing_token' | 'rejected' | 'low_score' | 'unavailable';

export interface CaptchaResult {
  ok: boolean;
  reason?: CaptchaFailure;
}

/** O que o front precisa para desenhar o widget. Nada aqui é segredo. */
export interface CaptchaPublicConfig {
  enabled: boolean;
  provider: CaptchaProviderId | null;
  siteKey: string | null;
  scriptUrl: string | null;
}

/** Timeout do siteverify: um provider pendurado não pode pendurar o login. */
const VERIFY_TIMEOUT_MS = 5000;

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);

  constructor(private readonly systemConfig: SystemConfigurationService) {}

  /** Retorna a configuração ativa do captcha, ou null quando está desligado ou incompleto. */
  private async activeConfig() {
    const [enabled, providerId, siteKey, secretKey] = await Promise.all([
      this.read(captchaConfigKeys.enabled),
      this.read(captchaConfigKeys.provider),
      this.read(captchaConfigKeys.siteKey),
      this.read(captchaConfigKeys.secretKey),
    ]);

    if (enabled !== true && enabled !== 'true') return null;

    const provider = CaptchaProviders[providerId as CaptchaProviderId];
    if (!provider || !siteKey || !secretKey) {
      throw new ServiceUnavailableException(
        'Captcha is enabled but its provider credentials are incomplete',
      );
    }

    return {
      id: providerId as CaptchaProviderId,
      provider,
      siteKey: siteKey as string,
      secretKey: secretKey as string,
    };
  }

  /** `findByLabelKey` estoura 404 se a chave não existe — aqui isso é "desligado". */
  private async read(key: string): Promise<unknown> {
    try {
      return (await this.systemConfig.findByLabelKey(key))?.value;
    } catch (error) {
      if (error instanceof NotFoundException) return undefined;
      throw error;
    }
  }

  async publicConfig(): Promise<CaptchaPublicConfig> {
    let active: Awaited<ReturnType<CaptchaService['activeConfig']>>;
    try {
      active = await this.activeConfig();
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) throw error;
      return { enabled: true, provider: null, siteKey: null, scriptUrl: null };
    }
    if (!active) {
      return { enabled: false, provider: null, siteKey: null, scriptUrl: null };
    }

    return {
      enabled: true,
      provider: active.id,
      siteKey: active.siteKey,
      // v3 quer o site key embutido na URL do script; os outros dois ignoram.
      scriptUrl:
        active.id === 'RECAPTCHA_V3'
          ? `${active.provider.scriptUrl}${encodeURIComponent(active.siteKey)}`
          : active.provider.scriptUrl,
    };
  }

  /** Verifica o token de captcha contra o provider configurado. */
  async verify(
    token: string | undefined,
    remoteIp?: string,
  ): Promise<CaptchaResult> {
    const active = await this.activeConfig();
    if (!active) return { ok: true };

    if (!token) return { ok: false, reason: 'missing_token' };

    let data: SiteVerifyResponse;
    try {
      data = await this.siteVerify(
        active.provider.verifyUrl,
        active.secretKey,
        token,
        remoteIp,
      );
    } catch (err) {
      // O fluxo protegido não pode prosseguir sem validar o desafio.
      this.logger.warn(
        `Captcha ${active.id} indisponível — request bloqueada: ${String(
          (err as Error)?.message ?? err,
        )}`,
      );
      return { ok: false, reason: 'unavailable' };
    }

    if (!data.success) {
      this.logger.warn(
        `Captcha ${active.id} recusou o token: ${(data['error-codes'] ?? []).join(', ') || 'sem detalhe'}`,
      );
      return { ok: false, reason: 'rejected' };
    }

    // Só a v3 devolve score; nos outros providers `minScore` não existe.
    const minScore =
      'minScore' in active.provider ? active.provider.minScore : undefined;

    if (typeof minScore === 'number' && typeof data.score === 'number') {
      if (data.score < minScore) {
        this.logger.warn(
          `Captcha ${active.id} reprovou por score ${data.score} < ${minScore}`,
        );
        return { ok: false, reason: 'low_score' };
      }
    }

    return { ok: true };
  }

  /** Retorna o catálogo dos providers de captcha registrados, para a tela de configuração. */
  listProviders() {
    return CaptchaProviderIds.map((id) => ({
      id,
      label: CaptchaProviders[id].label,
      scriptUrl: CaptchaProviders[id].scriptUrl,
    }));
  }

  /** O POST do siteverify. Idêntico nos três providers — só muda a URL. */
  private async siteVerify(
    verifyUrl: string,
    secret: string,
    token: string,
    remoteIp?: string,
  ): Promise<SiteVerifyResponse> {
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Captcha siteverify returned HTTP ${response.status}`);
    }
    return (await response.json()) as SiteVerifyResponse;
  }

  /** Valida as credenciais do captcha no provider antes de gravar. */
  async validateConfiguration(input: {
    provider: CaptchaProviderId;
    secretKey: string;
    token?: string;
  }): Promise<ProviderResult> {
    const provider = CaptchaProviders[input.provider];
    if (!provider) {
      return {
        status: false,
        data: `Provider desconhecido: ${input.provider}`,
      };
    }

    let data: SiteVerifyResponse;
    try {
      data = await this.siteVerify(
        provider.verifyUrl,
        input.secretKey,
        // Sem token do browser a sonda ainda distingue secret boa de secret ruim;
        // o que ela não consegue é provar que as duas chaves são do mesmo site.
        input.token ?? 'credential-probe-no-token',
      );
    } catch (err) {
      // Diferente do `verify()`, aqui NÃO falha aberto: gravar credencial que
      // ninguém conseguiu conferir é pior do que pedir para o admin repetir.
      return {
        status: false,
        data: `Não foi possível falar com ${provider.label}: ${String(
          (err as Error)?.message ?? err,
        )}`,
      };
    }

    if (data.success) return { status: true, data: 'Credenciais válidas' };

    const errors = data['error-codes'] ?? [];

    if (errors.some((code) => code.includes('secret'))) {
      return { status: false, data: 'Secret key inválida para este provider' };
    }

    // Token real recusado com a secret aceita = as duas chaves não são do mesmo
    // site. É o erro que o admin comete ao copiar as chaves de projetos diferentes.
    if (input.token) {
      return {
        status: false,
        data: 'Site key e secret key não pertencem ao mesmo site neste provider',
      };
    }

    // Sem token, recusa do token é o esperado: a secret passou pela autenticação.
    return {
      status: true,
      data: 'Secret key válida (par não verificado — sem token do browser)',
    };
  }
}
