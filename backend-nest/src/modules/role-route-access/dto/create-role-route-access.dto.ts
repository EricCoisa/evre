import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ROLES } from 'src/types/userRole';

export const CreateRoleRouteAccessSchema = z.object({
  roleId: z.enum(ROLES).describe('Tipo de papel/role'),
  routeId: z.string().uuid().describe('ID da rota'),
});

export class CreateRoleRouteAccessDto extends createZodDto(
  CreateRoleRouteAccessSchema,
) {}
