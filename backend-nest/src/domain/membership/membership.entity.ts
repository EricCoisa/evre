import { ApiProperty } from '@nestjs/swagger';

export class Membership {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ required: false })
  companyId?: string | null;

  @ApiProperty({ required: false })
  projectId?: string | null;

  @ApiProperty()
  canSeeCommercials: boolean;

  @ApiProperty()
  canComment: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
