import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAiApi = vi.hoisted(() => ({
  aiControllerCheckHealth: vi.fn(),
  aiControllerSaveConfiguration: vi.fn(),
  aiControllerListConversations: vi.fn(),
  aiControllerCreateConversation: vi.fn(),
  aiControllerGetConversation: vi.fn(),
  aiControllerRewindConversation: vi.fn(),
  aiControllerDeleteConversation: vi.fn(),
  aiControllerListModels: vi.fn(),
  aiControllerListCandidateModels: vi.fn(),
  aiControllerListTools: vi.fn(),
  aiControllerListToolPermissions: vi.fn(),
  aiControllerRevokeToolAccess: vi.fn(),
  aiControllerAllowToolAccess: vi.fn(),
  aiControllerSaveUserConfiguration: vi.fn(),
}));

vi.mock('@/lib/generated/ai/ai', () => ({ getAi: () => mockAiApi }));

import {
  getAiHealth,
  saveAiConfiguration,
  listConversations,
  createConversation,
  getConversation,
  rewindConversation,
  deleteConversation,
  getAiModels,
  listCandidateAiModels,
  getAiTools,
  getAiToolPermissions,
  revokeAiToolAccess,
  allowAiToolAccess,
  saveUserAiConfiguration,
} from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAiHealth', () => {
  it('devolve o status de saúde da IA', async () => {
    mockAiApi.aiControllerCheckHealth.mockResolvedValue({ operational: true });

    const result = await getAiHealth();

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ operational: true });
  });

  it('propaga falha como envelope de erro', async () => {
    mockAiApi.aiControllerCheckHealth.mockRejectedValue(new Error('boom'));

    const result = await getAiHealth();

    expect(result.success).toBe(false);
  });
});

describe('saveAiConfiguration', () => {
  it('salva a configuração da plataforma', async () => {
    mockAiApi.aiControllerSaveConfiguration.mockResolvedValue({ status: true, data: 'ok' });

    const payload = { provider: 'openai', model: 'gpt-4' };
    const result = await saveAiConfiguration(payload);

    expect(result.success).toBe(true);
    expect(mockAiApi.aiControllerSaveConfiguration).toHaveBeenCalledWith(payload);
  });
});

describe('listConversations', () => {
  it('lista as conversas', async () => {
    mockAiApi.aiControllerListConversations.mockResolvedValue({ data: [{ id: 'c1' }] });

    const result = await listConversations();

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ data: [{ id: 'c1' }] });
  });
});

describe('createConversation', () => {
  it('cria conversa repassando o dto', async () => {
    mockAiApi.aiControllerCreateConversation.mockResolvedValue('new-id');

    const result = await createConversation({ title: 'oi' });

    expect(result.success).toBe(true);
    expect(result.data).toBe('new-id');
    expect(mockAiApi.aiControllerCreateConversation).toHaveBeenCalledWith({ title: 'oi' });
  });
});

describe('getConversation', () => {
  it('busca conversa por id', async () => {
    mockAiApi.aiControllerGetConversation.mockResolvedValue({ id: 'c1', messages: [] });

    const result = await getConversation('c1');

    expect(result.success).toBe(true);
    expect(mockAiApi.aiControllerGetConversation).toHaveBeenCalledWith('c1');
  });
});

describe('rewindConversation', () => {
  it('rebobina até a mensagem informada', async () => {
    mockAiApi.aiControllerRewindConversation.mockResolvedValue([{ id: 'm1' }]);

    const result = await rewindConversation('c1', 'm1');

    expect(result.success).toBe(true);
    expect(mockAiApi.aiControllerRewindConversation).toHaveBeenCalledWith('c1', { messageId: 'm1' });
  });
});

describe('deleteConversation', () => {
  it('remove conversa por id', async () => {
    mockAiApi.aiControllerDeleteConversation.mockResolvedValue(undefined);

    const result = await deleteConversation('c1');

    expect(result.success).toBe(true);
    expect(mockAiApi.aiControllerDeleteConversation).toHaveBeenCalledWith('c1');
  });
});

describe('getAiModels', () => {
  it('lista os modelos configurados', async () => {
    mockAiApi.aiControllerListModels.mockResolvedValue({ models: ['gpt-4'], default: 'gpt-4' });

    const result = await getAiModels();

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ models: ['gpt-4'], default: 'gpt-4' });
  });
});

describe('listCandidateAiModels', () => {
  it('lista modelos reais de um provider ainda não salvo', async () => {
    mockAiApi.aiControllerListCandidateModels.mockResolvedValue({ models: ['gpt-4'] });

    const payload = { provider: 'openai' };
    const result = await listCandidateAiModels(payload);

    expect(result.success).toBe(true);
    expect(mockAiApi.aiControllerListCandidateModels).toHaveBeenCalledWith(payload);
  });
});

describe('getAiTools', () => {
  it('lista as tools disponíveis', async () => {
    mockAiApi.aiControllerListTools.mockResolvedValue([{ name: 'search', description: 'busca' }]);

    const result = await getAiTools();

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ name: 'search', description: 'busca' }]);
  });
});

describe('getAiToolPermissions', () => {
  it('lista as permissões de tool', async () => {
    mockAiApi.aiControllerListToolPermissions.mockResolvedValue([
      { name: 'search', description: 'busca', descriptionKey: 'searchDesc', group: 'web', enabled: true },
    ]);

    const result = await getAiToolPermissions();

    expect(result.success).toBe(true);
  });
});

describe('revokeAiToolAccess', () => {
  it('revoga acesso de uma tool por nome', async () => {
    mockAiApi.aiControllerRevokeToolAccess.mockResolvedValue(undefined);

    const result = await revokeAiToolAccess('search');

    expect(result.success).toBe(true);
    expect(mockAiApi.aiControllerRevokeToolAccess).toHaveBeenCalledWith('search');
  });
});

describe('allowAiToolAccess', () => {
  it('concede acesso de uma tool por nome', async () => {
    mockAiApi.aiControllerAllowToolAccess.mockResolvedValue({
      name: 'search', description: 'busca', descriptionKey: 'searchDesc', group: 'web', enabled: true,
    });

    const result = await allowAiToolAccess('search');

    expect(result.success).toBe(true);
    expect(mockAiApi.aiControllerAllowToolAccess).toHaveBeenCalledWith('search');
  });
});

describe('saveUserAiConfiguration', () => {
  it('salva a configuração BYOK do próprio usuário', async () => {
    mockAiApi.aiControllerSaveUserConfiguration.mockResolvedValue({ status: true, data: 'ok' });

    const payload = { provider: 'openai', model: 'gpt-4', apiKey: 'sk-1' };
    const result = await saveUserAiConfiguration(payload);

    expect(result.success).toBe(true);
    expect(mockAiApi.aiControllerSaveUserConfiguration).toHaveBeenCalledWith(payload);
  });
});
