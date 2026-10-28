import { readFileSync } from 'fs';
import { join } from 'path';
import { notificationConfigKeys } from '../../domain/notification/notification-config.const';

const seed = readFileSync(
  join(__dirname, '../../../prisma/seeds/system-config.seed.ts'),
  'utf8',
);

/** Garante que as chaves de canal de notificação nascem como BOOLEAN ligada por padrão no seed. */
describe('seed — config de canal de notificação', () => {
  // seed.ts referencia `notificationConfigKeys.<prop>` em vez do labelKey literal (ver
  // docs/backend/notifications.md) — a busca textual acompanha essa forma.
  it.each(Object.entries(notificationConfigKeys))(
    'notificationConfigKeys.%s é seedada como BOOLEAN ligada por padrão',
    (prop, labelKey) => {
      const idx = seed.indexOf(`labelKey: notificationConfigKeys.${prop}`);
      expect(idx, `${labelKey} (notificationConfigKeys.${prop}) não está no seed`).toBeGreaterThan(-1);
      const open = seed.lastIndexOf('{', idx);
      const close = seed.indexOf('}', idx);
      const block = seed.slice(open, close);
      expect(block).toContain("valueType: 'BOOLEAN'");
      expect(block).toContain("value: 'true'");
    },
  );
});
