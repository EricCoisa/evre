import { Injectable } from '@nestjs/common';
import { ToolRegistry } from '../tool-registry.service';

export interface ToolPermission {
  name: string;
  /** Texto voltado ao modelo — só serve de fallback se `descriptionKey` não tiver tradução. */
  description: string;
  /** Chave i18n da descrição para o usuário. */
  descriptionKey: string;
  group: string;
  enabled: boolean;
}

@Injectable()
export class ListMyToolPermissionsUseCase {
  constructor(private readonly toolRegistry: ToolRegistry) {}

  async execute(userId: string, roleName: string): Promise<ToolPermission[]> {
    const disabled = await this.toolRegistry.getDisabledToolNames(userId);
    return this.toolRegistry
      .getDefinitionsForRole(roleName)
      .map(({ name, description }) => ({
        name,
        description,
        descriptionKey: this.toolRegistry.getDescriptionKey(name),
        group: this.toolRegistry.getToolGroup(name),
        enabled: !disabled.has(name),
      }));
  }
}
