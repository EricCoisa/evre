import { disableSentry, initSentry } from './instrument';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import { AppModule } from './app.module';
import { StorageService } from './modules/storage/storage.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, RequestMethod } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { SystemConfigurationService } from './modules/system-configuration/system-configuration.service';
import { sentryConfigKeys } from './domain/observability/sentry.const';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ZodValidationPipe } from 'nestjs-zod';
import { I18nService } from 'nestjs-i18n';
import { setupI18nSwagger } from './common/swagger/i18n-swagger.plugin';
import { installWebhookKeyGate } from './modules/messaging/webhook-key.gate';

/** Prefixo global da API: também é o caminho em que o portão do webhook precisa ser montado. */
const API_PREFIX = 'api/v1';

const logger = new Logger('Bootstrap');

/**
 * APP_NAME isola a pasta de cada app derivado do template num storage S3 compartilhado
 * entre projetos (ver StorageService.buildKey e docs/backend/storage.md). Sem essa checagem,
 * dois projetos clonados do template sem renomear nada convergiriam na mesma pasta em silêncio.
 */
function assertAppNameConfigured(): void {
  if (!process.env.APP_NAME) {
    logger.error(
      'APP_NAME não está configurado. Defina um nome único por projeto antes de subir a ' +
        'aplicação — ver docs/backend/storage.md.',
    );
    process.exit(1);
  }
}

async function bootstrap() {
  assertAppNameConfigured();
  logger.log('Starting NestJS application...');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    rawBody: true,
  });
  app.useLogger(app.get(PinoLogger));
  logger.log('Nest app created');

  // Aplica a configuração de Sentry gravada em /settings (enabled/dsn), sem derrubar o boot em caso de falha.
  try {
    const sysConfig = app.get(SystemConfigurationService);
    const [enabled, dsn] = await Promise.all([
      sysConfig.getValueOrNull(sentryConfigKeys.enabled),
      sysConfig.getValueOrNull(sentryConfigKeys.dsn),
    ]);

    if (enabled === 'false') await disableSentry();
    else initSentry(dsn);
  } catch (error) {
    logger.warn('Sentry: não foi possível ler a configuração', error);
  }

  // Trust proxy headers (X-Forwarded-For) para rate limiting correto atrás de reverse proxy
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Security
  logger.log('Configuring security middlewares...');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  // O parser abaixo aceita 25 MB e roda antes dos guards
  installWebhookKeyGate(app, API_PREFIX);

  // Webhooks de provider (histórico, mídia embutida, lote de contatos) passam fácil de 100 KB, o padrão
  // do body-parser: o corpo era recusado com 413 → 500 e o evento se perdia. O rawBody (HMAC da Meta) continua.
  app.useBodyParser('json', { limit: '25mb' });

  // CORS - Permitir credenciais (cookies)
  logger.log('Enabling CORS...');
  app.enableCors({
    origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Language',
      'Accept-Language',
    ],
  });

  // Serve os assets estáticos do provider de storage LOCAL, fora do prefixo api/v1.
  const localStorageDir = path.resolve(
    await app.get(StorageService).getLocalStorageDir(),
  );
  app.useStaticAssets(localStorageDir, { prefix: '/uploads' });

  // Global prefix
  logger.log('Setting global prefix...');
  // Discovery OAuth do MCP e redirecionamento de link curto ficam fora do prefixo
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [
      {
        path: 's/:code',
        method: RequestMethod.GET,
      },
      {
        path: '.well-known/oauth-authorization-server',
        method: RequestMethod.GET,
      },
      {
        path: '.well-known/oauth-protected-resource',
        method: RequestMethod.GET,
      },
      {
        path: '.well-known/oauth-protected-resource/mcp',
        method: RequestMethod.GET,
      },
    ],
  });

  // Global filters and interceptors
  logger.log('Registering global filters and interceptors...');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Validation Pipe (Zod)
  logger.log('Registering global pipes...');
  app.useGlobalPipes(new ZodValidationPipe());

  // Swagger Documentation (desativado em produção)
  if (process.env.NODE_ENV !== 'production') {
    logger.log('Configuring Swagger...');
    const config = new DocumentBuilder()
      .setTitle('API Template')
      .setDescription('API base template com NestJS')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);

    // Setup i18n Swagger
    logger.log('Setting up i18n for Swagger...');
    const i18n = app.get(I18nService);
    const i18nPlugin = setupI18nSwagger(app, 'api/docs', document, i18n);

    // Traduz o documento para português (padrão da UI)
    const translatedDocument = i18nPlugin.translateDocument(document, 'pt-BR');

    // Swagger UI usando documento já traduzido + opção de trocar idioma
    logger.log('Setting up Swagger UI...');
    SwaggerModule.setup('api/docs', app, translatedDocument, {
      swaggerOptions: {
        urls: [
          { url: '/api/docs-json?lang=pt-BR', name: 'Português (pt-BR)' },
          { url: '/api/docs-json?lang=en', name: 'English (en)' },
        ],
      },
    });
  }

  const PORT = process.env.PORT || 3000;

  app.enableShutdownHooks();

  logger.log('Starting HTTP server...');
  await app.listen(PORT);
  logger.log(`NestJS listening on port ${PORT}`);
  logger.log(`Server running on http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`Swagger docs available at http://localhost:${PORT}/api/docs`);
  }
}

bootstrap().catch((error) => {
  console.error('Bootstrap error:', error);
  logger.error('Error during bootstrap', error);
});
