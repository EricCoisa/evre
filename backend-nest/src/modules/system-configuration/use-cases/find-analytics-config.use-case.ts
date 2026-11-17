import { Injectable } from '@nestjs/common';
import { FindSystemConfigByLabelKeyUseCase } from './find-by-label-key.use-case';
import { AnalyticsConfigDto } from '../dto/analytics-config.dto';

const GA4_ID_PATTERN = /^G-[A-Z0-9]+$/;
const CLARITY_ID_PATTERN = /^[a-z0-9]+$/i;

const sanitizeId = (value: unknown, pattern: RegExp): string => {
  const id = typeof value === 'string' ? value.trim() : '';
  return pattern.test(id) ? id : '';
};

@Injectable()
export class FindAnalyticsConfigUseCase {
  constructor(
    private readonly findByLabelKey: FindSystemConfigByLabelKeyUseCase,
  ) {}

  async execute(): Promise<AnalyticsConfigDto> {
    const [ga4, clarity] = await Promise.all([
      this.findByLabelKey.execute('SYSTEM_ANALYTICS_GA4_ID'),
      this.findByLabelKey.execute('SYSTEM_ANALYTICS_CLARITY_ID'),
    ]);
    return {
      ga4Id: sanitizeId(ga4.value, GA4_ID_PATTERN),
      clarityId: sanitizeId(clarity.value, CLARITY_ID_PATTERN),
    };
  }
}
