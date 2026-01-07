import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SetUserConfigurationSchema = z.object({
  definitionId: z.string().uuid('definitionId deve ser um UUID válido'),
  value: z.string().min(1, 'value é obrigatório'),
});

export class SetUserConfigurationDto extends createZodDto(
  SetUserConfigurationSchema,
) {
  @ApiProperty({
    description: 'ID da definição de configuração',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  definitionId: string;

  @ApiProperty({
    description: 'Valor da configuração',
    example: 'dark',
  })
  value: string;
}
