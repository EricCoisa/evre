import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SetSystemConfigurationsSchema = z.object({
  defaultValue: z.string().min(1, 'defaultValue é obrigatório'),
});

export class SetSystemConfigurationDto extends createZodDto(
  SetSystemConfigurationsSchema,
) {
  @ApiProperty({
    description: 'Valor da configuração',
    example: 'dark',
  })
  defaultValue: string;
}
