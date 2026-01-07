import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UserRouteAccessSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  routeId: z.string().uuid(),
  grantedBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  user: z
    .object({
      id: z.string().uuid(),
      email: z.string(),
      name: z.string().nullable(),
    })
    .optional(),
  route: z
    .object({
      id: z.string().uuid(),
      path: z.string(),
      labelKey: z.string(),
    })
    .optional(),
  grantedByUser: z
    .object({
      id: z.string().uuid(),
      email: z.string(),
      name: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export class UserRouteAccessDto extends createZodDto(UserRouteAccessSchema) {}
