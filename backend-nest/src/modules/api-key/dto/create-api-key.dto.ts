import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { McpScopes, type McpScope } from 'src/domain/api-key/mcp-scopes.const';

const scopeValues = Object.values(McpScopes) as [McpScope, ...McpScope[]];

export const CreateApiKeySchema = z.object({
  name: z
    .string()
    .min(1, 'name é obrigatório')
    .max(100, 'name deve ter no máximo 100 caracteres'),
  scopes: z
    .array(z.enum(scopeValues))
    .min(1, 'pelo menos um scope é obrigatório'),
  expiresAt: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.coerce.date().optional(),
  ),
});

export class CreateApiKeyDto extends createZodDto(CreateApiKeySchema) {
  @ApiProperty({
    example: 'Minha chave MCP',
    description: 'Nome da chave',
  })
  name: string;

  @ApiProperty({
    example: ['users:read'],
    description: 'Scopes da chave',
    isArray: true,
  })
  scopes: McpScope[];

  @ApiProperty({
    example: '2027-01-01T00:00:00.000Z',
    required: false,
    description: 'Data de expiração (opcional)',
  })
  expiresAt?: Date;
}
