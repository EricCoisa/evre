import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ROLES } from 'src/types/userRole';

const GenerateInviteTokenSchema = z.object({
  email: z
    .string()
    .min(1, 'validation.email.required')
    .email('validation.email.invalid'),
  role: z.enum(ROLES).optional().default('USER'),
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

//

const GenerateCompanyInviteTokenSchema = z.object({
  email: z
    .string()
    .min(1, 'validation.email.required')
    .email('validation.email.invalid'),
  name: z.string().optional(),
  companyId: z.string().min(1, 'validation.companyId.required'),
});

export class GenerateCompanyInviteTokenDto extends createZodDto(
  GenerateCompanyInviteTokenSchema,
) {}
