import { describe, it, expect, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { AiCheckpointerService } from './checkpointer.service';

function fakeConfig(databaseUrl?: string): ConfigService {
  return { get: vi.fn().mockReturnValue(databaseUrl) } as unknown as ConfigService;
}

describe('AiCheckpointerService', () => {
  it('throws fast when DATABASE_URL is missing instead of failing later at first use', () => {
    expect(() => new AiCheckpointerService(fakeConfig(undefined))).toThrow(/DATABASE_URL/);
  });

  it('builds a PostgresSaver bound to the langgraph schema when DATABASE_URL is set', () => {
    const service = new AiCheckpointerService(
      fakeConfig('postgresql://user:pass@localhost:5432/db'),
    );
    expect(service.saver).toBeDefined();
  });

  // `PostgresSaver.pool` é `private` no .d.ts da lib — o getter existe pra
  // contornar isso num único lugar (ver comentário em checkpointer.service.ts).
  // Se a lib parar de expor `pool` como propriedade de instância normal, esse
  // teste é o primeiro a quebrar, em vez de um NPE em produção dentro de
  // runConversationTurn.
  it('exposes the underlying pg.Pool for the conversation advisory lock', () => {
    const service = new AiCheckpointerService(
      fakeConfig('postgresql://user:pass@localhost:5432/db'),
    );
    expect(service.pool).toBeDefined();
    expect(typeof service.pool.connect).toBe('function');
  });

  it('runs saver.setup() on module init', async () => {
    const service = new AiCheckpointerService(
      fakeConfig('postgresql://user:pass@localhost:5432/db'),
    );
    const setup = vi.spyOn(service.saver, 'setup').mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(setup).toHaveBeenCalled();
  });

  it('runs saver.end() on module destroy', async () => {
    const service = new AiCheckpointerService(
      fakeConfig('postgresql://user:pass@localhost:5432/db'),
    );
    const end = vi.spyOn(service.saver, 'end').mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(end).toHaveBeenCalled();
  });
});
