import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ZodValidationPipe } from 'nestjs-zod';
import { I18nService } from 'nestjs-i18n';
import { setupI18nSwagger } from './common/swagger/i18n-swagger.plugin';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  logger.log('Starting NestJS application...');
  const app = await NestFactory.create(AppModule);
  logger.log('Nest app created');

  // Security
  logger.log('Configuring security middlewares...');
  app.use(helmet());
  app.use(cookieParser());

  // CORS - Permitir credenciais (cookies)
  logger.log('Enabling CORS...');
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Language',
      'Accept-Language',
    ],
  });

  // Global prefix
  logger.log('Setting global prefix...');
  app.setGlobalPrefix('api');

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

  logger.log('Starting HTTP server...');
  await app.listen(PORT);
  logger.log(`NestJS listening on port ${PORT}`);
  logger.log(`Server running on http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`Swagger docs available at http://localhost:${PORT}/api/docs`);
  }
}

bootstrap().catch((error) => {
  logger.error('Error during bootstrap', error);
});
