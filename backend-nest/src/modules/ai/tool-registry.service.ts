import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodType } from 'zod';
import { AI_TOOL_KEY } from 'src/domain/ai/ai-tool.decorator';
import type { IAiTool, AiToolContext } from 'src/domain/ai/ai-tool.types';
import type { AiWireTool } from 'src/domain/interface/ai-provider.interface';
import { LoggingService } from '../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { PrismaService } from '../../prisma/prisma.service';

export type DispatchResult =
  | { status: 'ok'; result: unknown; invalidates?: string[] }
  | { status: 'approval_required'; scope: string }
  | { status: 'error'; message: string };

@Injectable()
export class ToolRegistry implements OnModuleInit {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly tools = new Map<string, IAiTool>();
  // Grupo = módulo Nest dono da tool (ex.: 'user', 'feature-flag') — usado para
  // organizar a tela de permissões por tipo, sem precisar anotar cada tool manualmente.
  private readonly toolGroups = new Map<string, string>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly loggingService: LoggingService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    for (const wrapper of this.discovery.getProviders()) {
      const instance = wrapper.instance as IAiTool | null;
      const metatype = wrapper.metatype;
      if (!instance || !metatype) continue;
      if (!this.reflector.get<boolean>(AI_TOOL_KEY, metatype)) continue;
      const tool = instance;
      if (!tool.definition?.name || !tool.definition?.inputSchema) {
        throw new Error(
          `AiTool inválida: ${metatype.name} sem definition completa`,
        );
      }
      if (this.tools.has(tool.definition.name)) {
        throw new Error(`AiTool duplicada: ${tool.definition.name}`);
      }
      this.tools.set(tool.definition.name, tool);
      this.toolGroups.set(
        tool.definition.name,
        moduleNameToGroupSlug(wrapper.host?.name),
      );
    }
    this.logger.log(`ToolRegistry: ${this.tools.size} tool(s) registrada(s)`);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  getToolGroup(name: string): string {
    return this.toolGroups.get(name) ?? 'other';
  }

  /** Chave i18n da descrição que o usuário lê na tela de permissões. */
  getDescriptionKey(name: string): string {
    return this.tools.get(name)?.definition.descriptionKey ?? `tool_${name}`;
  }

  /** Scope de aprovação declarado pela tool, lido sem executá-la. */
  getApprovalScope(name: string): string | undefined {
    return this.tools.get(name)?.definition.approvalScope;
  }

  /** Tools que um userId desabilitou para o próprio agente (ver UserToolAccess). */
  async getDisabledToolNames(userId?: string): Promise<Set<string>> {
    if (!userId) return new Set();
    const rows = await this.prisma.userToolAccess.findMany({
      where: { userId },
      select: { toolName: true },
    });
    return new Set(rows.map((r) => r.toolName));
  }

  /** Catálogo completo permitido pelo role, sem considerar revogação individual — usado na tela de permissões. */
  getDefinitionsForRole(roleName: string): AiWireTool[] {
    return [...this.tools.values()]
      .filter(
        (t) => !t.definition.roles || t.definition.roles.includes(roleName),
      )
      .map((t) => ({
        name: t.definition.name,
        description: t.definition.description,
        inputSchema: toJsonSchema(t.definition.inputSchema),
      }));
  }

  /** Só o que o role pode usar e o usuário não revogou — o modelo não vê o resto. */
  async getToolDefinitions(
    ctx: Pick<AiToolContext, 'roleName'> & { userId?: string },
  ): Promise<AiWireTool[]> {
    const disabled = await this.getDisabledToolNames(ctx.userId);
    return this.getDefinitionsForRole(ctx.roleName).filter(
      (t) => !disabled.has(t.name),
    );
  }

  async dispatch(
    name: string,
    input: unknown,
    ctx: AiToolContext,
  ): Promise<DispatchResult> {
    const tool = this.tools.get(name);
    if (!tool) return { status: 'error', message: `Unknown tool: ${name}` };
    const def = tool.definition;

    // Re-checa roles (defesa dupla)
    if (def.roles && !def.roles.includes(ctx.roleName)) {
      return {
        status: 'error',
        message: `Permission denied for tool ${name}`,
      };
    }

    // Usuário revogou o acesso do próprio agente a esta tool (defesa dupla)
    const disabledByUser = await this.prisma.userToolAccess.findUnique({
      where: { userId_toolName: { userId: ctx.userId, toolName: name } },
    });
    if (disabledByUser) {
      return {
        status: 'error',
        message: `Tool ${name} foi desabilitada pelo usuário para o agente`,
      };
    }

    // Approval scope não aprovado
    if (def.approvalScope && !ctx.approvedScopes.includes(def.approvalScope)) {
      return { status: 'approval_required', scope: def.approvalScope };
    }

    // Input do modelo NÃO CONFIÁVEL — valida com safeParse
    const parsed = def.inputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: 'error',
        message: `Invalid input: ${parsed.error.message}`,
      };
    }

    try {
      const result = await tool.execute(parsed.data, ctx);
      await this.loggingService.create(
        {
          module: 'AI',
          action: LogActions.AI_TOOL_EXECUTED,
          message: `Tool ${name} executada pelo agente`,
          metadata: { tool: name, via: 'ai-agent' },
        },
        ctx.userId,
      );
      return { status: 'ok', result, invalidates: def.invalidates };
    } catch (err) {
      return {
        status: 'error',
        message: String((err as Error)?.message ?? err),
      };
    }
  }
}

/** 'UserRouteAccessModule' → 'user-route-access'; sem host (ex.: testes) → 'other' */
function moduleNameToGroupSlug(moduleName?: string): string {
  if (!moduleName) return 'other';
  return moduleName
    .replace(/Module$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/** Converte Zod schema para JSON Schema (Zod 3) */
function toJsonSchema(schema: ZodType): Record<string, unknown> {
  const result = zodToJsonSchema(schema);
  // Remove o $schema se presente, mantendo apenas a definição do schema
  if (result && typeof result === 'object' && '$schema' in result) {
    delete (result as Record<string, unknown>).$schema;
    return result;
  }
  return result;
}
