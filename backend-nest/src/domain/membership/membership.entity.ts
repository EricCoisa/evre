import { ApiProperty } from '@nestjs/swagger';
import type { MembershipScopeRoleValue } from './membershipScopeRole.const';

export class Membership {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ required: false })
  companyId?: string | null;

  @ApiProperty({ required: false })
  projectId?: string | null;

  @ApiProperty({ enum: ['OWNER', 'COLLABORATOR', 'VIEWER'] })
  scopeRole: MembershipScopeRoleValue;

  @ApiProperty()
  canSeeCommercials: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
