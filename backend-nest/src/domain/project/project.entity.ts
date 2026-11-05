import { ApiProperty } from '@nestjs/swagger';
import type { ProjectStatusValue } from './projectStatus.const';

export class Project {
  @ApiProperty()
  id: string;

  @ApiProperty()
  companyId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true })
  description?: string | null;

  @ApiProperty({ enum: ['ACTIVE', 'COMPLETED', 'ARCHIVED'] })
  status: ProjectStatusValue;

  @ApiProperty({ required: false, nullable: true })
  archivedAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
