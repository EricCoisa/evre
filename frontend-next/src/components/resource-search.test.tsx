import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResourceSearch } from './resource-search';
import { useMe } from '@/lib/actions/auth/queries';
import { useCapabilities } from '@/lib/actions/capability/queries';
import { useMyFeatureFlags } from '@/lib/actions/feature-flag/queries';
import { useRouter } from 'next/navigation';
import type { UserRoute } from '@/lib/actions/auth/types';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: (ns: string) => ({ t: (key: string) => `${ns}:${key}` }),
}));

vi.mock('@/lib/actions/auth/queries', () => ({ useMe: vi.fn() }));
vi.mock('@/lib/actions/capability/queries', () => ({ useCapabilities: vi.fn() }));
vi.mock('@/lib/actions/feature-flag/queries', () => ({ useMyFeatureFlags: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));

vi.mock('@/lib/types/tabs.types', () => ({
  TabsList: [
    { path: '/user', tab: 'users', labelKey: 'tabUsers', labelNs: 'users' },
    { path: '/user', tab: 'flagged', labelKey: 'tabFlagged', labelNs: 'users', flag: 'FEATURE_X' },
  ],
}));

vi.mock('@/lib/types/configrows.types', () => ({
  ConfigRowsList: [{ id: 'SYSTEM_CAPTCHA_ENABLED', path: '/settings', tab: 'captchaConfig' }],
}));

vi.mock('@/lib/types/buttons.types', () => ({
  ButtonsList: [
    { id: 'btn-new-user', path: '/user', tab: 'users', labelKey: 'newUser', labelNs: 'users', icon: 'Plus' },
  ],
}));

function route(overrides: Partial<UserRoute>): UserRoute {
  return {
    id: 'r', path: '/x', labelKey: 'x', icon: null, parentId: null,
    ordem: 0, isHome: false, isActive: true, showSideBar: true,
    ...overrides,
  };
}

const routes: UserRoute[] = [
  route({ id: 'u1', path: '/user', labelKey: 'usersLabel' }),
  route({ id: 's1', path: '/settings', labelKey: 'settingsLabel', ordem: 1 }),
];

const push = vi.fn();

/** O highlight quebra o label num <span> com um <mark> no meio — getByText exato não casa texto partido.
 *  Restringe ao próprio <span class="truncate">, senão ancestrais com o mesmo textContent também casam. */
function byFullText(expected: string) {
  return (_: string, element: Element | null) =>
    element?.tagName === 'SPAN' && element.className.includes('truncate') && element.textContent === expected;
}

function setup({
  capabilities = {},
  flags = {},
}: {
  capabilities?: Record<string, { available?: boolean; operational?: boolean; reason?: string }>;
  flags?: Record<string, boolean>;
} = {}) {
  vi.mocked(useMe).mockReturnValue({ data: { routes } } as unknown as ReturnType<typeof useMe>);
  vi.mocked(useCapabilities).mockReturnValue({ data: capabilities } as unknown as ReturnType<typeof useCapabilities>);
  vi.mocked(useMyFeatureFlags).mockReturnValue({ data: flags } as unknown as ReturnType<typeof useMyFeatureFlags>);
  vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  return render(<ResourceSearch />);
}

describe('ResourceSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('desktop', () => {
    it('shows no popover before typing anything', () => {
      setup();
      expect(screen.queryByRole('button', { name: /usersLabel/ })).toBeNull();
    });

    it('filters registered routes by label, sorted alphabetically', async () => {
      const user = userEvent.setup();
      setup();
      await user.type(screen.getByPlaceholderText('search'), 'label');

      const options = screen.getAllByRole('button').filter((b) => b.textContent === 'settingsLabel' || b.textContent === 'usersLabel');
      expect(options.map((o) => o.textContent)).toEqual(['settingsLabel', 'usersLabel']);
    });

    it('highlights the matched substring inside a <mark>', async () => {
      const user = userEvent.setup();
      setup();
      await user.type(screen.getByPlaceholderText('search'), 'Label');

      const marks = screen.getAllByText('Label', { selector: 'mark' });
      expect(marks.length).toBeGreaterThan(0);
    });

    it('combines a capability result and a config-row result for the same query', async () => {
      const user = userEvent.setup();
      setup({ capabilities: { CAPTCHA: { available: true, operational: false, reason: 'falhou' } } });
      await user.type(screen.getByPlaceholderText('search'), 'captcha');

      expect(screen.getByText(byFullText('settingsLabel — CAPTCHA'))).toBeInTheDocument();
      expect(screen.getByText(byFullText('SYSTEM_CAPTCHA_ENABLED'))).toBeInTheDocument();
    });

    it('omits a capability result once it is operational again', async () => {
      const user = userEvent.setup();
      setup({ capabilities: { CAPTCHA: { available: true, operational: true } } });
      await user.type(screen.getByPlaceholderText('search'), 'captcha');

      expect(screen.queryByText(/settingsLabel.*CAPTCHA/)).toBeNull();
    });

    it('omits a capability result when its fix path is not one of the user accessible routes', async () => {
      const user = userEvent.setup();
      setup({
        capabilities: { CAPTCHA: { available: true, operational: false } },
      });
      vi.mocked(useMe).mockReturnValue({
        data: { routes: [route({ id: 'u1', path: '/user', labelKey: 'usersLabel' })] },
      } as unknown as ReturnType<typeof useMe>);
      await user.type(screen.getByPlaceholderText('search'), 'captcha');

      expect(screen.queryByText(/CAPTCHA/)).toBeNull();
    });

    it('includes a tab result combining the route label and the tab label', async () => {
      const user = userEvent.setup();
      setup();
      await user.type(screen.getByPlaceholderText('search'), 'tabusers');

      expect(screen.getByText(byFullText('usersLabel — users:tabUsers'))).toBeInTheDocument();
    });

    it('excludes a tab result gated behind a feature flag that is off', async () => {
      const user = userEvent.setup();
      setup({ flags: {} });
      await user.type(screen.getByPlaceholderText('search'), 'tabFlagged'.toLowerCase());

      expect(screen.queryByText(/tabFlagged/)).toBeNull();
    });

    it('includes a flagged tab result once the feature flag is on', async () => {
      const user = userEvent.setup();
      setup({ flags: { FEATURE_X: true } });
      await user.type(screen.getByPlaceholderText('search'), 'tabflagged');

      expect(screen.getByText(byFullText('usersLabel — users:tabFlagged'))).toBeInTheDocument();
    });

    it('includes a button result combining the route label and the action label', async () => {
      const user = userEvent.setup();
      setup();
      await user.type(screen.getByPlaceholderText('search'), 'newuser');

      expect(screen.getByText(byFullText('usersLabel — users:newUser'))).toBeInTheDocument();
    });

    it('navigates to the plain path on Enter, and clears the query', async () => {
      const user = userEvent.setup();
      setup();
      const input = screen.getByPlaceholderText('search');
      await user.type(input, 'usersLabel');
      await user.keyboard('{Enter}');

      expect(push).toHaveBeenCalledWith('/user');
      expect(input).toHaveValue('');
    });

    it('navigates to path#hash for a config-row result', async () => {
      const user = userEvent.setup();
      setup();
      await user.type(screen.getByPlaceholderText('search'), 'SYSTEM_CAPTCHA_ENABLED');
      await user.click(screen.getByText(byFullText('SYSTEM_CAPTCHA_ENABLED')).closest('button')!);

      expect(push).toHaveBeenCalledWith('/settings?tab=captchaConfig#SYSTEM_CAPTCHA_ENABLED');
    });

    it('clears the query on Escape', async () => {
      const user = userEvent.setup();
      setup();
      const input = screen.getByPlaceholderText('search');
      await user.type(input, 'usersLabel');
      await user.keyboard('{Escape}');

      expect(input).toHaveValue('');
    });
  });

  describe('mobile', () => {
    it('opens a dialog from the icon button, navigates on result click, and closes', async () => {
      const user = userEvent.setup();
      setup();

      await user.click(screen.getByLabelText('search'));
      const dialog = screen.getByRole('dialog');
      const input = within(dialog).getByPlaceholderText('search');
      await user.type(input, 'usersLabel');

      await user.click(within(dialog).getByRole('button', { name: 'usersLabel' }));
      expect(push).toHaveBeenCalledWith('/user');
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
