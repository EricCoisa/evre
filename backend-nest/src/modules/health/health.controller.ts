import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from 'src/prisma/prisma.service';

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  /** Liveness — o processo está de pé (sem checar dependências). */
  @Get()
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /** Alias explícito para liveness. */
  @Get('live')
  livePath() {
    return this.live();
  }

  /** Readiness — verifica conexão com PostgreSQL. */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      async () => {
        // SELECT 1 é o check mínimo; migrar para PrismaHealthIndicator se terminus adicionar suporte nativo
        await this.prisma.$queryRaw`SELECT 1`;
        return { database: { status: 'up' } };
      },
    ]);
  }
}
