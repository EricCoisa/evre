import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { FeatureFlagCategoryEnum } from './create-feature-flag.dto';
import {
  FEATURE_FLAG_CATEGORIES,
  type FeatureFlagCategory,
} from '../../../domain/feature-flag/feature-flag.const';

export const UpdateFeatureFlagSchema = z.object({
  description: z.string().optional(),
  category: FeatureFlagCategoryEnum.optional(),
  isSystem: z.boolean().optional(),
  enabled: z.boolean().optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export class UpdateFeatureFlagDto extends createZodDto(
  UpdateFeatureFlagSchema,
) {
  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({
    enum: FEATURE_FLAG_CATEGORIES,
    required: false,
  })
  category?: FeatureFlagCategory;

  @ApiProperty({ required: false })
  isSystem?: boolean;

  @ApiProperty({ required: false })
  enabled?: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'ID da feature flag pai. Omitido = não altera; null = vira raiz; string = novo pai',
  })
  parentId?: string | null;
}
