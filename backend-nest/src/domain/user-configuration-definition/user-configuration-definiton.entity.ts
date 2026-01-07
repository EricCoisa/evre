import { ApiProperty } from '@nestjs/swagger';

export class UserConfigurationDefinition {
  @ApiProperty({
    description: 'ID único da definição',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Chave de label utilizada para internacionalização',
    example: 'user.configuration.theme',
  })
  labelKey: string;

  @ApiProperty({
    description: 'Tipo do valor (string, number, boolean, json, etc.)',
    example: 'string',
  })
  valueType: string;

  @ApiProperty({
    description: 'Valor padrão (opcional)',
    example: 'light',
    required: false,
  })
  defaultValue?: string | null | number | boolean | object;

  @ApiProperty({
    description: 'Indica se a configuração é obrigatória',
    example: false,
  })
  isRequired: boolean;

  @ApiProperty({
    description: 'Data de criação',
    example: '2025-12-17T12:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Data de atualização',
    example: '2025-12-17T12:00:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Configurações de usuários relacionadas (opcional)',
    required: false,
  })
  userConfigurations?: Array<{
    id: string;
    userId: string;
    definitionId: string;
    value: string;
  }> | null;
}
