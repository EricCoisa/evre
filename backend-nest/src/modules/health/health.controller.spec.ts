import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaService } from 'src/prisma/prisma.service';

const mockHealth = {
  check: vi.fn(),
};

const mockPrisma = {
  $queryRaw: vi.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealth },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    vi.clearAllMocks();
  });

  describe('live()', () => {
    it('returns ok without touching the database', () => {
      const result = controller.live();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('ready()', () => {
    it('returns 200 payload when database is reachable', async () => {
      mockHealth.check.mockImplementation(
        async (checks: (() => Promise<unknown>)[]) => {
          for (const check of checks) await check();
          return { status: 'ok', info: { database: { status: 'up' } } };
        },
      );
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.ready();
      expect(result.status).toBe('ok');
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('propagates error (503) when $queryRaw throws', async () => {
      mockHealth.check.mockImplementation(
        async (checks: (() => Promise<unknown>)[]) => {
          for (const check of checks) await check();
        },
      );
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      await expect(controller.ready()).rejects.toThrow('Connection refused');
    });
  });
});
