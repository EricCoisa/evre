import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RedisService } from 'src/common/infrastructure/redis/redis.service';

const PDF_HEALTH_KEY = 'pdf:health';
const PDF_HEALTH_TTL = 300;

export interface PdfGenerateOptions {
  orientation?: 'portrait' | 'landscape';
  format?: 'A4' | 'A3' | 'Letter';
  marginTop?: string;
  marginBottom?: string;
  marginLeft?: string;
  marginRight?: string;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly baseUrl =
    process.env.PDF_SERVICE_URL ?? 'http://gotenberg:3000';

  constructor(private readonly redis: RedisService) {}

  async generate(html: string, options?: PdfGenerateOptions): Promise<Buffer> {
    const form = new FormData();
    form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');

    if (options?.orientation === 'landscape') {
      form.append('landscape', 'true');
      form.append('paperWidth', '11.69');
      form.append('paperHeight', '8.27');
    }
    if (options?.marginTop) form.append('marginTop', options.marginTop);
    if (options?.marginBottom)
      form.append('marginBottom', options.marginBottom);
    if (options?.marginLeft) form.append('marginLeft', options.marginLeft);
    if (options?.marginRight) form.append('marginRight', options.marginRight);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/forms/chromium/convert/html`, {
        method: 'POST',
        body: form,
      });
    } catch (err) {
      this.logger.error(`Gotenberg unreachable: ${String(err)}`);
      throw new ServiceUnavailableException('PDF service unavailable');
    }

    if (!response.ok) {
      this.logger.error(`Gotenberg error ${response.status}`);
      throw new ServiceUnavailableException('PDF service returned an error');
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async checkHealth(): Promise<{ operational: boolean; reason?: string }> {
    const cached = await this.redis.get(PDF_HEALTH_KEY);
    if (cached !== null) {
      return JSON.parse(cached) as { operational: boolean; reason?: string };
    }

    let result: { operational: boolean; reason?: string };
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      const body = (await res.json()) as { status?: string };
      result =
        res.ok && body.status === 'up'
          ? { operational: true }
          : { operational: false, reason: `status ${res.status}` };
    } catch (err) {
      result = { operational: false, reason: String(err) };
    }

    await this.redis.set(
      PDF_HEALTH_KEY,
      JSON.stringify(result),
      PDF_HEALTH_TTL,
    );
    return result;
  }

  async invalidateHealthCache(): Promise<void> {
    await this.redis.del(PDF_HEALTH_KEY);
  }
}
