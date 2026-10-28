// Scopes: mesma fonte dos API keys (McpScopes no backend, via OpenAPI). Nunca
// duplicar a lista aqui — ver lib/actions/api-keys/types.ts.
export type { McpScope } from '../api-keys/types';
export { MCP_SCOPES } from '../api-keys/types';

import type { McpScope } from '../api-keys/types';

/** Um cliente MCP conectado (Claude Desktop, ChatGPT, …) na conta do usuário. */
export interface McpConnection {
  id: string;
  clientName: string;
  scopes: McpScope[];
  createdAt: string;
  lastUsedAt: string | null;
}

/** O que a tela de consentimento precisa mostrar antes do usuário aprovar. */
export interface AuthorizationRequest {
  clientId: string;
  clientName: string;
  redirectUri: string;
  requestedScopes: McpScope[];
  availableScopes: McpScope[];
}
