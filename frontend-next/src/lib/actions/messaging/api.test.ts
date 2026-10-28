import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  messagingControllerConnections: vi.fn(),
  messagingControllerCreateConnectionHandler: vi.fn(),
  messagingControllerRestoreConnectionHandler: vi.fn(),
  messagingControllerUpdateConnectionHandler: vi.fn(),
  messagingControllerSetDefaultHandler: vi.fn(),
  messagingControllerArchiveConnectionHandler: vi.fn(),
  messagingControllerHealth: vi.fn(),
  messagingControllerSendMessage: vi.fn(),
  messagingControllerPresence: vi.fn(),
  messagingControllerList: vi.fn(),
  messagingControllerCapabilities: vi.fn(),
  messagingControllerListContactsHandler: vi.fn(),
  messagingControllerCreateContactHandler: vi.fn(),
  messagingControllerUpdateContactHandler: vi.fn(),
  messagingControllerConnectSession: vi.fn(),
  messagingControllerSessionStatus: vi.fn(),
  messagingControllerDisconnectSession: vi.fn(),
  messagingControllerConversationsHandler: vi.fn(),
  messagingTemplateControllerListTemplateVariablesHandler: vi.fn(),
  messagingTemplateControllerCheckMetaTemplateHandler: vi.fn(),
  messagingTemplateControllerListTemplateButtonsHandler: vi.fn(),
  messagingTemplateControllerListTemplateTypes: vi.fn(),
  messagingTemplateControllerCreateTemplateType: vi.fn(),
  messagingTemplateControllerUpdateTemplateType: vi.fn(),
  messagingTemplateControllerRemoveTemplateType: vi.fn(),
  messagingTemplateControllerListTemplatesHandler: vi.fn(),
  messagingTemplateControllerCreateTemplateHandler: vi.fn(),
  messagingTemplateControllerUpdateTemplateHandler: vi.fn(),
  messagingTemplateControllerRemoveTemplateHandler: vi.fn(),
  messagingTemplateControllerSubmitTemplateHandler: vi.fn(),
  messagingTemplateControllerReconcileHandler: vi.fn(),
  messagingTemplateControllerListRemoteTemplatesHandler: vi.fn(),
  messagingTemplateControllerLinkRemoteTemplateHandler: vi.fn(),
  messagingTemplateControllerImportRemoteTemplateHandler: vi.fn(),
}));

vi.mock('@/lib/generated/messaging/messaging', () => ({
  getMessaging: () => mocks,
}));

import * as api from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('conexões', () => {
  it('listMessagingConnections repassa params e devolve dados', async () => {
    mocks.messagingControllerConnections.mockResolvedValue([{ id: 'c1' }]);

    const result = await api.listMessagingConnections({ archived: true });

    expect(mocks.messagingControllerConnections).toHaveBeenCalledWith({ archived: true });
    expect(result).toEqual({ success: true, data: [{ id: 'c1' }], message: '', status: 200 });
  });

  it('listMessagingConnections devolve erro quando o backend falha', async () => {
    mocks.messagingControllerConnections.mockRejectedValue({
      response: { status: 500, data: { message: 'falhou' } },
    });

    const result = await api.listMessagingConnections();

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.message).toBe('falhou');
  });

  it('createMessagingConnection repassa o payload', async () => {
    mocks.messagingControllerCreateConnectionHandler.mockResolvedValue({ id: 'c1' });

    const payload = { provider: 'META' } as unknown as Parameters<
      typeof api.createMessagingConnection
    >[0];
    const result = await api.createMessagingConnection(payload);

    expect(mocks.messagingControllerCreateConnectionHandler).toHaveBeenCalledWith(payload);
    expect(result).toMatchObject({ success: true, data: { id: 'c1' } });
  });

  it('restoreMessagingConnection usa {} quando nenhum payload é passado', async () => {
    mocks.messagingControllerRestoreConnectionHandler.mockResolvedValue({ id: 'c1' });

    await api.restoreMessagingConnection('c1');

    expect(mocks.messagingControllerRestoreConnectionHandler).toHaveBeenCalledWith('c1', {});
  });

  it('restoreMessagingConnection repassa o payload informado', async () => {
    mocks.messagingControllerRestoreConnectionHandler.mockResolvedValue({ id: 'c1' });
    const payload = { provider: 'META' } as unknown as Parameters<
      typeof api.restoreMessagingConnection
    >[1];

    await api.restoreMessagingConnection('c1', payload);

    expect(mocks.messagingControllerRestoreConnectionHandler).toHaveBeenCalledWith('c1', payload);
  });

  it('updateMessagingConnection repassa id e payload', async () => {
    mocks.messagingControllerUpdateConnectionHandler.mockResolvedValue({ id: 'c1' });
    const payload = { provider: 'META' } as unknown as Parameters<
      typeof api.updateMessagingConnection
    >[1];

    await api.updateMessagingConnection('c1', payload);

    expect(mocks.messagingControllerUpdateConnectionHandler).toHaveBeenCalledWith('c1', payload);
  });

  it('setDefaultMessagingConnection repassa o id', async () => {
    mocks.messagingControllerSetDefaultHandler.mockResolvedValue({ id: 'c1' });

    await api.setDefaultMessagingConnection('c1');

    expect(mocks.messagingControllerSetDefaultHandler).toHaveBeenCalledWith('c1');
  });

  it('archiveMessagingConnection repassa o id', async () => {
    mocks.messagingControllerArchiveConnectionHandler.mockResolvedValue({ id: 'c1' });

    await api.archiveMessagingConnection('c1');

    expect(mocks.messagingControllerArchiveConnectionHandler).toHaveBeenCalledWith('c1');
  });

  it('getMessagingHealth repassa o connectionId', async () => {
    mocks.messagingControllerHealth.mockResolvedValue({ operational: true });

    const result = await api.getMessagingHealth('c1');

    expect(mocks.messagingControllerHealth).toHaveBeenCalledWith('c1');
    expect(result).toMatchObject({ success: true, data: { operational: true } });
  });
});

describe('mensagens e presença', () => {
  it('sendMessage repassa o payload', async () => {
    mocks.messagingControllerSendMessage.mockResolvedValue({ id: 'm1' });
    const payload = { phone: '5511999999999', text: 'oi' } as unknown as Parameters<
      typeof api.sendMessage
    >[0];

    const result = await api.sendMessage(payload);

    expect(mocks.messagingControllerSendMessage).toHaveBeenCalledWith(payload);
    expect(result).toMatchObject({ success: true, data: { id: 'm1' } });
  });

  it('sendPresence repassa o payload e não lança quando o provider falha', async () => {
    mocks.messagingControllerPresence.mockRejectedValue(new Error('offline'));
    const payload = { phone: '5511999999999', state: 'composing' } as unknown as Parameters<
      typeof api.sendPresence
    >[0];

    const result = await api.sendPresence(payload);

    expect(mocks.messagingControllerPresence).toHaveBeenCalledWith(payload);
    expect(result.success).toBe(false);
    expect(result.message).toBe('offline');
  });

  it('listMessages usa {} como default e repassa params', async () => {
    const page = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    mocks.messagingControllerList.mockResolvedValue(page);

    const resultDefault = await api.listMessages();
    expect(mocks.messagingControllerList).toHaveBeenCalledWith({});

    const result = await api.listMessages({ phone: '5511999999999' });
    expect(mocks.messagingControllerList).toHaveBeenCalledWith({ phone: '5511999999999' });
    expect(result).toEqual({ success: true, data: page, message: '', status: 200 });
    expect(resultDefault.success).toBe(true);
  });

  it('getMessagingCapabilities repassa o connectionId', async () => {
    mocks.messagingControllerCapabilities.mockResolvedValue({ template: {} });

    await api.getMessagingCapabilities('c1');

    expect(mocks.messagingControllerCapabilities).toHaveBeenCalledWith('c1');
  });
});

describe('contatos', () => {
  it('listMessagingContacts usa {} como default', async () => {
    mocks.messagingControllerListContactsHandler.mockResolvedValue({ data: [], meta: {} });

    await api.listMessagingContacts();

    expect(mocks.messagingControllerListContactsHandler).toHaveBeenCalledWith({});
  });

  it('listMessagingContacts repassa params informados', async () => {
    mocks.messagingControllerListContactsHandler.mockResolvedValue({ data: [], meta: {} });

    await api.listMessagingContacts({ search: 'ana' });

    expect(mocks.messagingControllerListContactsHandler).toHaveBeenCalledWith({ search: 'ana' });
  });

  it('createMessagingContact repassa o payload', async () => {
    mocks.messagingControllerCreateContactHandler.mockResolvedValue({ id: 'ct1' });
    const payload = { phone: '5511999999999' } as unknown as Parameters<
      typeof api.createMessagingContact
    >[0];

    await api.createMessagingContact(payload);

    expect(mocks.messagingControllerCreateContactHandler).toHaveBeenCalledWith(payload);
  });

  it('updateMessagingContact repassa contactId e payload', async () => {
    mocks.messagingControllerUpdateContactHandler.mockResolvedValue({ id: 'ct1' });

    await api.updateMessagingContact('ct1', { name: 'Ana' });

    expect(mocks.messagingControllerUpdateContactHandler).toHaveBeenCalledWith('ct1', {
      name: 'Ana',
    });
  });
});

describe('sessão', () => {
  it('connectMessagingSession repassa o connectionId', async () => {
    mocks.messagingControllerConnectSession.mockResolvedValue({ status: 'CONNECTING' });

    await api.connectMessagingSession('c1');

    expect(mocks.messagingControllerConnectSession).toHaveBeenCalledWith('c1');
  });

  it('getMessagingSession repassa o connectionId', async () => {
    mocks.messagingControllerSessionStatus.mockResolvedValue({ status: 'CONNECTED' });

    await api.getMessagingSession('c1');

    expect(mocks.messagingControllerSessionStatus).toHaveBeenCalledWith('c1');
  });

  it('disconnectMessagingSession repassa o connectionId', async () => {
    mocks.messagingControllerDisconnectSession.mockResolvedValue({ status: true, data: 'ok' });

    await api.disconnectMessagingSession('c1');

    expect(mocks.messagingControllerDisconnectSession).toHaveBeenCalledWith('c1');
  });

  it('listMessagingConversations envolve o phone num objeto', async () => {
    mocks.messagingControllerConversationsHandler.mockResolvedValue([{ phone: '5511999999999' }]);

    await api.listMessagingConversations('5511999999999');

    expect(mocks.messagingControllerConversationsHandler).toHaveBeenCalledWith({
      phone: '5511999999999',
    });
  });
});

describe('catálogo de templates', () => {
  it('listTemplateVariables não recebe argumentos', async () => {
    mocks.messagingTemplateControllerListTemplateVariablesHandler.mockResolvedValue([]);

    await api.listTemplateVariables();

    expect(mocks.messagingTemplateControllerListTemplateVariablesHandler).toHaveBeenCalledWith();
  });

  it('checkMetaTemplate repassa o draft', async () => {
    mocks.messagingTemplateControllerCheckMetaTemplateHandler.mockResolvedValue({ issues: [] });
    const draft = { category: 'UTILITY', body: 'oi' } as unknown as Parameters<
      typeof api.checkMetaTemplate
    >[0];

    await api.checkMetaTemplate(draft);

    expect(mocks.messagingTemplateControllerCheckMetaTemplateHandler).toHaveBeenCalledWith(draft);
  });

  it('listTemplateButtons não recebe argumentos', async () => {
    mocks.messagingTemplateControllerListTemplateButtonsHandler.mockResolvedValue({
      reserved: [],
      handlers: [],
    });

    await api.listTemplateButtons();

    expect(mocks.messagingTemplateControllerListTemplateButtonsHandler).toHaveBeenCalledWith();
  });

  it('listTemplateTypes usa {} como default', async () => {
    mocks.messagingTemplateControllerListTemplateTypes.mockResolvedValue({ data: [], meta: {} });

    await api.listTemplateTypes();

    expect(mocks.messagingTemplateControllerListTemplateTypes).toHaveBeenCalledWith({});
  });

  it('createTemplateType repassa o payload', async () => {
    mocks.messagingTemplateControllerCreateTemplateType.mockResolvedValue({ id: 'tt1' });
    const payload = { key: 'otp', name: 'OTP' };

    await api.createTemplateType(payload);

    expect(mocks.messagingTemplateControllerCreateTemplateType).toHaveBeenCalledWith(payload);
  });

  it('updateTemplateType repassa id e payload', async () => {
    mocks.messagingTemplateControllerUpdateTemplateType.mockResolvedValue({ id: 'tt1' });

    await api.updateTemplateType('tt1', { name: 'Novo nome' });

    expect(mocks.messagingTemplateControllerUpdateTemplateType).toHaveBeenCalledWith('tt1', {
      name: 'Novo nome',
    });
  });

  it('removeTemplateType repassa o id', async () => {
    mocks.messagingTemplateControllerRemoveTemplateType.mockResolvedValue(undefined);

    const result = await api.removeTemplateType('tt1');

    expect(mocks.messagingTemplateControllerRemoveTemplateType).toHaveBeenCalledWith('tt1');
    expect(result.success).toBe(true);
  });

  it('listTemplates usa {} como default', async () => {
    mocks.messagingTemplateControllerListTemplatesHandler.mockResolvedValue({ data: [], meta: {} });

    await api.listTemplates();

    expect(mocks.messagingTemplateControllerListTemplatesHandler).toHaveBeenCalledWith({});
  });

  it('createTemplate repassa o payload', async () => {
    mocks.messagingTemplateControllerCreateTemplateHandler.mockResolvedValue({ id: 'tpl1' });
    const payload = {
      typeId: 'tt1',
      key: 'otp_code',
      language: 'pt_BR',
      category: 'AUTHENTICATION',
      body: '{{1}}',
    } as unknown as Parameters<typeof api.createTemplate>[0];

    await api.createTemplate(payload);

    expect(mocks.messagingTemplateControllerCreateTemplateHandler).toHaveBeenCalledWith(payload);
  });

  it('updateTemplate repassa id e payload', async () => {
    mocks.messagingTemplateControllerUpdateTemplateHandler.mockResolvedValue({ id: 'tpl1' });
    const payload = { body: 'novo corpo' };

    await api.updateTemplate('tpl1', payload);

    expect(mocks.messagingTemplateControllerUpdateTemplateHandler).toHaveBeenCalledWith(
      'tpl1',
      payload,
    );
  });

  it('removeTemplate usa remote=true por default e serializa como string', async () => {
    mocks.messagingTemplateControllerRemoveTemplateHandler.mockResolvedValue(undefined);

    await api.removeTemplate('tpl1');

    expect(mocks.messagingTemplateControllerRemoveTemplateHandler).toHaveBeenCalledWith('tpl1', {
      remote: 'true',
    });
  });

  it('removeTemplate repassa remote=false serializado como string', async () => {
    mocks.messagingTemplateControllerRemoveTemplateHandler.mockResolvedValue(undefined);

    await api.removeTemplate('tpl1', false);

    expect(mocks.messagingTemplateControllerRemoveTemplateHandler).toHaveBeenCalledWith('tpl1', {
      remote: 'false',
    });
  });

  it('submitTemplate repassa id e payload', async () => {
    mocks.messagingTemplateControllerSubmitTemplateHandler.mockResolvedValue({ status: 'PENDING' });

    await api.submitTemplate('tpl1', { connectionId: 'c1' });

    expect(mocks.messagingTemplateControllerSubmitTemplateHandler).toHaveBeenCalledWith('tpl1', {
      connectionId: 'c1',
    });
  });

  it('reconcileTemplateSubmissions repassa o connectionId', async () => {
    mocks.messagingTemplateControllerReconcileHandler.mockResolvedValue({ updated: 2 });

    const result = await api.reconcileTemplateSubmissions('c1');

    expect(mocks.messagingTemplateControllerReconcileHandler).toHaveBeenCalledWith('c1');
    expect(result).toMatchObject({ success: true, data: { updated: 2 } });
  });

  it('listRemoteTemplates repassa o connectionId', async () => {
    mocks.messagingTemplateControllerListRemoteTemplatesHandler.mockResolvedValue([]);

    await api.listRemoteTemplates('c1');

    expect(mocks.messagingTemplateControllerListRemoteTemplatesHandler).toHaveBeenCalledWith('c1');
  });

  it('linkRemoteTemplate repassa connectionId e payload', async () => {
    mocks.messagingTemplateControllerLinkRemoteTemplateHandler.mockResolvedValue(undefined);
    const payload = { remoteTemplateId: 'r1', templateId: 'tpl1' };

    await api.linkRemoteTemplate('c1', payload);

    expect(mocks.messagingTemplateControllerLinkRemoteTemplateHandler).toHaveBeenCalledWith(
      'c1',
      payload,
    );
  });

  it('importRemoteTemplate repassa connectionId e payload', async () => {
    mocks.messagingTemplateControllerImportRemoteTemplateHandler.mockResolvedValue(undefined);
    const payload = { remoteTemplateId: 'r1' };

    await api.importRemoteTemplate('c1', payload);

    expect(mocks.messagingTemplateControllerImportRemoteTemplateHandler).toHaveBeenCalledWith(
      'c1',
      payload,
    );
  });
});
