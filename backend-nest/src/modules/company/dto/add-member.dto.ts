import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AddCompanyMemberSchema = z.object({
  userId: z.string().uuid(),
  canSeeCommercials: z.boolean().optional(),
  canComment: z.boolean().optional(),
});

export class AddCompanyMemberDto extends createZodDto(AddCompanyMemberSchema) {}

export const InviteCompanyMemberSchema = z.object({
  email: z.string().min(1).email(),
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
