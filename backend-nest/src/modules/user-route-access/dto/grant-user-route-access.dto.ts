import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GrantUserRouteAccessSchema = z.object({
  userId: z.string().uuid().describe('ID do usuário'),
  routeId: z.string().uuid().describe('ID da rota'),
});

export class GrantUserRouteAccessDto extends createZodDto(
  GrantUserRouteAccessSchema,
) {}
