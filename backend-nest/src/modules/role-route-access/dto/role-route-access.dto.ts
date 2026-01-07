import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ROLES } from 'src/types/userRole';

export const RoleRouteAccessSchema = z.object({
  roleId: z.enum(ROLES),
  routeId: z.string().uuid(),
  route: z
    .object({
      id: z.string().uuid(),
      path: z.string(),
      labelKey: z.string(),
      icon: z.string().nullable().optional(),
    })
    .optional(),
});

export class RoleRouteAccessDto extends createZodDto(RoleRouteAccessSchema) {}
