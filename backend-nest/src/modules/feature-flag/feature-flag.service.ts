import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/infrastructure/redis/redis.service';
import {
  FeatureFlagInclude,
  type FeatureFlagWithRoles,
} from 'src/domain/feature-flag/feature-flag.entity';

const CACHE_KEY = 'feature-flags:all';
const CACHE_TTL = 300; // 5 min

/** Profundidade máxima da cadeia de parentId (raiz = nível 1). Cap de segurança, não pedido de negócio. */
const MAX_DEPTH = 5;

/** Avaliação e cache: o que o FeatureFlagGuard consome. CRUD mora nos use-cases. */
@Injectable()
export class FeatureFlagService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly i18n: I18nService,
  ) {}

  // ── cache ─────────────────────────────────────────────────────

  /** Público: os use-cases de escrita derrubam o cache. */
  async invalidate(): Promise<void> {
    await this.redis.del(CACHE_KEY);
  }

  private async allFlags(): Promise<FeatureFlagWithRoles[]> {
    const raw = await this.redis.get(CACHE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as FeatureFlagWithRoles[];
      } catch {
        // entrada corrompida — cai no banco
      }
    }

    const flags = await this.prisma.featureFlag.findMany({
      include: FeatureFlagInclude,
      orderBy: { key: 'asc' },
    });

    await this.redis.set(CACHE_KEY, JSON.stringify(flags), CACHE_TTL);
    return flags;
  }

  /** A lista cacheada; compartilhada com a avaliação, por isso vive aqui. */
  findAll(): Promise<FeatureFlagWithRoles[]> {
    return this.allFlags();
  }

  // ── avaliação ─────────────────────────────────────────────────

  /** Avalia cada flag para a role: enabled=false desliga; enabled=true liga para todos, ou só para roles na allowlist. Flag filha também exige o pai ligado. */
  async evaluateForRole(roleName: string): Promise<Record<string, boolean>> {
    const flags = await this.allFlags();
    const byId = this.indexById(flags);

    const result: Record<string, boolean> = {};
    for (const flag of flags) {
      result[flag.key] = this.evaluate(flag, roleName, byId);
    }
    return result;
  }

  async isEnabled(key: string, roleName: string): Promise<boolean> {
    const flags = await this.allFlags();
    const flag = flags.find((f) => f.key === key);
    if (!flag) return false;
    return this.evaluate(flag, roleName, this.indexById(flags));
  }

  private indexById(
    flags: FeatureFlagWithRoles[],
  ): Map<string, FeatureFlagWithRoles> {
    return new Map(flags.map((f) => [f.id, f]));
  }

  /** Avalia a flag exigindo também o pai ligado, subindo a cadeia de parentId. */
  private evaluate(
    flag: FeatureFlagWithRoles,
    roleName: string,
    byId: Map<string, FeatureFlagWithRoles>,
    depth = 0,
  ): boolean {
    if (!flag.enabled) return false;
    // Flags marcadas como isSystem operam para toda a aplicação (ex.: webhooks, OAuth, rotas públicas/sistema)
    if (
      !flag.isSystem &&
      flag.roles.length > 0 &&
      !flag.roles.some((r) => r.role.name === roleName)
    ) {
      return false;
    }
    if (!flag.parentId) return true;
    if (depth + 1 >= MAX_DEPTH) return false;

    const parent = byId.get(flag.parentId);
    if (!parent) return false;
    return this.evaluate(parent, roleName, byId, depth + 1);
  }

  // ── hierarquia (escrita) ─────────────────────────────────────

  /** Valida um parentId proposto para flagId, rejeitando auto-referência, pai inexistente, ciclo e profundidade acima de MAX_DEPTH. */
  async assertValidParent(
    flagId: string | null,
    parentId: string | null | undefined,
  ): Promise<void> {
    if (!parentId) return;

    if (parentId === flagId) {
      throw new ConflictException(this.i18n.t('feature_flag.self_parent'));
    }

    const flags = await this.allFlags();
    const byId = this.indexById(flags);
    const parent = byId.get(parentId);
    if (!parent) {
      throw new NotFoundException(this.i18n.t('feature_flag.parent_not_found'));
    }

    let depth = 1; // parent = nível 1
    let current: FeatureFlagWithRoles | undefined = parent;
    while (current) {
      if (current.id === flagId) {
        throw new ConflictException(this.i18n.t('feature_flag.cycle_detected'));
      }
      if (depth > MAX_DEPTH) {
        // corrente já corrompida além do teto (fora do fluxo normal) — nega em vez de girar para sempre
        throw new ConflictException(
          this.i18n.t('feature_flag.max_depth_exceeded'),
        );
      }
      if (!current.parentId) break;
      current = byId.get(current.parentId);
      depth++;
    }

    const subtreeHeight = flagId ? this.subtreeHeight(flagId, flags) : 0;
    if (depth + 1 + subtreeHeight > MAX_DEPTH) {
      throw new ConflictException(
        this.i18n.t('feature_flag.max_depth_exceeded'),
      );
    }
  }

  /** Maior distância (em nós) de `flagId` até uma folha na sua subárvore atual — 0 se não tem filhos. */
  private subtreeHeight(flagId: string, flags: FeatureFlagWithRoles[]): number {
    const children = flags.filter((f) => f.parentId === flagId);
    if (children.length === 0) return 0;
    return (
      1 + Math.max(...children.map((c) => this.subtreeHeight(c.id, flags)))
    );
  }
}
