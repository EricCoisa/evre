import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GenerateInviteTokenSchema = z.object({
  channel: z.enum(['EMAIL', 'WHATSAPP']).default('EMAIL'),
  email: z.string().email('validation.email.invalid').optional(),
  phone: z.string().optional(),
  roleId: z.string().uuid('validation.role.invalid'),
  name: z.string().max(200).optional(),
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
