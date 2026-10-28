import { describe, it, expect, vi } from 'vitest';
import { SendNotificationUseCase } from './send-notification.use-case';
import { NOTIFICATION_WHATSAPP_TEMPLATE_KEY } from 'src/domain/notification/notification-config.const';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { FeatureFlagService } from '../../feature-flag/feature-flag.service';
import type { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import type { EmailService } from '../../email/email.service';
import type { MessagingService } from '../../messaging/messaging.service';
import type { VerificationService } from '../../verification/verification.service';

function buildUseCase(opts: {
  enabled?: boolean;
  /** Override por labelKey de SystemConfiguration — sobrepõe o default ('true') só para as chaves listadas. */
  channelConfig?: Record<string, string | null>;
  users?: Array<{
    id: string;
    email: string | null;
    phone: string | null;
  }>;
  /** Resposta do VerificationModule para "este telefone está confirmado?" — default: true. */
  phoneConfirmed?: boolean;
  definitions?: Array<{
    id: string;
    labelKey: string;
    valueType: string;
    defaultValue: string | null;
  }>;
  configs?: Array<{ userId: string; definitionId: string; value: string }>;
}) {
  const prisma = {
    user: {
      findMany: vi.fn().mockResolvedValue(opts.users ?? []),
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'notif-1' }),
    },
    notificationRecipient: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    userConfigurationDefinition: {
      findMany: vi.fn().mockResolvedValue(opts.definitions ?? []),
    },
    userConfiguration: {
      findMany: vi.fn().mockResolvedValue(opts.configs ?? []),
    },
  } as unknown as PrismaService;

  const featureFlags = {
    isEnabled: vi.fn().mockResolvedValue(opts.enabled ?? true),
  } as unknown as FeatureFlagService;

  const systemConfig = {
    getValueOrNull: vi.fn((key: string) =>
      Promise.resolve(
        opts.channelConfig && key in opts.channelConfig
          ? opts.channelConfig[key]
          : 'true',
      ),
    ),
  } as unknown as SystemConfigurationService;

  const emailService = {
    send: vi.fn().mockResolvedValue({ status: true, data: 'ok' }),
    renderTemplate: vi.fn().mockResolvedValue('<html>mock</html>'),
  } as unknown as EmailService;

  const messagingService = {
    trySendTemplate: vi.fn().mockResolvedValue('msg-1'),
  } as unknown as MessagingService;

  const verificationService = {
    isConfirmed: vi.fn().mockResolvedValue(opts.phoneConfirmed ?? true),
  } as unknown as VerificationService;

  const useCase = new SendNotificationUseCase(
    prisma,
    featureFlags,
    systemConfig,
    emailService,
    messagingService,
    verificationService,
  );

  return { useCase, prisma, featureFlags, systemConfig, emailService, messagingService, verificationService };
}

describe('SendNotificationUseCase', () => {
  it('não faz nada quando a flag NOTIFICATION está desligada', async () => {
    const { useCase, prisma } = buildUseCase({ enabled: false });

    await useCase.execute({
      type: 'SYSTEM_ANNOUNCEMENT',
      recipients: { userIds: ['u1'] },
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('envia para destinatários explícitos (userIds)', async () => {
    const { useCase, prisma } = buildUseCase({});

    await useCase.execute({
      type: 'SYSTEM_ANNOUNCEMENT',
      recipients: { userIds: ['u1', 'u2'] },
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notificationRecipient.createMany).toHaveBeenCalledWith({
      data: [
        { notificationId: 'notif-1', userId: 'u1' },
        { notificationId: 'notif-1', userId: 'u2' },
      ],
      skipDuplicates: true,
    });
  });

  it('broadcast por role grava a audiência no evento, sem criar NotificationRecipient nem resolver usuários', async () => {
    const { useCase, prisma } = buildUseCase({});

    await useCase.execute({
      type: 'SYSTEM_ANNOUNCEMENT',
      recipients: { roleNames: ['ADMIN'] },
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        audienceAll: false,
        audienceRoleNames: ['ADMIN'],
      }),
    });
    expect(prisma.notificationRecipient.createMany).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('broadcast para todos grava audienceAll, sem criar NotificationRecipient nem resolver usuários', async () => {
    const { useCase, prisma } = buildUseCase({});

    await useCase.execute({
      type: 'SYSTEM_ANNOUNCEMENT',
      recipients: { all: true },
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ audienceAll: true, audienceRoleNames: [] }),
    });
    expect(prisma.notificationRecipient.createMany).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('broadcast com canal pedido resolve a lista de usuários só para o relay, não para o in-app', async () => {
    const { useCase, prisma, emailService } = buildUseCase({
      users: [{ id: 'u1', email: 'u1@test.com', phone: null }],
    });

    await useCase.execute({
      type: 'SYSTEM_ANNOUNCEMENT',
      recipients: { roleNames: ['ADMIN'] },
      title: 'Aviso',
      message: 'Corpo',
      channels: { email: true },
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        roleRecord: { name: { in: ['ADMIN'] } },
      },
      select: { id: true },
    });
    expect(prisma.notificationRecipient.createMany).not.toHaveBeenCalled();
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'u1@test.com' }),
    );
  });

  it('não dispara nenhum canal quando o tipo está na lista de tipos silenciados do usuário', async () => {
    const { useCase, prisma, emailService } = buildUseCase({
      users: [{ id: 'u1', email: 'u1@test.com', phone: null }],
      definitions: [
        {
          id: 'def-muted',
          labelKey: 'NOTIFICATION_MUTED_TYPES',
          valueType: 'JSON',
          defaultValue: '[]',
        },
      ],
      configs: [
        {
          userId: 'u1',
          definitionId: 'def-muted',
          value: JSON.stringify(['SYSTEM_ANNOUNCEMENT']),
        },
      ],
    });

    await useCase.execute({
      type: 'SYSTEM_ANNOUNCEMENT',
      recipients: { userIds: ['u1'] },
      channels: { email: true },
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('não envia email quando o usuário silenciou o canal, mas a notificação in-app é criada', async () => {
    const { useCase, prisma, emailService } = buildUseCase({
      users: [{ id: 'u1', email: 'u1@test.com', phone: null }],
      definitions: [
        {
          id: 'def-email',
          labelKey: 'NOTIFICATION_CHANNEL_EMAIL',
          valueType: 'BOOLEAN',
          defaultValue: 'true',
        },
      ],
      configs: [{ userId: 'u1', definitionId: 'def-email', value: 'false' }],
    });

    await useCase.execute({
      type: 'SYSTEM_ANNOUNCEMENT',
      recipients: { userIds: ['u1'] },
      channels: { email: true },
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('envia email quando pedido e permitido (default sem customização é true)', async () => {
    const { useCase, emailService } = buildUseCase({
      users: [{ id: 'u1', email: 'u1@test.com', phone: null }],
    });

    await useCase.execute({
      type: 'SYSTEM_ANNOUNCEMENT',
      recipients: { userIds: ['u1'] },
      title: 'Aviso',
      message: 'Corpo',
      channels: { email: true },
    });

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'u1@test.com', subject: 'Aviso' }),
    );
  });

  it('dispara WhatsApp via template único (NOTIFICATION) quando o usuário tem phone confirmado e canal permitido', async () => {
    const { useCase, messagingService, verificationService } = buildUseCase({
      users: [{ id: 'u1', email: null, phone: '+5511999999999' }],
      phoneConfirmed: true,
    });

    await useCase.execute({
      type: 'SYSTEM_ANNOUNCEMENT',
      recipients: { userIds: ['u1'] },
      title: 'Aviso',
      message: 'Corpo',
      channels: { whatsapp: true },
    });

    expect(verificationService.isConfirmed).toHaveBeenCalledWith({
      userId: 'u1',
      purpose: 'USER_PHONE_CONFIRMATION',
      target: '+5511999999999',
    });
    expect(messagingService.trySendTemplate).toHaveBeenCalledWith({
      key: NOTIFICATION_WHATSAPP_TEMPLATE_KEY,
      phone: '+5511999999999',
      values: { title: 'Aviso', message: 'Corpo' },
    });
  });

  it('não envia email quando SYSTEM_NOTIFICATION_EMAIL_ENABLED está desligada na plataforma, mesmo com preferência do usuário permitindo', async () => {
    const { useCase, emailService } = buildUseCase({
      channelConfig: { SYSTEM_NOTIFICATION_EMAIL_ENABLED: 'false' },
      users: [{ id: 'u1', email: 'u1@test.com', phone: null }],
    });

    await useCase.execute({
      type: 'SYSTEM_ANNOUNCEMENT',
      recipients: { userIds: ['u1'] },
      channels: { email: true },
    });

    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('não envia email quando a config de plataforma nunca foi seedada (chave ausente = desligada)', async () => {
    const { useCase, emailService } = buildUseCase({
      channelConfig: { SYSTEM_NOTIFICATION_EMAIL_ENABLED: null },
      users: [{ id: 'u1', email: 'u1@test.com', phone: null }],
    });

    await useCase.execute({
      type: 'SYSTEM_ANNOUNCEMENT',
      recipients: { userIds: ['u1'] },
      channels: { email: true },
    });

    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('não envia WhatsApp quando SYSTEM_NOTIFICATION_WHATSAPP_ENABLED está desligada na plataforma, mesmo com preferência do usuário permitindo', async () => {
    const { useCase, messagingService } = buildUseCase({
      channelConfig: { SYSTEM_NOTIFICATION_WHATSAPP_ENABLED: 'false' },
      users: [{ id: 'u1', email: null, phone: '+5511999999999' }],
    });

    await useCase.execute({
      type: 'SYSTEM_ANNOUNCEMENT',
      recipients: { userIds: ['u1'] },
      channels: { whatsapp: true },
    });

    expect(messagingService.trySendTemplate).not.toHaveBeenCalled();
  });

  it('WhatsApp desligado não impede email: cada canal é checado independentemente', async () => {
    const { useCase, emailService, messagingService } = buildUseCase({
      channelConfig: { SYSTEM_NOTIFICATION_WHATSAPP_ENABLED: 'false' },
      users: [{ id: 'u1', email: 'u1@test.com', phone: '+5511999999999' }],
    });

    await useCase.execute({
      type: 'SYSTEM_ANNOUNCEMENT',
      recipients: { userIds: ['u1'] },
      title: 'Aviso',
      channels: {
        email: true,
        whatsapp: true,
      },
    });

    expect(emailService.send).toHaveBeenCalled();
    expect(messagingService.trySendTemplate).not.toHaveBeenCalled();
  });

  it('não envia WhatsApp quando o telefone existe mas não está confirmado', async () => {
    const { useCase, messagingService } = buildUseCase({
      users: [{ id: 'u1', email: null, phone: '+5511999999999' }],
      phoneConfirmed: false,
    });

    await useCase.execute({
      type: 'SYSTEM_ANNOUNCEMENT',
      recipients: { userIds: ['u1'] },
      title: 'Aviso',
      channels: { whatsapp: true },
    });

    expect(messagingService.trySendTemplate).not.toHaveBeenCalled();
  });
});
