import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeToggle } from './theme-toggle';

const mocks = vi.hoisted(() => ({
  theme: 'light',
  setThemeSpy: vi.fn(),
  configData: { id: '1', value: 'light' } as { id: string; value: string } | undefined,
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  mounted: true,
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: mocks.theme,
    setTheme: (value: string) => {
      mocks.theme = value;
      mocks.setThemeSpy(value);
    },
  }),
}));

vi.mock('@/lib/actions/userConfiguration/queries', () => ({
  useUserConfiguration: () => ({ data: mocks.configData }),
  useSetUserConfiguration: () => ({ mutateAsync: mocks.mutateAsync }),
}));

vi.mock('@/hooks/use-has-mounted', () => ({ useHasMounted: () => mocks.mounted }));

describe('ThemeToggle', () => {
  it('clicar alterna e o valor não reverte quando a query de config refaz o fetch', async () => {
    mocks.theme = 'light';
    mocks.configData = { id: '1', value: 'light' };
    mocks.setThemeSpy.mockClear();

    const { rerender } = render(<ThemeToggle />);
    expect(mocks.setThemeSpy).toHaveBeenCalledTimes(1);
    expect(mocks.setThemeSpy).toHaveBeenLastCalledWith('light');

    const button = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(button);
    });
    expect(mocks.setThemeSpy).toHaveBeenCalledTimes(2);
    expect(mocks.setThemeSpy).toHaveBeenLastCalledWith('dark');

    mocks.configData = { id: '1', value: 'light' };
    rerender(<ThemeToggle />);

    expect(mocks.setThemeSpy).toHaveBeenCalledTimes(2);
    expect(mocks.theme).toBe('dark');
  });

  it('antes de montar, não renderiza nada', () => {
    mocks.mounted = false;
    const { container } = render(<ThemeToggle />);

    expect(container).toBeEmptyDOMElement();
    mocks.mounted = true;
  });

  it('tema dark mostra o ícone de sol', () => {
    mocks.theme = 'dark';
    mocks.configData = { id: '1', value: 'dark' };
    render(<ThemeToggle />);

    expect(document.querySelector('.lucide-sun')).toBeInTheDocument();
    expect(document.querySelector('.lucide-moon')).not.toBeInTheDocument();
  });

  it('sem configuração salva (sem id): troca o tema localmente sem chamar a mutação', async () => {
    mocks.theme = 'light';
    mocks.configData = undefined;
    mocks.mutateAsync.mockClear();

    render(<ThemeToggle />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(mocks.theme).toBe('dark');
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('se salvar a preferência falhar, mantém o tema trocado e não propaga o erro', async () => {
    mocks.theme = 'light';
    mocks.configData = { id: '1', value: 'light' };
    mocks.mutateAsync.mockRejectedValueOnce(new Error('network error'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ThemeToggle />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(mocks.theme).toBe('dark');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
