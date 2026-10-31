import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PageBuilderBridgeService } from './page-builder-bridge.service';

vi.mock('axios');

describe('PageBuilderBridgeService', () => {
  let service: PageBuilderBridgeService;
  let configGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    configGet = vi.fn((key: string) =>
      key === 'AGENT_CMS_SECRET' ? 'top-secret' : undefined,
    );
    service = new PageBuilderBridgeService({
      get: configGet,
    } as unknown as ConfigService);
  });

  it('recusa sem chamar a rede quando AGENT_CMS_SECRET não está configurada', async () => {
    configGet.mockReturnValue(undefined);

    await expect(service.describeSchema()).rejects.toThrow(
      'AGENT_CMS_SECRET not configured in environment variables',
    );
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('usa NEXTAUTH_URL e o header do secret quando configuradas', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'NEXTAUTH_URL'
        ? 'https://app.exemplo.com'
        : key === 'AGENT_CMS_SECRET'
          ? 'top-secret'
          : undefined,
    );
    vi.mocked(axios.get).mockResolvedValue({
      data: { blocks: [], pages: [], spans: [], classNames: [] },
    });

    const result = await service.describeSchema();

    expect(result).toEqual({ blocks: [], pages: [], spans: [], classNames: [] });
    expect(axios.get).toHaveBeenCalledWith(
      'https://app.exemplo.com/api/agent/page-builder/schema',
      { headers: { 'x-agent-secret': 'top-secret' } },
    );
  });

  it('cai para http://localhost:3000 quando NEXTAUTH_URL não está configurada', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { blocks: [], pages: [], spans: [], classNames: [] },
    });

    await service.describeSchema();

    expect(axios.get).toHaveBeenCalledWith(
      'http://localhost:3000/api/agent/page-builder/schema',
      expect.anything(),
    );
  });

  it('propaga a mensagem do Error ao falhar a consulta', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('gateway fora'));

    await expect(service.describeSchema()).rejects.toThrow('gateway fora');
  });

  it('cai para o fallback quando o erro não é um Error', async () => {
    vi.mocked(axios.get).mockRejectedValue('boom');

    await expect(service.describeSchema()).rejects.toThrow(
      'Falha ao consultar o catálogo de blocos do PageBuilder',
    );
  });

  it('devolve erro amigável quando conexão é recusada (ECONNREFUSED com mensagem vazia)', async () => {
    const connRefused = Object.assign(new Error(''), { code: 'ECONNREFUSED' });
    vi.mocked(axios.get).mockRejectedValue(connRefused);

    await expect(service.describeSchema()).rejects.toThrow(
      'Falha ao conectar no frontend (ECONNREFUSED em http://localhost:3000)',
    );
  });
});
