import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateUserConfigurationDefinitionsSchema = z.object({
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
  defaultValue: z.string().min(1, 'defaultValue é obrigatório').optional(),
});

export class UpdateUserConfigurationDefinitionsDto extends createZodDto(
  UpdateUserConfigurationDefinitionsSchema,
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
  defaultValue?: string;

  @ApiProperty({
    description: 'Indica se a configuração é obrigatória',
    example: true,
  })
  isRequired?: boolean;
}
