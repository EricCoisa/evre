import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';
import type {
  CapabilityCheckResult,
  CapabilityDefinition,
  CapabilityStatus,
} from 'src/domain/capability/capability.types';

const MAX_DEPTH = 5;
const CHECK_TIMEOUT_MS = 2000;

/** Registro do que cada módulo precisa configurado/vivo para um recurso funcionar. */
@Injectable()
export class CapabilityRegistry {
  private readonly logger = new Logger(CapabilityRegistry.name);
  private readonly definitions = new Map<string, CapabilityDefinition>();
  private readonly requirements = new Map<string, string[]>();

  constructor(
    private readonly featureFlags: FeatureFlagService,
    private readonly i18n: I18nService,
  ) {}

  /** Devolve a função que desfaz o registro. Nome duplicado é bug de boot, não runtime. */
  register(name: string, def: CapabilityDefinition): () => void {
    if (this.definitions.has(name)) {
      throw new Error(`Capability duplicada: ${name}`);
    }
    this.definitions.set(name, def);
    this.logger.log(`Capability registrada: ${name}`);
    return () => {
      this.definitions.delete(name);
    };
  }

  /** Liga um labelKey (chave de configuração) às capabilities que precisam estar vivas. */
  requires(labelKey: string, capabilities: string[]): () => void {
    this.requirements.set(labelKey, capabilities);
    this.logger.log(
      `Requisito registrado: ${labelKey} -> [${capabilities.join(', ')}]`,
    );
    return () => {
      this.requirements.delete(labelKey);
    };
  }

  /** Casa chave exata (D12). Sem requisito ⇒ `[]`. */
  requirementsFor(labelKey: string): string[] {
    return this.requirements.get(labelKey) ?? [];
  }

  async resolve(
    name: string,
    roleName: string,
    depth = 0,
  ): Promise<CapabilityStatus> {
    if (depth >= MAX_DEPTH) {
      return {
        available: false,
        operational: false,
        reason: this.i18n.t('capability.max_depth'),
      };
    }

    const def = this.definitions.get(name);
    if (!def) {
      // Sem registro ⇒ degrada liberando, nunca derruba quem pediu (§4.5 do relatório).
      return { available: true, operational: true };
    }

    for (const flag of def.flags) {
      if (!(await this.featureFlags.isEnabled(flag, roleName))) {
        return { available: false, operational: false };
      }
    }

    let res: CapabilityCheckResult;
    let timer: NodeJS.Timeout | undefined;
    try {
      res = await Promise.race([
        def.check({ resolve: (n) => this.resolve(n, roleName, depth + 1) }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('timeout')),
            CHECK_TIMEOUT_MS,
          );
        }),
      ]);
    } catch (err) {
      return {
        available: true,
        operational: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timer);
    }

    return {
      available: res.available ?? true, // flag do recurso INTERNO propaga ⇒ esconde (D10)
      operational: res.operational,
      reason: res.reason,
    };
  }

  async resolveAll(
    roleName: string,
  ): Promise<Record<string, CapabilityStatus>> {
    const names = [...this.definitions.keys()];
    const results = await Promise.allSettled(
      names.map((name) => this.resolve(name, roleName)),
    );

    const out: Record<string, CapabilityStatus> = {};
    results.forEach((result, i) => {
      out[names[i]] =
        result.status === 'fulfilled'
          ? result.value
          : { available: true, operational: false };
    });
    return out;
  }
}
