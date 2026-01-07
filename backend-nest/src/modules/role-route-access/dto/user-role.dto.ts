import { createZodDto } from 'nestjs-zod';
import { ROLES } from 'src/types/userRole';
import { z } from 'zod';

export const UserRoleSchema = z.object({
  roleId: z.enum(ROLES),
});

export class UserRoleDto extends createZodDto(UserRoleSchema) {}
