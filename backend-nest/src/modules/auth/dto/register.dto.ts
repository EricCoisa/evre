import { createZodDto } from 'nestjs-zod';
import { ROLES } from 'src/types/userRole';
import { z } from 'zod';

const RegisterSchema = z.object({
  email: z
    .string()
    .min(1, 'validation.email.required')
    .email('validation.email.invalid'),
  password: z.string().min(6, 'validation.password.min_length'),
  name: z.string().optional(),
  role: z.enum(ROLES).optional().default('USER'),
});

export class RegisterDto extends createZodDto(RegisterSchema) {}
