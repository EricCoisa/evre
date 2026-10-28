import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  Throttle,
  ThrottlerGuard,
  ThrottlerModule,
  SkipThrottle,
} from '@nestjs/throttler';
import request from 'supertest';

@Controller('test')
class TestController {
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @Get('limited')
  limited() {
    return { ok: true };
  }

  @SkipThrottle()
  @Get('open')
  open() {
    return { ok: true };
  }
}

describe('ThrottlerGuard (APP_GUARD)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 100 }] }),
      ],
      controllers: [TestController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();

    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('permite requisições dentro do limite', async () => {
    await request(app.getHttpServer()).get('/test/limited').expect(200);
    await request(app.getHttpServer()).get('/test/limited').expect(200);
  });

  it('retorna 429 ao exceder o limite', async () => {
    await request(app.getHttpServer()).get('/test/limited').expect(429);
  });

  it('@SkipThrottle nunca retorna 429', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer()).get('/test/open').expect(200);
    }
  });
});
