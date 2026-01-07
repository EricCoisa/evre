import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateUserConfigurationDefinitionSchema = z.object({
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
  defaultValue: z.string().optional(),
  isRequired: z.boolean().optional(),
});

export class UpdateUserConfigurationDefinitionDto extends createZodDto(
  UpdateUserConfigurationDefinitionSchema,
) {
  @ApiProperty({
    description: 'Chave de identificação da configuração',
    example: 'user.theme',
    required: false,
  })
  labelKey?: string;

  @ApiProperty({
    description: 'Tipo do valor (string, number, boolean, json)',
    example: 'string',
    required: false,
  })
  valueType?: string;

  @ApiProperty({
    description: 'Valor padrão da configuração',
    example: 'light',
    required: false,
  })
  defaultValue?: string;

  @ApiProperty({
    description: 'Indica se a configuração é obrigatória',
    example: false,
    required: false,
  })
  isRequired?: boolean;
}
