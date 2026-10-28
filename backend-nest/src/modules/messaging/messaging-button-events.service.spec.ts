import { Logger } from '@nestjs/common';
import { MessagingButtonEventService } from './messaging-button-events.service';
import { ButtonHandlerRegistry } from './button-handler.registry';

describe('MessagingButtonEventService', () => {
  const prisma = {
    messagingMessage: { findUnique: vi.fn() },
    messagingButtonEvent: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  };
  const queue = { add: vi.fn().mockResolvedValue({}) };
  let registry: ButtonHandlerRegistry;
  let service: MessagingButtonEventService;

  const tap = (over: Record<string, unknown> = {}) => ({
    connectionId: 'conn-1',
    messageId: 'in-1',
    contactId: 'c-1',
    replyTo: 'wamid.OUT',
    payload: 'accept:42',
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new ButtonHandlerRegistry();
    service = new MessagingButtonEventService(prisma as never, registry, queue as never);
    prisma.messagingMessage.findUnique.mockResolvedValue({
      id: 'out-1',
      templateId: 'tpl-1',
      correlation: { type: 'order', id: '42' },
      template: { type: { key: 'ORDER_UPDATE' } },
    });
    prisma.messagingButtonEvent.create.mockResolvedValue({ id: 'ev-1' });
  });

  describe('capture', () => {
    it('liga o toque ao template/tipo/correlação da mensagem respondida e enfileira', async () => {
      await service.capture(tap());

      expect(prisma.messagingMessage.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { connectionId_providerMessageId: { connectionId: 'conn-1', providerMessageId: 'wamid.OUT' } },
        }),
      );
      expect(prisma.messagingButtonEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          messageId: 'in-1',
          templateId: 'tpl-1',
          originalMessageId: 'out-1',
          typeKey: 'ORDER_UPDATE',
          buttonKey: 'accept',
          data: '42',
          correlation: { type: 'order', id: '42' },
        }),
        select: { id: true },
      });
      expect(queue.add).toHaveBeenCalledWith(
        'button',
        { eventId: 'ev-1' },
        expect.objectContaining({ jobId: 'ev-1', attempts: 5 }),
      );
    });

    it('sem a mensagem de origem ainda grava o evento (reservados valem para qualquer tipo)', async () => {
      prisma.messagingMessage.findUnique.mockResolvedValue(null);
      await service.capture(tap({ payload: 'opt_out' }));
      expect(prisma.messagingButtonEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ typeKey: null, templateId: null, buttonKey: 'opt_out', data: null }),
        select: { id: true },
      });
    });

    it('payload fora do formato é ignorado, sem consultar nem gravar', async () => {
      await service.capture(tap({ payload: 'Change Button!' }));
      expect(prisma.messagingMessage.findUnique).not.toHaveBeenCalled();
      expect(prisma.messagingButtonEvent.create).not.toHaveBeenCalled();
    });

    it('webhook reentregue (chave única violada) não duplica nem enfileira de novo', async () => {
      prisma.messagingButtonEvent.create.mockRejectedValue({ code: 'P2002' });
      await service.capture(tap());
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('outro erro do banco propaga', async () => {
      prisma.messagingButtonEvent.create.mockRejectedValue(new Error('db caiu'));
      await expect(service.capture(tap())).rejects.toThrow('db caiu');
    });

    it('sem fila, processa na hora', async () => {
      const inline = new MessagingButtonEventService(prisma as never, registry, null);
      prisma.messagingButtonEvent.findUnique.mockResolvedValue(null);
      await inline.capture(tap());
      expect(prisma.messagingButtonEvent.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ev-1' } }),
      );
    });

    it('sem replyTo não consulta a mensagem original — evento reservado sem contexto', async () => {
      await service.capture(tap({ replyTo: undefined }));
      expect(prisma.messagingMessage.findUnique).not.toHaveBeenCalled();
      expect(prisma.messagingButtonEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ templateId: null, originalMessageId: null, typeKey: null }),
        }),
      );
    });

    it('sem fila, falha no processamento síncrono é logada e não escapa da captura', async () => {
      const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const inline = new MessagingButtonEventService(prisma as never, registry, null);
      prisma.messagingButtonEvent.findUnique.mockRejectedValue(new Error('db fora'));

      await inline.capture(tap());

      expect(error.mock.calls.some((c) => String(c[0]).includes('falhou'))).toBe(true);
      error.mockRestore();
    });
  });

  describe('process', () => {
    const row = (over: Record<string, unknown> = {}) => ({
      id: 'ev-1',
      status: 'PENDING',
      typeKey: 'ORDER_UPDATE',
      buttonKey: 'accept',
      data: '42',
      connectionId: 'conn-1',
      templateId: 'tpl-1',
      originalMessageId: 'out-1',
      correlation: { type: 'order', id: '42' },
      messageId: 'in-1',
      message: { createdAt: new Date('2026-01-01'), contact: { phone: '5511999999999' } },
      ...over,
    });

    it('roda o handler do (tipo, botão) com o evento completo e marca PROCESSED', async () => {
      prisma.messagingButtonEvent.findUnique.mockResolvedValue(row());
      const handler = vi.fn();
      registry.register({ type: 'ORDER_UPDATE', button: 'accept' }, handler);

      await service.process('ev-1');

      expect(handler).toHaveBeenCalledWith({
        id: 'ev-1',
        typeKey: 'ORDER_UPDATE',
        buttonKey: 'accept',
        data: '42',
        phone: '5511999999999',
        connectionId: 'conn-1',
        templateId: 'tpl-1',
        originalMessageId: 'out-1',
        correlation: { type: 'order', id: '42' },
        messageId: 'in-1',
        at: new Date('2026-01-01'),
      });
      expect(prisma.messagingButtonEvent.update).toHaveBeenLastCalledWith({
        where: { id: 'ev-1' },
        data: { status: 'PROCESSED', processedAt: expect.any(Date), error: null },
      });
    });

    it('handler de outro tipo não dispara; handler sem tipo (reservado) dispara em qualquer um', async () => {
      prisma.messagingButtonEvent.findUnique.mockResolvedValue(row());
      const other = vi.fn();
      const any = vi.fn();
      registry.register({ type: 'OUTRO', button: 'accept' }, other);
      registry.register({ button: 'accept' }, any);

      await service.process('ev-1');

      expect(other).not.toHaveBeenCalled();
      expect(any).toHaveBeenCalled();
    });

    it('sem handler registrado o evento fica IGNORED (a resposta segue como texto no chat)', async () => {
      prisma.messagingButtonEvent.findUnique.mockResolvedValue(row());
      await service.process('ev-1');
      expect(prisma.messagingButtonEvent.update).toHaveBeenCalledWith({
        where: { id: 'ev-1' },
        data: { status: 'IGNORED', processedAt: expect.any(Date) },
      });
    });

    it('falha do handler grava FAILED com o erro e propaga para a fila refazer', async () => {
      prisma.messagingButtonEvent.findUnique.mockResolvedValue(row());
      registry.register({ type: 'ORDER_UPDATE', button: 'accept' }, () => {
        throw new Error('gateway fora');
      });

      await expect(service.process('ev-1')).rejects.toThrow('gateway fora');
      expect(prisma.messagingButtonEvent.update).toHaveBeenLastCalledWith({
        where: { id: 'ev-1' },
        data: { status: 'FAILED', error: 'gateway fora' },
      });
    });

    it('evento já PROCESSED não roda de novo (retentativa/job duplicado são seguros)', async () => {
      prisma.messagingButtonEvent.findUnique.mockResolvedValue(row({ status: 'PROCESSED' }));
      const handler = vi.fn();
      registry.register({ button: 'accept' }, handler);
      await service.process('ev-1');
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
