import { createZodDto } from 'nestjs-zod';
import { ROLES } from 'src/types/userRole';
import { z } from 'zod';

export const BulkCreateRoleRouteAccessSchema = z.object({
  roleId: z.enum(ROLES).describe('Tipo de papel/role'),
  routeIds: z.array(z.string().uuid()).min(1).describe('Lista de IDs de rotas'),
});

export class BulkCreateRoleRouteAccessDto extends createZodDto(
  BulkCreateRoleRouteAccessSchema,
) {}
