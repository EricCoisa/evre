import { ApiProperty } from '@nestjs/swagger';

export class SystemConfiguration {
  @ApiProperty({
    description: 'ID único da configuração',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Chave de label utilizada para internacionalização',
    example: 'system.site.title',
  })
  labelKey: string;

  @ApiProperty({
    description: 'Tipo do valor (string, number, boolean, json, etc.)',
    example: 'string',
  })
  valueType: string;

  @ApiProperty({
    description: 'Valor da configuração como string',
    example: 'My site title',
  })
  value: string | number | boolean | object;

  @ApiProperty({
    description: 'Data de atualização',
    example: '2025-12-17T12:00:00.000Z',
  })
  updatedAt: Date;
}
