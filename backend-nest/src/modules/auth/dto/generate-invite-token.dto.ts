import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GenerateInviteTokenSchema = z.object({
  email: z
    .string()
    .min(1, 'validation.email.required')
    .email('validation.email.invalid'),
  roleId: z.string().uuid('validation.role.invalid'),
});

export class GenerateInviteTokenDto extends createZodDto(
  GenerateInviteTokenSchema,
) {}

const ValidateInviteTokenSchema = z.object({
  token: z.string(),
});

export class ValidateInviteTokenDto extends createZodDto(
  ValidateInviteTokenSchema,
) {}

const AcceptInviteSchema = z.object({
  token: z.string(),
});

export class AcceptInviteDto extends createZodDto(AcceptInviteSchema) {}
