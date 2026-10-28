import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { appPublicUrl } from 'src/common/utils/app-public-url.util';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OAuthError, OAuthErrorFilter } from './oauth-error';
import {
  AuthorizeUseCase,
  type AuthorizeQuery,
} from './use-cases/authorize.use-case';
import {
  ExchangeTokenUseCase,
  type TokenRequest,
} from './use-cases/exchange-token.use-case';
import { RegisterClientUseCase } from './use-cases/register-client.use-case';

/** Authorization Server OAuth 2.1 do conector MCP. */
@ApiExcludeController()
@UseFilters(OAuthErrorFilter)
@Controller('oauth')
export class McpOauthController {
  constructor(
    private readonly registerClient: RegisterClientUseCase,
    private readonly authorize: AuthorizeUseCase,
    private readonly exchangeToken: ExchangeTokenUseCase,
  ) {}

  /** Registra um cliente OAuth dinamicamente (RFC 7591); endpoint público e throttled. */
  @Post('register')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  register(@Body() body: Record<string, unknown>) {
    return this.registerClient.execute(body ?? {});
  }

  /** Entrada do fluxo: valida e joga o browser na tela de consentimento do front. */
  @Get('authorize')
  async authorizeRedirect(
    @Query() query: AuthorizeQuery,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.redirect(await this.authorize.start(query, appPublicUrl(req)));
  }

  /** Lido pela tela de consentimento: quem está pedindo acesso e a quê. */
  @Get('authorize/request')
  describe(@Query('req') req: string) {
    if (!req) throw new OAuthError('invalid_request', 'req é obrigatório');
    return this.authorize.describe(req);
  }

  /** Consentimento do usuário logado — único ponto do fluxo que exige sessão JWT. */
  @Post('authorize/consent')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  consent(
    @Body() body: { req?: string; scopes?: string[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!body?.req)
      throw new OAuthError('invalid_request', 'req é obrigatório');
    return this.authorize.approve(body.req, body.scopes ?? [], user.id);
  }

  @Post('token')
  @HttpCode(200)
  async token(@Body() body: TokenRequest, @Res() res: Response) {
    const tokens = await this.exchangeToken.execute(body ?? {});
    // RFC 6749 §5.1 — resposta de token nunca entra em cache.
    res.setHeader('Cache-Control', 'no-store').json(tokens);
  }

  /** RFC 7009. */
  @Post('revoke')
  @HttpCode(200)
  async revoke(@Body() body: { token?: string }) {
    await this.exchangeToken.revoke(body?.token);
    return {};
  }
}
