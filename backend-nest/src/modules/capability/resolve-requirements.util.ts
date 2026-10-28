import type { CapabilityRegistry } from './capability.registry';
import type { CapabilityStatus } from 'src/domain/capability/capability.types';

export interface RequirementsResult {
  hidden: boolean;
  disabled: boolean;
  /** Só para ADMIN — pode conter erro de provider. */
  reason?: string;
  /** Nome da primeira capability que falhou. O front monta `capability.<NOME>.unavailable`
   *  quando `reason` não vem (viewer não-ADMIN), e resolve a rota de conserto por conta própria
   *  (ver `CAPABILITY_FIX_PATH` no front — rota é decisão de layout do front, não do backend). */
  capability?: string;
}

/** Sem requisito para `labelKey` ⇒ `undefined` (campo ausente no JSON). */
export function resolveRequirements(
  labelKey: string,
  registry: CapabilityRegistry,
  capabilityMap: Record<string, CapabilityStatus>,
  viewerRole: string,
): RequirementsResult | undefined {
  const required = registry.requirementsFor(labelKey);
  if (required.length === 0) return undefined;

  const isAdmin = viewerRole === 'ADMIN';
  let hidden = false;
  let disabled = false;
  let reason: string | undefined;
  let capability: string | undefined;

  for (const name of required) {
    const status = capabilityMap[name] ?? {
      available: true,
      operational: true,
    };
    if (!status.available) hidden = true;
    if (!status.operational) {
      disabled = true;
      if (capability === undefined) {
        capability = name;
        if (isAdmin) {
          reason = status.reason;
        }
      }
    }
  }

  return { hidden, disabled, reason, capability };
}
