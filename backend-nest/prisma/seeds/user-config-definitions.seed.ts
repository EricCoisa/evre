import { PrismaClient } from '@prisma/client';
import { USER_AI_CONFIG_KEYS, AiProviderConst } from '../../dist/src/domain/ai/ai.const';
import { notificationUserConfigKeys } from '../../dist/src/domain/notification/notification-config.const';

export async function seedUserConfigDefinitions(prisma: PrismaClient) {
  const userConfigDefs: Array<{
    labelKey: string;
    valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'DATE' | 'ENUM';
    options?: string[];
    defaultValue?: string;
    isRequired: boolean;
    secret?: boolean;
  }> = [
    {
      labelKey: 'USERCONFIG_THEME',
      valueType: 'ENUM',
      options: ['light', 'dark'],
      defaultValue: 'light',
      isRequired: false,
    },
    {
      labelKey: 'USERCONFIG_LANGUAGE',
      valueType: 'ENUM',
      options: ['pt-BR', 'en'],
      defaultValue: 'pt-BR',
      isRequired: false,
    },
    {
      labelKey: 'USERCONFIG_AGENT_PROVIDER',
      valueType: 'ENUM',
      options: ['ANTHROPIC', 'OPENAI', 'OPENAI_COMPATIBLE'],
      defaultValue: 'ANTHROPIC',
      isRequired: false,
    },
    // Modelo/chave por provider (BYOK), espelhando as SYSTEM_AI_<PROVIDER>_*: quem
    // configura OpenAI e Anthropic mantém as duas credenciais guardadas e só troca
    // o USERCONFIG_AGENT_PROVIDER acima. Ver USER_AI_CONFIG_KEYS em domain/ai/ai.const.ts.
    {
      labelKey: USER_AI_CONFIG_KEYS[AiProviderConst.ANTHROPIC].model,
      valueType: 'STRING',
      isRequired: false,
    },
    {
      labelKey: USER_AI_CONFIG_KEYS[AiProviderConst.ANTHROPIC].apiKey,
      valueType: 'STRING',
      secret: true,
      isRequired: false,
    },
    {
      labelKey: USER_AI_CONFIG_KEYS[AiProviderConst.OPENAI].model,
      valueType: 'STRING',
      isRequired: false,
    },
    {
      labelKey: USER_AI_CONFIG_KEYS[AiProviderConst.OPENAI].apiKey,
      valueType: 'STRING',
      secret: true,
      isRequired: false,
    },
    {
      labelKey: USER_AI_CONFIG_KEYS[AiProviderConst.OPENAI_COMPATIBLE].model,
      valueType: 'STRING',
      isRequired: false,
    },
    {
      labelKey: USER_AI_CONFIG_KEYS[AiProviderConst.OPENAI_COMPATIBLE].apiKey,
      valueType: 'STRING',
      secret: true,
      isRequired: false,
    },
    {
      labelKey: USER_AI_CONFIG_KEYS[AiProviderConst.OPENAI_COMPATIBLE].baseUrl!,
      valueType: 'STRING',
      isRequired: false,
    },
    {
      labelKey: 'USERCONFIG_AGENT_PROMPT',
      valueType: 'STRING',
      isRequired: false,
    },
    // PageBuilder: mapa pageKey → layout, uma linha por usuário para todas as páginas.
    {
      labelKey: 'PAGE_LAYOUTS',
      valueType: 'JSON',
      defaultValue: '{}',
      isRequired: false,
    },
    // Notification: silenciar canal por usuário, sem tocar na flag global.
    {
      labelKey: notificationUserConfigKeys.channelEmail,
      valueType: 'BOOLEAN',
      defaultValue: 'true',
      isRequired: false,
    },
    {
      labelKey: notificationUserConfigKeys.channelWhatsapp,
      valueType: 'BOOLEAN',
      defaultValue: 'true',
      isRequired: false,
    },
    // Lista de type-keys (ver notification-type.const.ts) que o usuário não quer receber,
    // em nenhum canal. JSON porque é um array, não um valor simples.
    {
      labelKey: notificationUserConfigKeys.mutedTypes,
      valueType: 'JSON',
      defaultValue: '[]',
      isRequired: false,
    },
  ];

  for (const def of userConfigDefs) {
    await prisma.userConfigurationDefinition.upsert({
      where: { labelKey: def.labelKey },
      update: {},
      create: def,
    });
  }
  console.log('✅ User configuration definitions created');
}
