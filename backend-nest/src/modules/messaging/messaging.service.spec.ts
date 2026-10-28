import type { Logger } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingNonRetryableError } from './messaging.errors';
import {
  MESSAGING_SEND_PARTITIONS,
  sendPartition,
} from './messaging-queue.const';
import {
  EVO,
  GO_CONNECTION,
  META,
  realConnections,
  type ConnectionRow,
} from './test-utils/messaging-fixtures';

const PHONE = '5511987654321';

function setup(rows: ConnectionRow[] = [EVO], withQueues = true) {
  const {
    service: connections,
    registry,
    prisma: connPrisma,
  } = realConnections(rows);
  const prisma = {
    messagingMessage: {
      create: vi.fn().mockResolvedValue({ id: 'msg-1' }),
      findUnique: vi.fn(),
      // Padrão: nenhuma mensagem anterior pendente para o mesmo destinatário.
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    messagingContact: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: 'contact-1' }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    messagingConversation: {
      upsert: vi.fn().mockResolvedValue({}),
      // Padrão: contato falou agora (dentro da janela); os testes da janela sobrescrevem.
      findFirst: vi.fn().mockResolvedValue({ lastInboundAt: new Date() }),
    },
    messagingTemplateSubmission: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    messagingTemplate: { update: vi.fn().mockResolvedValue({}) },
    ...connPrisma,
  };
  // Aceita as duas formas de $transaction (array e callback), usando o próprio `prisma` como `tx`.
  prisma.$transaction = vi.fn((arg: unknown) =>
    Array.isArray(arg)
      ? Promise.all(arg)
      : (arg as (tx: typeof prisma) => unknown)(prisma),
  ) as never;
  const flags = { isEnabled: vi.fn().mockResolvedValue(true) };
  const state = { applyEvent: vi.fn().mockResolvedValue(undefined) };
  const events = { emit: vi.fn() };
  const queue = { add: vi.fn().mockResolvedValue({}) };
  // Uma fila por partição; todas repassam ao mesmo espião, e cada uma guarda o seu para checar o roteamento.
  const partitionQueues = Array.from(
    { length: MESSAGING_SEND_PARTITIONS },
    () => ({
      add: vi.fn((...args: unknown[]) => queue.add(...args)),
    }),
  );
  const templates = { resolve: vi.fn() };
  const buttonEvents = { capture: vi.fn().mockResolvedValue(undefined) };
  const profiles = { syncQuietly: vi.fn() };
  const webhooks = { ignoredPhones: vi.fn().mockResolvedValue(new Set<string>()) };
  const service = new MessagingService(
    prisma as never,
    flags as never,
    connections,
    registry,
    state as never,
    events as never,
    { t: (key: string) => key } as never,
    templates as never,
    profiles as never,
    webhooks as never,
    withQueues ? (partitionQueues as never) : null,
    buttonEvents as never,
  );
  return {
    service,
    webhooks,
    buttonEvents,
    templates,
    prisma,
    flags,
    profiles,
    state,
    events,
    queue,
    partitionQueues,
    connections,
    registry,
  };
}

const okJson = (body: unknown) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: () => Promise.resolve(body),
});
const failJson = (status: number, body: unknown) => ({
  ok: false,
  status,
  statusText: 'x',
  json: () => Promise.resolve(body),
});

describe('MessagingService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('kill-switch', () => {
    // A flag nasce sem roles; avaliar com roleName vazio é o que a faz valer para cron e webhook.
    it('consulta MESSAGING com roleName vazio', async () => {
      const { service, flags } = setup();
      await service.isEnabled();
      expect(flags.isEnabled).toHaveBeenCalledWith('MESSAGING', '');
    });

    it('repassa o resultado da flag', async () => {
      const { service, flags } = setup();
      flags.isEnabled.mockResolvedValue(false);
      expect(await service.isEnabled()).toBe(false);
    });
  });

  describe('providerFor', () => {
    it('monta o provider da conexão com a config decifrada', async () => {
      const { service } = setup([META]);
      const fetchSpy = vi
        .fn()
        .mockResolvedValue(okJson({ messages: [{ id: 'wamid.X' }] }));
      vi.stubGlobal('fetch', fetchSpy);

      await (
        await service.providerFor('conn-meta')
      ).send({ type: 'TEXT', phone: PHONE, text: 'x' });

      expect(fetchSpy.mock.calls[0][0]).toContain('graph.facebook.com');
      // O token foi decifrado antes de ir ao provider.
      expect((fetchSpy.mock.calls[0][1] as RequestInit).headers).toMatchObject({
        Authorization: 'Bearer tok-meta',
      });
    });

    it('config incompleta estoura com o campo faltando, não com erro genérico', async () => {
      const { service } = setup([{ ...EVO, config: {} }]);
      await expect(service.providerFor('conn-evo')).rejects.toThrow(
        /baseUrl|instance|token/,
      );
    });

    it('conexão inexistente é 404', async () => {
      const { service } = setup();
      await expect(service.providerFor('nao-existe')).rejects.toThrow(
        'messaging.connection_not_found',
      );
    });
  });

  describe('inspectCandidate', () => {
    it('erro de schema reprova SEM chamar a rede', async () => {
      const { service } = setup();
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const { result: res } = await service.inspectCandidate({
        provider: 'META',
        config: { phoneNumberId: 'abc', accessToken: 'tok' },
      });

      expect(res.status).toBe(false);
      expect(res.data).toContain('phoneNumberId');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('Meta válida devolve o número da conta — é o que fixa o número da conexão', async () => {
      const { service } = setup();
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(
            okJson({
              verified_name: 'Empresa',
              display_phone_number: '+55 34 99895-6461',
            }),
          )
          .mockResolvedValueOnce(
            okJson({ display_phone_number: '+55 34 99895-6461' }),
          ),
      );

      const res = await service.inspectCandidate({
        provider: 'META',
        config: { phoneNumberId: '123', accessToken: 'tok', wabaId: 'waba-1' },
      });

      expect(res.result.status).toBe(true);
      expect(res.accountPhone).toBe('5534998956461');
    });

    it('credencial reprovada não consulta o número', async () => {
      const { service } = setup();
      const fetchSpy = vi
        .fn()
        .mockResolvedValue(
          failJson(401, { error: { message: 'Invalid token' } }),
        );
      vi.stubGlobal('fetch', fetchSpy);
      const res = await service.inspectCandidate({
        provider: 'META',
        config: { phoneNumberId: '123', accessToken: 'ruim', wabaId: 'waba-1' },
      });
      expect(res.result.status).toBe(false);
      expect(res.accountPhone).toBeNull();
      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it('Evolution não sabe o número sem QR: accountPhone nulo', async () => {
      const { service } = setup();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(okJson({ instance: { state: 'open' } })),
      );
      const res = await service.inspectCandidate({
        provider: 'EVOLUTION_API',
        config: { baseUrl: 'http://x', token: 't', instance: 'i' },
      });
      expect(res.accountPhone).toBeNull();
    });

    it('provider desconhecido não explode', async () => {
      const { service } = setup();
      const { result: res } = await service.inspectCandidate({
        provider: 'TELEGRAM' as never,
        config: {},
      });
      expect(res.status).toBe(false);
      expect(res.data).toContain('desconhecido');
    });
  });

  describe('send — kill-switch, conexão e opt-out', () => {
    const TEXT = { type: 'TEXT', phone: '551187654321', text: 'oi' } as const;

    it('flag desligada recusa mesmo sem usuário no contexto (cron/job)', async () => {
      const { service, flags, prisma, queue } = setup();
      flags.isEnabled.mockResolvedValue(false);
      await expect(service.send(TEXT)).rejects.toThrow('messaging.disabled');
      expect(prisma.messagingMessage.create).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    describe('janela de atendimento (Meta, 24h)', () => {
      it('texto livre sem mensagem recebida é recusado antes de gravar', async () => {
        const { service, prisma, queue } = setup([META]);
        prisma.messagingConversation.findFirst.mockResolvedValue(null);
        await expect(service.send(TEXT)).rejects.toThrow(
          'messaging.outside_service_window',
        );
        expect(prisma.messagingMessage.create).not.toHaveBeenCalled();
        expect(queue.add).not.toHaveBeenCalled();
      });

      it('texto livre com última mensagem recebida há mais de 24h é recusado', async () => {
        const { service, prisma } = setup([META]);
        prisma.messagingConversation.findFirst.mockResolvedValue({
          lastInboundAt: new Date(Date.now() - 25 * 3_600_000),
        });
        await expect(service.send(TEXT)).rejects.toThrow(
          'messaging.outside_service_window',
        );
      });

      it('dentro da janela envia', async () => {
        const { service, prisma } = setup([META]);
        prisma.messagingConversation.findFirst.mockResolvedValue({
          lastInboundAt: new Date(Date.now() - 3_600_000),
        });
        await expect(service.send(TEXT)).resolves.toBeDefined();
      });

      it('provider sem janela (Evolution) não consulta nem recusa', async () => {
        const { service, prisma } = setup([EVO]);
        prisma.messagingConversation.findFirst.mockResolvedValue(null);
        await expect(service.send(TEXT)).resolves.toBeDefined();
        expect(prisma.messagingConversation.findFirst).not.toHaveBeenCalled();
      });
    });

    it('sem conexão nenhuma recusa dizendo para criar uma', async () => {
      const { service, prisma } = setup([]);
      await expect(service.send(TEXT)).rejects.toThrow(
        'messaging.no_connection',
      );
      expect(prisma.messagingMessage.create).not.toHaveBeenCalled();
    });

    /** trySend é a porta de quem a mensagem é um extra: falha nunca quebra o chamador, diferente de send. */
    describe('trySend — canal opcional', () => {
      it('flag desligada devolve null em vez de lançar', async () => {
        const { service, flags, queue } = setup();
        flags.isEnabled.mockResolvedValue(false);

        await expect(service.trySend(TEXT)).resolves.toBeNull();
        expect(queue.add).not.toHaveBeenCalled();
      });

      it('sem conexão devolve null em vez de lançar', async () => {
        const { service } = setup([]);
        await expect(service.trySend(TEXT)).resolves.toBeNull();
      });

      it('com mensageria pronta, enfileira como o send', async () => {
        const { service, queue } = setup([EVO]);

        await expect(service.trySend(TEXT)).resolves.toEqual(
          expect.any(String),
        );
        expect(queue.add).toHaveBeenCalled();
      });
    });

    it('sem connectionId usa a conexão mais antiga; com connectionId usa a pedida', async () => {
      const { service, prisma } = setup([EVO, GO_CONNECTION]);
      await service.send(TEXT);
      expect(
        prisma.messagingMessage.create.mock.calls[0][0].data.connectionId,
      ).toBe('conn-evo');

      await service.send(TEXT, { connectionId: 'conn-go' });
      expect(
        prisma.messagingMessage.create.mock.calls[1][0].data.connectionId,
      ).toBe('conn-go');
    });

    it('connectionId inexistente é recusado antes de qualquer escrita', async () => {
      const { service, prisma } = setup();
      await expect(
        service.send(TEXT, { connectionId: 'nada' }),
      ).rejects.toThrow('messaging.connection_not_found');
      expect(prisma.messagingMessage.create).not.toHaveBeenCalled();
    });

    // Opt-out é do CONTATO (global, por telefone): bloqueado, bloqueado em qualquer conexão.
    it('opt-out bloqueia o envio por qualquer conexão, e NÃO enfileira', async () => {
      const { service, prisma, queue } = setup([EVO, GO_CONNECTION]);
      prisma.messagingContact.findUnique.mockResolvedValue({ optOut: true });

      await expect(
        service.send(TEXT, { connectionId: 'conn-go' }),
      ).rejects.toThrow('messaging.opt_out');
      expect(prisma.messagingContact.findUnique).toHaveBeenCalledWith({
        where: { phone: '5511987654321' },
        select: { optOut: true },
      });
      expect(prisma.messagingMessage.create).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    // bypassOptOut é permissão (ex.: aviso de segurança), não rótulo do template — furar sem ele é bug.
    it('bypassOptOut fura o opt-out; sem a flag o guard volta a bloquear', async () => {
      const { service, prisma } = setup([EVO, GO_CONNECTION]);
      prisma.messagingContact.findUnique.mockResolvedValue({ optOut: true });

      await expect(
        service.send(TEXT, { connectionId: 'conn-go', bypassOptOut: true }),
      ).resolves.toEqual(expect.any(String));
      expect(prisma.messagingMessage.create).toHaveBeenCalled();

      await expect(
        service.send(TEXT, { connectionId: 'conn-go', bypassOptOut: false }),
      ).rejects.toThrow('messaging.opt_out');
    });

    // Falha na hora, antes de qualquer escrita — a fila faria 5 tentativas e isso não melhora.
    describe('precheck de aprovação de template', () => {
      const templateInput = {
        type: 'TEMPLATE' as const,
        phone: '5511987654321',
        template: {
          name: 'password_changed',
          language: 'pt-BR',
          category: 'UTILITY' as const,
          values: {},
          body: 'oi',
        },
      };

      it('conexão sem fluxo de aprovação (Evolution) nunca consulta submissão', async () => {
        const { service, prisma } = setup([EVO]);

        await expect(
          service.send(templateInput, { templateId: 'tpl-1' }),
        ).resolves.toEqual(expect.any(String));
        expect(
          prisma.messagingTemplateSubmission.findUnique,
        ).not.toHaveBeenCalled();
      });

      it('Meta sem submissão para a conexão falha na primeira tentativa, sem enfileirar', async () => {
        const { service, prisma, queue } = setup([META]);

        await expect(
          service.send(templateInput, {
            connectionId: 'conn-meta',
            templateId: 'tpl-1',
          }),
        ).rejects.toThrow(/template_not_approved/);
        expect(prisma.messagingMessage.create).not.toHaveBeenCalled();
        expect(queue.add).not.toHaveBeenCalled();
      });

      it('Meta com submissão PENDING (ainda) falha; APPROVED passa', async () => {
        const { service, prisma } = setup([META]);
        const findUnique = prisma.messagingTemplateSubmission.findUnique;
        findUnique.mockResolvedValue({ status: 'PENDING' });

        await expect(
          service.send(templateInput, {
            connectionId: 'conn-meta',
            templateId: 'tpl-1',
          }),
        ).rejects.toThrow(/template_not_approved/);

        findUnique.mockResolvedValue({ status: 'APPROVED' });
        await expect(
          service.send(templateInput, {
            connectionId: 'conn-meta',
            templateId: 'tpl-1',
          }),
        ).resolves.toEqual(expect.any(String));
        expect(findUnique).toHaveBeenCalledWith({
          where: {
            templateId_connectionId: {
              templateId: 'tpl-1',
              connectionId: 'conn-meta',
            },
          },
        });
      });
    });

    it('opt-out consultado com o telefone já normalizado (variante sem o 9 não escapa)', async () => {
      const { service, prisma } = setup();
      await service.send(TEXT);
      expect(
        prisma.messagingContact.findUnique.mock.calls[0][0].where.phone,
      ).toBe('5511987654321');
    });

    it('telefone vazio recusa antes de qualquer escrita', async () => {
      const { service, prisma } = setup();
      await expect(
        service.send({ type: 'TEXT', phone: '   ', text: 'x' }),
      ).rejects.toThrow('messaging.phone_required');
      expect(prisma.messagingMessage.create).not.toHaveBeenCalled();
    });

    it('grava QUEUED normalizado, vinculado à conexão e ao contato, e enfileira só o id', async () => {
      const { service, prisma, queue } = setup();
      const id = await service.send(TEXT, { userId: 'user-9' });

      // O contato é global (por telefone); a conversa é que é por (conexão, contato).
      expect(prisma.messagingContact.upsert).toHaveBeenCalledWith({
        where: { phone: '5511987654321' },
        // A atividade do contato acompanha a da conversa: é por ela que a inbox ordena, no banco.
        create: { phone: '5511987654321', lastMessageAt: expect.any(Date) },
        update: { lastMessageAt: expect.any(Date) },
        select: { id: true },
      });
      expect(prisma.messagingConversation.upsert).toHaveBeenCalledWith({
        where: {
          connectionId_contactId: {
            connectionId: 'conn-evo',
            contactId: 'contact-1',
          },
        },
        create: {
          connectionId: 'conn-evo',
          contactId: 'contact-1',
          lastMessageAt: expect.any(Date),
        },
        update: { lastMessageAt: expect.any(Date) },
      });
      expect(prisma.messagingMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            connectionId: 'conn-evo',
            contactId: 'contact-1',
            direction: 'OUTBOUND',
            status: 'QUEUED',
            type: 'TEXT',
            text: 'oi',
            sentById: 'user-9',
          }),
        }),
      );
      expect(
        prisma.messagingMessage.create.mock.calls[0][0].data,
      ).not.toHaveProperty('phone');
      expect(queue.add).toHaveBeenCalledWith(
        'send',
        { messageId: 'msg-1' },
        expect.objectContaining({ attempts: 1 }),
      );
      expect(id).toBe('msg-1');
    });

    describe('sendTemplate', () => {
      const RESOLVED = {
        name: 'login_code',
        language: 'pt-BR',
        category: 'AUTHENTICATION',
        values: { code_number: '123456' },
        body: 'Seu código é 123456',
      };

      it('resolve pelo catálogo e envia com templateId e o bypassOptOut do template', async () => {
        const { service, prisma, queue, templates: t } = setup();
        t.resolve.mockResolvedValue({
          templateId: 'tpl-1',
          resolved: RESOLVED,
          bypassOptOut: true,
        });
        prisma.messagingContact.findUnique.mockResolvedValue({ optOut: true });

        const id = await service.sendTemplate({
          key: 'LOGIN_CODE',
          phone: PHONE,
        });

        // opt-out ignorado porque o template o fura; sem sensitive o job leva o id e a permissão de
        // furar o opt-out (o dispatch reconfere o opt-out e precisa saber disso).
        expect(id).toBe('msg-1');
        expect(queue.add).toHaveBeenCalledWith(
          'send',
          { messageId: 'msg-1', bypassOptOut: true },
          expect.anything(),
        );
      });

      it('grava na mensagem o template de origem e a referência de negócio', async () => {
        const { service, prisma, templates: t } = setup();
        t.resolve.mockResolvedValue({
          templateId: 'tpl-1',
          resolved: RESOLVED,
          bypassOptOut: false,
        });

        await service.sendTemplate(
          { key: 'LOGIN_CODE', phone: PHONE },
          { correlation: { type: 'order', id: '42' } },
        );

        expect(prisma.messagingMessage.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              templateId: 'tpl-1',
              correlation: { type: 'order', id: '42' },
            }),
          }),
        );
      });

      it('trySendTemplate devolve null em vez de lançar', async () => {
        const { service, templates: t } = setup();
        t.resolve.mockRejectedValue(new Error('sem template'));
        await expect(
          service.trySendTemplate({ key: 'X', phone: PHONE }),
        ).resolves.toBeNull();
      });

      describe('variável sensitive', () => {
        const REDACTED = {
          ...RESOLVED,
          redacted: {
            body: 'Seu código é ••••••',
            values: { code_number: '••••••' },
            names: ['code_number'],
          },
        };

        it('o banco guarda a versão mascarada; o texto real viaja só no job', async () => {
          const { service, prisma, queue, templates: t } = setup();
          t.resolve.mockResolvedValue({
            templateId: 'tpl-1',
            resolved: REDACTED,
            bypassOptOut: false,
          });

          await service.sendTemplate({ key: 'LOGIN_CODE', phone: PHONE });

          const data = prisma.messagingMessage.create.mock.calls[0][0].data;
          expect(data.text).toBe('Seu código é ••••••');
          expect(JSON.stringify(data.raw)).not.toContain('123456');
          expect(data.raw.template.sensitive).toEqual(['code_number']);

          const [, job, opts] = queue.add.mock.calls[0];
          expect(job.input.template.body).toBe('Seu código é 123456');
          expect(opts.removeOnFail).toEqual({ age: 3600 });
        });

        it('dispatch de linha mascarada sem o conteúdo real recusa em vez de mandar "••••••"', async () => {
          const { service, prisma } = setup();
          prisma.messagingMessage.findUnique.mockResolvedValue({
            id: 'msg-1',
            connectionId: 'conn-evo',
            type: 'TEMPLATE',
            contact: { phone: PHONE },
            text: 'Seu código é ••••••',
            mediaUrl: null,
            raw: { type: 'TEMPLATE', template: { sensitive: ['code_number'] } },
          });

          await expect(service.dispatch('msg-1')).rejects.toThrow(/sensível/);
        });
      });
    });

    // A mensagem depende do contactId (FK): diferente da versão antiga, onde `phone` ficava na
    // própria linha, uma falha real no upsert do contato agora impede o envio.
    it('falha no upsert de contato impede o envio — a mensagem depende do contactId', async () => {
      const { service, prisma, queue } = setup();
      prisma.messagingContact.upsert.mockRejectedValue(
        new Error('unique violation'),
      );
      await expect(service.send(TEXT)).rejects.toThrow('unique violation');
      expect(prisma.messagingMessage.create).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('avisa a tela na hora que a mensagem foi registrada', async () => {
      const { service, events } = setup();
      await service.send(TEXT);
      expect(events.emit).toHaveBeenCalledWith({ type: 'messages' });
    });
  });

  describe('dispatch', () => {
    const row = {
      id: 'msg-1',
      connectionId: 'conn-evo',
      type: 'TEXT',
      contact: { phone: PHONE },
      text: 'oi',
      mediaUrl: null,
      raw: null,
    };

    it('sucesso grava SENT com o providerMessageId e limpa o erro', async () => {
      const { service, prisma } = setup();
      prisma.messagingMessage.findUnique.mockResolvedValue(row);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(okJson({ key: { id: '3EB0OK' } })),
      );

      await service.dispatch('msg-1');

      expect(prisma.messagingMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { status: 'SENT', providerMessageId: '3EB0OK', error: null },
      });
    });

    it('envia pelo provider da conexão DA MENSAGEM, não de outra', async () => {
      const { service, prisma } = setup([EVO, GO_CONNECTION]);
      prisma.messagingMessage.findUnique.mockResolvedValue({
        ...row,
        connectionId: 'conn-go',
      });
      const fetchSpy = vi.fn().mockResolvedValue(okJson({ messageId: 'X' }));
      vi.stubGlobal('fetch', fetchSpy);

      await service.dispatch('msg-1');
      expect(fetchSpy.mock.calls[0][0]).toBe('http://go:8080/send/text');
    });

    // O webhook pode ecoar nossa mensagem antes de gravarmos o id; sem descartar o eco, o
    // update violaria a unicidade e o retry da fila reenviaria a mensagem.
    it('descarta o eco do webhook que chegou antes do id — só desta conexão', async () => {
      const { service, prisma } = setup();
      prisma.messagingMessage.findUnique.mockResolvedValue(row);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(okJson({ key: { id: '3EB0OK' } })),
      );

      await service.dispatch('msg-1');

      expect(prisma.messagingMessage.deleteMany).toHaveBeenCalledWith({
        where: {
          connectionId: 'conn-evo',
          providerMessageId: '3EB0OK',
          id: { not: 'msg-1' },
        },
      });
    });

    // A outra metade da corrida do §2: o eco chegou ANTES do id (criou uma linha própria), e
    // markSent precisa ler o raw dela antes de apagá-la, ou a mídia enviada por upload se perde.
    it('eco chegado ANTES do id: aproveita o raw dele antes de apagar a linha', async () => {
      const { service, prisma } = setup();
      prisma.messagingMessage.findUnique.mockResolvedValue(row);
      prisma.messagingMessage.findMany.mockResolvedValue([
        { raw: { key: { id: '3EB0OK' }, message: { imageMessage: {} } } },
      ]);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(okJson({ key: { id: '3EB0OK' } })),
      );

      await service.dispatch('msg-1');

      expect(prisma.messagingMessage.deleteMany).toHaveBeenCalledWith({
        where: {
          connectionId: 'conn-evo',
          providerMessageId: '3EB0OK',
          id: { not: 'msg-1' },
        },
      });
      expect(prisma.messagingMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: {
          status: 'SENT',
          providerMessageId: '3EB0OK',
          error: null,
          raw: { key: { id: '3EB0OK' }, message: { imageMessage: {} } },
        },
      });
    });

    it('falha grava FAILED com a mensagem, avisa a tela e propaga para a fila retentar', async () => {
      const { service, prisma, events } = setup();
      prisma.messagingMessage.findUnique.mockResolvedValue(row);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(failJson(401, { message: 'Unauthorized' })),
      );

      await expect(service.dispatch('msg-1')).rejects.toThrow(/401/);
      expect(prisma.messagingMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { status: 'FAILED', error: expect.stringContaining('401') },
      });
      expect(events.emit).toHaveBeenCalledWith({ type: 'messages' });
    });

    it('id inexistente é 404, não erro genérico', async () => {
      const { service, prisma } = setup();
      prisma.messagingMessage.findUnique.mockResolvedValue(null);
      await expect(service.dispatch('sumiu')).rejects.toThrow(
        'messaging.message_not_found',
      );
    });
  });

  describe('send — arquivo anexado', () => {
    const FILE = {
      type: 'IMAGE',
      phone: '551187654321',
      file: { data: Buffer.from('PNG'), mimeType: 'image/png' },
      caption: 'olha',
    } as const;

    const prepare = () => {
      const ctx = setup();
      ctx.prisma.messagingMessage.findUnique.mockResolvedValue({
        id: 'msg-1',
        connectionId: 'conn-evo',
        type: 'IMAGE',
        contact: { phone: PHONE },
        raw: {},
      });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(okJson({ key: { id: '3EB0OK' } })),
      );
      return ctx;
    };

    it('não vai para a fila: os bytes não são gravados, então envia na própria chamada', async () => {
      const { service, queue, prisma } = prepare();
      await service.send(FILE);
      expect(queue.add).not.toHaveBeenCalled();
      expect(prisma.messagingMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SENT' }),
        }),
      );
    });

    it('o banco guarda legenda e mimetype, mas nunca o arquivo', async () => {
      const { service, prisma } = prepare();
      await service.send(FILE);
      const data = prisma.messagingMessage.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        type: 'IMAGE',
        text: 'olha',
        mimeType: 'image/png',
        mediaUrl: null,
      });
      expect(JSON.stringify(data.raw)).not.toContain('PNG');
      expect(data.raw).not.toHaveProperty('file');
    });

    it('falha do provider vira FAILED e chega ao chamador', async () => {
      const { service, prisma } = prepare();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(failJson(500, { message: 'boom' })),
      );
      await expect(service.send(FILE)).rejects.toThrow(/500/);
      expect(prisma.messagingMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    it('mídia sem origem, ou com as duas, é 400', async () => {
      const { service } = prepare();
      await expect(
        service.send({ type: 'IMAGE', phone: '551187654321' } as never),
      ).rejects.toThrow('messaging.media_source');
      await expect(
        service.send({ ...FILE, mediaUrl: 'https://x.com/a.png' } as never),
      ).rejects.toThrow('messaging.media_source');
    });

    // Sem o id do upload não há como baixar depois a mídia que NÓS enviamos (a Meta não a devolve por messageId).
    it('Meta: guarda o id do upload no raw para a mídia poder ser baixada depois', async () => {
      const { service, prisma } = setup([META]);
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(okJson({ id: 'UP1' }))
          .mockResolvedValueOnce(okJson({ messages: [{ id: 'wamid.OK' }] })),
      );
      prisma.messagingMessage.findUnique.mockResolvedValue({
        id: 'msg-1',
        connectionId: 'conn-meta',
        type: 'IMAGE',
        contact: { phone: PHONE },
        raw: { type: 'IMAGE', caption: 'olha' },
      });

      await service.send(FILE);

      expect(prisma.messagingMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: expect.objectContaining({
          providerMessageId: 'wamid.OK',
          raw: { type: 'IMAGE', caption: 'olha', mediaRef: 'UP1' },
        }),
      });
    });
  });

  describe('ingest — tudo escopado pela conexão do webhook', () => {
    const upsert = (prisma: ReturnType<typeof setup>['prisma']) =>
      prisma.messagingMessage.upsert.mock.calls[0][0];
    const evolution = (message: Record<string, unknown>, fromMe = false) => ({
      event: 'messages.upsert',
      instance: 'inst',
      data: {
        key: { id: 'A1', remoteJid: '5511987654321@s.whatsapp.net', fromMe },
        pushName: 'Ana',
        message,
        messageTimestamp: 1728000000,
      },
    });

    it('mensagem recebida entra na conexão, deduplicada por (conexão, id do provider)', async () => {
      const { service, prisma } = setup();
      await service.ingest('conn-evo', evolution({ conversation: 'oi' }));

      const call = upsert(prisma);
      expect(call.where).toEqual({
        connectionId_providerMessageId: {
          connectionId: 'conn-evo',
          providerMessageId: 'A1',
        },
      });
      expect(call.create).toMatchObject({
        connectionId: 'conn-evo',
        contactId: 'contact-1',
        direction: 'INBOUND',
        status: 'DELIVERED',
      });
      expect(prisma.messagingContact.upsert.mock.calls[0][0].where).toEqual({
        phone: '5511987654321',
      });
      // Mensagem recebida (não fromMe): grava lastInboundAt também — base da janela de 24h da Meta.
      expect(prisma.messagingConversation.upsert).toHaveBeenCalledWith({
        where: {
          connectionId_contactId: {
            connectionId: 'conn-evo',
            contactId: 'contact-1',
          },
        },
        create: {
          connectionId: 'conn-evo',
          contactId: 'contact-1',
          lastMessageAt: expect.any(Date),
          lastInboundAt: expect.any(Date),
        },
        update: {
          lastMessageAt: expect.any(Date),
          lastInboundAt: expect.any(Date),
        },
      });
    });

    it('mídia recebida guarda só a descrição — nada de base64 no banco e nada no storage', async () => {
      const { service, prisma } = setup();
      const body = evolution({
        imageMessage: {
          mimetype: 'image/jpeg',
          caption: 'foto',
          base64: 'AAAA',
        },
      });
      (body.data as Record<string, unknown>).base64 = 'BBBB';

      await service.ingest('conn-evo', body);

      const { create } = upsert(prisma);
      expect(create).toMatchObject({
        type: 'IMAGE',
        text: 'foto',
        mimeType: 'image/jpeg',
      });
      expect(create).not.toHaveProperty('mediaUrl');
      expect(JSON.stringify(create.raw)).not.toMatch(/AAAA|BBBB/);
    });

    it('mensagem enviada pelo celular entra como OUTBOUND já enviada', async () => {
      const { service, prisma } = setup();
      await service.ingest(
        'conn-evo',
        evolution({ conversation: 'do celular' }, true),
      );
      expect(upsert(prisma).create).toMatchObject({
        direction: 'OUTBOUND',
        status: 'SENT',
        text: 'do celular',
      });
      // fromMe: não é inbound — não conta para a janela de atendimento de 24h.
      expect(prisma.messagingConversation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.not.objectContaining({
            lastInboundAt: expect.anything(),
          }),
        }),
      );
    });

    // O bug do §2: o eco de uma mídia que NÓS enviamos chega depois do markSent, quando a linha
    // já existe (dedup por providerMessageId). O raw do eco é a fonte canônica para downloadMedia.
    it('eco de mídia nossa chegado DEPOIS do envio atualiza o raw da linha existente', async () => {
      const { service, prisma } = setup();
      const body = evolution(
        { imageMessage: { mimetype: 'image/jpeg', caption: 'enviei' } },
        true,
      );
      await service.ingest('conn-evo', body);
      expect(upsert(prisma).update).toEqual({ raw: body.data });
    });

    it('mensagem recebida (não é eco nosso) não toca no raw ao deduplicar', async () => {
      const { service, prisma } = setup();
      await service.ingest(
        'conn-evo',
        evolution({ conversation: 'oi' }, false),
      );
      expect(upsert(prisma).update).toEqual({});
    });

    it('reação não grava mensagem', async () => {
      const { service, prisma } = setup();
      const res = await service.ingest(
        'conn-evo',
        evolution({ reactionMessage: { text: '👍' } }),
      );
      expect(res.messages).toBe(0);
      expect(prisma.messagingMessage.upsert).not.toHaveBeenCalled();
    });

    it('status de entrega atualiza só a mensagem DESTA conexão', async () => {
      const { service, prisma, events } = setup();
      await service.ingest('conn-evo', {
        event: 'messages.update',
        instance: 'inst',
        data: { key: { id: 'A' }, status: 'READ' },
      });
      // Só avança: READ sobrescreve o que vem antes dele, nunca o que já está adiante.
      expect(prisma.messagingMessage.updateMany).toHaveBeenCalledWith({
        where: {
          connectionId: 'conn-evo',
          providerMessageId: 'A',
          status: { in: ['QUEUED', 'SENT', 'FAILED', 'DELIVERED'] },
        },
        data: { status: 'READ' },
      });
      expect(events.emit).toHaveBeenCalledWith({ type: 'messages' });
    });

    // Webhooks não chegam em ordem: o DELIVERED atrasado casa com a mensagem, mas não rebaixa o READ.
    it('DELIVERED só sobrescreve QUEUED, SENT ou FAILED — nunca READ', async () => {
      const { service, prisma } = setup();
      await service.ingest('conn-evo', {
        event: 'messages.update',
        instance: 'inst',
        data: { key: { id: 'A' }, status: 'DELIVERY_ACK' },
      });
      expect(prisma.messagingMessage.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: { in: ['QUEUED', 'SENT', 'FAILED'] },
        }),
        data: { status: 'DELIVERED' },
      });
    });

    it('status atrasado (mensagem já adiante) não é órfão: não lança nem avisa a tela', async () => {
      const { service, prisma, events } = setup();
      // A guarda não atualiza nada, mas a mensagem existe.
      prisma.messagingMessage.updateMany.mockResolvedValue({ count: 0 });
      prisma.messagingMessage.count.mockResolvedValue(1);

      await expect(
        service.ingest('conn-evo', {
          event: 'messages.update',
          instance: 'inst',
          data: { key: { id: 'A' }, status: 'DELIVERY_ACK' },
        }),
      ).resolves.toMatchObject({ statuses: 1 });
      expect(prisma.messagingMessage.count).toHaveBeenCalledWith({
        where: { connectionId: 'conn-evo', providerMessageId: 'A' },
      });
      expect(events.emit).not.toHaveBeenCalledWith({ type: 'messages' });
    });

    it('status de mensagem desconhecida lança, para a fila tentar de novo', async () => {
      const { service, prisma } = setup();
      prisma.messagingMessage.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.ingest('conn-evo', {
          event: 'messages.update',
          instance: 'inst',
          data: { key: { id: 'Z' }, status: 'READ' },
        }),
      ).rejects.toThrow(/desconhecida/);
    });

    // O bug que isto cobre: um status órfão (ex. grupo, sem ignoreGroups) no MEIO do lote abortava
    // tudo depois dele — mensagens legítimas do mesmo payload nunca eram gravadas.
    it('status órfão no meio do lote não impede as mensagens do mesmo payload de serem gravadas', async () => {
      const { service, prisma, connections } = setup();
      vi.spyOn(connections, 'use').mockReturnValue({
        parseWebhook: () => [
          {
            kind: 'MESSAGE',
            providerMessageId: 'M1',
            phone: '5511987654321',
            type: 'TEXT',
            fromMe: false,
            text: 'oi',
            at: new Date(),
            raw: {},
          },
          {
            kind: 'STATUS',
            providerMessageId: 'ORFAO',
            status: 'READ',
            at: new Date(),
          },
          {
            kind: 'MESSAGE',
            providerMessageId: 'M2',
            phone: '5511987654321',
            type: 'TEXT',
            fromMe: false,
            text: 'tudo bem?',
            at: new Date(),
            raw: {},
          },
        ],
      } as never);
      prisma.messagingMessage.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.ingest('conn-evo', {})).rejects.toThrow('ORFAO');
      expect(prisma.messagingMessage.upsert).toHaveBeenCalledTimes(2);
    });

    it('evento de conexão vai para o estado da conexão, não é gravado como mensagem', async () => {
      const { service, state, prisma } = setup();
      const res = await service.ingest('conn-evo', {
        event: 'connection.update',
        instance: 'inst',
        data: { state: 'close' },
      });

      expect(res.connections).toBe(1);
      expect(state.applyEvent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'conn-evo' }),
        {
          kind: 'CONNECTION',
          status: 'DISCONNECTED',
        },
      );
      expect(prisma.messagingMessage.upsert).not.toHaveBeenCalled();
    });

    it('evento de outra instância não mexe em nada', async () => {
      const { service, state, prisma } = setup();
      const res = await service.ingest('conn-evo', {
        event: 'connection.update',
        instance: 'de-outro-uso',
        data: { state: 'close' },
      });
      expect(res).toEqual({ messages: 0, statuses: 0, connections: 0 });
      expect(state.applyEvent).not.toHaveBeenCalled();
      expect(prisma.messagingMessage.upsert).not.toHaveBeenCalled();
    });

    it('conexão inexistente é 404 — nada é gravado', async () => {
      const { service, prisma } = setup();
      await expect(
        service.ingest('nada', evolution({ conversation: 'x' })),
      ).rejects.toThrow('messaging.connection_not_found');
      expect(prisma.messagingMessage.upsert).not.toHaveBeenCalled();
    });

    it('mensagem recebida avisa mensagens e contatos', async () => {
      const { service, events } = setup();
      await service.ingest('conn-evo', evolution({ conversation: 'oi' }));
      expect(events.emit).toHaveBeenCalledWith({ type: 'messages' });
      expect(events.emit).toHaveBeenCalledWith({ type: 'contacts' });
    });
  });

  describe('ingest — toque em botão (resposta a uma mensagem nossa)', () => {
    it('manda o toque para a captura de evento com a linha de entrada e o payload', async () => {
      const { service, prisma, buttonEvents } = setup([META]);
      prisma.messagingMessage.upsert.mockResolvedValue({ id: 'in-1' });
      await service.ingest('conn-meta', {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [
                    {
                      id: 'wamid.IN',
                      from: '5511999999999',
                      timestamp: '1714510003',
                      type: 'button',
                      context: { id: 'wamid.OUT' },
                      button: { text: 'Sim', payload: 'accept:42' },
                    },
                    // Texto comum não gera evento.
                    {
                      id: 'wamid.IN2',
                      from: '5511999999999',
                      timestamp: '1714510004',
                      type: 'text',
                      text: { body: 'oi' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      expect(buttonEvents.capture).toHaveBeenCalledTimes(1);
      expect(buttonEvents.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: 'conn-meta',
          messageId: 'in-1',
          replyTo: 'wamid.OUT',
          payload: 'accept:42',
        }),
      );
    });

    it('grava a mensagem que o cliente respondeu (context.id) na linha de entrada', async () => {
      const { service, prisma } = setup([META]);
      await service.ingest('conn-meta', {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  contacts: [
                    { wa_id: '5511999999999', profile: { name: 'Ana' } },
                  ],
                  messages: [
                    {
                      id: 'wamid.IN',
                      from: '5511999999999',
                      timestamp: '1714510003',
                      type: 'button',
                      context: { id: 'wamid.OUT', from: '15550783881' },
                      button: { text: 'Sim', payload: 'accept:42' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      expect(prisma.messagingMessage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            providerMessageId: 'wamid.IN',
            replyToProviderMessageId: 'wamid.OUT',
            text: 'Sim',
          }),
        }),
      );
    });
  });

  describe('ingest — TEMPLATE_CATEGORY (template_category_update da Meta)', () => {
    const hook = (newCategory: string) => ({
      entry: [
        {
          changes: [
            {
              field: 'template_category_update',
              value: {
                message_template_id: 999,
                message_template_name: 'promo',
                message_template_language: 'pt_BR',
                previous_category: 'UTILITY',
                new_category: newCategory,
              },
            },
          ],
        },
      ],
    });

    it('acompanha a categoria da Meta, guarda a anterior e avisa as telas', async () => {
      const { service, prisma, events } = setup([META]);
      prisma.messagingTemplateSubmission.findFirst.mockResolvedValue({
        templateId: 't-1',
        template: { category: 'UTILITY' },
      });

      await service.ingest('conn-meta', hook('MARKETING'));

      expect(prisma.messagingTemplate.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: {
          category: 'MARKETING',
          previousCategory: 'UTILITY',
          categoryChangedAt: expect.any(Date),
        },
      });
      expect(events.emit).toHaveBeenCalledWith({ type: 'templates' });
    });

    it('categoria igual à local ou template desconhecido: nada a fazer', async () => {
      const { service, prisma, events } = setup([META]);
      prisma.messagingTemplateSubmission.findFirst.mockResolvedValueOnce({
        templateId: 't-1',
        template: { category: 'MARKETING' },
      });
      await service.ingest('conn-meta', hook('MARKETING'));
      prisma.messagingTemplateSubmission.findFirst.mockResolvedValueOnce(null);
      await service.ingest('conn-meta', hook('MARKETING'));

      expect(prisma.messagingTemplate.update).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalledWith({ type: 'templates' });
    });
  });

  describe('ingest — TEMPLATE_STATUS (message_template_status_update da Meta)', () => {
    const metaWebhook = (value: Record<string, unknown>) => ({
      entry: [
        { changes: [{ field: 'message_template_status_update', value }] },
      ],
    });

    it('submissão atualizada avisa as telas (templates); órfão não avisa', async () => {
      const { service, prisma, events } = setup([META]);
      const hook = metaWebhook({
        event: 'REJECTED',
        message_template_id: 999,
        message_template_name: 'x',
        message_template_language: 'pt_BR',
      });
      prisma.messagingTemplateSubmission.updateMany.mockResolvedValueOnce({
        count: 0,
      });
      await service.ingest('conn-meta', hook);
      expect(events.emit).not.toHaveBeenCalledWith({ type: 'templates' });

      prisma.messagingTemplateSubmission.updateMany.mockResolvedValueOnce({
        count: 1,
      });
      await service.ingest('conn-meta', hook);
      expect(events.emit).toHaveBeenCalledWith({ type: 'templates' });
    });

    it('casa pelo providerTemplateId e atualiza a submissão', async () => {
      const { service, prisma } = setup([META]);
      prisma.messagingTemplateSubmission.updateMany.mockResolvedValue({
        count: 1,
      });

      const res = await service.ingest(
        'conn-meta',
        metaWebhook({
          event: 'APPROVED',
          message_template_id: 999,
          message_template_name: 'password_changed',
          message_template_language: 'pt_BR',
        }),
      );

      expect(
        prisma.messagingTemplateSubmission.updateMany,
      ).toHaveBeenCalledWith({
        where: { providerTemplateId: '999' },
        data: {
          status: 'APPROVED',
          reason: null,
          reviewedAt: expect.any(Date),
        },
      });
      // Não é 'MESSAGE' nem 'STATUS': não entra nas contagens de mensagem/entrega.
      expect(res).toEqual({ messages: 0, statuses: 0, connections: 0 });
    });

    // "dedupe e status órfão não aplicados a ele": sem casar, só avisa — nunca lança nem conta.
    it('sem submissão correspondente não lança (diferente do status órfão de mensagem)', async () => {
      const { service } = setup([META]);

      await expect(
        service.ingest(
          'conn-meta',
          metaWebhook({
            event: 'REJECTED',
            message_template_id: 404,
            message_template_name: 'oi',
            message_template_language: 'pt_BR',
            reason: 'INCORRECT_CATEGORY',
          }),
        ),
      ).resolves.toEqual({ messages: 0, statuses: 0, connections: 0 });
    });
  });

  describe('downloadMedia', () => {
    const mediaRow = (over: object = {}) => ({
      id: 'm',
      connectionId: 'conn-evo',
      type: 'IMAGE',
      providerMessageId: 'A',
      direction: 'INBOUND',
      raw: null,
      mimeType: null,
      fileName: null,
      ...over,
    });

    it('mensagem de texto não tem mídia: 404', async () => {
      const { service, prisma } = setup();
      prisma.messagingMessage.findUnique.mockResolvedValue(
        mediaRow({ type: 'TEXT' }),
      );
      await expect(service.downloadMedia('m')).rejects.toThrow(
        'messaging.media_not_found',
      );
    });

    it('baixa pelo provider da conexão da mensagem', async () => {
      const { service, prisma } = setup([EVO, META]);
      prisma.messagingMessage.findUnique.mockResolvedValue(
        mediaRow({ connectionId: 'conn-meta', raw: { image: { id: 'MID' } } }),
      );
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce(
          okJson({ url: 'https://cdn.meta/f', mime_type: 'image/png' }),
        )
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)),
        });
      vi.stubGlobal('fetch', fetchSpy);

      await service.downloadMedia('m');
      expect(fetchSpy.mock.calls[0][0]).toContain('graph.facebook.com');
    });

    it('falha do provider vira 404 e não vaza o erro cru', async () => {
      const { service, prisma } = setup();
      prisma.messagingMessage.findUnique.mockResolvedValue(mediaRow());
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(failJson(400, { message: 'Message not found' })),
      );
      await expect(service.downloadMedia('m')).rejects.toThrow(
        'messaging.media_not_found',
      );
    });

    // Fecha o ciclo do bug do §2: com o raw do eco preservado, baixar a mídia que NÓS enviamos
    // pelo Evolution Go (que exige o `Message` completo, sem fallback por id) funciona.
    it('mídia de uma saída por upload (raw preservado pelo §2) devolve os bytes no Evolution Go', async () => {
      const { service, prisma } = setup([GO_CONNECTION]);
      prisma.messagingMessage.findUnique.mockResolvedValue(
        mediaRow({
          connectionId: 'conn-go',
          direction: 'OUTBOUND',
          raw: { Message: { imageMessage: {} } },
        }),
      );
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            okJson({ data: { base64: Buffer.from('IMG').toString('base64') } }),
          ),
      );

      const media = await service.downloadMedia('m');
      expect(media.data.toString()).toBe('IMG');
    });

    it('completa mimetype e nome com o que ficou gravado quando o provider não os dá', async () => {
      const { service, prisma } = setup();
      prisma.messagingMessage.findUnique.mockResolvedValue(
        mediaRow({
          type: 'DOCUMENT',
          mimeType: 'application/pdf',
          fileName: 'n.pdf',
        }),
      );
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(okJson({ base64: 'QQ==' })),
      );
      expect(await service.downloadMedia('m')).toMatchObject({
        mimeType: 'application/pdf',
        fileName: 'n.pdf',
      });
    });
  });

  describe('webhook contacts.upsert (nome e foto empurrados pelo provider)', () => {
    const PHONE_REF = '5534998956461';

    describe('webhook contacts.upsert', () => {
      const body = (data: unknown) => ({
        event: 'contacts.upsert',
        instance: 'inst',
        data,
      });

      it('atualiza só quem já é contato (em qualquer conexão) — a agenda do celular não vira linha', async () => {
        const { service, prisma, events } = setup();
        await service.ingest(
          'conn-evo',
          body([
            {
              remoteJid: `${PHONE_REF}@s.whatsapp.net`,
              pushName: 'Maria',
              profilePicUrl: 'https://pps.whatsapp.net/a.jpg',
            },
          ]),
        );
        expect(prisma.messagingContact.updateMany).toHaveBeenCalledWith({
          where: { phone: PHONE_REF },
          data: {
            pushName: 'Maria',
            profilePictureUrl: 'https://pps.whatsapp.net/a.jpg',
          },
        });
        expect(prisma.messagingContact.upsert).not.toHaveBeenCalled();
        expect(events.emit).toHaveBeenCalledWith({ type: 'contacts' });
      });

      it('contato que não existe não avisa a tela', async () => {
        const { service, prisma, events } = setup();
        prisma.messagingContact.updateMany.mockResolvedValue({ count: 0 });
        await service.ingest(
          'conn-evo',
          body([
            { remoteJid: `${PHONE_REF}@s.whatsapp.net`, pushName: 'Maria' },
          ]),
        );
        expect(events.emit).not.toHaveBeenCalledWith({ type: 'contacts' });
      });
    });
  });

  describe('presence', () => {
    it('emitPresence repassa direto pro canal realtime, sem tocar no banco', () => {
      const { service, events, prisma } = setup();
      service.emitPresence('conn-evo', {
        kind: 'PRESENCE',
        phone: PHONE,
        state: 'COMPOSING',
      });
      expect(events.emit).toHaveBeenCalledWith({
        type: 'presence',
        connectionId: 'conn-evo',
        phone: PHONE,
        state: 'COMPOSING',
      });
      expect(prisma.messagingMessage.create).not.toHaveBeenCalled();
    });

    it('sendPresence chama o provider da conexão resolvida', async () => {
      const { service } = setup([EVO, GO_CONNECTION]);
      const fetchSpy = vi.fn().mockResolvedValue(okJson({}));
      vi.stubGlobal('fetch', fetchSpy);

      await service.sendPresence(PHONE, 'COMPOSING', {
        connectionId: 'conn-go',
      });

      await vi.waitFor(() =>
        expect(fetchSpy.mock.calls[0][0]).toBe(
          'http://go:8080/message/presence',
        ),
      );
    });

    // A Evolution segura a resposta até o fim do `delay` da presença: o chamador não pode esperar por ela.
    it('não espera a resposta do provider (o envio da mensagem não fica preso atrás do "digitando")', async () => {
      const { service } = setup([EVO]);
      let answer!: () => void;
      const fetchSpy = vi.fn().mockReturnValue(
        new Promise((resolve) => {
          answer = () => resolve(okJson({}));
        }),
      );
      vi.stubGlobal('fetch', fetchSpy);

      await service.sendPresence(PHONE, 'COMPOSING');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      answer();
    });

    it('provider sem sendPresence (Meta) é um no-op silencioso', async () => {
      const { service } = setup([META]);
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      await expect(
        service.sendPresence(PHONE, 'COMPOSING', { connectionId: 'conn-meta' }),
      ).resolves.toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('falha do provider é só um warning, nunca lança', async () => {
      const { service } = setup([EVO]);
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
      const warn = vi
        .spyOn((service as unknown as { logger: Logger }).logger, 'warn')
        .mockImplementation(() => undefined);
      await expect(
        service.sendPresence(PHONE, 'PAUSED'),
      ).resolves.toBeUndefined();
      await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    });
  });
  /** A fila entrega ao menos uma vez: dispatch idempotente evita duplicar mensagem já aceita pelo provider. */
  describe('dispatch — idempotência, opt-out e retentativa', () => {
    const ROW = {
      id: 'msg-1',
      connectionId: 'conn-evo',
      type: 'TEXT',
      contact: { phone: PHONE, optOut: false },
      text: 'oi',
      mediaUrl: null,
      raw: null,
      providerMessageId: null as string | null,
      updatedAt: new Date('2026-10-09T12:00:00Z'),
    };
    const accepted = () =>
      vi.fn().mockResolvedValue(okJson({ key: { id: '3EB0OK' } }));

    it('mensagem que o provider já aceitou não é reenviada (job reentregue)', async () => {
      const { service, prisma } = setup();
      prisma.messagingMessage.findUnique.mockResolvedValue({
        ...ROW,
        providerMessageId: '3EB0OK',
      });
      const fetchSpy = accepted();
      vi.stubGlobal('fetch', fetchSpy);

      const result = await service.dispatch('msg-1');

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(prisma.messagingMessage.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        providerMessageId: '3EB0OK',
        acceptedAt: ROW.updatedAt,
      });
    });

    describe('opt-out pedido depois de enfileirar', () => {
      const optedOut = { ...ROW, contact: { phone: PHONE, optOut: true } };

      it('não envia, grava FAILED e a fila não repete', async () => {
        const { service, prisma } = setup();
        prisma.messagingMessage.findUnique.mockResolvedValue(optedOut);
        const fetchSpy = accepted();
        vi.stubGlobal('fetch', fetchSpy);

        await expect(service.dispatch('msg-1')).rejects.toBeInstanceOf(
          MessagingNonRetryableError,
        );

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(prisma.messagingMessage.update).toHaveBeenCalledWith({
          where: { id: 'msg-1' },
          data: { error: 'messaging.opt_out', status: 'FAILED' },
        });
      });

      it('aviso que fura o opt-out (bypass) segue e envia', async () => {
        const { service, prisma } = setup();
        prisma.messagingMessage.findUnique.mockResolvedValue(optedOut);
        const fetchSpy = accepted();
        vi.stubGlobal('fetch', fetchSpy);

        await service.dispatch('msg-1', undefined, { bypassOptOut: true });

        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('falha do provider', () => {
      const refuse = () =>
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(failJson(500, { message: 'fora do ar' })),
        );

      it('sem nova tentativa: FAILED', async () => {
        const { service, prisma } = setup();
        prisma.messagingMessage.findUnique.mockResolvedValue(ROW);
        refuse();

        await expect(service.dispatch('msg-1')).rejects.toThrow('fora do ar');

        expect(prisma.messagingMessage.update).toHaveBeenCalledWith({
          where: { id: 'msg-1' },
          data: expect.objectContaining({ status: 'FAILED' }),
        });
      });

      // Entre tentativas a mensagem ainda pode sair: dizer FAILED induz o operador a reenviar à mão.
      it('com nova tentativa agendada: o status segue QUEUED e só o erro é gravado', async () => {
        const { service, prisma } = setup();
        prisma.messagingMessage.findUnique.mockResolvedValue(ROW);
        refuse();

        await expect(
          service.dispatch('msg-1', undefined, { retriesLeft: 2 }),
        ).rejects.toThrow('fora do ar');

        const data = prisma.messagingMessage.update.mock.calls[0][0].data;
        expect(data.error).toContain('fora do ar');
        expect(data).not.toHaveProperty('status');
      });

      // O provider pode ter enviado e só a resposta se perdeu: repetir duplicaria a mensagem.
      it('sem resposta a tempo: FAILED com aviso, sem retentativa', async () => {
        const { service, prisma } = setup();
        prisma.messagingMessage.findUnique.mockResolvedValue(ROW);
        vi.stubGlobal(
          'fetch',
          vi
            .fn()
            .mockRejectedValue(
              Object.assign(new Error('t'), { name: 'TimeoutError' }),
            ),
        );

        await expect(
          service.dispatch('msg-1', undefined, { retriesLeft: 2 }),
        ).rejects.toBeInstanceOf(MessagingNonRetryableError);

        expect(prisma.messagingMessage.update).toHaveBeenCalledWith({
          where: { id: 'msg-1' },
          data: { error: 'messaging.send_timeout', status: 'FAILED' },
        });
      });
    });

    describe('provider aceitou, mas gravar o resultado falhou', () => {
      it('queda curta do banco: grava na segunda tentativa e NÃO reenvia', async () => {
        const { service, prisma } = setup();
        prisma.messagingMessage.findUnique.mockResolvedValue(ROW);
        const fetchSpy = accepted();
        vi.stubGlobal('fetch', fetchSpy);
        prisma.$transaction
          .mockRejectedValueOnce(new Error('db caiu'))
          .mockImplementation(((cb: (tx: unknown) => unknown) =>
            cb(prisma)) as never);

        const result = await service.dispatch('msg-1');

        expect(result.providerMessageId).toBe('3EB0OK');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(prisma.messagingMessage.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'SENT',
              providerMessageId: '3EB0OK',
            }),
          }),
        );
      });

      it('banco fora: erro sem retry (conciliação), sem FAILED e sem segundo envio', async () => {
        const { service, prisma } = setup();
        prisma.messagingMessage.findUnique.mockResolvedValue(ROW);
        const fetchSpy = accepted();
        vi.stubGlobal('fetch', fetchSpy);
        prisma.$transaction.mockRejectedValue(new Error('db fora'));

        const failure = await service.dispatch('msg-1').catch((e) => e);

        expect(failure).toBeInstanceOf(MessagingNonRetryableError);
        expect(failure.message).toContain('3EB0OK');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(prisma.$transaction).toHaveBeenCalledTimes(3);
        for (const [{ data }] of prisma.messagingMessage.update.mock.calls) {
          expect(data).not.toHaveProperty('status');
        }
      });
    });

    it('eco que já avançou (READ) não rebaixa a mensagem ao descartar a linha dele', async () => {
      const { service, prisma } = setup();
      prisma.messagingMessage.findUnique.mockResolvedValue(ROW);
      prisma.messagingMessage.findMany.mockResolvedValue([
        { raw: {}, status: 'READ' },
      ]);
      vi.stubGlobal('fetch', accepted());

      await service.dispatch('msg-1');

      expect(prisma.messagingMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'READ' }),
        }),
      );
    });
  });

  /** A ordem por destinatário vem da fila: a conversa cai sempre na mesma partição, que entrega uma mensagem por vez. */
  describe('send — partição da conversa', () => {
    const text = (phone: string) => ({
      type: 'TEXT' as const,
      phone,
      text: 'oi',
    });

    it('mensagens da mesma conversa vão sempre para a mesma fila', async () => {
      const { service, partitionQueues } = setup();
      await service.send(text(PHONE));
      await service.send(text(PHONE));
      await service.send(text(PHONE));
      const used = partitionQueues.filter((q) => q.add.mock.calls.length > 0);
      expect(used).toHaveLength(1);
      expect(used[0].add).toHaveBeenCalledTimes(3);
    });

    it('a fila é a da partição calculada de (conexão, contato)', async () => {
      const { service, partitionQueues } = setup();
      await service.send(text(PHONE));
      const expected = sendPartition('conn-evo', 'contact-1');
      expect(partitionQueues[expected].add).toHaveBeenCalledTimes(1);
    });

    it('sendPartition é estável e espalha conversas diferentes', () => {
      expect(sendPartition('c1', 'p1')).toBe(sendPartition('c1', 'p1'));
      const seen = new Set(
        Array.from({ length: 200 }, (_, i) => sendPartition('c1', `p${i}`)),
      );
      expect(seen.size).toBe(MESSAGING_SEND_PARTITIONS);
    });

    describe('envio direto (anexo, sendNow, sem fila)', () => {
      it('conversa com mensagem ainda saindo: 409 e nada é gravado nem enviado', async () => {
        const { service, prisma } = setup();
        prisma.messagingMessage.findFirst.mockResolvedValue({ id: 'msg-0' });
        const spy = vi.spyOn(service, 'dispatch');

        const failure = await service
          .sendNow({ type: 'TEXT', phone: PHONE, text: 'oi' })
          .catch((e) => e);

        expect(failure.getStatus()).toBe(409);
        expect(failure.message).toBe('messaging.conversation_busy');
        expect(prisma.messagingMessage.create).not.toHaveBeenCalled();
        expect(spy).not.toHaveBeenCalled();
      });

      // Linha órfã antiga (processo caiu entre gravar e enfileirar) não pode travar a conversa.
      it('só conta mensagem da MESMA conversa, ainda QUEUED, sem id do provider e recente', async () => {
        const { service, prisma } = setup();
        vi.spyOn(service, 'dispatch').mockResolvedValue({} as never);
        await service.sendNow({ type: 'TEXT', phone: PHONE, text: 'oi' });

        const [{ where }] = prisma.messagingMessage.findFirst.mock.calls[0];
        expect(where).toMatchObject({
          direction: 'OUTBOUND',
          status: 'QUEUED',
          providerMessageId: null,
        });
        expect(where.connectionId).toBeDefined();
        expect(where.contactId).toBeDefined();
        const age = Date.now() - where.createdAt.gt.getTime();
        expect(age).toBeGreaterThan(4 * 60_000);
        expect(age).toBeLessThan(6 * 60_000);
      });

      it('conversa livre: grava e envia na hora', async () => {
        const { service, prisma } = setup();
        const spy = vi
          .spyOn(service, 'dispatch')
          .mockResolvedValue({} as never);
        await service.sendNow({ type: 'TEXT', phone: PHONE, text: 'oi' });
        await service.send({
          type: 'IMAGE',
          phone: PHONE,
          file: { data: Buffer.from('x'), mimeType: 'image/png' },
        } as never);
        expect(spy).toHaveBeenCalledTimes(2);
        expect(prisma.messagingMessage.create).toHaveBeenCalledTimes(2);
      });

      it('o envio pela fila NÃO confere a conversa: a ordem é da fila', async () => {
        const { service, prisma, queue } = setup();
        prisma.messagingMessage.findFirst.mockResolvedValue({ id: 'msg-0' });
        await service.send(text(PHONE));
        expect(queue.add).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('dispatch — retentativa só de erro transitório', () => {
    const ROW = {
      id: 'msg-1',
      connectionId: 'conn-evo',
      contactId: 'contact-1',
      type: 'TEXT',
      contact: { phone: PHONE, optOut: false },
      text: 'oi',
      mediaUrl: null,
      raw: null,
      providerMessageId: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const failWith = (response: unknown) =>
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    it.each([500, 503, 429, 408])(
      'HTTP %i com tentativa a seguir: segue QUEUED, só o erro é gravado',
      async (status) => {
        const { service, prisma } = setup();
        prisma.messagingMessage.findUnique.mockResolvedValue(ROW);
        failWith(failJson(status, { message: 'x' }));
        await expect(
          service.dispatch('msg-1', undefined, { retriesLeft: 1 }),
        ).rejects.toThrow();
        const { data } = prisma.messagingMessage.update.mock.calls[0][0];
        expect(data).not.toHaveProperty('status');
      },
    );

    it('HTTP 400 não se repete: FAILED mesmo com tentativas sobrando', async () => {
      const { service, prisma } = setup();
      prisma.messagingMessage.findUnique.mockResolvedValue(ROW);
      failWith(failJson(400, { message: 'número inválido' }));
      await expect(
        service.dispatch('msg-1', undefined, { retriesLeft: 3 }),
      ).rejects.toThrow();
      expect(prisma.messagingMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: expect.objectContaining({ status: 'FAILED' }),
      });
    });

    it('conexão recusada (fetch failed) com tentativa a seguir: segue QUEUED', async () => {
      const { service, prisma } = setup();
      prisma.messagingMessage.findUnique.mockResolvedValue(ROW);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new TypeError('fetch failed')),
      );
      await expect(
        service.dispatch('msg-1', undefined, { retriesLeft: 1 }),
      ).rejects.toThrow();
      const { data } = prisma.messagingMessage.update.mock.calls[0][0];
      expect(data).not.toHaveProperty('status');
    });

    it('última tentativa (retriesLeft 0) em erro transitório: FAILED', async () => {
      const { service, prisma } = setup();
      prisma.messagingMessage.findUnique.mockResolvedValue(ROW);
      failWith(failJson(503, { message: 'x' }));
      await expect(
        service.dispatch('msg-1', undefined, { retriesLeft: 0 }),
      ).rejects.toThrow();
      expect(prisma.messagingMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: expect.objectContaining({ status: 'FAILED' }),
      });
    });
  });

  describe('send — opções do job na fila', () => {
    it('jobId = id da mensagem e falhas expiram (o corpo do job não fica para sempre)', async () => {
      const { service, queue } = setup();
      await service.send({ type: 'TEXT', phone: PHONE, text: 'oi' });
      expect(queue.add).toHaveBeenCalledWith(
        'send',
        { messageId: 'msg-1' },
        expect.objectContaining({
          jobId: 'msg-1',
          attempts: 1,
          removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
        }),
      );
    });
  });

  describe('send — sem fila configurada (Redis ausente)', () => {
    it('sem anexo e sem fila, envia de forma síncrona na própria chamada', async () => {
      const { service, queue, prisma } = setup([EVO], false);
      prisma.messagingMessage.findUnique.mockResolvedValue({
        id: 'msg-1',
        connectionId: 'conn-evo',
        contactId: 'contact-1',
        type: 'TEXT',
        contact: { phone: PHONE, optOut: false },
        text: 'oi',
        mediaUrl: null,
        raw: { type: 'TEXT', phone: PHONE, text: 'oi' },
        providerMessageId: null,
      });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(okJson({ key: { id: '3EB0OK' } })),
      );

      const id = await service.send({ type: 'TEXT', phone: PHONE, text: 'oi' });

      expect(id).toBe('msg-1');
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('send — mídia com URL inalcançável', () => {
    it('recusa antes de gravar quando a URL aponta para rede interna', async () => {
      const { service, prisma } = setup();
      await expect(
        service.send({
          type: 'IMAGE',
          phone: PHONE,
          mediaUrl: 'http://192.168.1.1/foto.jpg',
        } as never),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.messagingMessage.create).not.toHaveBeenCalled();
    });
  });

  describe('assertTemplateApproved — sem templateId', () => {
    it('Meta sem templateId nenhum (não apenas não aprovado) também recusa, sem consultar o banco', async () => {
      const { service, prisma } = setup([META]);

      await expect(
        service.send(
          {
            type: 'TEMPLATE',
            phone: PHONE,
            template: { key: 'tpl', language: 'pt-BR', body: 'oi' },
          } as never,
          { connectionId: 'conn-meta' },
        ),
      ).rejects.toThrow(/template_not_approved/);
      expect(prisma.messagingTemplateSubmission.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('dropIgnored', () => {
    it('descarta eventos do número ignorado, mas mantém os sem telefone (STATUS/CONNECTION)', async () => {
      const { service, webhooks } = setup();
      webhooks.ignoredPhones.mockResolvedValue(new Set([PHONE]));
      const withPhone = { kind: 'CONTACT', phone: PHONE } as never;
      const otherPhone = { kind: 'CONTACT', phone: '5500000000000' } as never;
      const noPhone = { kind: 'STATUS', providerMessageId: 'x' } as never;

      const result = await service.dropIgnored([withPhone, otherPhone, noPhone]);

      expect(result).toEqual([otherPhone, noPhone]);
    });
  });

  describe('ingest — evento de presença não gera efeito (desviado antes da fila pelo use-case)', () => {
    it('não estoura e não grava nada quando um evento PRESENCE chega ao switch', async () => {
      const { service, prisma, connections } = setup();
      vi.spyOn(connections, 'use').mockReturnValue({
        parseWebhook: () => [{ kind: 'PRESENCE', phone: PHONE, state: 'COMPOSING' }],
      } as never);

      const counts = await service.ingest('conn-evo', {});

      expect(counts).toEqual({ messages: 0, statuses: 0, connections: 0 });
      expect(prisma.messagingMessage.upsert).not.toHaveBeenCalled();
    });
  });

  describe('downloadMedia — mensagem inexistente', () => {
    it('404 quando o id não existe', async () => {
      const { service, prisma } = setup();
      prisma.messagingMessage.findUnique.mockResolvedValue(null);
      await expect(service.downloadMedia('sumiu')).rejects.toThrow(
        'messaging.message_not_found',
      );
    });
  });

  describe('toSendInput — reconstrução do envio a partir da linha gravada', () => {
    it('usa o raw guardado quando o tipo bate com o da linha (retry preserva o conteúdo original)', async () => {
      const { service, prisma, connections } = setup();
      const send = vi.fn().mockResolvedValue({ providerMessageId: 'X', acceptedAt: new Date() });
      vi.spyOn(connections, 'use').mockReturnValue({ send } as never);
      prisma.messagingMessage.findUnique.mockResolvedValue({
        id: 'msg-1',
        connectionId: 'conn-evo',
        contactId: 'contact-1',
        type: 'TEXT',
        contact: { phone: PHONE, optOut: false },
        text: 'texto gravado',
        mediaUrl: null,
        raw: { type: 'TEXT', text: 'texto original do raw' },
        providerMessageId: null,
      });

      await service.dispatch('msg-1', undefined);

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'TEXT', text: 'texto original do raw', phone: PHONE }),
      );
    });

    it('sem raw gravado, mídia é reconstruída a partir de mediaUrl', async () => {
      const { service, prisma, connections } = setup();
      const send = vi.fn().mockResolvedValue({ providerMessageId: 'X', acceptedAt: new Date() });
      vi.spyOn(connections, 'use').mockReturnValue({ send } as never);
      prisma.messagingMessage.findUnique.mockResolvedValue({
        id: 'msg-1',
        connectionId: 'conn-evo',
        contactId: 'contact-1',
        type: 'IMAGE',
        contact: { phone: PHONE, optOut: false },
        text: null,
        mediaUrl: 'https://cdn.example.com/foto.jpg',
        raw: null,
        providerMessageId: null,
      });

      await service.dispatch('msg-1', undefined);

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'IMAGE',
          mediaUrl: 'https://cdn.example.com/foto.jpg',
          phone: PHONE,
        }),
      );
    });
  });

  describe('inspectCandidate — erro inesperado fora da validação', () => {
    it('nunca estoura: um erro ao montar o provider também vira resultado', async () => {
      const { service, registry } = setup();
      vi.spyOn(registry, 'find').mockReturnValue({
        configSchema: { safeParse: () => ({ success: true, data: {} }) },
        use: () => {
          throw new Error('config quebrada');
        },
      } as never);

      const { result, accountPhone } = await service.inspectCandidate({
        provider: 'META',
        config: {},
      } as never);

      expect(result).toEqual({ status: false, data: 'config quebrada' });
      expect(accountPhone).toBeNull();
    });
  });
});
