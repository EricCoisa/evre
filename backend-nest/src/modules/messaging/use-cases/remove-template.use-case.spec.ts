import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';
import { RemoveTemplateUseCase } from './remove-template.use-case';

describe('RemoveTemplateUseCase', () => {
  const prisma = {
    messagingTemplate: { findUnique: vi.fn(), delete: vi.fn() },
  };
  const deleteRemoteTemplate = vi.fn();
  const connections = { use: vi.fn().mockReturnValue({ deleteRemoteTemplate }) };
  const useCase = new RemoveTemplateUseCase(prisma as never, connections as never);

  beforeEach(() => {
    vi.clearAllMocks();
    deleteRemoteTemplate.mockResolvedValue({ status: true, data: 'ok' });
  });

  it('id inexistente é 404', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(null);
    await expect(useCase.execute('nada')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('template com isSystem=true não pode ser removido e lança BadRequestException', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue({
      id: 't-sys',
      key: 'PASSWORD_CHANGED',
      isSystem: true,
      submissions: [],
    });
    await expect(useCase.execute('t-sys')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.messagingTemplate.delete).not.toHaveBeenCalled();
    expect(deleteRemoteTemplate).not.toHaveBeenCalled();
  });

  it('sem submissão nenhuma, só apaga local', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue({
      id: 't-1',
      key: 'PASSWORD_CHANGED',
      submissions: [],
    });
    await useCase.execute('t-1');
    expect(deleteRemoteTemplate).not.toHaveBeenCalled();
    expect(prisma.messagingTemplate.delete).toHaveBeenCalledWith({ where: { id: 't-1' } });
  });

  it('apaga remoto, só do idioma do template (hsm_id), em cada conexão submetida antes de apagar local', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue({
      id: 't-1',
      key: 'PASSWORD_CHANGED',
      submissions: [
        { connectionId: 'conn-meta', providerTemplateId: 'wa-1', connection: { id: 'conn-meta' } },
        { connectionId: 'conn-meta-2', providerTemplateId: 'wa-2', connection: { id: 'conn-meta-2' } },
      ],
    });
    await useCase.execute('t-1');
    expect(deleteRemoteTemplate).toHaveBeenCalledTimes(2);
    expect(deleteRemoteTemplate).toHaveBeenCalledWith('password_changed', 'wa-1');
    expect(prisma.messagingTemplate.delete).toHaveBeenCalledWith({ where: { id: 't-1' } });
  });

  it('falha na Meta aborta: nada é apagado localmente e o motivo vai ao operador', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue({
      id: 't-1',
      key: 'PASSWORD_CHANGED',
      submissions: [{ connectionId: 'conn-meta', connection: { id: 'conn-meta', provider: 'META' } }],
    });
    deleteRemoteTemplate.mockResolvedValueOnce({ status: false, data: 'Invalid OAuth access token' });

    const error = await useCase.execute('t-1').catch((e) => e);
    expect(error).toBeInstanceOf(BadGatewayException);
    expect(error.message).toContain('Invalid OAuth access token');
    expect(prisma.messagingTemplate.delete).not.toHaveBeenCalled();
  });

  it('template que já não existe na Meta não impede apagar localmente', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue({
      id: 't-1',
      key: 'X',
      submissions: [{ connectionId: 'conn-meta', connection: { id: 'conn-meta' } }],
    });
    deleteRemoteTemplate.mockResolvedValueOnce({ status: false, data: 'Template name does not exist' });

    await expect(useCase.execute('t-1')).resolves.toMatchObject({ status: true });
    expect(prisma.messagingTemplate.delete).toHaveBeenCalled();
  });

  it('remote=false apaga só localmente, sem falar com a Meta', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue({
      id: 't-1',
      key: 'X',
      submissions: [{ connectionId: 'conn-meta', connection: { id: 'conn-meta' } }],
    });
    await useCase.execute('t-1', false);
    expect(deleteRemoteTemplate).not.toHaveBeenCalled();
    expect(prisma.messagingTemplate.delete).toHaveBeenCalled();
  });

  it('conexão sem deleteRemoteTemplate (Evolution) é ignorada', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue({
      id: 't-1',
      key: 'PASSWORD_CHANGED',
      submissions: [{ connectionId: 'conn-evo', connection: { id: 'conn-evo' } }],
    });
    connections.use.mockReturnValueOnce({});

    await useCase.execute('t-1');
    expect(deleteRemoteTemplate).not.toHaveBeenCalled();
    expect(prisma.messagingTemplate.delete).toHaveBeenCalled();
  });
});
