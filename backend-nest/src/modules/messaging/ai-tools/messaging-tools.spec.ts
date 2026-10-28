import { SendWhatsappMessageTool } from './send-whatsapp-message.tool';
import { ListWhatsappMessagesTool } from './list-whatsapp-messages.tool';
import { SendWhatsappTemplateTool } from './send-whatsapp-template.tool';
import { ListWhatsappTemplatesTool } from './list-whatsapp-templates.tool';
import { ListWhatsappTemplateTypesTool } from './list-whatsapp-template-types.tool';
import { CreateWhatsappTemplateTool } from './create-whatsapp-template.tool';
import { SubmitWhatsappTemplateTool } from './submit-whatsapp-template.tool';
import { GetMessagingConfigTool } from './get-messaging-config.tool';
import type { MessagingService } from '../messaging.service';
import type { ListMessagesUseCase } from '../use-cases/list-messages.use-case';

const ctx = { userId: 'user-1', roleName: 'ADMIN', approvedScopes: [] };

describe('tools de mensageria', () => {
  describe('send_whatsapp_message', () => {
    const messagingService = { send: vi.fn().mockResolvedValue('msg-1') };
    const tool = new SendWhatsappMessageTool(
      messagingService as unknown as MessagingService,
    );

    beforeEach(() => vi.clearAllMocks());

    // Escrita sem approvalScope seria executável sem aprovação nenhuma.
    it('declara approvalScope de escrita e role ADMIN', () => {
      expect(tool.definition.approvalScope).toBe('messaging:write');
      expect(tool.definition.roles).toEqual(['ADMIN']);
    });

    // O agente não pode enviar em nome de outra pessoa.
    it('usa o userId do contexto, nunca do input', async () => {
      await tool.execute(
        { phone: '5511987654321', text: 'oi', userId: 'outro' },
        ctx,
      );

      expect(messagingService.send).toHaveBeenCalledWith(
        { type: 'TEXT', phone: '5511987654321', text: 'oi' },
        { userId: 'user-1' },
      );
    });

    it('input inválido reprova antes de enviar', async () => {
      await expect(
        tool.execute({ phone: '5511999999999' }, ctx),
      ).rejects.toThrow();
      expect(messagingService.send).not.toHaveBeenCalled();
    });
  });

  describe('list_whatsapp_messages', () => {
    const listMessages = {
      execute: vi.fn().mockResolvedValue({
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        data: [
          {
            id: 'interno',
            phone: '5511987654321',
            direction: 'INBOUND',
            status: 'DELIVERED',
            type: 'TEXT',
            text: 'oi',
            error: null,
            raw: { segredo: true },
            createdAt: '2026-09-30T12:00:00Z',
          },
        ],
      }),
    };
    const tool = new ListWhatsappMessagesTool(
      listMessages as unknown as ListMessagesUseCase,
    );

    it('não é tool de escrita — leitura omite approvalScope', () => {
      expect(tool.definition.approvalScope).toBeUndefined();
    });

    // `raw` pode ter payload grande e dado que o modelo não precisa ver.
    it('não devolve `raw` nem id interno ao modelo', async () => {
      const res = (await tool.execute({})) as {
        messages: Record<string, unknown>[];
      };
      expect(res.messages[0]).not.toHaveProperty('raw');
      expect(res.messages[0]).not.toHaveProperty('id');
      expect(res.messages[0]).toMatchObject({
        text: 'oi',
        status: 'DELIVERED',
      });
    });

    it('limit acima do teto reprova', async () => {
      await expect(tool.execute({ limit: 500 })).rejects.toThrow();
    });
  });

  describe('get_messaging_config', () => {
    const connection = { id: 'conn-1', provider: 'EVOLUTION_API' };
    const connections = {
      list: vi.fn().mockResolvedValue([connection]),
      view: vi.fn().mockReturnValue({
        id: 'conn-1',
        provider: 'EVOLUTION_API',
        phone: '5534998956461',
        config: { baseUrl: 'http://evolution' },
        secrets: { token: true },
      }),
    };
    const state = {
      health: vi.fn().mockResolvedValue({ operational: true }),
      status: vi
        .fn()
        .mockResolvedValue({ supported: true, status: 'CONNECTED' }),
    };
    const messagingService = { isEnabled: vi.fn().mockResolvedValue(true) };

    const tool = new GetMessagingConfigTool(
      connections as never,
      state as never,
      messagingService as never,
    );

    // Se a credencial vazasse aqui, iria para o histórico da conversa e para o MCP.
    it('lista conexões com status das credenciais, nunca o valor', async () => {
      const res = (await tool.execute()) as {
        enabled: boolean;
        connections: Array<Record<string, unknown>>;
      };
      expect(res.enabled).toBe(true);
      expect(res.connections[0]).toMatchObject({
        id: 'conn-1',
        secrets: { token: true },
        health: { operational: true },
        session: { status: 'CONNECTED' },
      });
      expect(JSON.stringify(res)).not.toContain('segredo');
    });

    // Diagnóstico não pode quebrar justamente quando o provider está fora.
    it('provider fora do ar não derruba a tool', async () => {
      state.status.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const res = (await tool.execute()) as {
        connections: Array<{ session: { error: string } }>;
      };
      expect(res.connections[0].session.error).toContain('ECONNREFUSED');
    });
  });

  describe('send_whatsapp_template', () => {
    const messagingService = { sendTemplate: vi.fn().mockResolvedValue('msg-2') };
    const tool = new SendWhatsappTemplateTool(
      messagingService as unknown as MessagingService,
    );

    beforeEach(() => vi.clearAllMocks());

    it('declara approvalScope de escrita e role ADMIN', () => {
      expect(tool.definition.approvalScope).toBe('messaging:write');
      expect(tool.definition.roles).toEqual(['ADMIN']);
    });

    it('usa o userId do contexto e recusa variável sensível', async () => {
      const res = await tool.execute(
        { phone: '5511987654321', templateKey: 'ORDER', values: { order_id: '9' }, userId: 'outro' },
        ctx,
      );

      expect(res).toEqual({ id: 'msg-2', status: 'QUEUED' });
      expect(messagingService.sendTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '5511987654321',
          key: 'ORDER',
          values: { order_id: '9' },
          allowSensitive: false,
        }),
        { userId: 'user-1', connectionId: undefined },
      );
    });

    it('sem templateId nem templateKey reprova antes de enviar', async () => {
      await expect(tool.execute({ phone: '5511987654321' }, ctx)).rejects.toThrow();
      expect(messagingService.sendTemplate).not.toHaveBeenCalled();
    });

    // O agente não pode trocar o nome que o sistema tira do contato.
    it('reserved só aceita variável sem origem no contexto', async () => {
      await expect(
        tool.execute(
          { phone: '5511987654321', templateKey: 'ORDER', reserved: { first_name: 'Outro' } },
          ctx,
        ),
      ).rejects.toThrow(/reserved.provide/);
      expect(messagingService.sendTemplate).not.toHaveBeenCalled();
    });
  });

  describe('list_whatsapp_templates', () => {
    const prisma = {
      messagingTemplate: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'tpl-1',
            key: 'ORDER',
            language: 'pt-BR',
            body: 'Olá {{ first_name }}, pedido {{ order_id }}',
            type: {
              variables: [
                { name: 'order_id', type: 'STRING', required: true },
                { name: 'first_name', type: 'STRING', required: false, reserved: true },
              ],
            },
          },
        ]),
      },
    };
    const tool = new ListWhatsappTemplatesTool(prisma as never);

    it('separa o que o agente informa do que o sistema preenche', async () => {
      const [t] = (await tool.execute({})) as Array<Record<string, unknown>>;
      expect(t).toMatchObject({
        id: 'tpl-1',
        values: [{ name: 'order_id', required: true }],
        reserved: { provide: [], auto: ['first_name'] },
      });
    });
  });

  describe('list_whatsapp_templates — envio pelo agente', () => {
    const row = (over: Record<string, unknown>) => ({
      id: 'tpl-1',
      key: 'NOTICE',
      language: 'pt-BR',
      body: 'oi',
      buttons: null,
      invalidatedAt: null,
      invalidReason: null,
      type: { key: 'NOTICE_T', variables: [] },
      ...over,
    });
    const run = async (r: unknown) => {
      const prisma = { messagingTemplate: { findMany: vi.fn().mockResolvedValue([r]) } };
      const [t] = (await new ListWhatsappTemplatesTool(prisma as never).execute({})) as Array<
        Record<string, unknown>
      >;
      return t;
    };

    it('template válido sem link do sistema é enviável', async () => {
      expect(await run(row({}))).toMatchObject({
        typeKey: 'NOTICE_T',
        invalid: false,
        sendableByAgent: true,
        notSendableReason: null,
      });
    });

    it('template inválido não é enviável e traz o motivo', async () => {
      expect(
        await run(row({ invalidatedAt: new Date(), invalidReason: 'faltou {{ x }}' })),
      ).toMatchObject({ invalid: true, sendableByAgent: false, notSendableReason: 'faltou {{ x }}' });
    });

    it('link do sistema (botão URL com slot) não é enviável pelo agente', async () => {
      const t = await run(
        row({
          buttons: [
            { kind: 'QUICK_REPLY', label: 'Ok', slot: 'ack' },
            { kind: 'URL', label: 'Abrir', url: 'https://x/{{ open }}', slot: 'open' },
          ],
        }),
      );
      expect(t).toMatchObject({ sendableByAgent: false });
      expect(t.buttons).toEqual([
        { kind: 'QUICK_REPLY', label: 'Ok', slot: 'ack' },
        { kind: 'URL', label: 'Abrir', slot: 'open' },
      ]);
    });

    it('botão URL livre (sem slot) não bloqueia', async () => {
      const t = await run(
        row({ buttons: [{ kind: 'URL', label: 'Site', url: 'https://example.com' }] }),
      );
      expect(t).toMatchObject({ sendableByAgent: true });
    });
  });

  describe('list_whatsapp_template_types', () => {
    const prisma = {
      messagingTemplateType: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'ty-1',
            key: 'NOTICE_T',
            name: 'Aviso',
            _count: { templates: 2 },
            variables: [
              { name: 'title', type: 'STRING', required: true },
              { name: 'first_name', type: 'STRING', required: false, reserved: true },
            ],
            buttons: [
              { key: 'ack', kind: 'QUICK_REPLY', required: true },
              { key: 'open', kind: 'URL', urlBase: 'https://x/', required: true },
            ],
          },
        ]),
      },
    };
    const tool = new ListWhatsappTemplateTypesTool(prisma as never);

    it('é somente leitura: sem approvalScope e só ADMIN', () => {
      expect(tool.definition.approvalScope).toBeUndefined();
      expect(tool.definition.roles).toEqual(['ADMIN']);
    });

    it('expõe o contrato do tipo sem a URL base', async () => {
      const [t] = (await tool.execute({})) as Array<Record<string, unknown>>;
      expect(t).toMatchObject({
        key: 'NOTICE_T',
        templatesCount: 2,
        variables: [{ name: 'title', required: true }],
        reserved: { provide: [], auto: ['first_name'] },
      });
      expect(t.buttons).toEqual([
        { key: 'ack', kind: 'QUICK_REPLY', reserved: false, required: true, systemLink: false },
        { key: 'open', kind: 'URL', reserved: false, required: true, systemLink: true },
      ]);
    });
  });

  describe('create_whatsapp_template', () => {
    const prisma = {
      messagingTemplateType: { findUnique: vi.fn().mockResolvedValue({ id: 'ty-1' }) },
    };
    const createTemplate = {
      execute: vi.fn().mockResolvedValue({
        id: 'tpl-9',
        key: 'NOTICE',
        language: 'pt-BR',
        category: 'UTILITY',
        body: '{{ title }} chegou, veja os detalhes agora',
        footer: null,
        buttons: null,
      }),
    };
    const tool = new CreateWhatsappTemplateTool(prisma as never, createTemplate as never);
    const input = {
      typeKey: 'NOTICE_T',
      key: 'NOTICE',
      language: 'pt-BR',
      category: 'UTILITY',
      body: '{{ title }} chegou, veja os detalhes agora',
    };

    beforeEach(() => vi.clearAllMocks());

    it('exige aprovação de escrita e só ADMIN', () => {
      expect(tool.definition.approvalScope).toBe('messaging:write');
      expect(tool.definition.roles).toEqual(['ADMIN']);
    });

    it('cria só o rascunho (resolve o tipo pela chave) e devolve as regras da Meta', async () => {
      const out = (await tool.execute(input)) as Record<string, unknown>;
      expect(createTemplate.execute).toHaveBeenCalledWith(
        expect.objectContaining({ typeId: 'ty-1', key: 'NOTICE' }),
      );
      expect(out).toMatchObject({ id: 'tpl-9', status: 'DRAFT', submitted: false });
      // corpo começa com variável → erro da Meta visível ao agente antes de submeter
      expect((out.metaRules as { code: string }[]).map((i) => i.code)).toContain(
        'BODY_STARTS_WITH_VARIABLE',
      );
    });

    it('o agente não consegue furar o opt-out nem informar typeId', async () => {
      await tool.execute({ ...input, bypassOptOut: true, typeId: 'outro' });
      const arg = createTemplate.execute.mock.calls[0][0];
      expect(arg.bypassOptOut).toBeUndefined();
      expect(arg.typeId).toBe('ty-1');
    });

    it('tipo inexistente falha antes de criar', async () => {
      prisma.messagingTemplateType.findUnique.mockResolvedValueOnce(null);
      await expect(tool.execute(input)).rejects.toThrow(/não encontrado/);
      expect(createTemplate.execute).not.toHaveBeenCalled();
    });
  });

  describe('submit_whatsapp_template', () => {
    const submit = {
      execute: vi.fn().mockResolvedValue({ connectionId: 'c1', status: 'PENDING', reason: null }),
    };
    const tool = new SubmitWhatsappTemplateTool(submit as never);

    it('exige aprovação de escrita (ação externa) e só ADMIN', () => {
      expect(tool.definition.approvalScope).toBe('messaging:write');
      expect(tool.definition.roles).toEqual(['ADMIN']);
    });

    it('submete com conexão e exemplos e devolve o status', async () => {
      const out = await tool.execute({
        templateId: 'tpl-9',
        connectionId: 'c1',
        examples: { title: 'Aviso' },
      });
      expect(submit.execute).toHaveBeenCalledWith('tpl-9', {
        connectionId: 'c1',
        examples: { title: 'Aviso' },
      });
      expect(out).toMatchObject({ templateId: 'tpl-9', status: 'PENDING' });
    });

    it('sem conexão reprova antes de submeter', async () => {
      submit.execute.mockClear();
      await expect(tool.execute({ templateId: 'tpl-9' })).rejects.toThrow();
      expect(submit.execute).not.toHaveBeenCalled();
    });
  });
});
