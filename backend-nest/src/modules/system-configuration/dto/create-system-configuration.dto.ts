import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateSystemConfigurationSchema = z.object({
  labelKey: z
    .string()
    .min(1, 'labelKey é obrigatório')
    .max(255, 'labelKey deve ter no máximo 255 caracteres'),
  valueType: z
    .string()
    .min(1, 'valueType é obrigatório')
    .max(50, 'valueType deve ter no máximo 50 caracteres'),
  value: z.string().min(1, 'value é obrigatório'),
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
    description: 'Tipo do valor (string, number, boolean, json)',
    example: 'boolean',
  })
  valueType: string;

  @ApiProperty({
    description: 'Valor da configuração',
    example: 'false',
  })
  value: string;
}
