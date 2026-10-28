import { readFileSync } from 'fs';
import { join } from 'path';

const flagsSeed = readFileSync(
  join(__dirname, '../../../prisma/seeds/feature-flags.seed.ts'),
  'utf8',
);
const routesSeed = readFileSync(
  join(__dirname, '../../../prisma/seeds/routes.seed.ts'),
  'utf8',
);
const seed = `${flagsSeed}\n${routesSeed}`;

/** As flags de mensageria dependem de não ter allowlist de role para o kill-switch valer no webhook anônimo. */
describe('seed — flags de mensageria', () => {
  it('MESSAGING é seedada', () => {
    expect(seed).toContain("key: 'MESSAGING'");
    expect(seed).toContain("key: 'MESSAGING_CONTACTS'");
    expect(seed).toContain("key: 'MESSAGING_CHAT'");
  });

  // Se este teste falhar, alguém associou role à flag e o inbound vai parar sem erro visível.
  it('nenhuma featureFlagRole é criada para MESSAGING', () => {
    const idx = seed.indexOf("key: 'MESSAGING'");
    const afterFlag = seed.slice(idx, idx + 1200);
    expect(afterFlag).not.toMatch(/featureFlagRole[\s\S]*MESSAGING/);
    expect(afterFlag.slice(0, 600)).not.toContain('roleMap');
  });

  it('a flag MESSAGING é marcada como isSystem', () => {
    const block = seed.slice(
      seed.indexOf("key: 'MESSAGING'"),
      seed.indexOf("key: 'MESSAGING'") + 500,
    );
    expect(block).toMatch(/isSystem:\s*true/);
  });

  it('sub-flags apontam para MESSAGING e não criam allowlist de roles', () => {
    for (const key of ['MESSAGING_CONTACTS', 'MESSAGING_CHAT']) {
      const idx = seed.indexOf(`key: '${key}'`);
      const block = seed.slice(idx, idx + 500);
      expect(block).toContain('parentId: messagingRootFlag.id');
      expect(block).not.toContain('roleMap');
      expect(block).not.toContain('featureFlagRole');
    }
  });

  it('rota /comunicacao é incluída somente na lista ADMIN', () => {
    const idx = seed.indexOf('where: { path: RoutePathConst.COMMUNICATION }');
    expect(idx).toBeGreaterThanOrEqual(0);
    const routeBlock = seed.slice(idx, idx + 400);
    expect(routeBlock).toContain("labelKey: 'ROUTE_COMMUNICATION'");
    const admin = seed.slice(
      seed.indexOf('const adminRoutes'),
      seed.indexOf('const moderatorRoutes'),
    );
    expect(admin).toContain('communicationRoute');
    expect(
      seed.slice(
        seed.indexOf('const moderatorRoutes'),
        seed.indexOf('const userRoutes'),
      ),
    ).not.toContain('communicationRoute');
  });
});
