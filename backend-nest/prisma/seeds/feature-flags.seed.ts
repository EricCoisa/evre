import { PrismaClient } from '@prisma/client';

export async function seedFeatureFlags(
  prisma: PrismaClient,
  roleMap: Record<string, string>,
) {
  const roleNames = Object.keys(roleMap);

  await prisma.featureFlag.upsert({
    where: { key: 'BETA_DASHBOARD' },
    update: {
      category: 'DASHBOARD',
    },
    create: {
      key: 'BETA_DASHBOARD',
      description: 'Habilita o novo dashboard beta para todos',
      category: 'DASHBOARD',
      enabled: true,
    },
  });

  const adminFlag = await prisma.featureFlag.upsert({
    where: { key: 'ADVANCED_REPORTS' },
    update: {
      category: 'REPORTS',
    },
    create: {
      key: 'ADVANCED_REPORTS',
      description: 'Relatórios avançados (restrito a ADMIN)',
      category: 'REPORTS',
      enabled: true,
    },
  });

  // Restrict ADVANCED_REPORTS to ADMIN role only
  await prisma.featureFlagRole.upsert({
    where: {
      featureFlagId_roleId: {
        featureFlagId: adminFlag.id,
        roleId: roleMap['ADMIN'],
      },
    },
    update: {},
    create: { featureFlagId: adminFlag.id, roleId: roleMap['ADMIN'] },
  });

  console.log('✅ Feature flags created');

  // AI Agent feature flag
  const aiAgentFlag = await prisma.featureFlag.upsert({
    where: { key: 'AI_AGENT' },
    update: {
      category: 'AI',
    },
    create: {
      key: 'AI_AGENT',
      description: 'Habilita o chat com o agente de IA',
      category: 'AI',
      enabled: true,
    },
  });
  await prisma.featureFlagRole.upsert({
    where: {
      featureFlagId_roleId: {
        featureFlagId: aiAgentFlag.id,
        roleId: roleMap['ADMIN'],
      },
    },
    update: {},
    create: { featureFlagId: aiAgentFlag.id, roleId: roleMap['ADMIN'] },
  });
  console.log('✅ AI Agent feature flag created');

  // MCP / API Keys feature flag — controla a aba de API Keys em /profile
  const mcpApiKeysFlag = await prisma.featureFlag.upsert({
    where: { key: 'MCP_API_KEYS' },
    update: {
      category: 'CONNECTORS',
    },
    create: {
      key: 'MCP_API_KEYS',
      description: 'Habilita a aba de API Keys (MCP) no perfil do usuário',
      category: 'CONNECTORS',
      enabled: true,
    },
  });
  for (const name of roleNames) {
    await prisma.featureFlagRole.upsert({
      where: {
        featureFlagId_roleId: {
          featureFlagId: mcpApiKeysFlag.id,
          roleId: roleMap[name],
        },
      },
      update: {},
      create: { featureFlagId: mcpApiKeysFlag.id, roleId: roleMap[name] },
    });
  }
  console.log('✅ MCP API Keys feature flag created');

  // MCP Connectors — conector MCP remoto (Claude Desktop / ChatGPT). Flag off
  // derruba o endpoint /api/v1/mcp e esconde a aba Conectores do perfil.
  const mcpConnectorsFlag = await prisma.featureFlag.upsert({
    where: { key: 'MCP_CONNECTORS' },
    update: {
      category: 'CONNECTORS',
    },
    create: {
      key: 'MCP_CONNECTORS',
      description:
        'Habilita o conector MCP remoto (Claude Desktop, ChatGPT) e a aba Conectores no perfil',
      category: 'CONNECTORS',
      enabled: true,
    },
  });
  for (const name of roleNames) {
    await prisma.featureFlagRole.upsert({
      where: {
        featureFlagId_roleId: {
          featureFlagId: mcpConnectorsFlag.id,
          roleId: roleMap[name],
        },
      },
      update: {},
      create: { featureFlagId: mcpConnectorsFlag.id, roleId: roleMap[name] },
    });
  }
  console.log('✅ MCP Connectors feature flag created');

  // PageBuilder — flag off deixa as páginas renderizando o componente em código
  const pageBuilderFlag = await prisma.featureFlag.upsert({
    where: { key: 'PAGE_BUILDER' },
    update: {
      category: 'SYSTEM',
    },
    create: {
      key: 'PAGE_BUILDER',
      description:
        'Habilita a customização de páginas por usuário (PageBuilder)',
      category: 'SYSTEM',
      enabled: true,
    },
  });
  for (const name of roleNames) {
    await prisma.featureFlagRole.upsert({
      where: {
        featureFlagId_roleId: {
          featureFlagId: pageBuilderFlag.id,
          roleId: roleMap[name],
        },
      },
      update: {},
      create: { featureFlagId: pageBuilderFlag.id, roleId: roleMap[name] },
    });
  }
  console.log('✅ PageBuilder feature flag created');

  // OAuth — rota pública / de sistema. isSystem: true indica uso por toda aplicação.
  await prisma.featureFlag.upsert({
    where: { key: 'OAUTH_LOGIN' },
    update: {
      description: 'Habilita login por provider OAuth/OIDC (Google, Microsoft…)',
      category: 'AUTH',
      isSystem: true,
    },
    create: {
      key: 'OAUTH_LOGIN',
      description:
        'Habilita login por provider OAuth/OIDC (Google, Microsoft…)',
      category: 'AUTH',
      isSystem: true,
      enabled: true,
    },
  });
  console.log('✅ OAuth login feature flag created');

  // Mensageria — kill-switch do módulo inteiro. isSystem: true indica uso por toda aplicação.
  const messagingRootFlag = await prisma.featureFlag.upsert({
    where: { key: 'MESSAGING' },
    update: {
      description: 'Habilita a mensageria (WhatsApp)',
      category: 'MESSAGING',
      isSystem: true,
    },
    create: {
      key: 'MESSAGING',
      description:
        'Habilita a mensageria (WhatsApp)',
      category: 'MESSAGING',
      isSystem: true,
      enabled: true,
    },
  });
  await prisma.featureFlag.upsert({
    where: { key: 'MESSAGING_CONTACTS' },
    update: { parentId: messagingRootFlag.id, category: 'MESSAGING' },
    create: {
      key: 'MESSAGING_CONTACTS',
      description:
        'Habilita a lista e o gerenciamento de contatos da mensageria',
      category: 'MESSAGING',
      enabled: true,
      parentId: messagingRootFlag.id,
    },
  });
  await prisma.featureFlag.upsert({
    where: { key: 'MESSAGING_CHAT' },
    update: { parentId: messagingRootFlag.id, category: 'MESSAGING' },
    create: {
      key: 'MESSAGING_CHAT',
      description: 'Habilita o chat de contatos da mensageria',
      category: 'MESSAGING',
      enabled: true,
      parentId: messagingRootFlag.id,
    },
  });
  await prisma.featureFlag.upsert({
    where: { key: 'MESSAGING_TEMPLATES' },
    update: { parentId: messagingRootFlag.id, category: 'MESSAGING' },
    create: {
      key: 'MESSAGING_TEMPLATES',
      description: 'Habilita o catálogo de templates da mensageria',
      category: 'MESSAGING',
      enabled: true,
      parentId: messagingRootFlag.id,
    },
  });
  console.log('✅ Messaging feature flag created');

  // Notification — nasce desligada, como a MESSAGING: módulo agnóstico que outros
  // módulos chamam via NotificationService, sem valor até ligado pelo admin. Sem roles: notify()
  // avalia com roleName vazio em chamadas de sistema (cron, webhook) — uma role associada
  // travaria isso em silêncio. Liga/desliga por canal (email/WhatsApp) é SystemConfiguration, não
  // flag filha — feature flag é rollout de dev, não controle de operador (ver system-config.seed.ts).
  await prisma.featureFlag.upsert({
    where: { key: 'NOTIFICATION' },
    update: {
      category: 'NOTIFICATIONS',
    },
    create: {
      key: 'NOTIFICATION',
      description:
        'Habilita o módulo de notificação (sininho, inbox, relay de email/WhatsApp)',
      category: 'NOTIFICATIONS',
      enabled: true,
    },
  });
  console.log('✅ Notification feature flag created');

  // Time Tracking feature flag (para ADMIN e MODERATOR)
  const timeTrackingFlag = await prisma.featureFlag.upsert({
    where: { key: 'FEATURE_TIME_TRACKING' },
    update: {
      category: 'GENERAL',
    },
    create: {
      key: 'FEATURE_TIME_TRACKING',
      description: 'Habilita o módulo de rastreamento de tempo trabalhado (Time Tracker)',
      category: 'GENERAL',
      enabled: true,
    },
  });

  for (const roleName of ['ADMIN', 'MODERATOR']) {
    if (roleMap[roleName]) {
      await prisma.featureFlagRole.upsert({
        where: {
          featureFlagId_roleId: {
            featureFlagId: timeTrackingFlag.id,
            roleId: roleMap[roleName],
          },
        },
        update: {},
        create: {
          featureFlagId: timeTrackingFlag.id,
          roleId: roleMap[roleName],
        },
      });
    }
  }
  console.log('✅ Time Tracking feature flag created');
}
