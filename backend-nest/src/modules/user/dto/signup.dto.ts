import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),
  name: z.string().optional(),
  inviteToken: z.string().optional(),
  acceptTerms: z.boolean().optional(),
});

export class SignUpDto extends createZodDto(SignUpSchema) {}

const CompleteEmailSignupSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
  acceptTerms: z.literal(true),
});

export class CompleteEmailSignupDto extends createZodDto(
  CompleteEmailSignupSchema,
) {}
