import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SetDefinitionDefaultSchema = z.object({
  defaultValue: z.string().min(1, 'defaultValue é obrigatório'),
});

export class SetDefinitionDefaultDto extends createZodDto(
  SetDefinitionDefaultSchema,
) {
  @ApiProperty({
    description: 'Novo valor padrão, herdado por quem não personalizou a chave',
    example: 'dark',
  })
  defaultValue: string;
}
