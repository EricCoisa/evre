import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z
    .string()
    .min(1, 'validation.email.required')
    .email('validation.email.invalid'),
  password: z.string().min(6, 'validation.password.min_length'),
});

export class LoginDto extends createZodDto(LoginSchema) {}
