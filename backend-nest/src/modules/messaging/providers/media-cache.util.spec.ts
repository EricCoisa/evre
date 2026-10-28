import { MediaCache } from './media-cache.util';

const media = (size: number) => ({ data: Buffer.alloc(size) });

describe('MediaCache', () => {
  it('reaproveita dentro do TTL e recarrega depois', async () => {
    let t = 0;
    const cache = new MediaCache(1000, 1024, () => t);
    const load = vi.fn().mockImplementation(() => Promise.resolve(media(10)));

    await cache.getOrLoad('a', load);
    await cache.getOrLoad('a', load);
    expect(load).toHaveBeenCalledTimes(1);

    t = 1001;
    await cache.getOrLoad('a', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('pedidos simultâneos compartilham uma só carga', async () => {
    const cache = new MediaCache();
    let release!: (v: { data: Buffer }) => void;
    const load = vi.fn(
      () => new Promise<{ data: Buffer }>((r) => (release = r)),
    );

    const all = Promise.all([
      cache.getOrLoad('a', load),
      cache.getOrLoad('a', load),
      cache.getOrLoad('a', load),
    ]);
    release(media(1));
    await all;
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('respeita o teto de bytes descartando o mais antigo', async () => {
    const cache = new MediaCache(60_000, 100);
    const load = (n: number) => vi.fn().mockResolvedValue(media(n));
    const first = load(60);
    await cache.getOrLoad('old', first);
    await cache.getOrLoad('new', load(60));

    await cache.getOrLoad('old', first);
    expect(first).toHaveBeenCalledTimes(2);
  });

  it('item maior que o teto é servido, mas não retido', async () => {
    const cache = new MediaCache(60_000, 10);
    const big = vi.fn().mockResolvedValue(media(50));
    await cache.getOrLoad('x', big);
    await cache.getOrLoad('x', big);
    expect(big).toHaveBeenCalledTimes(2);
  });

  it('falha não fica em cache', async () => {
    const cache = new MediaCache();
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValueOnce(media(1));
    await expect(cache.getOrLoad('a', load)).rejects.toThrow('x');
    await expect(cache.getOrLoad('a', load)).resolves.toBeDefined();
  });
});
