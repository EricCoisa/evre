import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateSystemConfigurationSchema = z.object({
  labelKey: z
    .string()
    .min(1, 'labelKey é obrigatório')
    .max(255, 'labelKey deve ter no máximo 255 caracteres')
    .optional(),
  valueType: z
    .enum(['STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE', 'ENUM'])
    .optional(),
  options: z.array(z.string()).optional(),
  value: z.string().min(1, 'value é obrigatório').optional(),
});

export class UpdateSystemConfigurationDto extends createZodDto(
  UpdateSystemConfigurationSchema,
) {
  @ApiProperty({
    description: 'Chave de identificação da configuração',
    example: 'system.maintenance.mode',
    required: false,
  })
  labelKey?: string;

  @ApiProperty({
    description: 'Tipo do valor',
    enum: ['STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE', 'ENUM'],
    required: false,
  })
  valueType?: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'DATE' | 'ENUM';

  @ApiProperty({
    description: 'Opções para valueType ENUM',
    isArray: true,
    required: false,
  })
  options?: string[];

  @ApiProperty({
    description: 'Valor da configuração',
    example: 'false',
    required: false,
  })
  value?: string;
}
