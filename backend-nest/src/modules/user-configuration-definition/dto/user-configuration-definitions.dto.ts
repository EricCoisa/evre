import { ApiProperty } from '@nestjs/swagger';

export class UserConfigurationDefinitionsDto {
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
    description: 'Tipo do valor (STRING, NUMBER, BOOLEAN, JSON, DATE, ENUM)',
    example: 'BOOLEAN',
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
    description: 'Valor da configuração',
    example: 'false',
  })
  defaultValue?: number | string | boolean | object | null;

  @ApiProperty({
    description: 'Indica se a configuração é obrigatória',
    example: true,
  })
  isRequired?: boolean;

  @ApiProperty({
    description: 'Indica se o valor é secreto e deve ser criptografado',
    example: false,
    required: false,
    default: false,
  })
  secret?: boolean;

  @ApiProperty({
    description: 'Data da última atualização',
    example: '2025-12-05T11:49:53.000Z',
  })
  updatedAt: Date;
}
