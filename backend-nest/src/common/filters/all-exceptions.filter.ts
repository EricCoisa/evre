import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nContext } from 'nestjs-i18n';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const i18n = I18nContext.current(host);

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message =
      exception instanceof HttpException
        ? exception.getResponse()
        : (i18n?.t('common.errors.internal_server') ?? 'Internal server error');

    // Se a mensagem for um objeto (comum em HttpException)
    if (
      typeof message === 'object' &&
      message !== null &&
      'message' in message
    ) {
      const msg = (message as { message: string | string[] }).message;

      // Se for array de mensagens de validação
      if (Array.isArray(msg)) {
        message = {
          ...message,
          message: msg.map((m) => (m.includes('.') && i18n ? i18n.t(m) : m)),
        };
      } else if (typeof msg === 'string' && msg.includes('.') && i18n) {
        // Se for chave de tradução (contém ponto)
        message = {
          ...message,
          message: i18n.t(msg),
        };
      }
    } else if (typeof message === 'string' && message.includes('.') && i18n) {
      // Traduzir mensagem simples se for chave de tradução
      message = i18n.t(message);
    }

    this.logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : exception,
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
