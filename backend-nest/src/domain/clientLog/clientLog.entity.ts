import { ApiProperty } from '@nestjs/swagger';

export class ClientLog {
  @ApiProperty({
    description: 'ID do log',
    example: 'b1a2c3d4-e5f6-7890-abcd-1234567890ef',
  })
  id: string;

  @ApiProperty({
    description: 'ID da empresa (Company)',
    example: 'c1a2b3c4-d5e6-7890-abcd-1234567890ef',
  })
  companyId: string;

  @ApiProperty({
    description: 'ID do projeto (Project)',
    example: 'p1a2b3c4-d5e6-7890-abcd-1234567890ef',
  })
  projectId: string;

  @ApiProperty({
    description: 'Ambiente do sistema cliente (ex: production, staging, dev)',
    example: 'production',
  })
  environment: string;

  @ApiProperty({
    description: 'Metadados adicionais em formato JSON',
    example: '{"userId": "123", "ip": "192.168.1.1"}',
    required: false,
  })
  metadata?: string | null;

  @ApiProperty({
    description: 'Data/hora de criação do log',
    example: '2026-01-09T12:00:00.000Z',
  })
  createdAt: Date;
}
