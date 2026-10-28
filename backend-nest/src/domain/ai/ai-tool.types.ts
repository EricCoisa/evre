import { z } from 'zod';
import type { McpScope } from '../api-key/mcp-scopes.const';
import type { InvalidationTag } from './invalidation-tags.const';

export interface AiToolContext {
  userId: string;
  roleName: string;
  approvedScopes: string[];
}

export interface AiToolDefinition {
  name: string; // snake_case, único — ex.: 'list_users'
  description: string; // o que o modelo lê para decidir usar — NÃO é texto de UI
  descriptionKey?: string; // chave i18n da descrição mostrada ao usuário (tela de permissões). Ausente = `tool_<name>`
  inputSchema: z.ZodType; // validado no dispatch e convertido em JSON Schema para o modelo (zod-to-json-schema)
  roles?: string[]; // RBAC — espelha o guard do endpoint equivalente; ausente = qualquer autenticado
  invalidates?: InvalidationTag[]; // tags de InvalidationTags (invalidation-tags.const.ts) p/ o frontend invalidar queries
  approvalScope?: McpScope; // se definido, só executa com o scope aprovado (chat: approvedScopes da conversa ou aprovação one-shot; MCP: scopes da chave). Leitura omite; escrita SEMPRE declara.
}

export interface IAiTool {
  readonly definition: AiToolDefinition;
  execute(input: unknown, ctx: AiToolContext): Promise<unknown>;
}
