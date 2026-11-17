import { FindAnalyticsConfigUseCase } from './find-analytics-config.use-case';

const stored: Record<string, unknown> = {};
const findByLabelKey = {
  execute: vi.fn((key: string) => Promise.resolve({ value: stored[key] })),
};
const useCase = new FindAnalyticsConfigUseCase(findByLabelKey as never);

describe('FindAnalyticsConfigUseCase', () => {
  it('devolve os IDs válidos', async () => {
    stored.SYSTEM_ANALYTICS_GA4_ID = 'G-ABC123';
    stored.SYSTEM_ANALYTICS_CLARITY_ID = 'abc123';
    await expect(useCase.execute()).resolves.toEqual({
      ga4Id: 'G-ABC123',
      clarityId: 'abc123',
    });
  });

  it('esvazia IDs vazios ou fora do formato', async () => {
    stored.SYSTEM_ANALYTICS_GA4_ID = "');alert(1)//";
    stored.SYSTEM_ANALYTICS_CLARITY_ID = '';
    await expect(useCase.execute()).resolves.toEqual({
      ga4Id: '',
      clarityId: '',
    });
  });
});
