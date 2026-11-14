import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AddCompanyMemberSchema = z.object({
  userId: z.string().uuid(),
  canSeeCommercials: z.boolean().optional(),
  canComment: z.boolean().optional(),
});

export class AddCompanyMemberDto extends createZodDto(AddCompanyMemberSchema) {}

export const InviteCompanyMemberSchema = z.object({
  channel: z.enum(['EMAIL', 'WHATSAPP']).default('EMAIL'),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  name: z.string().max(200).optional(),
});

export class InviteCompanyMemberDto extends createZodDto(
  InviteCompanyMemberSchema,
) {}

export const UpdateCompanyMemberSchema = z.object({
  canSeeCommercials: z.boolean().optional(),
  canComment: z.boolean().optional(),
});

export class UpdateCompanyMemberDto extends createZodDto(
  UpdateCompanyMemberSchema,
) {}
