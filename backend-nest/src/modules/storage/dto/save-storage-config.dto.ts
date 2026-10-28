import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { StorageEngineConst } from 'src/domain/storage/storage.const';

/** Formulário de storage; o backend valida o conjunto completo contra o provider antes de persistir. */
export const SaveStorageConfigSchema = z
  .object({
    provider: z.enum([StorageEngineConst.S3, StorageEngineConst.LOCAL]),
    // S3
    endpoint: z.string().optional(),
    region: z.string().optional(),
    bucket: z.string().optional(),
    // Segredos: vazio = manter o valor já gravado.
    accessKey: z.string().optional(),
    secretKey: z.string().optional(),
    publicUrl: z.string().optional(),
    // LOCAL
    dir: z.string().optional(),
    baseUrl: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const required =
      data.provider === StorageEngineConst.S3
        ? (['endpoint', 'region', 'bucket', 'publicUrl'] as const)
        : (['dir', 'baseUrl'] as const);

    for (const field of required) {
      if (!data[field]?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `${field} é obrigatório para ${data.provider}`,
        });
      }
    }
  });

export class SaveStorageConfigDto extends createZodDto(
  SaveStorageConfigSchema,
) {
  @ApiProperty({ enum: ['S3', 'LOCAL'], example: 'S3' })
  provider: 'S3' | 'LOCAL';

  @ApiProperty({ required: false, example: 'http://localhost:8333' })
  endpoint?: string;

  @ApiProperty({ required: false, example: 'us-east-1' })
  region?: string;

  @ApiProperty({ required: false, example: 'app-uploads' })
  bucket?: string;

  @ApiProperty({
    required: false,
    description: 'Vazio mantém a credencial já gravada',
  })
  accessKey?: string;

  @ApiProperty({
    required: false,
    description: 'Vazio mantém a credencial já gravada',
  })
  secretKey?: string;

  @ApiProperty({
    required: false,
    example: 'http://localhost:8333/app-uploads',
  })
  publicUrl?: string;

  @ApiProperty({ required: false, example: './uploads' })
  dir?: string;

  @ApiProperty({ required: false, example: 'http://localhost:3001' })
  baseUrl?: string;
}
