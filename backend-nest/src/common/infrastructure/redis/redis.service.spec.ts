import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  incrby: vi.fn(),
  scard: vi.fn(),
  quit: vi.fn(),
  on: vi.fn(),
};

vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedis),
}));

function build(): RedisService {
  return new RedisService({
    get: vi.fn().mockReturnValue('redis://localhost:6379'),
  } as unknown as ConfigService);
}

describe('RedisService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setnx', () => {
    it('reports the lock as taken when Redis says the key already exists', async () => {
      mockRedis.set.mockResolvedValue(null);
      await expect(build().setnx('k', '1', 60)).resolves.toBe(false);
      expect(mockRedis.set).toHaveBeenCalledWith('k', '1', 'EX', 60, 'NX');
    });

    it('reports the lock as acquired when Redis accepts the SET NX', async () => {
      mockRedis.set.mockResolvedValue('OK');
      await expect(build().setnx('k', '1', 60)).resolves.toBe(true);
    });

    // Lock é proteção de UX; o checkpointer serializa escrita por thread_id.
    it('grants the lock when Redis is unreachable instead of blocking the feature', async () => {
      mockRedis.set.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(build().setnx('k', '1', 60)).resolves.toBe(true);
    });
  });

  // Os demais métodos já falhavam abertos; estão aqui para que o `setnx` não
  // volte a divergir do resto da classe sem alguém perceber.
  describe('degradação quando o Redis está fora', () => {
    it('falls back to a cache miss on get', async () => {
      mockRedis.get.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(build().get('k')).resolves.toBeNull();
    });

    it('swallows the failure on set and del', async () => {
      mockRedis.set.mockRejectedValue(new Error('ECONNREFUSED'));
      mockRedis.del.mockRejectedValue(new Error('ECONNREFUSED'));
      const redis = build();
      await expect(redis.set('k', '1', 60)).resolves.toBeUndefined();
      await expect(redis.del('k')).resolves.toBeUndefined();
    });
  });
});
