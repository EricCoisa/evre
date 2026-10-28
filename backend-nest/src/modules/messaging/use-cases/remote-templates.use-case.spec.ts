import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ListRemoteTemplatesUseCase } from './list-remote-templates.use-case';
import { LinkRemoteTemplateUseCase } from './link-remote-template.use-case';
import { ImportRemoteTemplateUseCase } from './import-remote-template.use-case';

describe('Remote Templates Use Cases', () => {
  const mockPrisma = {
    messagingTemplateType: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    messagingTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    messagingTemplateSubmission: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  };

  const mockProvider = {
    fetchTemplateStatuses: vi.fn(),
  };

  const mockConnections = {
    getActive: vi.fn().mockResolvedValue({ id: 'conn-1' }),
    use: vi.fn().mockReturnValue(mockProvider),
  };

  const mockEvents = {
    emit: vi.fn(),
  };

  describe('ListRemoteTemplatesUseCase', () => {
    const useCase = new ListRemoteTemplatesUseCase(
      mockPrisma as never,
      mockConnections as never,
    );

    it('falha se o provider não suporta catálogo remoto', async () => {
      mockConnections.use.mockReturnValueOnce({});
      await expect(useCase.execute('conn-1')).rejects.toThrow(BadRequestException);
    });

    it('lista templates da Meta com correspondência exata e candidatos locais', async () => {
      mockProvider.fetchTemplateStatuses.mockResolvedValueOnce([
        {
          providerTemplateId: 'meta-101',
          name: 'order_status',
          language: 'pt-BR',
          status: 'APPROVED',
          category: 'UTILITY',
        },
      ]);

      mockPrisma.messagingTemplate.findMany.mockResolvedValueOnce([
        {
          id: 'tmpl-1',
          key: 'ORDER_STATUS',
          language: 'pt-BR',
          category: 'UTILITY',
        },
        {
          id: 'tmpl-2',
          key: 'WELCOME_MSG',
          language: 'pt-BR',
          category: 'MARKETING',
        },
        {
          id: 'tmpl-en',
          key: 'ORDER_STATUS',
          language: 'en-US',
          category: 'UTILITY',
        },
      ]);

      mockPrisma.messagingTemplateSubmission.findMany.mockResolvedValueOnce([]);

      const result = await useCase.execute('conn-1');
      expect(result).toHaveLength(1);
      expect(result[0].providerTemplateId).toBe('meta-101');
      expect(result[0].name).toBe('order_status');
      expect(result[0].linkedTemplateId).toBeUndefined();

      // Apenas candidatos com correspondência exata
      expect(result[0].suggestedTemplates).toHaveLength(1);
      expect(result[0].suggestedTemplates[0].key).toBe('ORDER_STATUS');
      expect(result[0].suggestedTemplates[0].exactMatch).toBe(true);
    });

    it('indica quando o template da Meta já está vinculado nesta conexão', async () => {
      mockProvider.fetchTemplateStatuses.mockResolvedValueOnce([
        {
          providerTemplateId: 'meta-101',
          name: 'order_status',
          language: 'pt-BR',
          status: 'APPROVED',
          category: 'UTILITY',
        },
      ]);

      mockPrisma.messagingTemplate.findMany.mockResolvedValueOnce([]);
      mockPrisma.messagingTemplateSubmission.findMany.mockResolvedValueOnce([
        {
          templateId: 'tmpl-1',
          providerTemplateId: 'meta-101',
          template: { id: 'tmpl-1', key: 'ORDER_STATUS' },
        },
      ]);

      const result = await useCase.execute('conn-1');
      expect(result[0].linkedTemplateId).toBe('tmpl-1');
      expect(result[0].linkedTemplateKey).toBe('ORDER_STATUS');
    });
  });

  describe('LinkRemoteTemplateUseCase', () => {
    const useCase = new LinkRemoteTemplateUseCase(
      mockPrisma as never,
      mockConnections as never,
      mockEvents as never,
    );

    it('falha se template local não existe', async () => {
      mockPrisma.messagingTemplate.findUnique.mockResolvedValueOnce(null);
      await expect(
        useCase.execute('conn-1', {
          templateId: 'non-existing',
          remoteTemplateId: 'meta-101',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('falha se template não existe na Meta', async () => {
      mockPrisma.messagingTemplate.findUnique.mockResolvedValueOnce({
        id: 'tmpl-1',
        key: 'ORDER_STATUS',
        language: 'pt-BR',
        category: 'UTILITY',
      });
      mockProvider.fetchTemplateStatuses.mockResolvedValueOnce([]);

      await expect(
        useCase.execute('conn-1', {
          templateId: 'tmpl-1',
          remoteTemplateId: 'meta-101',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('recusa vínculo se o template local não for correspondência exata de nome ou idioma', async () => {
      mockPrisma.messagingTemplate.findUnique.mockResolvedValueOnce({
        id: 'tmpl-2',
        key: 'OUTRO_NOME',
        language: 'pt-BR',
        category: 'UTILITY',
      });
      mockProvider.fetchTemplateStatuses.mockResolvedValueOnce([
        {
          providerTemplateId: 'meta-101',
          name: 'order_status',
          language: 'pt-BR',
          status: 'APPROVED',
          category: 'UTILITY',
        },
      ]);

      await expect(
        useCase.execute('conn-1', {
          templateId: 'tmpl-2',
          remoteTemplateId: 'meta-101',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('vincula com sucesso o template local ao template da Meta', async () => {
      mockPrisma.messagingTemplate.findUnique.mockResolvedValueOnce({
        id: 'tmpl-1',
        key: 'ORDER_STATUS',
        language: 'pt-BR',
        category: 'UTILITY',
      });
      mockProvider.fetchTemplateStatuses.mockResolvedValueOnce([
        {
          providerTemplateId: 'meta-101',
          name: 'order_status',
          language: 'pt-BR',
          status: 'APPROVED',
          category: 'UTILITY',
        },
      ]);
      mockPrisma.messagingTemplateSubmission.upsert.mockResolvedValueOnce({
        id: 'sub-1',
        templateId: 'tmpl-1',
        connectionId: 'conn-1',
        providerTemplateId: 'meta-101',
        status: 'APPROVED',
      });

      const result = await useCase.execute('conn-1', {
        templateId: 'tmpl-1',
        remoteTemplateId: 'meta-101',
      });

      expect(result.submissionId).toBe('sub-1');
      expect(result.status).toBe('APPROVED');
      expect(mockEvents.emit).toHaveBeenCalledWith({ type: 'templates' });
      expect(mockPrisma.messagingTemplateSubmission.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            templateId_connectionId: {
              templateId: 'tmpl-1',
              connectionId: 'conn-1',
            },
          },
        }),
      );
    });
  });

  describe('ImportRemoteTemplateUseCase', () => {
    const useCase = new ImportRemoteTemplateUseCase(
      mockPrisma as never,
      mockConnections as never,
      mockEvents as never,
    );

    it('importa template da Meta, cria tipo e template local com submissão', async () => {
      mockProvider.fetchTemplateStatuses.mockResolvedValueOnce([
        {
          providerTemplateId: 'meta-202',
          name: 'payment_received',
          language: 'pt-BR',
          status: 'APPROVED',
          category: 'UTILITY',
          components: [
            { type: 'HEADER', format: 'TEXT', text: 'Aviso {{code}}' },
            { type: 'BODY', text: 'Olá {{name}}, pagamento de {{amount}} recebido.' },
            { type: 'FOOTER', text: 'Obrigado pela preferência' },
            {
              type: 'BUTTONS',
              buttons: [{ type: 'URL', text: 'Ver Recibo', url: 'https://site.com/recibo/{{code}}' }],
            },
          ],
        },
      ]);

      mockPrisma.messagingTemplateType.findUnique.mockResolvedValueOnce(null);
      mockPrisma.messagingTemplateType.create.mockResolvedValueOnce({
        id: 'type-created-1',
        key: 'PAYMENT_RECEIVED',
      });
      mockPrisma.messagingTemplate.findUnique.mockResolvedValueOnce(null);
      mockPrisma.messagingTemplate.create.mockResolvedValueOnce({
        id: 'tmpl-created-1',
        key: 'PAYMENT_RECEIVED',
      });
      mockPrisma.messagingTemplateSubmission.upsert.mockResolvedValueOnce({
        id: 'sub-created-1',
        status: 'APPROVED',
      });

      const result = await useCase.execute('conn-1', {
        remoteTemplateId: 'meta-202',
      });

      expect(result.templateId).toBe('tmpl-created-1');
      expect(result.templateKey).toBe('PAYMENT_RECEIVED');
      expect(result.status).toBe('APPROVED');
      expect(mockEvents.emit).toHaveBeenCalledWith({ type: 'templates' });
      expect(mockPrisma.messagingTemplateType.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            key: 'PAYMENT_RECEIVED',
            variables: expect.arrayContaining([
              expect.objectContaining({ name: 'code' }),
              expect.objectContaining({ name: 'name' }),
              expect.objectContaining({ name: 'amount' }),
            ]),
          }),
        }),
      );
      expect(mockPrisma.messagingTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            key: 'PAYMENT_RECEIVED',
            language: 'pt-BR',
            typeId: 'type-created-1',
            body: 'Olá {{name}}, pagamento de {{amount}} recebido.',
            footer: 'Obrigado pela preferência',
          }),
        }),
      );
    });
  });
});

