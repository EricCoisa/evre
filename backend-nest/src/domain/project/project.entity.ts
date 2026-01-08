import { ApiProperty } from '@nestjs/swagger';
import { ProjectStatusConst } from './projectStatus.const';

export class Project {
  @ApiProperty({
    description: 'Unique identifier of the project',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Company identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  companyId: string;

  @ApiProperty({
    description: 'Proposal identifier (optional)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  proposalId: string | null;

  @ApiProperty({
    description: 'Project name',
    example: 'E-commerce Platform Development',
  })
  name: string;

  @ApiProperty({
    description: 'Project description',
    example:
      'Development of a modern e-commerce platform with payment integration',
    required: false,
  })
  description: string | null;

  @ApiProperty({
    description: 'Project status',
    enum: Object.values(ProjectStatusConst),
    example: ProjectStatusConst.PROPOSAL,
  })
  status: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-07T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-07T10:00:00.000Z',
  })
  updatedAt: Date;
}
