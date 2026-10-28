import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ConfirmVerificationSchema = z.object({
  purpose: z.string().min(1),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'verification.invalid_code'),
});

export class ConfirmVerificationDto extends createZodDto(
  ConfirmVerificationSchema,
) {}
