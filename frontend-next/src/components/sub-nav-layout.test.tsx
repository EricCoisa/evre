import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import { SubNavLayout, type SubNavSection, TabsContent } from './sub-nav-layout';

describe('SubNavLayout', () => {
  const mockSections: SubNavSection[] = [
    {
      title: 'Geral',
      items: [
        { id: 'general-1', label: 'Item 1' },
        { id: 'general-2', label: 'Item 2', hidden: true },
      ],
    },
    {
      title: 'Avançado',
      items: [
        { id: 'advanced-1', label: 'Item Avançado' },
      ],
    },
  ];

  it('renderiza os títulos das seções e os itens visíveis', () => {
    render(
      <SubNavLayout sections={mockSections} defaultTab="general-1">
        <TabsContent value="general-1">Conteúdo Geral 1</TabsContent>
        <TabsContent value="advanced-1">Conteúdo Avançado 1</TabsContent>
      </SubNavLayout>
    );

    expect(screen.getByText('Geral')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /item 1/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /item 2/i })).not.toBeInTheDocument();
    expect(screen.getByText('Avançado')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /item avançado/i })).toBeInTheDocument();
    expect(screen.getByText('Conteúdo Geral 1')).toBeInTheDocument();
  });

  it('alterna o conteúdo ao selecionar outro item da navegação', () => {
    render(
      <SubNavLayout sections={mockSections} defaultTab="general-1">
        <TabsContent value="general-1">Conteúdo Geral 1</TabsContent>
        <TabsContent value="advanced-1">Conteúdo Avançado 1</TabsContent>
      </SubNavLayout>
    );

    const advancedTrigger = screen.getByRole('tab', { name: /item avançado/i });
    fireEvent.mouseDown(advancedTrigger, { button: 0 });

    expect(screen.getByText('Conteúdo Avançado 1')).toBeInTheDocument();
  });

  it('renderiza ícone e badge do item, e reflete o item ativo no gatilho mobile', () => {
    const sections: SubNavSection[] = [
      {
        title: 'Geral',
        items: [{ id: 'general-1', label: 'Item 1', icon: <span data-testid="icon">ico</span>, badge: <span data-testid="badge">3</span> }],
      },
    ];
    const { container } = render(
      <SubNavLayout sections={sections} defaultTab="general-1">
        <TabsContent value="general-1">Conteúdo</TabsContent>
      </SubNavLayout>,
    );

    // Ícone/badge no item da sidebar desktop + ícone no gatilho mobile (item ativo)
    expect(screen.getAllByTestId('icon').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('badge').length).toBeGreaterThanOrEqual(1);
    const mobileTrigger = container.querySelector('#sub-nav-mobile-trigger')!;
    expect(mobileTrigger).toHaveTextContent('Item 1');
  });

  it('seção sem título não renderiza cabeçalho; seção com todos os itens ocultos não renderiza nada', () => {
    const sections: SubNavSection[] = [
      { items: [{ id: 'a', label: 'Item A' }] },
      { title: 'Oculta', items: [{ id: 'b', label: 'Item B', hidden: true }] },
    ];
    render(
      <SubNavLayout sections={sections} defaultTab="a">
        <TabsContent value="a">Conteúdo A</TabsContent>
      </SubNavLayout>,
    );

    expect(screen.getByRole('tab', { name: /item a/i })).toBeInTheDocument();
    expect(screen.queryByText('Oculta')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /item b/i })).not.toBeInTheDocument();
  });

  it('com tab/onTabChange controlados, clicar não muda o estado interno — só avisa o pai', () => {
    const sections: SubNavSection[] = [
      { items: [{ id: 'general-1', label: 'Item 1' }, { id: 'advanced-1', label: 'Item Avançado' }] },
    ];
    const onTabChange = vi.fn();

    render(
      <SubNavLayout sections={sections} defaultTab="general-1" tab="advanced-1" onTabChange={onTabChange}>
        <TabsContent value="general-1">Conteúdo Geral</TabsContent>
        <TabsContent value="advanced-1">Conteúdo Avançado</TabsContent>
      </SubNavLayout>,
    );

    expect(screen.getByText('Conteúdo Avançado')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /item 1/i }), { button: 0 });

    expect(onTabChange).toHaveBeenCalledWith('general-1');
    // O conteúdo não muda porque a aba é controlada externamente e continua "advanced-1"
    expect(screen.getByText('Conteúdo Avançado')).toBeInTheDocument();
  });

  it('sidebarHidden não renderiza a sidebar desktop, e a troca de aba continua funcionando pelo drawer mobile', () => {
    const sections: SubNavSection[] = [
      { items: [{ id: 'a', label: 'Item A' }, { id: 'b', label: 'Item B' }] },
    ];
    const { container } = render(
      <SubNavLayout sections={sections} defaultTab="a" sidebarHidden>
        <TabsContent value="a">Conteúdo A</TabsContent>
        <TabsContent value="b">Conteúdo B</TabsContent>
      </SubNavLayout>,
    );

    expect(container.querySelector('aside')).not.toBeInTheDocument();
    expect(screen.getByText('Conteúdo A')).toBeInTheDocument();

    fireEvent.click(container.querySelector('#sub-nav-mobile-trigger')!);
    fireEvent.click(screen.getByRole('button', { name: 'Item B' }));

    expect(screen.getByText('Conteúdo B')).toBeInTheDocument();
  });
});
