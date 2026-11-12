import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CmsAgentBridgeService } from './cms-agent-bridge.service';

vi.mock('axios');

function httpError(data: unknown) {
  return Object.assign(new Error('Request failed'), { response: { data } });
}

describe('CmsAgentBridgeService', () => {
  let service: CmsAgentBridgeService;
  let configGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    configGet = vi.fn((key: string) =>
      key === 'AGENT_CMS_SECRET' ? 'top-secret' : undefined,
    );
    service = new CmsAgentBridgeService({
      get: configGet,
    } as unknown as ConfigService);
  });

  describe('AGENT_CMS_SECRET ausente', () => {
    beforeEach(() => {
      configGet.mockReturnValue(undefined);
    });

    it('describeSchema recusa sem chamar a rede', async () => {
      await expect(service.describeSchema()).rejects.toThrow(
        'AGENT_CMS_SECRET not configured in environment variables',
      );
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('getDocument recusa sem chamar a rede', async () => {
      await expect(service.getDocument('posts')).rejects.toThrow(
        'AGENT_CMS_SECRET not configured in environment variables',
      );
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('updateDocument recusa sem chamar a rede', async () => {
      await expect(service.updateDocument('posts', '1', {})).rejects.toThrow(
        'AGENT_CMS_SECRET not configured in environment variables',
      );
      expect(axios.patch).not.toHaveBeenCalled();
    });
  });

  describe('describeSchema', () => {
    it('prefere FRONTEND_INTERNAL_URL sobre NEXTAUTH_URL', async () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'FRONTEND_INTERNAL_URL') return 'http://frontend:3000';
        if (key === 'NEXTAUTH_URL') return 'https://app.exemplo.com';
        if (key === 'AGENT_CMS_SECRET') return 'top-secret';
        return undefined;
      });
      vi.mocked(axios.get).mockResolvedValue({ data: { collections: [] } });

      await service.describeSchema();

      expect(axios.get).toHaveBeenCalledWith(
        'http://frontend:3000/api/agent/cms/schema',
        expect.anything(),
      );
    });

    it('usa NEXTAUTH_URL como fallback quando FRONTEND_INTERNAL_URL não está configurada', async () => {
      configGet.mockImplementation((key: string) =>
        key === 'NEXTAUTH_URL'
          ? 'https://app.exemplo.com'
          : key === 'AGENT_CMS_SECRET'
            ? 'top-secret'
            : undefined,
      );
      vi.mocked(axios.get).mockResolvedValue({ data: { collections: [] } });

      const result = await service.describeSchema();

      expect(result).toEqual({ collections: [] });
      expect(axios.get).toHaveBeenCalledWith(
        'https://app.exemplo.com/api/agent/cms/schema',
        { headers: { 'x-agent-secret': 'top-secret', 'Content-Type': 'application/json' } },
      );
    });

    it('cai para http://localhost:3000 quando NEXTAUTH_URL não está configurada', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: { collections: [] } });

      await service.describeSchema();

      expect(axios.get).toHaveBeenCalledWith(
        'http://localhost:3000/api/agent/cms/schema',
        expect.anything(),
      );
    });

    it('propaga o erro vindo do Payload quando presente', async () => {
      vi.mocked(axios.get).mockRejectedValue(
        httpError({ error: 'collection não existe' }),
      );

      await expect(service.describeSchema()).rejects.toThrow(
        'collection não existe',
      );
    });

    it('cai para a mensagem do Error quando não há response.data.error', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('network down'));

      await expect(service.describeSchema()).rejects.toThrow('network down');
    });

    it('cai para o fallback quando o erro não é um Error nem tem response.data.error', async () => {
      vi.mocked(axios.get).mockRejectedValue('boom');

      await expect(service.describeSchema()).rejects.toThrow(
        'Falha ao consultar schema do CMS',
      );
    });
  });

  describe('getDocument', () => {
    it('monta a URL da coleção quando id não é informado', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: [{ id: '1' }] });

      const result = await service.getDocument('posts');

      expect(result).toEqual([{ id: '1' }]);
      expect(axios.get).toHaveBeenCalledWith(
        'http://localhost:3000/api/agent/cms/posts',
        expect.anything(),
      );
    });

    it('monta a URL do documento quando id é informado', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: { id: '1' } });

      await service.getDocument('posts', '1');

      expect(axios.get).toHaveBeenCalledWith(
        'http://localhost:3000/api/agent/cms/posts/1',
        expect.anything(),
      );
    });

    it('propaga erro ao falhar a consulta', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('timeout'));

      await expect(service.getDocument('posts', '1')).rejects.toThrow(
        'timeout',
      );
    });
  });

  describe('updateDocument', () => {
    it('faz PATCH no documento e retorna o resultado', async () => {
      vi.mocked(axios.patch).mockResolvedValue({ data: { id: '1', title: 'novo' } });

      const result = await service.updateDocument('posts', '1', {
        title: 'novo',
      });

      expect(result).toEqual({ id: '1', title: 'novo' });
      expect(axios.patch).toHaveBeenCalledWith(
        'http://localhost:3000/api/agent/cms/posts/1',
        { title: 'novo' },
        expect.anything(),
      );
    });

    it('propaga o erro do Payload ao falhar a atualização', async () => {
      vi.mocked(axios.patch).mockRejectedValue(
        httpError({ error: 'campo inválido' }),
      );

      await expect(
        service.updateDocument('posts', '1', { title: 'x' }),
      ).rejects.toThrow('campo inválido');
    });
  });
});
