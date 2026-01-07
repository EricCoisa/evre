import { ApiProperty } from '@nestjs/swagger';
import { LogModuleConst } from './logModule.const';

export class Logging {
  @ApiProperty({
    description: 'ID único do log',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Módulo do sistema que gerou o log',
    enum: LogModuleConst,
    example: 'USER',
  })
  module: keyof typeof LogModuleConst;

  @ApiProperty({
    description: 'Ação executada',
    example: 'CREATE',
  })
  action: string;

  @ApiProperty({
    description: 'Mensagem descritiva do log',
    example: 'Usuário criado com sucesso',
  })
  message: string;

  @ApiProperty({
    description: 'Metadados adicionais em formato JSON',
    example: '{"userId": "123", "ip": "192.168.1.1"}',
    required: false,
  })
  metadata?: string | null;

  @ApiProperty({
    description: 'ID do usuário que executou a ação',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  performedById?: string | null;

  @ApiProperty({
    description: 'Data de criação do log',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Dados do usuário que executou a ação',
    required: false,
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'João Silva',
      email: 'user@example.com',
    },
  })
  performedBy?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}
