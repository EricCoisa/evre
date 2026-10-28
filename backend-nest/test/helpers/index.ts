import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AppModule } from 'src/app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import cookieParser from 'cookie-parser';
import { installWebhookKeyGate } from 'src/modules/messaging/webhook-key.gate';

/** Cria uma aplicação NestJS completa para testes E2E, com overrides de providers e contagem do throttler neutralizada. */
export async function createTestApp(
  overrides: Array<{ token: unknown; value: unknown }> = [],
): Promise<INestApplication> {
  // Pelo storage, e não pelo guard: `overrideProvider(APP_GUARD)` não substitui
  // enhancer global, e `overrideGuard` só alcança guard de `@UseGuards`. Zerar a
  // contagem mantém o guard real no caminho — só nunca acumula.
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ThrottlerStorage)
    .useValue({
      increment: () =>
        Promise.resolve({
          totalHits: 0,
          timeToExpire: 0,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
    });
  for (const { token, value } of overrides) {
    builder = builder.overrideProvider(token).useValue(value);
  }
  const moduleFixture: TestingModule = await builder.compile();

  // Espelha o `main.ts`: sem isto `req.rawBody` é undefined, e rota que valida assinatura
  // sobre o corpo cru (webhook de mensageria) rejeitaria tudo no E2E por motivo errado.
  const app = moduleFixture.createNestApplication({ rawBody: true });
  app.setGlobalPrefix('api/v1');
  // Antes do body-parser, como no `main.ts`.
  installWebhookKeyGate(app, 'api/v1');
  app.use(cookieParser());
  app.useGlobalPipes(new ZodValidationPipe());
  await app.init();

  return app;
}

/**
 * Cria um módulo de teste isolado com providers customizados.
 */
export async function createTestModule(
  metadata: Parameters<typeof Test.createTestingModule>[0],
): Promise<TestingModule> {
  return Test.createTestingModule(metadata).compile();
}
