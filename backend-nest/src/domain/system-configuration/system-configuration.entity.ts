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
    description: 'Tipo do valor (STRING, NUMBER, BOOLEAN, JSON, DATE, ENUM)',
    example: 'STRING',
  })
  valueType: string;

  @ApiProperty({
    description: 'Opções disponíveis para valueType ENUM',
    example: ['light', 'dark'],
    isArray: true,
    required: false,
  })
  options?: string[];

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

  @ApiProperty({
    description: 'Indica se o valor é secreto e deve ser tratado com cuidado',
    example: false,
  })
  secret?: boolean;

  @ApiProperty({
    description:
      'Indica se a configuração está bloqueada e não pode ser alterada',
    example: false,
  })
  blocked?: boolean;
}
