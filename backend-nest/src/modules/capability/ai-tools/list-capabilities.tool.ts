import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { CapabilityRegistry } from '../capability.registry';
import type { CapabilityStatus } from 'src/domain/capability/capability.types';

/** Mesmo recorte do GET /capabilities: `reason` só vai pro ADMIN. */
@AiToolDef()
@Injectable()
export class ListCapabilitiesTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_capabilities',
    description:
      'Lista todas as capabilities do sistema e seu estado para o role do usuário logado: "available" (habilitada por feature flag) e "operational" (dependências configuradas e vivas). Use para diagnosticar por que um recurso está indisponível ou fora do ar.',
    inputSchema: z.object({}),
    invalidates: [],
  };

  constructor(private readonly registry: CapabilityRegistry) {}

  async execute(
    _input: unknown,
    ctx: AiToolContext,
  ): Promise<Record<string, CapabilityStatus>> {
    const result = await this.registry.resolveAll(ctx.roleName);
    if (ctx.roleName !== 'ADMIN') {
      for (const status of Object.values(result)) {
        delete status.reason;
      }
    }
    return result;
  }
}
