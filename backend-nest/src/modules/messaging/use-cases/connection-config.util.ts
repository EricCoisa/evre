import type { IMessagingService } from 'src/domain/interface/messaging-provider.interface';
import type { PlainConfig } from '../messaging-connection.service';

/** Config em texto claro do formulário, com os campos gerados pelo sistema (`systemFields?`) sobrepostos. */
export function buildConfig(
  adapter: IMessagingService<unknown>,
  input: object,
  previous?: PlainConfig,
): PlainConfig {
  const config: PlainConfig = {};
  for (const field of adapter.configFields) {
    const rawSent = (input as Record<string, unknown>)[field];
    const sent = typeof rawSent === 'string' ? rawSent.trim() : '';
    const kept = previous?.[field];
    const value = sent || kept;
    if (value) config[field] = value;
  }

  Object.assign(config, adapter.systemFields?.(previous));
  return config;
}
