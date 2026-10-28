import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { McpScopes, type McpScope } from 'src/domain/api-key/mcp-scopes.const';

const scopeValues = Object.values(McpScopes) as [McpScope, ...McpScope[]];

export const UpdateApiKeyScopesSchema = z.object({
  scopes: z
    .array(z.enum(scopeValues))
    .min(1, 'pelo menos um scope é obrigatório'),
});

export class UpdateApiKeyScopesDto extends createZodDto(
  UpdateApiKeyScopesSchema,
) {
  @ApiProperty({
    example: ['users:read', 'routes:read'],
    description: 'Scopes da chave',
    isArray: true,
  })
  scopes: McpScope[];
}
