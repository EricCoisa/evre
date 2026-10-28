import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ForgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'auth.validation.email_required')
    .email('auth.validation.email_invalid'),
});

export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}
