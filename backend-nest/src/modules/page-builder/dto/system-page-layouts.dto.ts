import { ApiProperty } from '@nestjs/swagger';

/** Mapa `pageKey → PageLayout` padrão do sistema, tipado como objeto livre. */
export class SystemPageLayoutsDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Mapa pageKey → layout. Vazio quando não há padrão configurado.',
    example: { '/dashboard': { v: 1, blocks: [] } },
  })
  layouts: Record<string, unknown>;
}
