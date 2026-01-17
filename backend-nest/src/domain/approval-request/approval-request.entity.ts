import { ApiProperty } from '@nestjs/swagger';

export class ApprovalRequest {
  @ApiProperty({
    description: 'Unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Name of the approvalrequest',
    example: 'Example ApprovalRequest',
  })
  name: string;

  @ApiProperty({
    description: 'Description of the approvalrequest',
    example: 'This is an example description',
    required: false,
  })
  description?: string | null;

  @ApiProperty({
    description: 'Active status',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-01-16T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-01-16T10:00:00.000Z',
  })
  updatedAt: Date;
}
