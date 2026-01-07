import { ApiProperty } from '@nestjs/swagger';

export class SystemConfigurationDto {
  @ApiProperty({
    description: 'ID único da configuração',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

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
  value: number | string | boolean | object;

  @ApiProperty({
    description: 'Data da última atualização',
    example: '2025-12-05T11:49:53.000Z',
  })
  updatedAt: Date;
}
