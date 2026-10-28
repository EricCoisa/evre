import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const api = vi.hoisted(() => ({
  getMessagingCapabilities: vi.fn(),
  listMessagingConnections: vi.fn(),
  listMessagingConversations: vi.fn(),
  getMessagingHealth: vi.fn(),
  listMessages: vi.fn(),
  listMessagingContacts: vi.fn(),
  sendMessage: vi.fn(),
  sendPresence: vi.fn(),
  createMessagingContact: vi.fn(),
  updateMessagingContact: vi.fn(),
  listTemplateVariables: vi.fn(),
  listTemplateButtons: vi.fn(),
  checkMetaTemplate: vi.fn(),
  listTemplateTypes: vi.fn(),
  createTemplateType: vi.fn(),
  updateTemplateType: vi.fn(),
  removeTemplateType: vi.fn(),
  listTemplates: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  removeTemplate: vi.fn(),
  submitTemplate: vi.fn(),
  reconcileTemplateSubmissions: vi.fn(),
  listRemoteTemplates: vi.fn(),
  linkRemoteTemplate: vi.fn(),
  importRemoteTemplate: vi.fn(),
}));

const realtime = vi.hoisted(() => ({ useMessagingRealtime: vi.fn() }));
const sendAttachmentMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn(), success: vi.fn() }));

vi.mock('./api', () => api);
vi.mock('@/hooks/use-messaging-realtime', () => realtime);
vi.mock('@/lib/messaging/send-attachment', () => ({ sendAttachment: sendAttachmentMock }));
vi.mock('sonner', () => ({ toast: toastMock }));

// Simplificação deliberada: reproduz só o contrato de Alive (unwrap em sucesso, throw em falha),
// sem o retry de 401 — esse comportamento já tem cobertura própria em collector.test.ts.
vi.mock('@/lib/api/collector', () => ({
  Collector:
    <TArgs extends unknown[], T>(
      fn: (...args: TArgs) => Promise<{ success: boolean; data: T; message: string }>,
    ) =>
    async (...args: TArgs): Promise<T> => {
      const res = await fn(...args);
      if (!res.success) throw new Error(res.message || 'Erro desconhecido');
      return res.data;
    },
}));

import {
  useMessagingConnections,
  useMessagingArchivedConnections,
  useMessagingHealth,
  useMessages,
  useMessageThread,
  useMessagingCapabilities,
  useNativeButtonsSupport,
  messagingContactsKey,
  useMessagingContacts,
  useResolveConversations,
  useCreateMessagingContact,
  useUpdateMessagingContact,
  useSendMessage,
  useSendPresence,
  useSendAttachment,
  useMessagingConversations,
  useTemplateVariables,
  useMetaTemplateCheck,
  useTemplateButtons,
  useTemplateTypes,
  useCreateTemplateType,
  useUpdateTemplateType,
  useRemoveTemplateType,
  useTemplates,
  useTemplatesForConnection,
  useCreateTemplate,
  useUpdateTemplate,
  useRemoveTemplate,
  useSubmitTemplate,
  useReconcileTemplateSubmissions,
  useRemoteTemplates,
  useLinkRemoteTemplate,
  useImportRemoteTemplate,
} from './queries';

function ok<T>(data: T) {
  return { success: true, data, message: '' };
}
function fail(message = 'deu erro') {
  return { success: false, data: null, message };
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, invalidate, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useMessagingConnections', () => {
  it('busca conexões ativas e liga o realtime', async () => {
    api.listMessagingConnections.mockResolvedValue(ok([{ id: 'c1' }]));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useMessagingConnections(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([{ id: 'c1' }]);
    expect(api.listMessagingConnections).toHaveBeenCalledWith({ archived: false });
    expect(realtime.useMessagingRealtime).toHaveBeenCalledWith(true);
  });

  it('enabled=false não consulta e desliga o realtime', () => {
    const { wrapper } = makeWrapper();

    renderHook(() => useMessagingConnections(false), { wrapper });

    expect(api.listMessagingConnections).not.toHaveBeenCalled();
    expect(realtime.useMessagingRealtime).toHaveBeenCalledWith(false);
  });
});

describe('useMessagingArchivedConnections', () => {
  it('busca conexões arquivadas', async () => {
    api.listMessagingConnections.mockResolvedValue(ok([{ id: 'c-arch' }]));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useMessagingArchivedConnections(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.listMessagingConnections).toHaveBeenCalledWith({ archived: true });
    expect(result.current.data).toEqual([{ id: 'c-arch' }]);
  });
});

describe('useMessagingHealth', () => {
  it('devolve operational/reason quando há connectionId', async () => {
    api.getMessagingHealth.mockResolvedValue(ok({ operational: true, reason: undefined }));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useMessagingHealth('c1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(api.getMessagingHealth).toHaveBeenCalledWith('c1');
    expect(result.current.operational).toBe(true);
  });

  it('sem connectionId não consulta e cai no default operational=false', () => {
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useMessagingHealth(undefined), { wrapper });

    expect(api.getMessagingHealth).not.toHaveBeenCalled();
    expect(result.current.operational).toBe(false);
  });
});

describe('useMessages', () => {
  it('repassa os params para listMessages', async () => {
    const page = { data: [{ id: 'm1' }], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } };
    api.listMessages.mockResolvedValue(ok(page));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useMessages({ phone: '5511999999999' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.listMessages).toHaveBeenCalledWith({ phone: '5511999999999' });
    expect(result.current.data).toEqual(page);
  });
});

describe('useMessageThread', () => {
  it('pagina para trás usando meta.page/totalPages', async () => {
    api.listMessages.mockImplementation((params: { page: number }) =>
      Promise.resolve(
        ok({
          data: [{ id: `m${params.page}` }],
          meta: { total: 2, page: params.page, limit: 30, totalPages: 2 },
        }),
      ),
    );
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useMessageThread('c1', '5511999999999'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.listMessages).toHaveBeenCalledWith({
      connectionId: 'c1',
      phone: '5511999999999',
      page: 1,
      limit: 30,
    });
    expect(result.current.hasNextPage).toBe(true);
  });
});

describe('useMessagingCapabilities', () => {
  it('consulta quando há connectionId', async () => {
    api.getMessagingCapabilities.mockResolvedValue(ok({ template: {} }));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useMessagingCapabilities('c1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getMessagingCapabilities).toHaveBeenCalledWith('c1');
  });
});

describe('useNativeButtonsSupport', () => {
  it('agrega capabilities de todas as conexões', async () => {
    api.listMessagingConnections.mockResolvedValue(ok([{ id: 'c1' }, { id: 'c2' }]));
    api.getMessagingCapabilities.mockImplementation((connectionId: string) =>
      Promise.resolve(
        ok(
          connectionId === 'c1'
            ? { template: { components: { buttons: ['x'] }, approval: false } }
            : { template: { components: { buttons: [] }, approval: true } },
        ),
      ),
    );
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useNativeButtonsSupport(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.supported).toBe(true);
    expect(result.current.approval).toBe(true);
    expect(result.current.approvalConnectionIds).toEqual(['c2']);
  });
});

describe('messagingContactsKey', () => {
  it('monta a chave a partir dos params', () => {
    expect(messagingContactsKey({ search: 'ana' })).toEqual(['messaging', 'contacts', { search: 'ana' }]);
    expect(messagingContactsKey()).toEqual(['messaging', 'contacts', {}]);
  });
});

describe('useMessagingContacts', () => {
  it('usa messagingContactsKey e repassa params', async () => {
    const page = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    api.listMessagingContacts.mockResolvedValue(ok(page));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useMessagingContacts({ search: 'ana' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.listMessagingContacts).toHaveBeenCalledWith({ search: 'ana' });
  });
});

describe('useResolveConversations', () => {
  it('devolve uma função que chama listMessagingConversations', async () => {
    api.listMessagingConversations.mockResolvedValue(ok([{ phone: '5511999999999' }]));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useResolveConversations(), { wrapper });
    const data = await result.current('5511999999999');

    expect(api.listMessagingConversations).toHaveBeenCalledWith('5511999999999');
    expect(data).toEqual([{ phone: '5511999999999' }]);
  });
});

describe('useCreateMessagingContact', () => {
  it('cria o contato e invalida a lista', async () => {
    api.createMessagingContact.mockResolvedValue(ok({ id: 'ct1' }));
    const { wrapper, invalidate } = makeWrapper();
    const payload = { phone: '5511999999999' } as Parameters<typeof api.createMessagingContact>[0];

    const { result } = renderHook(() => useCreateMessagingContact(), { wrapper });
    await result.current.mutateAsync(payload);

    expect(api.createMessagingContact).toHaveBeenCalledWith(payload);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'contacts'] });
  });
});

describe('useUpdateMessagingContact', () => {
  it('atualiza o contato e invalida a lista', async () => {
    api.updateMessagingContact.mockResolvedValue(ok({ id: 'ct1' }));
    const { wrapper, invalidate } = makeWrapper();

    const { result } = renderHook(() => useUpdateMessagingContact(), { wrapper });
    await result.current.mutateAsync({ contactId: 'ct1', payload: { name: 'Ana' } });

    expect(api.updateMessagingContact).toHaveBeenCalledWith('ct1', { name: 'Ana' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'contacts'] });
  });
});

describe('useSendMessage', () => {
  it('envia e invalida mensagens e contatos', async () => {
    api.sendMessage.mockResolvedValue(ok({ id: 'm1' }));
    const { wrapper, invalidate } = makeWrapper();
    const payload = { phone: '5511999999999', text: 'oi' } as Parameters<typeof api.sendMessage>[0];

    const { result } = renderHook(() => useSendMessage(), { wrapper });
    await result.current.mutateAsync(payload);

    expect(api.sendMessage).toHaveBeenCalledWith(payload);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'messages'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'contacts'] });
  });
});

describe('useSendPresence', () => {
  it('resolve com o envelope crú mesmo em falha (sem Collector, sem toast)', async () => {
    api.sendPresence.mockResolvedValue(fail('offline'));
    const { wrapper } = makeWrapper();
    const payload = { phone: '5511999999999', state: 'composing' } as Parameters<
      typeof api.sendPresence
    >[0];

    const { result } = renderHook(() => useSendPresence(), { wrapper });
    const data = await result.current.mutateAsync(payload);

    // mutationFn direto (sem wrapper): react-query também passa um 2º arg de contexto da mutation.
    expect(api.sendPresence.mock.calls[0][0]).toEqual(payload);
    expect(data).toEqual(fail('offline'));
    expect(toastMock.error).not.toHaveBeenCalled();
  });
});

describe('useSendAttachment', () => {
  it('envia o anexo e invalida mensagens e contatos', async () => {
    sendAttachmentMock.mockResolvedValue({ id: 'm1' });
    const { wrapper, invalidate } = makeWrapper();
    const input = { connectionId: 'c1', phone: '5511999999999', file: new File([], 'a.png') };

    const { result } = renderHook(() => useSendAttachment(), { wrapper });
    await result.current.mutateAsync(input);

    // mutationFn direto (sem wrapper): react-query também passa um 2º arg de contexto da mutation.
    expect(sendAttachmentMock.mock.calls[0][0]).toEqual(input);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'messages'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'contacts'] });
  });

  it('toasta a mensagem de erro quando o envio falha', async () => {
    sendAttachmentMock.mockRejectedValue(new Error('upload falhou'));
    const { wrapper } = makeWrapper();
    const input = { connectionId: 'c1', phone: '5511999999999', file: new File([], 'a.png') };

    const { result } = renderHook(() => useSendAttachment(), { wrapper });
    await expect(result.current.mutateAsync(input)).rejects.toThrow('upload falhou');
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('upload falhou'));
  });
});

describe('useMessagingConversations', () => {
  it('consulta quando há phone', async () => {
    api.listMessagingConversations.mockResolvedValue(ok([{ phone: '5511999999999' }]));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useMessagingConversations('5511999999999'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.listMessagingConversations).toHaveBeenCalledWith('5511999999999');
  });

  it('sem phone não consulta', () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useMessagingConversations(undefined), { wrapper });
    expect(api.listMessagingConversations).not.toHaveBeenCalled();
  });
});

describe('useTemplateVariables', () => {
  it('busca as variáveis reservadas', async () => {
    api.listTemplateVariables.mockResolvedValue(ok([{ name: 'otp_code' }]));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useTemplateVariables(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([{ name: 'otp_code' }]);
  });
});

describe('useMetaTemplateCheck', () => {
  it('consulta quando enabled e body preenchido', async () => {
    api.checkMetaTemplate.mockResolvedValue(ok({ issues: [{ code: 'x' }] }));
    const { wrapper } = makeWrapper();
    const draft = { category: 'UTILITY', body: 'oi' } as Parameters<typeof api.checkMetaTemplate>[0];

    const { result } = renderHook(() => useMetaTemplateCheck(draft, true), { wrapper });
    await waitFor(() => expect(result.current.issues).toEqual([{ code: 'x' }]));

    expect(api.checkMetaTemplate).toHaveBeenCalledWith(draft);
  });

  it('não consulta quando o body está vazio', () => {
    const { wrapper } = makeWrapper();
    const draft = { category: 'UTILITY', body: '   ' } as Parameters<typeof api.checkMetaTemplate>[0];

    const { result } = renderHook(() => useMetaTemplateCheck(draft, true), { wrapper });

    expect(api.checkMetaTemplate).not.toHaveBeenCalled();
    expect(result.current.issues).toEqual([]);
  });
});

describe('useTemplateButtons', () => {
  it('busca reservados e handlers', async () => {
    api.listTemplateButtons.mockResolvedValue(ok({ reserved: [], handlers: [] }));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useTemplateButtons(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.listTemplateButtons).toHaveBeenCalled();
  });
});

describe('useTemplateTypes', () => {
  it('repassa os params', async () => {
    const page = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    api.listTemplateTypes.mockResolvedValue(ok(page));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useTemplateTypes({ page: 2 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.listTemplateTypes).toHaveBeenCalledWith({ page: 2 });
  });
});

describe('mutações de tipo de template', () => {
  it('useCreateTemplateType cria e invalida template-types', async () => {
    api.createTemplateType.mockResolvedValue(ok({ id: 'tt1' }));
    const { wrapper, invalidate } = makeWrapper();
    const payload = { key: 'otp', name: 'OTP' };

    const { result } = renderHook(() => useCreateTemplateType(), { wrapper });
    await result.current.mutateAsync(payload);

    expect(api.createTemplateType).toHaveBeenCalledWith(payload);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'template-types'] });
  });

  it('useUpdateTemplateType atualiza e invalida template-types', async () => {
    api.updateTemplateType.mockResolvedValue(ok({ id: 'tt1' }));
    const { wrapper, invalidate } = makeWrapper();

    const { result } = renderHook(() => useUpdateTemplateType(), { wrapper });
    await result.current.mutateAsync({ id: 'tt1', payload: { name: 'Novo' } });

    expect(api.updateTemplateType).toHaveBeenCalledWith('tt1', { name: 'Novo' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'template-types'] });
  });

  it('useRemoveTemplateType remove e invalida template-types', async () => {
    api.removeTemplateType.mockResolvedValue(ok(undefined));
    const { wrapper, invalidate } = makeWrapper();

    const { result } = renderHook(() => useRemoveTemplateType(), { wrapper });
    await result.current.mutateAsync('tt1');

    expect(api.removeTemplateType).toHaveBeenCalledWith('tt1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'template-types'] });
  });
});

describe('useTemplates', () => {
  it('repassa params e liga o realtime', async () => {
    const page = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    api.listTemplates.mockResolvedValue(ok(page));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useTemplates({ typeId: 'tt1' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.listTemplates).toHaveBeenCalledWith({ typeId: 'tt1' });
    expect(realtime.useMessagingRealtime).toHaveBeenCalled();
  });
});

describe('useTemplatesForConnection', () => {
  it('consulta sem paginação quando há connectionId', async () => {
    const page = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    api.listTemplates.mockResolvedValue(ok(page));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useTemplatesForConnection('c1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.listTemplates).toHaveBeenCalledWith({ connectionId: 'c1', pagination: false });
  });

  it('sem connectionId não consulta', () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useTemplatesForConnection(undefined), { wrapper });
    expect(api.listTemplates).not.toHaveBeenCalled();
  });
});

describe('mutações de template', () => {
  it('useCreateTemplate cria e invalida templates', async () => {
    api.createTemplate.mockResolvedValue(ok({ id: 'tpl1' }));
    const { wrapper, invalidate } = makeWrapper();
    const payload = {
      typeId: 'tt1',
      key: 'otp_code',
      language: 'pt_BR',
      category: 'AUTHENTICATION',
      body: '{{1}}',
    } as Parameters<typeof api.createTemplate>[0];

    const { result } = renderHook(() => useCreateTemplate(), { wrapper });
    await result.current.mutateAsync(payload);

    expect(api.createTemplate).toHaveBeenCalledWith(payload);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'templates'] });
  });

  it('useUpdateTemplate atualiza e invalida templates', async () => {
    api.updateTemplate.mockResolvedValue(ok({ id: 'tpl1' }));
    const { wrapper, invalidate } = makeWrapper();

    const { result } = renderHook(() => useUpdateTemplate(), { wrapper });
    await result.current.mutateAsync({ id: 'tpl1', payload: { body: 'novo' } });

    expect(api.updateTemplate).toHaveBeenCalledWith('tpl1', { body: 'novo' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'templates'] });
  });

  it('useRemoveTemplate remove (com flag remote) e invalida templates', async () => {
    api.removeTemplate.mockResolvedValue(ok(undefined));
    const { wrapper, invalidate } = makeWrapper();

    const { result } = renderHook(() => useRemoveTemplate(), { wrapper });
    await result.current.mutateAsync({ id: 'tpl1', remote: false });

    expect(api.removeTemplate).toHaveBeenCalledWith('tpl1', false);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'templates'] });
  });

  it('useSubmitTemplate submete e invalida templates', async () => {
    api.submitTemplate.mockResolvedValue(ok({ status: 'PENDING' }));
    const { wrapper, invalidate } = makeWrapper();

    const { result } = renderHook(() => useSubmitTemplate(), { wrapper });
    await result.current.mutateAsync({ id: 'tpl1', payload: { connectionId: 'c1' } });

    expect(api.submitTemplate).toHaveBeenCalledWith('tpl1', { connectionId: 'c1' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'templates'] });
  });

  it('useReconcileTemplateSubmissions reconcilia e invalida templates', async () => {
    api.reconcileTemplateSubmissions.mockResolvedValue(ok({ updated: 2 }));
    const { wrapper, invalidate } = makeWrapper();

    const { result } = renderHook(() => useReconcileTemplateSubmissions(), { wrapper });
    await result.current.mutateAsync('c1');

    expect(api.reconcileTemplateSubmissions).toHaveBeenCalledWith('c1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'templates'] });
  });
});

describe('useRemoteTemplates', () => {
  it('consulta quando enabled e há connectionId', async () => {
    api.listRemoteTemplates.mockResolvedValue(ok([{ providerTemplateId: 'r1' }]));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useRemoteTemplates('c1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.listRemoteTemplates).toHaveBeenCalledWith('c1');
  });

  it('enabled=false não consulta mesmo com connectionId', () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useRemoteTemplates('c1', false), { wrapper });
    expect(api.listRemoteTemplates).not.toHaveBeenCalled();
  });
});

describe('useLinkRemoteTemplate', () => {
  it('vincula e invalida templates + remote-templates da conexão', async () => {
    api.linkRemoteTemplate.mockResolvedValue(ok(undefined));
    const { wrapper, invalidate } = makeWrapper();
    const input = { connectionId: 'c1', payload: { remoteTemplateId: 'r1', templateId: 'tpl1' } };

    const { result } = renderHook(() => useLinkRemoteTemplate(), { wrapper });
    await result.current.mutateAsync(input);

    expect(api.linkRemoteTemplate).toHaveBeenCalledWith('c1', input.payload);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'templates'] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['messaging', 'remote-templates', 'c1'],
    });
  });
});

describe('useImportRemoteTemplate', () => {
  it('importa e invalida templates + template-types + remote-templates da conexão', async () => {
    api.importRemoteTemplate.mockResolvedValue(ok(undefined));
    const { wrapper, invalidate } = makeWrapper();
    const input = { connectionId: 'c1', payload: { remoteTemplateId: 'r1' } };

    const { result } = renderHook(() => useImportRemoteTemplate(), { wrapper });
    await result.current.mutateAsync(input);

    expect(api.importRemoteTemplate).toHaveBeenCalledWith('c1', input.payload);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'templates'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'template-types'] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['messaging', 'remote-templates', 'c1'],
    });
  });
});
