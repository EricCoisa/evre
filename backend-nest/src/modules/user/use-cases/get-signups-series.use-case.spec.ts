import { Test } from '@nestjs/testing';
import { GetSignupsSeriesUseCase } from './get-signups-series.use-case';
import { PrismaService } from 'src/prisma/prisma.service';

const mockPrisma = { user: { findMany: vi.fn() } };

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
};
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('GetSignupsSeriesUseCase', () => {
  let useCase: GetSignupsSeriesUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        GetSignupsSeriesUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    useCase = mod.get(GetSignupsSeriesUseCase);
    vi.clearAllMocks();
    mockPrisma.user.findMany.mockResolvedValue([]);
  });

  it('devolve um ponto por dia da janela, mesmo sem cadastros', async () => {
    const result = await useCase.execute(7);

    expect(result.data).toHaveLength(7);
    expect(result.data.every((p) => p.value === 0)).toBe(true);
  });

  it('agrupa cadastros do mesmo dia no mesmo ponto', async () => {
    const today = daysAgo(0);
    mockPrisma.user.findMany.mockResolvedValue([
      { createdAt: today },
      { createdAt: today },
      { createdAt: daysAgo(1) },
    ]);

    const result = await useCase.execute(7);
    const byDate = Object.fromEntries(
      result.data.map((p) => [p.date, p.value]),
    );

    expect(byDate[isoDay(today)]).toBe(2);
    expect(byDate[isoDay(daysAgo(1))]).toBe(1);
  });

  it('mantém a série em ordem cronológica e ignora data fora da janela', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { createdAt: daysAgo(90) }, // fora da janela: não pode criar ponto novo
    ]);

    const result = await useCase.execute(3);
    const dates = result.data.map((p) => p.date);

    expect(dates).toHaveLength(3);
    expect([...dates].sort()).toEqual(dates);
    expect(result.data.reduce((sum, p) => sum + p.value, 0)).toBe(0);
  });
});
