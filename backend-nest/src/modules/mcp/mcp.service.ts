import { Injectable, Logger } from '@nestjs/common';

import { LogActions } from 'src/domain/logging/log-actions';
import {
  JSONRPC_ERROR,
  MCP_LATEST_PROTOCOL_VERSION,
  MCP_PROTOCOL_VERSIONS,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
} from 'src/domain/mcp/mcp.const';
import { LoggingService } from '../logging/logging.service';
import { ToolRegistry } from '../ai/tool-registry.service';

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface McpCaller {
  userId: string;
  roleName: string;
  /** Scopes aprovados no consentimento — é o que libera as tools de escrita. */
  approvedScopes: string[];
}

const ok = (id: JsonRpcResponse['id'], result: unknown): JsonRpcResponse => ({
  jsonrpc: '2.0',
  id,
  result,
});

const fail = (
  id: JsonRpcResponse['id'],
  code: number,
  message: string,
): JsonRpcResponse => ({ jsonrpc: '2.0', id, error: { code, message } });

/** Implementa MCP sobre Streamable HTTP em modo stateless: cada POST é uma mensagem JSON-RPC 2.0 completa. */
@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(
    private readonly registry: ToolRegistry,
    private readonly loggingService: LoggingService,
  ) {}

  /** Lote JSON-RPC (array) ou mensagem única. Notificações devolvem `null`. */
  async handle(
    body: unknown,
    caller: McpCaller,
  ): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
    if (Array.isArray(body)) {
      const results = await Promise.all(
        body.map((msg) => this.handleOne(msg as JsonRpcRequest, caller)),
      );
      const answers = results.filter((r): r is JsonRpcResponse => r !== null);
      return answers.length ? answers : null;
    }
    return this.handleOne(body as JsonRpcRequest, caller);
  }

  private async handleOne(
    msg: JsonRpcRequest,
    caller: McpCaller,
  ): Promise<JsonRpcResponse | null> {
    if (!msg || typeof msg !== 'object' || typeof msg.method !== 'string') {
      return fail(null, JSONRPC_ERROR.INVALID_REQUEST, 'Invalid Request');
    }

    // Notificação (sem `id`) não tem resposta — JSON-RPC 2.0 §4.1.
    const isNotification = msg.id === undefined || msg.id === null;
    const id: string | number | null = msg.id ?? null;

    if (isNotification) {
      if (!msg.method.startsWith('notifications/')) {
        this.logger.debug(`MCP: notificação desconhecida ${msg.method}`);
      }
      return null;
    }

    try {
      switch (msg.method) {
        case 'initialize':
          return ok(id, this.initialize(msg.params));
        case 'ping':
          return ok(id, {});
        case 'tools/list':
          return ok(id, { tools: await this.listTools(caller) });
        case 'tools/call':
          return ok(id, await this.callTool(msg.params, caller));
        // Não declaramos as capabilities `resources`/`prompts`, mas alguns
        // clientes sondam de todo jeito e esperam uma lista vazia, não um erro.
        case 'resources/list':
          return ok(id, { resources: [] });
        case 'resources/templates/list':
          return ok(id, { resourceTemplates: [] });
        case 'prompts/list':
          return ok(id, { prompts: [] });
        default:
          return fail(
            id,
            JSONRPC_ERROR.METHOD_NOT_FOUND,
            `Method not found: ${msg.method}`,
          );
      }
    } catch (err) {
      this.logger.error(`MCP ${msg.method} falhou`, err as Error);
      return fail(id, JSONRPC_ERROR.INTERNAL, 'Internal error');
    }
  }

  private initialize(params: unknown): unknown {
    const requested = (params as { protocolVersion?: string } | undefined)
      ?.protocolVersion;

    return {
      // Espelha a versão do cliente quando a conhecemos; senão puxa para a nossa
      // mais nova e deixa o cliente decidir se aceita.
      protocolVersion:
        requested &&
        (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
          ? requested
          : MCP_LATEST_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    };
  }

  /** Catálogo de tools do agente in-app, filtrado por role e pelas revogações do usuário. */
  private async listTools(caller: McpCaller) {
    return this.registry.getToolDefinitions({
      roleName: caller.roleName,
      userId: caller.userId,
    });
  }

  private async callTool(params: unknown, caller: McpCaller) {
    const { name, arguments: args } = (params ?? {}) as {
      name?: string;
      arguments?: unknown;
    };

    if (!name) {
      return this.toolError('tools/call requer `name`');
    }

    const outcome = await this.registry.dispatch(name, args ?? {}, {
      userId: caller.userId,
      roleName: caller.roleName,
      approvedScopes: caller.approvedScopes,
    });

    if (outcome.status === 'approval_required') {
      // MCP não tem aprovação humana no meio de um tools/call: informa o scope faltante ao modelo.
      return this.toolError(
        `Esta tool exige o scope "${outcome.scope}", que não foi aprovado nesta conexão. ` +
          `Reconecte o conector aprovando o scope para usá-la.`,
      );
    }

    if (outcome.status === 'error') return this.toolError(outcome.message);

    await this.loggingService.create(
      {
        module: 'MCP',
        action: LogActions.MCP_TOOL_CALLED,
        message: `Tool ${name} executada via MCP`,
        metadata: { tool: name, via: 'mcp' },
      },
      caller.userId,
    );

    return {
      content: [
        { type: 'text', text: JSON.stringify(outcome.result, null, 2) },
      ],
    };
  }

  /** Erro de tool vai como resultado com `isError`, não como erro JSON-RPC. */
  private toolError(message: string) {
    return { content: [{ type: 'text', text: message }], isError: true };
  }
}
