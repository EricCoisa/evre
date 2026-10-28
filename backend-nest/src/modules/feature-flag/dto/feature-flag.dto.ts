import { ApiProperty } from '@nestjs/swagger';
import {
  FEATURE_FLAG_CATEGORIES,
  type FeatureFlagCategory,
} from '../../../domain/feature-flag/feature-flag.const';

class FeatureFlagRoleNestedDto {
  @ApiProperty()
  name: string;
}

export class FeatureFlagRoleDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  roleId: string;

  @ApiProperty({ type: () => FeatureFlagRoleNestedDto })
  role: FeatureFlagRoleNestedDto;
}

export class FeatureFlagDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  description?: string | null;

  @ApiProperty({ enum: FEATURE_FLAG_CATEGORIES })
  category: FeatureFlagCategory;

  @ApiProperty({ default: false })
  isSystem: boolean;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty({ type: String, required: false, nullable: true })
  parentId: string | null;

  @ApiProperty({ type: () => FeatureFlagRoleDto, isArray: true })
  roles: FeatureFlagRoleDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
