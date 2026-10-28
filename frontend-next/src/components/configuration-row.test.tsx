import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test-utils';
import { ConfigurationRow } from './configuration-row';

const mocks = vi.hoisted(() => ({
  userRole: null as string | null,
}));

vi.mock('@/lib/actions/auth/queries', () => ({
  useMe: () => ({
    data: mocks.userRole ? { role: mocks.userRole } : null,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

function MockChild(props: { disabled?: boolean; warning?: boolean; warningReason?: React.ReactNode }) {
  return (
    <div>
      <span data-testid="child-disabled">{String(props.disabled ?? false)}</span>
      <span data-testid="child-warning">{String(props.warning ?? false)}</span>
      <span data-testid="child-reason">{String(props.warningReason ?? '')}</span>
    </div>
  );
}

describe('ConfigurationRow — comportamento de disableOnRequirement e warn por perfil', () => {
  beforeEach(() => {
    mocks.userRole = null;
  });

  it('SystemConfiguration padrão (disableOnRequirement: true): desabilita o filho se o requisito estiver indisponível', () => {
    render(
      <ConfigurationRow
        title="Canal de Email do Sistema"
        requirements={{
          hidden: false,
          disabled: true,
          capability: 'EMAIL',
        }}
      >
        <MockChild />
      </ConfigurationRow>
    );

    expect(screen.getByTestId('child-disabled').textContent).toBe('true');
  });

  it('UserConfiguration (disableOnRequirement: false): NÃO desabilita o filho apesar da indisponibilidade, permitindo alteração', () => {
    render(
      <ConfigurationRow
        title="Preferência de Notificação por Email"
        disableOnRequirement={false}
        requirements={{
          hidden: false,
          disabled: true,
          capability: 'EMAIL',
        }}
      >
        <MockChild />
      </ConfigurationRow>
    );

    // O filho permanece habilitado para o usuário alterar a configuração apesar da indisponibilidade
    expect(screen.getByTestId('child-disabled').textContent).toBe('false');
  });

  it('usuário sem permissão (role: USER): NÃO recebe warning no filho mesmo com requisito indisponível', () => {
    mocks.userRole = 'USER';

    render(
      <ConfigurationRow
        title="Preferência de Notificação"
        disableOnRequirement={false}
        requirements={{
          hidden: false,
          disabled: true,
          capability: 'EMAIL',
        }}
      >
        <MockChild />
      </ConfigurationRow>
    );

    expect(screen.getByTestId('child-disabled').textContent).toBe('false');
    expect(screen.getByTestId('child-warning').textContent).toBe('false');
  });

  it('usuário administrador (role: ADMIN): recebe warning no filho se o requisito estiver indisponível', () => {
    mocks.userRole = 'ADMIN';

    render(
      <ConfigurationRow
        title="Preferência de Notificação"
        disableOnRequirement={false}
        requirements={{
          hidden: false,
          disabled: true,
          capability: 'EMAIL',
          reason: 'Serviço de email indisponível',
        }}
      >
        <MockChild />
      </ConfigurationRow>
    );

    // O controle do usuário permanece habilitado para alteração
    expect(screen.getByTestId('child-disabled').textContent).toBe('false');
    // Mas o admin recebe o warning para saber que a infraestrutura está pendente
    expect(screen.getByTestId('child-warning').textContent).toBe('true');
    expect(screen.getByTestId('child-reason').textContent).toBe('Serviço de email indisponível');
  });

  it('requirements.hidden: a linha inteira não renderiza nada', () => {
    render(
      <ConfigurationRow title="Linha oculta" requirements={{ hidden: true }}>
        <MockChild />
      </ConfigurationRow>
    );

    expect(screen.queryByText('Linha oculta')).toBeNull();
    expect(screen.queryByTestId('child-disabled')).toBeNull();
  });

  it('admin sem reason explícito mas com capability traduzida: usa capability.<nome>.unavailable', () => {
    mocks.userRole = 'ADMIN';

    render(
      <ConfigurationRow
        title="Notificações por email"
        disableOnRequirement={false}
        requirements={{ disabled: true, capability: 'EMAIL' }}
      >
        <MockChild />
      </ConfigurationRow>
    );

    // t() está mockado para devolver a própria chave — confirma que a chave específica foi escolhida
    expect(screen.getByTestId('child-reason').textContent).toBe('capability.EMAIL.unavailable');
  });

  it('admin sem reason e sem tradução específica para a capability: cai no fallback genérico', () => {
    mocks.userRole = 'ADMIN';

    render(
      <ConfigurationRow
        title="Recurso desconhecido"
        disableOnRequirement={false}
        requirements={{ disabled: true, capability: 'UNKNOWN_CAPABILITY' }}
      >
        <MockChild />
      </ConfigurationRow>
    );

    expect(screen.getByTestId('child-reason').textContent).toBe('capability.unavailable');
  });

  it('BUG conhecido (configuration-row.tsx:78): children não-ReactElement lança, pois `children.props.disabled` é lido sem guarda de isValidElement (a guarda só existe depois, no cloneElement)', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <ConfigurationRow title="Linha com texto puro" requirements={{ disabled: true }}>
          {'texto puro' as unknown as React.ReactElement}
        </ConfigurationRow>
      )
    ).toThrow();

    consoleErrorSpy.mockRestore();
  });
});

