import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { captchaConfigKeys } from '../../dist/src/domain/auth/captcha.const';
import { oauthConfigKeys } from '../../dist/src/domain/auth/oauthProvider.const';
import { sentryConfigKeys } from '../../dist/src/domain/observability/sentry.const';
import { notificationConfigKeys } from '../../dist/src/domain/notification/notification-config.const';
import {
  AI_CONFIG_KEYS,
  AiProviderConst,
} from '../../dist/src/domain/ai/ai.const';
import { EMAIL_CONFIG_KEYS } from '../../dist/src/domain/mail/mail.const';
import { STORAGE_CONFIG_KEYS } from '../../dist/src/domain/storage/storage.const';
import {
  ARTIFACT_CONFIG_KEYS,
  ARTIFACT_FILE_DEFAULT_MAX_SIZE_BYTES,
  ARTIFACT_ZIP_DEFAULT_MAX_SIZE_BYTES,
  ARTIFACT_FOLDER_DEFAULT_MAX_SIZE_BYTES,
} from '../../dist/src/domain/artifact/artifact.const';

export async function seedSystemConfigurations(prisma: PrismaClient) {
  const sysConfigs: Array<{
    labelKey: string;
    valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'DATE' | 'ENUM';
    options?: string[];
    value: string;
    secret?: boolean;
    /** `blocked` não é editável por API (não está em nenhum DTO): identidade da
     *  instalação se define aqui e nem ADMIN altera depois. */
    blocked?: boolean;
  }> = [
    { labelKey: 'SYSTEM_APP_NAME', valueType: 'STRING', value: 'EVRE' },
    // Descritor opcional ao lado do nome no header da proposta pública. Nasce vazio —
    // é texto de negócio por instalação, não faz sentido um default de template.
    { labelKey: 'SYSTEM_APP_TAGLINE', valueType: 'STRING', value: '' },
    {
      labelKey: 'SYSTEMCONFIG_SUPORTURL',
      valueType: 'STRING',
      value: '',
    },
    { labelKey: 'SYSTEMCONFIG_SENDLOG', valueType: 'BOOLEAN', value: 'false' },
    // Identidade da instalação junto ao suporte (ver clientLog). Não é configuração
    // operacional: muda por provisionamento, não por tela. `blocked` faz o backend
    // recusar update/delete e o front renderizar o campo desabilitado.
    {
      labelKey: 'SYSTEMID',
      valueType: 'STRING',
      value: '000-000-000',
      blocked: true,
    },
    // `secret` aqui só mascara a resposta da API (`****`): com `blocked` o valor
    // nunca é reescrito, então nunca chega a ser cifrado em disco. Quem precisa do
    // valor real é o clientLog, e `findByLabelKey` descriptografa antes de devolver.
    {
      labelKey: 'SYSTEMTOKEN',
      valueType: 'STRING',
      value: '000-000-000',
      secret: true,
      blocked: true,
    },
    {
      labelKey: 'SYSTEMCONFIG_THEME',
      valueType: 'ENUM',
      options: ['light', 'dark'],
      value: 'light',
    },
    { labelKey: 'SYSTEMCONFIG_LOG_LIMITE', valueType: 'NUMBER', value: '1000' },
    {
      labelKey: 'SYSTEMCONFIG_LOG_DELETE_DAY',
      valueType: 'NUMBER',
      value: '30',
    },
    { labelKey: 'SYSTEM_USER_CREATE', valueType: 'BOOLEAN', value: 'false' },
    { labelKey: 'SYSTEM_TERMS_VERSION', valueType: 'STRING', value: '1.0' },
    {
      labelKey: EMAIL_CONFIG_KEYS.provider,
      valueType: 'ENUM',
      options: ['RESEND', 'SMTP'],
      value: 'RESEND',
    },
    {
      labelKey: EMAIL_CONFIG_KEYS.providerApiKey,
      valueType: 'STRING',
      value: '',
      secret: true,
    },
    {
      labelKey: EMAIL_CONFIG_KEYS.defaultFrom,
      valueType: 'STRING',
      value: '',
    },
    {
      labelKey: EMAIL_CONFIG_KEYS.smtpHost,
      valueType: 'STRING',
      value: '',
    },
    { labelKey: EMAIL_CONFIG_KEYS.smtpPort, valueType: 'STRING', value: '587' },
    {
      labelKey: EMAIL_CONFIG_KEYS.smtpUser,
      valueType: 'STRING',
      value: '',
    },
    {
      labelKey: EMAIL_CONFIG_KEYS.smtpPass,
      valueType: 'STRING',
      value: '',
      secret: true,
    },
    {
      labelKey: EMAIL_CONFIG_KEYS.smtpSecure,
      valueType: 'BOOLEAN',
      value: 'false',
    },
    { labelKey: 'EMAIL_TEMPLATES', valueType: 'JSON', value: '{}' },
    {
      labelKey: 'SYSTEM_MESSAGING_IGNORE_LIST',
      valueType: 'JSON',
      value: '[]',
    },
    { labelKey: 'SYSTEM_ROLE_HOME_ROUTES', valueType: 'JSON', value: '{}' },
    {
      labelKey: 'SYSTEM_LOG_MIN_LEVEL',
      valueType: 'ENUM',
      options: ['DEBUG', 'INFO', 'WARN'],
      value: 'DEBUG',
    },
    {
      labelKey: STORAGE_CONFIG_KEYS.provider,
      valueType: 'ENUM',
      options: ['S3', 'LOCAL'],
      value: 'S3',
    },
    {
      labelKey: STORAGE_CONFIG_KEYS.s3Endpoint,
      valueType: 'STRING',
      value: '',
    },
    {
      labelKey: STORAGE_CONFIG_KEYS.s3Region,
      valueType: 'STRING',
      value: 'us-east-1',
    },
    {
      labelKey: STORAGE_CONFIG_KEYS.s3Bucket,
      valueType: 'STRING',
      value: '',
    },
    {
      labelKey: STORAGE_CONFIG_KEYS.s3AccessKey,
      valueType: 'STRING',
      value: '',
      secret: true,
    },
    {
      labelKey: STORAGE_CONFIG_KEYS.s3SecretKey,
      valueType: 'STRING',
      value: '',
      secret: true,
    },
    {
      labelKey: STORAGE_CONFIG_KEYS.s3PublicUrl,
      valueType: 'STRING',
      value: '',
    },
    {
      labelKey: STORAGE_CONFIG_KEYS.localDir,
      valueType: 'STRING',
      value: './uploads',
    },
    {
      labelKey: STORAGE_CONFIG_KEYS.publicBaseUrl,
      valueType: 'STRING',
      value: 'http://localhost:3001',
    },
    // OAuth/OIDC — o fluxo é agnóstico: um provider novo são estas 3 chaves + uma entrada
    // em src/domain/auth/oauthProvider.const.ts. Vazio = botão não aparece no /login.
    {
      labelKey: oauthConfigKeys('GOOGLE').issuer,
      valueType: 'STRING',
      value: 'https://accounts.google.com',
    },
    {
      labelKey: oauthConfigKeys('GOOGLE').clientId,
      valueType: 'STRING',
      value: '',
    },
    {
      labelKey: oauthConfigKeys('GOOGLE').clientSecret,
      valueType: 'STRING',
      value: '',
      secret: true,
    },
    {
      labelKey: oauthConfigKeys('MICROSOFT').issuer,
      valueType: 'STRING',
      value: 'https://login.microsoftonline.com/common/v2.0',
    },
    {
      labelKey: oauthConfigKeys('MICROSOFT').clientId,
      valueType: 'STRING',
      value: '',
    },
    {
      labelKey: oauthConfigKeys('MICROSOFT').clientSecret,
      valueType: 'STRING',
      value: '',
      secret: true,
    },
    // Liga/desliga o provider no login sem apagar as credenciais gravadas. Default true:
    // mantém o comportamento atual (configurado = ativo) até o admin desligar manualmente.
    {
      labelKey: oauthConfigKeys('GOOGLE').enabled,
      valueType: 'BOOLEAN',
      value: 'true',
    },
    {
      labelKey: oauthConfigKeys('MICROSOFT').enabled,
      valueType: 'BOOLEAN',
      value: 'true',
    },
    // Captcha — o dono do sistema escolhe o provider e cola as duas chaves. Nasce
    // DESLIGADO: template novo sobe sem captcha, e sem credencial o guard libera.
    // Um provider novo é uma entrada em src/domain/auth/captcha.const.ts + este enum.
    {
      labelKey: captchaConfigKeys.enabled,
      valueType: 'BOOLEAN',
      value: 'false',
    },
    {
      labelKey: captchaConfigKeys.provider,
      valueType: 'ENUM',
      options: ['TURNSTILE', 'HCAPTCHA', 'RECAPTCHA_V3'],
      value: 'TURNSTILE',
    },
    { labelKey: captchaConfigKeys.siteKey, valueType: 'STRING', value: '' },
    {
      labelKey: captchaConfigKeys.secretKey,
      valueType: 'STRING',
      value: '',
      secret: true,
    },
    // Sentry — DSN não é credencial (o Sentry publica o dele no bundle do
    // front), então fica legível no /settings. Nasce LIGADO e sem DSN: sem
    // destino o SDK é no-op de qualquer jeito, e `true` não derruba quem já
    // roda com SENTRY_DSN no ambiente. Ambos aplicados no boot.
    { labelKey: sentryConfigKeys.enabled, valueType: 'BOOLEAN', value: 'true' },
    { labelKey: sentryConfigKeys.dsn, valueType: 'STRING', value: '' },
    // Liga/desliga o relay de notificação por canal pra plataforma inteira — independente da
    // preferência de cada usuário (NOTIFICATION_CHANNEL_EMAIL/_WHATSAPP, UserConfiguration).
    // Nasce LIGADO: mantém o comportamento atual até o admin desligar manualmente.
    {
      labelKey: notificationConfigKeys.emailEnabled,
      valueType: 'BOOLEAN',
      value: 'true',
    },
    {
      labelKey: notificationConfigKeys.whatsappEnabled,
      valueType: 'BOOLEAN',
      value: 'true',
    },
    {
      labelKey: 'SYSTEM_AI_PROVIDER',
      valueType: 'ENUM',
      options: ['ANTHROPIC', 'OPENAI', 'OPENAI_COMPATIBLE'],
      value: 'ANTHROPIC',
    },
    {
      labelKey: AI_CONFIG_KEYS[AiProviderConst.ANTHROPIC].apiKey,
      valueType: 'STRING',
      value: '',
      secret: true,
    },
    {
      labelKey: AI_CONFIG_KEYS[AiProviderConst.ANTHROPIC].model,
      valueType: 'STRING',
      value: 'claude-sonnet-4-6',
    },
    {
      labelKey: AI_CONFIG_KEYS[AiProviderConst.OPENAI].apiKey,
      valueType: 'STRING',
      value: '',
      secret: true,
    },
    {
      labelKey: AI_CONFIG_KEYS[AiProviderConst.OPENAI].model,
      valueType: 'STRING',
      value: 'gpt-4o',
    },
    {
      labelKey: AI_CONFIG_KEYS[AiProviderConst.OPENAI_COMPATIBLE].baseUrl!,
      valueType: 'STRING',
      value: 'https://openrouter.ai/api/v1',
    },
    {
      labelKey: AI_CONFIG_KEYS[AiProviderConst.OPENAI_COMPATIBLE].apiKey,
      valueType: 'STRING',
      value: '',
      secret: true,
    },
    {
      labelKey: AI_CONFIG_KEYS[AiProviderConst.OPENAI_COMPATIBLE].model,
      valueType: 'STRING',
      value: 'llama3',
    },
    { labelKey: 'SYSTEM_AI_SYSTEM_PROMPT', valueType: 'STRING', value: '' },
    { labelKey: 'SYSTEM_AGENT_OWN_KEY', valueType: 'BOOLEAN', value: 'false' },
    // Mensageria (WhatsApp): só o que é do sistema inteiro fica aqui. Provider, credenciais e
    // instância são por conexão (tabela messaging_connections), criadas em /settings.
    // Nasce SEM conexão: a flag MESSAGING também nasce desligada, então template novo sobe sem
    // mensageria. Um provider novo é uma entrada em src/domain/messaging/messaging.const.ts + o
    // enum do Prisma. Ver docs/backend/messaging.md.
    //
    // Chave de acesso do webhook: vai na URL registrada no provider e é conferida antes de
    // qualquer parse. Gerada uma vez; `value` nunca é sobrescrito no re-seed.
    {
      labelKey: 'SYSTEM_MESSAGING_WEBHOOK_KEY',
      valueType: 'STRING',
      value: crypto.randomBytes(32).toString('hex'),
      secret: true,
    },
    // Override da URL pública do webhook — só usado em dev com túnel.
    {
      labelKey: 'SYSTEM_MESSAGING_WEBHOOK_PUBLIC_URL',
      valueType: 'STRING',
      value: '',
    },
    // Layout padrão do PageBuilder: o que quem não customizou a página enxerga. Nasce vazio
    // (= ninguém publicou padrão ainda), e o admin grava pelo "Salvar como Padrão" do editor.
    { labelKey: 'PAGE_LAYOUTS', valueType: 'JSON', value: '{}' },
    // Tamanho máximo (bytes) do upload de artefato do bloco `iframe`. Sem tela de ajuste nesta
    // etapa (ver docs da F1-03) — editável só por quem grava SystemConfiguration diretamente.
    {
      labelKey: ARTIFACT_CONFIG_KEYS.fileMaxSizeBytes,
      valueType: 'NUMBER',
      value: String(ARTIFACT_FILE_DEFAULT_MAX_SIZE_BYTES),
    },
    {
      labelKey: ARTIFACT_CONFIG_KEYS.zipMaxSizeBytes,
      valueType: 'NUMBER',
      value: String(ARTIFACT_ZIP_DEFAULT_MAX_SIZE_BYTES),
    },
    {
      labelKey: ARTIFACT_CONFIG_KEYS.folderMaxSizeBytes,
      valueType: 'NUMBER',
      value: String(ARTIFACT_FOLDER_DEFAULT_MAX_SIZE_BYTES),
    },
    {
      labelKey: 'TIME_TRACKING_FORGOTTEN_THRESHOLD_HOURS',
      valueType: 'NUMBER',
      value: '8',
    },
  ];

  // Limpa placeholders legados que possam ter ficado em bancos locais existentes
  const legacyPlaceholders = [
    'aaaaaaaa-bbbb-cccc-dddd-aaaaaaaaaaaa',
    'sk-placeholder',
    'sk-ant-placeholder',
    'smtp.example.com',
    'user@example.com',
    'pass123',
    'http://localhost:8333',
    'http://localhost:8333/template',
    'minioadmin',
    'no-reply@example.com',
    'http://localhost:3000',
  ];

  for (const placeholder of legacyPlaceholders) {
    await prisma.systemConfiguration.updateMany({
      where: { value: placeholder },
      data: { value: '' },
    });
  }

  for (const cfg of sysConfigs) {
    await prisma.systemConfiguration.upsert({
      where: { labelKey: cfg.labelKey },
      // `value` nunca é sobrescrito — é estado que o admin gerencia. Mas `blocked` e
      // `secret` não são editáveis por API, então só o seed pode corrigi-los numa
      // base que já existe; com `update: {}` a trava nunca chegava lá.
      update: { blocked: cfg.blocked ?? false, secret: cfg.secret ?? false },
      create: cfg,
    });
  }
  console.log('✅ System configurations created');

  // O backend cacheia system config no Redis por 5 min (CONFIG_CACHE_TTL) e só
  // invalida nos use-cases de update/remove. O seed escreve direto no Prisma, então
  // sem isto uma mudança de `blocked`/`secret` fica invisível até o TTL expirar —
  // dá a impressão de que o seed não funcionou.
  await invalidateSystemConfigCache(sysConfigs.map((c) => c.labelKey));
}

/** Apaga as chaves sysconfig:* que o seed acabou de sobrescrever, de forma best-effort. */
async function invalidateSystemConfigCache(labelKeys: string[]): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url) return;

  // Mesmo import do RedisService (`import Redis from 'ioredis'`): o dinâmico com
  // destructuring do default não é construtível sob o tsconfig do build.
  let redis: Redis | undefined;
  try {
    redis = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    await redis.connect();
    await redis.del(...labelKeys.map((k) => `sysconfig:${k}`));
    console.log('✅ Cache de system configuration invalidado');
  } catch {
    console.warn(
      '⚠️  Redis inacessível — cache de system configuration não invalidado. ' +
        'Mudanças de configuração aparecem em até 5 min (CONFIG_CACHE_TTL).',
    );
  } finally {
    redis?.disconnect();
  }
}
