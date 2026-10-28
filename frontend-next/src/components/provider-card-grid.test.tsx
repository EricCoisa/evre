import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import { ProviderCardGrid, type ProviderCardItem } from './provider-card-grid';

describe('ProviderCardGrid', () => {
  const mockProviders: ProviderCardItem[] = [
    {
      id: 'resend',
      name: 'Resend',
      description: 'Envio gerenciado de email',
      isActive: true,
      isConfigured: true,
    },
    {
      id: 'smtp',
      name: 'SMTP',
      description: 'Servidor dedicado',
      isActive: false,
      isConfigured: false,
    },
  ];

  it('renderiza os nomes e descrições dos provedores', () => {
    render(<ProviderCardGrid providers={mockProviders} />);

    expect(screen.getByText('Resend')).toBeInTheDocument();
    expect(screen.getByText('Envio gerenciado de email')).toBeInTheDocument();
    expect(screen.getByText('SMTP')).toBeInTheDocument();
    expect(screen.getByText('Servidor dedicado')).toBeInTheDocument();
  });

  it('exibe badge "Ativo" no provedor ativo e "Não configurado" no inativo', () => {
    render(<ProviderCardGrid providers={mockProviders} />);

    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByText('Não configurado')).toBeInTheDocument();
  });

  it('chama onConfigure com o ID do provedor ao clicar no botão Configurar', () => {
    const handleConfigure = vi.fn();
    render(<ProviderCardGrid providers={mockProviders} onConfigure={handleConfigure} />);

    const configButtons = screen.getAllByRole('button', { name: /configurar/i });
    expect(configButtons).toHaveLength(2);

    fireEvent.click(configButtons[0]);
    expect(handleConfigure).toHaveBeenCalledWith('resend');

    fireEvent.click(configButtons[1]);
    expect(handleConfigure).toHaveBeenCalledWith('smtp');
  });

  it('chama onActivate apenas para provedores configurados que não estão ativos', () => {
    const handleActivate = vi.fn();
    const configurableProviders: ProviderCardItem[] = [
      mockProviders[0],
      {
        ...mockProviders[1],
        isConfigured: true,
        canActivate: true,
      },
    ];

    render(
      <ProviderCardGrid
        providers={configurableProviders}
        onActivate={handleActivate}
        onConfigure={vi.fn()}
      />
    );

    const activateButton = screen.getByRole('button', { name: /ativar/i });
    expect(activateButton).toBeInTheDocument();
    expect(activateButton).not.toBeDisabled();

    fireEvent.click(activateButton);
    expect(handleActivate).toHaveBeenCalledWith('smtp');
  });

  it('desabilita o botão Ativar quando o provedor não estiver configurado ou validado', () => {
    const handleActivate = vi.fn();
    render(
      <ProviderCardGrid
        providers={mockProviders}
        onActivate={handleActivate}
        onConfigure={vi.fn()}
      />
    );

    const activateButton = screen.getByRole('button', { name: /ativar/i });
    expect(activateButton).toBeInTheDocument();
    expect(activateButton).toBeDisabled();

    fireEvent.click(activateButton);
    expect(handleActivate).not.toHaveBeenCalled();
  });

  it('sem isConfigured definido, não mostra badge nenhuma', () => {
    render(<ProviderCardGrid providers={[{ id: 'x', name: 'X', isActive: false }]} />);

    expect(screen.queryByText('Ativo')).not.toBeInTheDocument();
    expect(screen.queryByText('Configurado')).not.toBeInTheDocument();
    expect(screen.queryByText('Não configurado')).not.toBeInTheDocument();
  });

  it('renderiza ícone, badge de texto e rightSlot customizados', () => {
    render(
      <ProviderCardGrid
        providers={[
          {
            id: 'x', name: 'X', isActive: false,
            icon: <span data-testid="icon">ico</span>,
            badge: 'Beta',
            rightSlot: <span data-testid="right-slot">extra</span>,
          },
        ]}
      />,
    );

    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByTestId('right-slot')).toBeInTheDocument();
  });

  it('actionsSlot substitui completamente os botões padrão', () => {
    const handleConfigure = vi.fn();
    render(
      <ProviderCardGrid
        providers={[
          { id: 'x', name: 'X', isActive: false, actionsSlot: <button>Ação custom</button> },
        ]}
        onConfigure={handleConfigure}
      />,
    );

    expect(screen.getByRole('button', { name: 'Ação custom' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /configurar/i })).not.toBeInTheDocument();
  });

  it('sem onActivate e sem onConfigure, não renderiza nenhuma ação', () => {
    render(<ProviderCardGrid providers={[{ id: 'x', name: 'X', isActive: false }]} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('disabled no grid inteiro trava os botões mesmo quando o provedor pode ativar', () => {
    render(
      <ProviderCardGrid
        providers={[{ id: 'x', name: 'X', isActive: false, isConfigured: true, canActivate: true }]}
        onActivate={vi.fn()}
        onConfigure={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByRole('button', { name: /ativar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /configurar/i })).toBeDisabled();
  });

  it('disabled no provedor individual trava só aquele card', () => {
    render(
      <ProviderCardGrid
        providers={[{ id: 'x', name: 'X', isActive: false, isConfigured: true, canActivate: true, disabled: true }]}
        onActivate={vi.fn()}
        onConfigure={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /ativar/i })).toBeDisabled();
  });

  it('aceita labels customizados em vez dos traduzidos', () => {
    render(
      <ProviderCardGrid
        providers={[mockProviders[0]]}
        onConfigure={vi.fn()}
        configureLabel="Config custom"
        activeLabel="Ativo custom"
      />,
    );

    expect(screen.getByText('Ativo custom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Config custom' })).toBeInTheDocument();
  });

  it.each([
    [1, 'grid-cols-1'],
    [2, 'sm:grid-cols-2'],
    [4, 'lg:grid-cols-4'],
    [5, 'lg:grid-cols-3'], // valor inválido cai no padrão (columns=3)
  ] as const)('columns=%i aplica a classe %s', (columns, expectedClass) => {
    const { container } = render(<ProviderCardGrid providers={mockProviders} columns={columns as never} />);
    const grid = container.querySelector('.grid.gap-4')!;
    expect(grid).toHaveClass(expectedClass);
  });
});

