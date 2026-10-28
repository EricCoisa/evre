import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';

/** Erro OAuth no formato exigido pela RFC 6749 §5.2 ({ "error": "...", ... }). */
export class OAuthError extends HttpException {
  constructor(
    code:
      | 'invalid_request'
      | 'invalid_client'
      | 'invalid_grant'
      | 'unauthorized_client'
      | 'unsupported_grant_type'
      | 'invalid_scope'
      | 'access_denied'
      | 'server_error'
      | 'invalid_redirect_uri'
      | 'invalid_client_metadata',
    description: string,
    status = 400,
  ) {
    super({ error: code, error_description: description }, status);
  }
}

@Catch(OAuthError)
export class OAuthErrorFilter implements ExceptionFilter {
  catch(exception: OAuthError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    res
      .status(exception.getStatus())
      // RFC 6749 §5.1: resposta de token nunca pode ser cacheada.
      .setHeader('Cache-Control', 'no-store')
      .json(exception.getResponse());
  }
}
