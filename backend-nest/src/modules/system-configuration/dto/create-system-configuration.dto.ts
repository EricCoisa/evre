import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateSystemConfigurationSchema = z.object({
  labelKey: z
    .string()
    .min(1, 'labelKey é obrigatório')
    .max(255, 'labelKey deve ter no máximo 255 caracteres'),
  valueType: z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE', 'ENUM']),
  options: z.array(z.string()).default([]),
  value: z.string().min(1, 'value é obrigatório'),
  secret: z.boolean().default(false),
});

export class CreateSystemConfigurationDto extends createZodDto(
  CreateSystemConfigurationSchema,
) {
  @ApiProperty({
    description: 'Chave de identificação da configuração',
    example: 'system.maintenance.mode',
  })
  labelKey: string;

  @ApiProperty({
    description: 'Tipo do valor',
    enum: ['STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE', 'ENUM'],
    example: 'BOOLEAN',
  })
  valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'DATE' | 'ENUM';

  @ApiProperty({
    description: 'Opções para valueType ENUM',
    isArray: true,
    required: false,
    default: [],
  })
  options: string[];

  @ApiProperty({
    description: 'Valor da configuração',
    example: 'false',
  })
  value: string;

  @ApiProperty({
    description: 'Indica se o valor é secreto e deve ser criptografado',
    example: false,
    required: false,
    default: false,
  })
  secret: boolean;
}
