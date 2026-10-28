import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SendMessageUseCase } from './send-message.use-case';
import { MessagingService } from '../messaging.service';
import { MessagingTemplateService } from '../messaging-template.service';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import type { SendMessageDto } from '../dto/send-message.dto';

const PHONE = '5511999999999';
const dto = (partial: Partial<SendMessageDto>): SendMessageDto =>
  ({ phone: PHONE, ...partial }) as SendMessageDto;
const upload = (mimetype: string, originalname = 'arquivo.bin') => ({
  buffer: Buffer.from('bytes'),
  mimetype,
  originalname,
});

describe('SendMessageUseCase', () => {
  let useCase: SendMessageUseCase;
  let messagingService: { send: ReturnType<typeof vi.fn> };
  let prisma: {
    messagingTemplate: { findUnique: ReturnType<typeof vi.fn> };
    messagingContact: { findUnique: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    prisma = {
      messagingTemplate: { findUnique: vi.fn() },
      messagingContact: { findUnique: vi.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        SendMessageUseCase,
        MessagingTemplateService,
        {
          provide: MessagingService,
          useValue: { send: vi.fn().mockResolvedValue('message-id-123') },
        },
        { provide: PrismaService, useValue: prisma },
        {
          provide: I18nService,
          useValue: {
            t: (key: string, o?: { args?: Record<string, string> }) =>
              o?.args ? `${key} ${JSON.stringify(o.args)}` : key,
          },
        },
      ],
    }).compile();

    useCase = module.get(SendMessageUseCase);
    messagingService = module.get(MessagingService);
  });

  it('envia texto com o userId', async () => {
    const result = await useCase.execute(
      dto({ type: 'TEXT', text: 'Hello' }),
      'user-123',
    );

    expect(result).toBe('message-id-123');
    expect(messagingService.send).toHaveBeenCalledWith(
      { phone: PHONE, type: 'TEXT', text: 'Hello' },
      { userId: 'user-123' },
    );
  });

  it('sem type nem arquivo, assume texto', async () => {
    await useCase.execute(dto({ text: 'oi' }), null);
    expect(messagingService.send).toHaveBeenCalledWith(
      { phone: PHONE, type: 'TEXT', text: 'oi' },
      { userId: null },
    );
  });

  it('texto sem conteúdo é 400, com mensagem traduzível do campo e do tipo', async () => {
    await expect(useCase.execute(dto({}), null)).rejects.toThrow(
      'messaging.field_required {"field":"text","type":"TEXT"}',
    );
    await expect(useCase.execute(dto({}), null)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(messagingService.send).not.toHaveBeenCalled();
  });

  it('template exige templateId', async () => {
    await expect(
      useCase.execute(dto({ type: 'TEMPLATE' }), null),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.messagingTemplate.findUnique).not.toHaveBeenCalled();
  });

  describe('template', () => {
    // `last_name` (não reservada) prova a variável do tipo; first_name/full_name vêm só da reservada.
    const TYPE = {
      variables: [
        { name: 'last_name', type: 'STRING', required: true },
        { name: 'discount', type: 'STRING', required: false, default: '10%' },
        { name: 'first_name', reserved: true },
        { name: 'full_name', reserved: true },
      ],
    };
    const ROW = {
      id: 't-1',
      key: 'PASSWORD_CHANGED',
      language: 'pt-BR',
      category: 'UTILITY',
      body: 'Olá {{ first_name }} {{ last_name }}, ganhe {{ discount }}',
      header: null,
      footer: null,
      buttons: null,
      type: TYPE,
    };

    beforeEach(() => {
      prisma.messagingContact.findUnique.mockResolvedValue(null);
    });

    // Nunca "{{ first_name }}" cru ao destinatário: reservada não liberada no tipo derruba o envio.
    it('placeholder sem valor (reservada não liberada no tipo) é 400 e nada é enviado', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue({
        ...ROW,
        type: { variables: [{ name: 'last_name', type: 'STRING', required: true }] },
      });

      await expect(
        useCase.execute(
          dto({ type: 'TEMPLATE', templateId: 't-1', values: { last_name: 'Souza' } }),
          'user-123',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(messagingService.send).not.toHaveBeenCalled();
    });

    it('resolve o templateId em ResolvedTemplate já renderizado, com first_name/full_name do contato', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue(ROW);
      prisma.messagingContact.findUnique.mockResolvedValue({
        name: 'Ana Souza',
        pushName: null,
      });

      await useCase.execute(
        dto({ type: 'TEMPLATE', templateId: 't-1', values: { last_name: 'Souza' } }),
        'user-123',
      );

      expect(prisma.messagingTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: 't-1' },
        include: { type: true },
      });
      expect(prisma.messagingContact.findUnique).toHaveBeenCalledWith({
        where: { phone: PHONE },
        select: { name: true, pushName: true },
      });
      expect(messagingService.send).toHaveBeenCalledWith(
        {
          phone: PHONE,
          type: 'TEMPLATE',
          template: {
            name: 'password_changed',
            language: 'pt-BR',
            category: 'UTILITY',
            values: {
              last_name: 'Souza',
              discount: '10%',
              first_name: 'Ana',
              full_name: 'Ana Souza',
            },
            body: 'Olá Ana Souza, ganhe 10%',
            bodySource: 'Olá {{ first_name }} {{ last_name }}, ganhe {{ discount }}',
            header: undefined,
            footer: undefined,
            buttons: undefined,
          },
        },
        { userId: 'user-123', templateId: 't-1' },
      );
    });

    it('contato sem nome (ou não encontrado) cai no fallback das reservadas', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue(ROW);

      await useCase.execute(
        dto({ type: 'TEMPLATE', templateId: 't-1', values: { last_name: 'Souza' } }),
        null,
      );

      expect(messagingService.send.mock.calls[0][0].template.values).toMatchObject({
        first_name: 'cliente',
        full_name: 'cliente',
      });
    });

    it('valor do chamador para first_name é ignorado — a reservada (contexto) vence', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue(ROW);
      prisma.messagingContact.findUnique.mockResolvedValue({
        name: 'Ana Souza',
        pushName: null,
      });

      await useCase.execute(
        dto({
          type: 'TEMPLATE',
          templateId: 't-1',
          values: { last_name: 'Souza', first_name: 'Forjado' },
        }),
        null,
      );

      expect(messagingService.send.mock.calls[0][0].template.values.first_name).toBe('Ana');
    });

    it('templateId inexistente é 404', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue(null);
      await expect(
        useCase.execute(dto({ type: 'TEMPLATE', templateId: 'missing' }), null),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('variável obrigatória do tipo (não reservada) sem valor é 400', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue(ROW);
      await expect(
        useCase.execute(dto({ type: 'TEMPLATE', templateId: 't-1' }), null),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('anexo', () => {
    it.each([
      ['image/png', 'IMAGE'],
      ['video/mp4', 'VIDEO'],
      ['audio/ogg; codecs=opus', 'AUDIO'],
      ['application/pdf', 'DOCUMENT'],
    ])('deduz o tipo de %s', async (mimetype, type) => {
      await useCase.execute(dto({}), 'u', upload(mimetype, 'a.bin'));
      expect(messagingService.send.mock.calls[0][0]).toMatchObject({ type });
    });

    it('repassa os bytes e a legenda, sem mediaUrl', async () => {
      await useCase.execute(dto({ caption: 'olha' }), 'u', upload('image/png'));
      const [input] = messagingService.send.mock.calls[0];
      expect(input.file).toEqual({
        data: Buffer.from('bytes'),
        mimeType: 'image/png',
      });
      expect(input.caption).toBe('olha');
      expect(input.mediaUrl).toBeUndefined();
    });

    it('documento usa o nome do arquivo e corrige a codificação latin1 do multer', async () => {
      const latin1 = Buffer.from('relatório.pdf', 'utf8').toString('latin1');
      await useCase.execute(dto({}), 'u', upload('application/pdf', latin1));
      expect(messagingService.send.mock.calls[0][0]).toMatchObject({
        type: 'DOCUMENT',
        fileName: 'relatório.pdf',
      });
    });
  });

  it('documento por link exige fileName', async () => {
    await expect(
      useCase.execute(
        dto({ type: 'DOCUMENT', mediaUrl: 'https://x.com/a.pdf' }),
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
