import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateUserConfigurationDefinitionCreateSchema = z.object({
  labelKey: z.string().min(1, 'labelKey é obrigatório').max(255),
  valueType: z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE', 'ENUM']),
  options: z.array(z.string()).default([]),
  defaultValue: z.string().min(1, 'defaultValue é obrigatório'),
  secret: z.boolean().optional(),
});

export class CreateUserConfigurationDefinitionCreateDto extends createZodDto(
  CreateUserConfigurationDefinitionCreateSchema,
) {
  @ApiProperty({ example: 'system.maintenance.mode' })
  labelKey: string;

  @ApiProperty({
    enum: ['STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE', 'ENUM'],
    example: 'BOOLEAN',
  })
  valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'DATE' | 'ENUM';

  @ApiProperty({ isArray: true, required: false, default: [] })
  options: string[];

  @ApiProperty({ example: 'false' })
  defaultValue: string;

  @ApiProperty({
    description: 'Indica se o valor é secreto e deve ser criptografado',
    example: false,
    required: false,
    default: false,
  })
  secret?: boolean;
}
