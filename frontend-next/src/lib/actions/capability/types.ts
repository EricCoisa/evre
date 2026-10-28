/** Espelha `CapabilityStatus` do backend (src/domain/capability/capability.types.ts). */
export interface CapabilityStatus {
  /** Flags exigidas estão ON para a role. false ⇒ esconder. */
  available: boolean;
  /** Configurado e respondendo. false ⇒ desabilitar. */
  operational: boolean;
  /** Só para ADMIN — pode conter erro de provider. */
  reason?: string;
}
