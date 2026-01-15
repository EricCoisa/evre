import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RouteSchema = z.object({
  id: z.string().uuid(),
  path: z.string(),
  labelKey: z.string(),
  icon: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  ordem: z.number().int(),
  isHome: z.boolean(),
  isActive: z.boolean(),
  showSideBar: z.boolean().nullable(),
  isClientHome: z.boolean().nullable(),
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
