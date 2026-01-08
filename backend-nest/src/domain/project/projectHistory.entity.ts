import { ApiProperty } from '@nestjs/swagger';
import { ProjectHistoryTypeConst } from './projectHistoryType.const';

export class ProjectHistory {
  @ApiProperty({
    description: 'Unique identifier of the history entry',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Project identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  projectId: string;

  @ApiProperty({
    description: 'History type',
    enum: Object.values(ProjectHistoryTypeConst),
    example: ProjectHistoryTypeConst.STATUS_CHANGE,
  })
  type: string;

  @ApiProperty({
    description: 'History payload (JSON)',
    example: '{"oldStatus": "PROPOSAL", "newStatus": "REQUIREMENTS"}',
  })
  payload: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-07T10:00:00.000Z',
  })
  createdAt: Date;
}
