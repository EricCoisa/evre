import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';
import { LogModuleConst } from './logModule.const';

export class LoggingPerformedBy {
  @ApiProperty({
    description: 'ID do usuário',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Nome do usuário',
    example: 'João Silva',
    nullable: true,
    type: String,
  })
  name: string | null;

  @ApiProperty({
    description: 'Email do usuário',
    example: 'user@example.com',
  })
  email: string;
}

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
    example: { userId: '123', ip: '192.168.1.1' },
    required: false,
  })
  metadata?: Prisma.JsonValue | null;

  @ApiProperty({
    description: 'ID do usuário que executou a ação',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
    type: String,
    nullable: true,
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
    nullable: true,
    type: LoggingPerformedBy,
  })
  performedBy?: LoggingPerformedBy | null;
}
