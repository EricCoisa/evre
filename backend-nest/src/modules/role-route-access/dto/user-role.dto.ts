import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UserRoleSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
});

export class UserRoleDto extends createZodDto(UserRoleSchema) {}
