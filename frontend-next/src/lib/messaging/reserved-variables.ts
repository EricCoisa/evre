import { ReservedVariable } from '@/lib/actions/messaging/types';

/** Devolve o valor fictício da variável reservada para o preview, ou o nome entre colchetes se ausente. */
export function getReservedDummyValue(variable: ReservedVariable): string {
  return variable.dummy || `[${variable.name}]`;
}
