export interface CapabilityStatus {
  /** Flags exigidas estão ON para a role. false ⇒ esconder. */
  available: boolean;
  /** Configurado e respondendo. false ⇒ desabilitar. */
  operational: boolean;
  /** Só para ADMIN — pode conter erro de provider. */
  reason?: string;
}

/** O que um check devolve; available só vem preenchido quando delega a outro recurso. */
export interface CapabilityCheckResult {
  operational: boolean;
  reason?: string;
  available?: boolean;
}

export type CapabilityCheck = (ctx: {
  /** Delega a outro recurso mantendo a guarda de profundidade. */
  resolve: (name: string) => Promise<CapabilityStatus>;
}) => Promise<CapabilityCheckResult>;

export interface CapabilityDefinition {
  flags: string[];
  check: CapabilityCheck;
}
