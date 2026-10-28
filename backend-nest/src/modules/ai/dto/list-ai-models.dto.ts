import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AiProviderConst } from 'src/domain/ai/ai.const';

/** Corpo de `POST /ai/models/candidate`; campo vazio usa o valor já gravado para o provider. */
export const ListAiModelsSchema = z.object({
  provider: z.enum([
    AiProviderConst.ANTHROPIC,
    AiProviderConst.OPENAI,
    AiProviderConst.OPENAI_COMPATIBLE,
  ]),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
});

export class ListAiModelsDto extends createZodDto(ListAiModelsSchema) {
  @ApiProperty({
    enum: ['ANTHROPIC', 'OPENAI', 'OPENAI_COMPATIBLE'],
    example: 'ANTHROPIC',
  })
  provider: 'ANTHROPIC' | 'OPENAI' | 'OPENAI_COMPATIBLE';

  @ApiProperty({
    required: false,
    description: 'Vazio usa a chave já gravada para o provider',
  })
  apiKey?: string;

  @ApiProperty({
    required: false,
    description: 'Vazio usa a base URL já gravada (OPENAI_COMPATIBLE)',
  })
  baseUrl?: string;
}
