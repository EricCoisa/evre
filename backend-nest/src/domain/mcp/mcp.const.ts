/** Constantes do servidor MCP remoto (Streamable HTTP) e do Authorization Server OAuth 2.1. */

/** Revisões do protocolo MCP que sabemos responder, da mais nova para a mais velha. */
export const MCP_PROTOCOL_VERSIONS = [
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
] as const;

export const MCP_LATEST_PROTOCOL_VERSION = MCP_PROTOCOL_VERSIONS[0];

/** Caminhos públicos no domínio do front, usados nos metadados OAuth e na URL do conector. */
export const MCP_PUBLIC_PATH = 'mcp';
export const OAUTH_PUBLIC_PATH = 'oauth';

export const MCP_SERVER_NAME = 'template-mcp';
export const MCP_SERVER_VERSION = '1.0.0';

export const OAUTH_TOKEN_PREFIX = {
  ACCESS: 'mcpat_',
  REFRESH: 'mcprt_',
  CODE: 'mcpac_',
} as const;

/** TTLs. Code curtíssimo (RFC 6749 §4.1.2 recomenda <=10min); access curto porque o refresh cobre. */
export const OAUTH_TTL_SECONDS = {
  CODE: 5 * 60,
  ACCESS: 60 * 60,
  REFRESH: 30 * 24 * 60 * 60,
} as const;

/** Feature flag que liga/desliga o conector inteiro (endpoint + aba no perfil). */
export const MCP_CONNECTORS_FLAG = 'MCP_CONNECTORS';

/** Códigos de erro JSON-RPC 2.0 usados pelo endpoint MCP. */
export const JSONRPC_ERROR = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
} as const;
