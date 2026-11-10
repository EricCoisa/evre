import { Test } from '@nestjs/testing';
import { CheckPdfHealthUseCase } from './check-health.use-case';
import { PdfService } from '../pdf.service';

const mockPdfService = { checkHealth: vi.fn() };

describe('CheckPdfHealthUseCase', () => {
  let useCase: CheckPdfHealthUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CheckPdfHealthUseCase,
        { provide: PdfService, useValue: mockPdfService },
      ],
    }).compile();
    useCase = module.get(CheckPdfHealthUseCase);
  });

  it('returns operational: true when service is up', async () => {
    mockPdfService.checkHealth.mockResolvedValue({ operational: true });
    expect(await useCase.execute()).toEqual({ operational: true });
  });

  it('returns operational: false with reason when service is down', async () => {
    mockPdfService.checkHealth.mockResolvedValue({ operational: false, reason: 'connection refused' });
    expect(await useCase.execute()).toEqual({ operational: false, reason: 'connection refused' });
  });
});
