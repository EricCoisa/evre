import { ApiProperty } from '@nestjs/swagger';

export class UserConfiguration {
  @ApiProperty({
    description: 'ID único da configuração do usuário',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'ID do usuário',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'ID da definição desta configuração',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  definitionId: string;

  @ApiProperty({
    description: 'Valor armazenado como string',
    example: 'dark',
  })
  value: string;

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
    description: 'Dados básicos do usuário (opcional)',
    required: false,
    example: { id: '123', name: 'João', email: 'joao@example.com' },
  })
  user?: { id: string; name?: string | null; email: string } | null;

  @ApiProperty({
    description: 'Dados da definição desta configuração (opcional)',
    required: false,
    example: {
      id: 'def-1',
      labelKey: 'ui.theme',
      valueType: 'string',
      defaultValue: 'light',
    },
  })
  definition?: {
    id: string;
    labelKey: string;
    valueType: string;
    defaultValue?: string | null;
  } | null;
}
