import { Injectable, Logger } from '@nestjs/common';
import type {
  IAiService,
  IAiProvider,
} from 'src/domain/interface/ai-provider.interface';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import type { OpenAiCompatibleConfigDto } from '../dto/openai-compatible-config.dto';

// Neutraliza headers do SDK (User-Agent + X-Stainless-*) que WAFs/Cloudflare
// bloqueiam com 403 — mesma razão pelo qual _validate usa fetch direto.
export const WAF_BYPASS_HEADERS: Record<string, string | null> = {
  'User-Agent': 'node-fetch/1.0',
  'X-Stainless-Lang': null,
  'X-Stainless-Package-Version': null,
  'X-Stainless-Runtime': null,
  'X-Stainless-Runtime-Version': null,
  'X-Stainless-Arch': null,
  'X-Stainless-OS': null,
};

@Injectable()
export class OpenAiCompatibleProvider implements IAiService<OpenAiCompatibleConfigDto> {
  private readonly logger = new Logger(OpenAiCompatibleProvider.name);

  use(cfg: OpenAiCompatibleConfigDto): IAiProvider {
    // Só o prefixo da chave: identifica qual, sem expor.
    this.logger.log(
      `[OpenAI Compatible] baseURL=${cfg.baseUrl} model=${cfg.model} ` +
        `apiKey=${cfg.apiKey ? `${cfg.apiKey.slice(0, 8)}…` : '(ausente)'}`,
    );

    return {
      validateConfiguration: () =>
        this._validate(cfg.model, cfg.baseUrl, cfg.apiKey),
      listModels: () => this._listModels(cfg.baseUrl, cfg.apiKey),
    };
  }

  // Fetch direto para evitar User-Agent do SDK ser bloqueado por WAF/Cloudflare
  private async _validate(
    model: string,
    baseUrl: string,
    apiKey: string,
  ): Promise<ProviderResult> {
    this.logger.log(
      `[OpenAI Compatible] Validating via fetch (bypass SDK User-Agent): ${baseUrl}`,
    );

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey || 'not-needed'}`,
    };

    // Tenta GET /models primeiro
    try {
      this.logger.log(`[OpenAI Compatible] Trying GET ${baseUrl}/models`);
      const res = await fetch(`${baseUrl}/models`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      this.logger.log(`[OpenAI Compatible] GET /models → ${res.status}`);
      if (res.ok) {
        return { status: true, data: 'API key valid' };
      }
      if (res.status === 401) {
        return { status: false, data: `401 Unauthorized` };
      }
      // 403/404 no /models é comum em gateways — tenta chat
    } catch (err) {
      this.logger.warn(`[OpenAI Compatible] GET /models error: ${err}`);
    }

    // Fallback: POST /chat/completions
    try {
      this.logger.log(
        `[OpenAI Compatible] Trying POST ${baseUrl}/chat/completions (model: ${model})`,
      );
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: AbortSignal.timeout(8000),
      });
      this.logger.log(
        `[OpenAI Compatible] POST /chat/completions → ${res.status}`,
      );

      // 200/400/422 = endpoint responde (chave aceita, erro é do modelo/payload)
      if (res.status === 200 || res.status === 400 || res.status === 422) {
        return { status: true, data: `endpoint reachable (${res.status})` };
      }

      if (res.status === 401) {
        return { status: false, data: `401 Unauthorized` };
      }

      const errorMsg = await this._readErrorMessage(res);
      this.logger.error(
        `[OpenAI Compatible] ✗ Validation failed: ${res.status} ${errorMsg}`,
      );
      return { status: false, data: `${res.status} ${errorMsg}` };
    } catch (error) {
      const errorMsg = (error as Error)?.message ?? String(error);
      this.logger.error(
        `[OpenAI Compatible] ✗ Network error: ${errorMsg}`,
        error,
      );
      return { status: false, data: errorMsg };
    }
  }

  // Extrai mensagem legível da resposta — evita devolver HTML bruto ao usuário
  private async _readErrorMessage(res: Response): Promise<string> {
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('text/html')) {
      return 'Endpoint retornou HTML (URL incorreta ou não é uma API OpenAI-compatível)';
    }
    try {
      const json = (await res.json()) as {
        error?: { message?: string };
        message?: string;
      };
      return json?.error?.message ?? json?.message ?? res.statusText;
    } catch {
      const text = await res.text();
      // Trunca respostas longas (ex: páginas HTML que escaparam do check acima)
      return text.length > 200
        ? `${text.slice(0, 200)}…`
        : text || res.statusText;
    }
  }

  private async _listModels(
    baseUrl: string,
    apiKey: string,
  ): Promise<string[]> {
    try {
      const res = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey || 'not-needed'}` },
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { data?: Array<{ id: string }> };
      return (json.data ?? []).map((m) => m.id).sort();
    } catch {
      return [];
    }
  }
}
