import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AiProviderConst } from 'src/domain/ai/ai.const';

/** Formulário de configuração de IA, usado tanto pela plataforma (admin) quanto pelo BYOK do usuário. */
export const SaveAiConfigSchema = z
  .object({
    provider: z.enum([
      AiProviderConst.ANTHROPIC,
      AiProviderConst.OPENAI,
      AiProviderConst.OPENAI_COMPATIBLE,
    ]),
    model: z.string().min(1),
    apiKey: z.string().optional(),
    baseUrl: z.string().url().optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (
      data.provider === AiProviderConst.OPENAI_COMPATIBLE &&
      !data.baseUrl?.trim()
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['baseUrl'],
        message: 'baseUrl é obrigatória para OPENAI_COMPATIBLE',
      });
    }
  });

export class SaveAiConfigDto extends createZodDto(SaveAiConfigSchema) {
  @ApiProperty({
    enum: ['ANTHROPIC', 'OPENAI', 'OPENAI_COMPATIBLE'],
    example: 'ANTHROPIC',
  })
  provider: 'ANTHROPIC' | 'OPENAI' | 'OPENAI_COMPATIBLE';

  @ApiProperty({ example: 'claude-sonnet-4-6' })
  model: string;

  @ApiProperty({
    required: false,
    description: 'Vazio mantém a credencial já gravada',
  })
  apiKey?: string;

  @ApiProperty({
    required: false,
    example: 'https://openrouter.ai/api/v1',
    description: 'Obrigatória apenas para OPENAI_COMPATIBLE',
  })
  baseUrl?: string;
}
