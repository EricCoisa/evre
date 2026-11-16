import { ApiProperty } from '@nestjs/swagger';

export class Lead {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'João Silva' })
  name: string;

  @ApiProperty({ example: '+5511999990000', required: false })
  phone?: string | null;

  @ApiProperty({ example: 'joao@empresa.com', required: false })
  email?: string | null;

  @ApiProperty({ example: 'Gostaria de saber mais sobre os planos.' })
  message: string;

  @ApiProperty({ enum: ['NEW', 'VIEWED', 'RESOLVED'], example: 'NEW' })
  status: string;

  @ApiProperty({ required: false })
  messagingContactId?: string | null;

  @ApiProperty({ required: false })
  resolvedById?: string | null;

  @ApiProperty({ required: false })
  resolvedAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
