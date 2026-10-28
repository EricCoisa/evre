import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SetFeatureFlagRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(0),
});

export class SetFeatureFlagRolesDto extends createZodDto(
  SetFeatureFlagRolesSchema,
) {
  @ApiProperty({
    description: 'IDs das roles permitidas (vazio = todas as roles)',
    isArray: true,
    type: String,
  })
  roleIds: string[];
}
