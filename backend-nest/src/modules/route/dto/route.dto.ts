import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RouteSchema = z.object({
  id: z.string().uuid(),
  path: z.string(),
  labelKey: z.string(),
  icon: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  ordem: z.number().int(),
  isActive: z.boolean(),
  // Não-nulos no banco (`Boolean @default(...)` em route.prisma). Declará-los nullable
  // aqui obrigava todo consumidor a tratar um null que nunca chega.
  showSideBar: z.boolean(),
});

export class RouteDto extends createZodDto(RouteSchema) {}

// Schema para rota com hierarquia (inclui filhos)
export const RouteWithChildrenSchema: z.ZodType<any> = z.lazy(() =>
  RouteSchema.extend({
    children: z.array(RouteWithChildrenSchema).optional(),
  }),
);

export class RouteWithChildrenDto extends createZodDto(
  RouteWithChildrenSchema,
) {}
