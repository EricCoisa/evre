import { ApiProperty } from '@nestjs/swagger';

export class UserConfigurationDto {
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
    nullable: true,
  })
  value: number | string | boolean | object | null;

  @ApiProperty({
    description: 'Indica se o valor foi personalizado pelo usuário',
    example: true,
  })
  isCustomized: boolean;

  @ApiProperty({
    description: 'Indica se o valor é obrigatório',
    example: true,
  })
  isRequired: boolean;
}
