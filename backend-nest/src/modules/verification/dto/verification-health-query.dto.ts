import { z } from 'zod';

export const VerificationHealthQuerySchema = z.object({
  channel: z.enum(['EMAIL', 'WHATSAPP', 'AUTHENTICATOR']),
});

export type VerificationHealthQuery = z.infer<
  typeof VerificationHealthQuerySchema
>;
