import { Controller, Get, HttpStatus, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ResolveShortUrlUseCase } from './use-cases/resolve-short-url.use-case';

/** Resolve códigos de links curtos fora do prefixo api/v1 e redireciona (HTTP 302) para o destino original. */
@ApiExcludeController()
@Controller('s')
export class ShortUrlRedirectController {
  constructor(
    private readonly resolveShortUrlUseCase: ResolveShortUrlUseCase,
  ) {}

  @Get(':code')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  async redirect(
    @Param('code') code: string,
    @Res() res: Response,
  ): Promise<void> {
    const targetUrl = await this.resolveShortUrlUseCase.execute(code);
    return res.redirect(HttpStatus.FOUND, targetUrl);
  }
}
