import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RoleHomeMapSchema = z.object({
  /** `{ "<roleName>": "<routeId>" }`. Role fora do mapa não tem home definida. */
  homes: z.record(z.string(), z.string().uuid()),
});

export class SaveRoleHomeDto extends createZodDto(RoleHomeMapSchema) {}
