import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { MessagingWebhookService } from './messaging-webhook.service';
import { timingSafeCompare } from './providers/webhook.util';

/** Rota do webhook, sem o prefixo global da API. */
export const MESSAGING_WEBHOOK_ROUTE = '/messaging/webhook';

type KeySource = Pick<MessagingWebhookService, 'webhookKey'>;

/** Confere a chave da URL do webhook antes de o corpo de até 25 MB ser lido e parseado. */
export function webhookKeyGate(messaging: KeySource): RequestHandler {
  const logger = new Logger('WebhookKeyGate');

  const reject = (res: Response): void => {
    res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    // O handshake (GET) não tem corpo: quem decide é o use-case.
    if (req.method !== 'POST') return next();

    messaging
      .webhookKey()
      .then((expected) => {
        const sent =
          typeof req.query['key'] === 'string' ? req.query['key'] : '';
        if (!expected || !timingSafeCompare(sent, expected)) {
          logger.warn(
            'Webhook recusado antes de ler o corpo: chave ausente ou inválida',
          );
          return reject(res);
        }
        next();
      })
      .catch(next);
  };
}

/** Instala o portão no `app`. Tem de rodar ANTES de registrar o body-parser. */
export function installWebhookKeyGate(
  app: INestApplication,
  apiPrefix: string,
): void {
  app.use(
    `/${apiPrefix}${MESSAGING_WEBHOOK_ROUTE}`,
    webhookKeyGate(app.get(MessagingWebhookService)),
  );
}
