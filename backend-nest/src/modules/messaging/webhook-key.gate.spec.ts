import { webhookKeyGate } from './webhook-key.gate';

describe('webhookKeyGate', () => {
  const messaging = { webhookKey: vi.fn() };
  const gate = webhookKeyGate(messaging as never);

  const res = () => {
    const r = { status: vi.fn(), json: vi.fn() };
    r.status.mockReturnValue(r);
    return r;
  };
  /** O portão responde sozinho ou chama `next`: espera um dos dois. */
  const run = async (req: object) => {
    const response = res();
    const next = vi.fn();
    gate(req as never, response as never, next);
    await vi.waitFor(() => {
      if (!next.mock.calls.length && !response.json.mock.calls.length) {
        throw new Error('portão ainda não respondeu');
      }
    });
    return { response, next };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    messaging.webhookKey.mockResolvedValue('k');
  });

  it('chave certa segue para o body-parser', async () => {
    const { next, response } = await run({
      method: 'POST',
      query: { key: 'k' },
    });
    expect(next).toHaveBeenCalledWith();
    expect(response.status).not.toHaveBeenCalled();
  });

  it.each([
    ['sem key', {}],
    ['key errada', { key: 'x' }],
    ['key vazia', { key: '' }],
    ['key repetida (array)', { key: ['k', 'k'] }],
  ])('%s: 401 antes de qualquer leitura do corpo', async (_label, query) => {
    const { next, response } = await run({ method: 'POST', query });
    expect(response.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([null, ''])(
    'sem chave configurada (%j): 401 (falha fechada)',
    async (configured) => {
      messaging.webhookKey.mockResolvedValue(configured);
      const { next, response } = await run({ method: 'POST', query: {} });
      expect(response.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    },
  );

  it('o handshake (GET) não tem corpo e passa: o use-case decide', async () => {
    const { next } = await run({ method: 'GET', query: {} });
    expect(next).toHaveBeenCalledWith();
    expect(messaging.webhookKey).not.toHaveBeenCalled();
  });

  it('falha ao ler a chave vai para o tratador de erros, não derruba o processo', async () => {
    const failure = new Error('redis fora');
    messaging.webhookKey.mockRejectedValue(failure);
    const { next } = await run({ method: 'POST', query: { key: 'k' } });
    expect(next).toHaveBeenCalledWith(failure);
  });
});
