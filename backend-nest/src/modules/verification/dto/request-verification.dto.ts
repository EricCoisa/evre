import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RequestVerificationSchema = z.object({
  purpose: z.string().min(1),
  channel: z.enum(['EMAIL', 'WHATSAPP', 'AUTHENTICATOR']),
  /** Só quando o destino ainda não está persistido (ex. telefone candidato). */
  target: z.string().optional(),
});

export class RequestVerificationDto extends createZodDto(
  RequestVerificationSchema,
) {}
