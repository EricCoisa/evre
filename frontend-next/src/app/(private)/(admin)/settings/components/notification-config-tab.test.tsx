import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@/test-utils';
import { NotificationConfig } from './notification-config-tab';
import type { ConfigurationRequirements } from '@/types/capabilities';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

interface SysConfig {
  id: string;
  labelKey: string;
  valueType: string;
  value: string;
  blocked?: boolean;
  requirements?: ConfigurationRequirements;
}

const mocks = vi.hoisted(() => ({
  configs: {} as Record<string, SysConfig>,
  updateMutateAsync: vi.fn(),
  userRole: null as string | null,
}));

vi.mock('@/lib/actions/auth/queries', () => ({
  useMe: () => ({
    data: mocks.userRole ? { role: mocks.userRole } : null,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/lib/actions/systemConfiguration/queries', () => ({
  useConfiguration: (labelKey: string) => ({ data: mocks.configs[labelKey] }),
  useUpdateConfiguration: () => ({
    mutateAsync: mocks.updateMutateAsync,
    isPending: false,
  }),
}));

function sysConfig(overrides: Partial<SysConfig>): SysConfig {
  return { id: 'id', labelKey: 'KEY', valueType: 'BOOLEAN', value: 'true', ...overrides };
}

describe('NotificationConfig', () => {
  beforeEach(() => {
    mocks.userRole = null;
    mocks.updateMutateAsync.mockClear();
    mocks.configs = {
      SYSTEM_NOTIFICATION_EMAIL_ENABLED: sysConfig({
        id: 'email-cfg',
        labelKey: 'SYSTEM_NOTIFICATION_EMAIL_ENABLED',
        value: 'true',
      }),
      SYSTEM_NOTIFICATION_WHATSAPP_ENABLED: sysConfig({
        id: 'whatsapp-cfg',
        labelKey: 'SYSTEM_NOTIFICATION_WHATSAPP_ENABLED',
        value: 'false',
      }),
    };
  });

  it('providers configurados: os switches ficam habilitados e alternáveis', () => {
    render(<NotificationConfig />);

    const emailRow = screen.getByText('channel_toggle_email').parentElement?.parentElement;
    const whatsappRow = screen.getByText('channel_toggle_whatsapp').parentElement?.parentElement;
    const emailSwitch = within(emailRow!).getByRole('switch');
    const whatsappSwitch = within(whatsappRow!).getByRole('switch');

    expect(emailSwitch).not.toBeDisabled();
    expect(whatsappSwitch).not.toBeDisabled();

    fireEvent.click(emailSwitch);
    expect(mocks.updateMutateAsync).toHaveBeenCalledWith({
      systemConfiguration: expect.objectContaining({ id: 'email-cfg', value: 'false' }),
    });
  });

  it('EMAIL não operacional: switch de email fica desabilitado e mostra a dica no popover', () => {
    mocks.configs.SYSTEM_NOTIFICATION_EMAIL_ENABLED.requirements = {
      hidden: false,
      disabled: true,
      capability: 'EMAIL',
    };

    render(<NotificationConfig />);

    const emailRow = screen.getByText('channel_toggle_email').parentElement?.parentElement;
    const whatsappRow = screen.getByText('channel_toggle_whatsapp').parentElement?.parentElement;
    expect(within(emailRow!).getByRole('switch')).toBeDisabled();
    expect(within(whatsappRow!).getByRole('switch')).not.toBeDisabled();

    const warningTrigger = within(emailRow!).getByRole('button', { name: 'capability.EMAIL.unavailable' });
    expect(warningTrigger).toBeInTheDocument();

    fireEvent.click(warningTrigger);
    expect(screen.getByText('capability.EMAIL.unavailable')).toBeInTheDocument();
  });

  it('MESSAGING não operacional: switch de WhatsApp fica desabilitado e mostra a dica no popover', () => {
    mocks.configs.SYSTEM_NOTIFICATION_WHATSAPP_ENABLED.requirements = {
      hidden: false,
      disabled: true,
      capability: 'MESSAGING',
    };

    render(<NotificationConfig />);

    const emailRow = screen.getByText('channel_toggle_email').parentElement?.parentElement;
    const whatsappRow = screen.getByText('channel_toggle_whatsapp').parentElement?.parentElement;
    expect(within(whatsappRow!).getByRole('switch')).toBeDisabled();
    expect(within(emailRow!).getByRole('switch')).not.toBeDisabled();

    const warningTrigger = within(whatsappRow!).getByRole('button', { name: 'capability.MESSAGING.unavailable' });
    expect(warningTrigger).toBeInTheDocument();

    fireEvent.click(warningTrigger);
    expect(screen.getByText('capability.MESSAGING.unavailable')).toBeInTheDocument();
  });

  it('usuário sem permissão de configuração (role: USER): switch fica desabilitado mas NÃO exibe botão/ícone de warn', () => {
    mocks.userRole = 'USER';
    mocks.configs.SYSTEM_NOTIFICATION_EMAIL_ENABLED.requirements = {
      hidden: false,
      disabled: true,
      capability: 'EMAIL',
    };

    render(<NotificationConfig />);

    const emailRow = screen.getByText('channel_toggle_email').parentElement?.parentElement;
    expect(within(emailRow!).getByRole('switch')).toBeDisabled();

    const warningTrigger = within(emailRow!).queryByRole('button', { name: /capability/i });
    expect(warningTrigger).not.toBeInTheDocument();
  });
});
