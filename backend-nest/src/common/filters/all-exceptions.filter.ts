import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Request, Response } from 'express';
import { I18nContext } from 'nestjs-i18n';

/** Envelope único de erro da API. */
export interface ApiErrorBody {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
  errors?: unknown;
}

/** Chave de tradução por convenção: `namespace.caminho`, sem espaço. */
const I18N_KEY = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/i;

/** Desembrulha a mensagem quando um SDK de terceiro a entrega serializada em JSON. */
function unwrapJson(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return text;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === 'string') return parsed;
    if (Array.isArray(parsed)) return parsed.map(String).join('; ');
    if (parsed && typeof parsed === 'object') {
      const { message, error } = parsed as {
        message?: unknown;
        error?: unknown;
      };
      const inner = message ?? error;
      if (typeof inner === 'string') return inner;
    }
  } catch {
    // não era JSON válido — devolve o texto como veio
  }
  return text;
}

/** Mensagem genérica — só é montada quando o erro não traz nada exibível. */
function genericMessage(i18n?: I18nContext): string {
  return (
    String(i18n?.t('common.errors.internal_server') ?? '') ||
    'Internal server error'
  );
}

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

    const raw =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const body =
      typeof raw === 'object' && raw !== null
        ? (raw as Record<string, unknown>)
        : null;

    // Sem mensagem utilizável (erro não-HTTP, por exemplo) cai na genérica: o
    // detalhe interno fica só no log, nunca na resposta.
    const message =
      this.toMessage(body ? body.message : raw, i18n) || genericMessage(i18n);
    const errors = body?.errors;

    // 4xx é fluxo normal do cliente (validação, 401, 404): não vira alerta nem
    // carrega stack. 5xx é bug nosso — log completo e evento no Sentry.
    const line = `${request.method} ${request.url} ${status} - ${message}`;
    if (status >= 500) {
      this.logger.error(
        line,
        exception instanceof Error ? exception.stack : String(exception),
      );
      // No-op sem SENTRY_DSN — ver `src/instrument.ts`.
      Sentry.captureException(exception);
    } else {
      this.logger.warn(line);
    }

    const payload: ApiErrorBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      ...(errors === undefined ? {} : { errors }),
    };
    response.status(status).json(payload);
  }

  /** Achata em string legível qualquer coisa que um `throw` possa carregar. */
  private toMessage(raw: unknown, i18n: I18nContext | undefined): string {
    if (Array.isArray(raw)) {
      return raw
        .map((item) => this.toMessage(item, i18n))
        .filter(Boolean)
        .join('; ');
    }
    if (typeof raw !== 'string' || !raw) return '';

    const text = unwrapJson(raw);
    return i18n && I18N_KEY.test(text) ? String(i18n.t(text)) : text;
  }
}
