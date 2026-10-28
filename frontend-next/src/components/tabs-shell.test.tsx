import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TabsShell } from './tabs-shell';

const mockSetTab = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-tab-param', () => ({
  useTabParam: () => ['active-tab', mockSetTab],
}));
vi.mock('@/components/ui/tabs', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Tabs: (props: any) => (
    <div
      data-testid="tabs"
      data-value={props.value}
      className={props.className}
      onClick={() => props.onValueChange('other-tab')}
    >
      {props.children}
    </div>
  ),
}));

describe('TabsShell', () => {
  it('passa o valor da aba e repassa onValueChange para o setter', () => {
    render(
      <TabsShell defaultTab="home">
        <span>conteudo</span>
      </TabsShell>,
    );

    const tabs = screen.getByTestId('tabs');
    expect(tabs).toHaveAttribute('data-value', 'active-tab');
    expect(tabs).toHaveClass('w-full');
    expect(screen.getByText('conteudo')).toBeInTheDocument();

    tabs.click();
    expect(mockSetTab).toHaveBeenCalledWith('other-tab');
  });

  it('aceita className extra', () => {
    render(
      <TabsShell defaultTab="home" className="extra">
        <span>conteudo</span>
      </TabsShell>,
    );

    expect(screen.getByTestId('tabs')).toHaveClass('w-full', 'extra');
  });
});
