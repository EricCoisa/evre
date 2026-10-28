import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateUserConfigurationDefinitionsSchema = z.object({
  labelKey: z.string().min(1).max(255).optional(),
  valueType: z
    .enum(['STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE', 'ENUM'])
    .optional(),
  options: z.array(z.string()).optional(),
  defaultValue: z.string().min(1).optional(),
  isRequired: z.boolean().optional(),
  secret: z.boolean().optional(),
});

export class UpdateUserConfigurationDefinitionsDto extends createZodDto(
  UpdateUserConfigurationDefinitionsSchema,
) {
  @ApiProperty({ example: 'system.maintenance.mode', required: false })
  labelKey?: string;

  @ApiProperty({
    enum: ['STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE', 'ENUM'],
    required: false,
  })
  valueType?: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'DATE' | 'ENUM';

  @ApiProperty({ isArray: true, required: false })
  options?: string[];

  @ApiProperty({ example: 'false', required: false })
  defaultValue?: string;

  @ApiProperty({ example: true, required: false })
  isRequired?: boolean;

  @ApiProperty({
    description: 'Indica se o valor é secreto e deve ser criptografado',
    example: false,
    required: false,
    default: false,
  })
  secret?: boolean;
}
