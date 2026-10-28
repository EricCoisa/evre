import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  FEATURE_FLAG_CATEGORIES,
  FeatureFlagCategoryConst,
  type FeatureFlagCategory,
} from '../../../domain/feature-flag/feature-flag.const';

export const FeatureFlagCategoryEnum = z.enum(FEATURE_FLAG_CATEGORIES);

export const CreateFeatureFlagSchema = z.object({
  key: z
    .string()
    .min(1, 'key é obrigatório')
    .max(255, 'key deve ter no máximo 255 caracteres')
    .regex(/^[A-Z0-9_]+$/, 'key deve ser maiúsculo, dígitos e underscores'),
  description: z.string().optional(),
  category: FeatureFlagCategoryEnum.default(FeatureFlagCategoryConst.GENERAL),
  isSystem: z.boolean().default(false),
  enabled: z.boolean().default(false),
  parentId: z.string().uuid().optional(),
});

export class CreateFeatureFlagDto extends createZodDto(
  CreateFeatureFlagSchema,
) {
  @ApiProperty({
    example: 'NEW_DASHBOARD',
    description: 'Chave única da flag (maiúsculo)',
  })
  key: string;

  @ApiProperty({ example: 'Novo dashboard para ADMIN', required: false })
  description?: string;

  @ApiProperty({
    enum: FEATURE_FLAG_CATEGORIES,
    default: FeatureFlagCategoryConst.GENERAL,
  })
  category: FeatureFlagCategory;

  @ApiProperty({ example: false, default: false })
  isSystem: boolean;

  @ApiProperty({ example: false, default: false })
  enabled: boolean;

  @ApiProperty({
    required: false,
    description: 'ID da feature flag pai — vazio/omitido = flag raiz',
  })
  parentId?: string;
}
