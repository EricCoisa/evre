import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateRoleRouteAccessSchema = z.object({
  roleId: z.string().uuid().describe('ID do role'),
  routeId: z.string().uuid().describe('ID da rota'),
});

export class CreateRoleRouteAccessDto extends createZodDto(
  CreateRoleRouteAccessSchema,
) {}
