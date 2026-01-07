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
    .string()
    .min(1, 'valueType é obrigatório')
    .max(50, 'valueType deve ter no máximo 50 caracteres')
    .optional(),
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
    description: 'Tipo do valor (string, number, boolean, json)',
    example: 'boolean',
    required: false,
  })
  valueType?: string;

  @ApiProperty({
    description: 'Valor da configuração',
    example: 'false',
    required: false,
  })
  value?: string;
}
