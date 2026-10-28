import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import {
  PAGE_SOURCE_KEY,
  type PageSourceEntry,
} from 'src/domain/page-builder/page-source.types';

/** Catálogo das fontes de dados liberadas para o PageBuilder, derivado em runtime dos endpoints marcados com pageSource. */
@Injectable()
export class PageSourceRegistry implements OnModuleInit {
  private readonly logger = new Logger(PageSourceRegistry.name);
  private readonly sources = new Map<string, PageSourceEntry>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    for (const wrapper of this.discovery.getControllers()) {
      const instance = wrapper.instance as object | null;
      if (!instance) continue;
      const prototype = Object.getPrototypeOf(instance) as object;
      for (const methodName of this.metadataScanner.getAllMethodNames(
        prototype,
      )) {
        const entry = this.reflector.get<PageSourceEntry | undefined>(
          PAGE_SOURCE_KEY,
          (instance as Record<string, () => unknown>)[methodName],
        );
        if (!entry) continue;
        if (this.sources.has(entry.key)) {
          throw new Error(`PageSource duplicada: ${entry.key}`);
        }
        this.sources.set(entry.key, entry);
      }
    }
    this.logger.log(`PageSourceRegistry: ${this.sources.size} fonte(s)`);
  }

  /** Só as fontes que este role consegue chamar — evita bloco salvo que responde 403. */
  listForRole(roleName: string): PageSourceEntry[] {
    return [...this.sources.values()].filter(
      (s) => s.roles.length === 0 || s.roles.includes(roleName),
    );
  }

  has(key: string): boolean {
    return this.sources.has(key);
  }

  getKind(key: string): PageSourceEntry['kind'] | undefined {
    return this.sources.get(key)?.kind;
  }

  get(key: string): PageSourceEntry | undefined {
    return this.sources.get(key);
  }
}
