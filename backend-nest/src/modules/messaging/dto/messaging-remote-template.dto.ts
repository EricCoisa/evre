import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const LinkRemoteTemplateSchema = z.object({
  remoteTemplateId: z.string().min(1),
  templateId: z.string().uuid(),
});

export class LinkRemoteTemplateDto extends createZodDto(
  LinkRemoteTemplateSchema,
) {
  @ApiProperty({
    description: 'ID do template na Meta (providerTemplateId)',
    example: '123456789012345',
  })
  remoteTemplateId: string;

  @ApiProperty({
    description: 'ID do template no banco local a vincular',
    example: 'd8c4d216-b81b-4f76-bc34-b09787e2f5b6',
  })
  templateId: string;
}

export class RemoteTemplateItemDto {
  @ApiProperty({ description: 'ID do template na Meta' })
  providerTemplateId: string;

  @ApiProperty({ description: 'Nome do template na Meta (snake_case)' })
  name: string;

  @ApiProperty({ description: 'Idioma no padrão da plataforma (ex: pt-BR)' })
  language: string;

  @ApiProperty({
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED'],
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Motivo de rejeição retornado pela Meta',
  })
  reason?: string;

  @ApiPropertyOptional({
    enum: ['AUTHENTICATION', 'UTILITY', 'MARKETING'],
  })
  category?: 'AUTHENTICATION' | 'UTILITY' | 'MARKETING';

  @ApiPropertyOptional({
    description: 'ID do template local já vinculado nesta conexão, se houver',
  })
  linkedTemplateId?: string;

  @ApiPropertyOptional({
    description: 'Key do template local já vinculado nesta conexão, se houver',
  })
  linkedTemplateKey?: string;

  @ApiProperty({
    description:
      'Templates locais candidatos a vínculo (compatíveis em idioma/nome)',
    type: [Object],
  })
  suggestedTemplates: Array<{
    id: string;
    key: string;
    language: string;
    category: string;
    exactMatch: boolean;
  }>;
}

export const ImportRemoteTemplateSchema = z.object({
  remoteTemplateId: z.string().min(1),
  typeId: z.string().uuid().optional(),
});

export class ImportRemoteTemplateDto extends createZodDto(
  ImportRemoteTemplateSchema,
) {
  @ApiProperty({
    description: 'ID do template na Meta a ser baixado/importado',
    example: '123456789012345',
  })
  remoteTemplateId: string;

  @ApiPropertyOptional({
    description:
      'ID de um tipo de template existente a associar. Se omitido, o sistema busca ou cria um tipo automaticamente.',
    example: 'd8c4d216-b81b-4f76-bc34-b09787e2f5b6',
  })
  typeId?: string;
}
