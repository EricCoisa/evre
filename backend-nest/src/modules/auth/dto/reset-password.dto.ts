import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'auth.validation.token_required'),
  password: z
    .string()
    .min(8, 'auth.validation.password_min_length')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/,
      'auth.validation.password_weak',
    ),
});

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
