"use server";
import { GET, POST } from '../../api/api';
import type { ApiResponse } from '../../api/api';
import { getMcp } from '@/lib/generated/mcp/mcp';
import { wrapAs } from '../wrap';
import type { AuthorizationRequest, McpConnection, McpScope } from './types';

const api = getMcp();

export async function listMcpConnections(): Promise<ApiResponse<McpConnection[]>> {
  return wrapAs(() => api.mcpConnectionsControllerList());
}

export async function revokeMcpConnection(id: string): Promise<ApiResponse<void>> {
  return wrapAs(() => api.mcpConnectionsControllerRevoke(id));
}

// Os dois abaixo falam com o Authorization Server, que está fora do OpenAPI
// (superfície de protocolo OAuth, não API da aplicação) — daí o helper cru.

export async function getAuthorizationRequest(
  req: string,
): Promise<ApiResponse<AuthorizationRequest>> {
  return GET<AuthorizationRequest>(
    `/oauth/authorize/request?req=${encodeURIComponent(req)}`,
  );
}

export async function approveAuthorization(
  req: string,
  scopes: McpScope[],
): Promise<ApiResponse<{ redirectTo: string }>> {
  return POST<{ redirectTo: string }>('/oauth/authorize/consent', { req, scopes });
}
