import {
  MessagingSessionStore,
  type StoredSession,
} from './messaging-session.store';

const ID = 'conn-1';

function setup() {
  const data = new Map<string, string>();
  const redis = {
    get: vi.fn((k: string) => Promise.resolve(data.get(k) ?? null)),
    set: vi.fn((k: string, v: string) => {
      data.set(k, v);
      return Promise.resolve();
    }),
    del: vi.fn((k: string) => {
      data.delete(k);
      return Promise.resolve();
    }),
  };
  return { store: new MessagingSessionStore(redis as never), redis };
}

describe('MessagingSessionStore', () => {
  it('grava e lê o estado', async () => {
    const { store } = setup();
    await store.set(ID, { status: 'CONNECTED', phoneNumber: '5534999999999' });
    expect(await store.get(ID)).toMatchObject({
      status: 'CONNECTED',
      phoneNumber: '5534999999999',
    });
  });

  it('QR só existe enquanto pareia: ao conectar ele some', async () => {
    const { store } = setup();
    await store.set(ID, { status: 'CONNECTING', qrCode: 'QR', pairingCode: 'P' });
    const connected = await store.set(ID, { status: 'CONNECTED', qrCode: 'QR' });
    expect(connected).not.toHaveProperty('qrCode');
    expect(connected).not.toHaveProperty('pairingCode');
  });

  it('QR novo substitui o anterior — quem grava o estado já traz o QR vigente', async () => {
    const { store } = setup();
    await store.set(ID, { status: 'CONNECTING', qrCode: 'velho' });
    const after = await store.set(ID, { status: 'CONNECTING', qrCode: 'novo' });
    expect(after.qrCode).toBe('novo');
  });

  it('JSON corrompido no Redis vira "sem estado", não erro', async () => {
    const { store, redis } = setup();
    redis.get.mockResolvedValueOnce('{quebrado');
    expect(await store.get(ID)).toBeNull();
  });

  it('clear apaga', async () => {
    const { store } = setup();
    await store.set(ID, { status: 'CONNECTED' });
    await store.clear(ID);
    expect(await store.get(ID)).toBeNull();
  });

  describe('frescor', () => {
    const at = (
      status: StoredSession['status'],
      ageMs: number,
      extra: Partial<StoredSession> = {},
    ): StoredSession => ({
      status,
      updatedAt: 1_000_000 - ageMs,
      ...extra,
    });
    const store = setup().store;

    it('vale por alguns minutos, qualquer que seja o estado', () => {
      expect(store.isFresh(at('CONNECTED', 60_000), 1_000_000)).toBe(true);
      expect(store.isFresh(at('CONNECTING', 60_000), 1_000_000)).toBe(true);
      expect(store.isFresh(at('CONNECTED', 6 * 60_000), 1_000_000)).toBe(false);
    });
  });
});
