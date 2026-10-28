import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import type { FormBuilderField } from '@/components/form/form-builder';
import { AiProviderConfig } from './ai-provider-config';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}));

const mocks = vi.hoisted(() => ({ registerTour: vi.fn() }));
vi.mock('@/components/tour', () => ({
  useTour: () => ({ registerTour: mocks.registerTour }),
  HelpButton: ({ tourId, startDirect }: { tourId: string; startDirect?: boolean }) => (
    <button data-testid="help-button" data-tour-id={tourId} data-start-direct={String(!!startDirect)}>
      help
    </button>
  ),
  ignoreTourInteraction: () => {},
}));

vi.mock('@/components/form/form-builder', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FormBuilder: (props: any) => (
    <div data-testid="form-builder">
      <span data-testid="submit-label">{props.submitLabel}</span>
      <button onClick={() => props.onSubmit(props.values)}>submit-form</button>
      <button onClick={props.onCancel}>cancel-form</button>
    </div>
  ),
}));

const schema = z.object({ apiKey: z.string() });
const fields: FormBuilderField[] = [{ name: 'apiKey', label: 'Chave' }];
const labelFor = (provider: string) => `label:${provider}`;

function baseProps(overrides: Partial<Parameters<typeof AiProviderConfig>[0]> = {}) {
  return {
    title: 'Provedor de IA',
    description: 'Descrição genérica',
    options: ['ANTHROPIC', 'OPENAI'],
    active: 'ANTHROPIC',
    editing: null,
    onEdit: vi.fn(),
    onActivate: vi.fn(),
    labelFor,
    schema,
    fields,
    values: {},
    onSubmit: vi.fn().mockResolvedValue(undefined),
    submitLabel: 'Salvar',
    ...overrides,
  };
}

beforeEach(() => {
  mocks.registerTour.mockClear();
});

describe('AiProviderConfig', () => {
  it('renderiza título, descrição e um card por provider com o label traduzido', () => {
    render(<AiProviderConfig {...baseProps()} />);

    expect(screen.getByText('Provedor de IA')).toBeInTheDocument();
    expect(screen.getAllByText('Descrição genérica').length).toBeGreaterThan(0);
    expect(screen.getByText('label:ANTHROPIC')).toBeInTheDocument();
    expect(screen.getByText('label:OPENAI')).toBeInTheDocument();
  });

  it('usa a description genérica no card quando não há tradução específica do provider', () => {
    render(<AiProviderConfig {...baseProps()} />);
    expect(screen.getAllByText('Descrição genérica').length).toBeGreaterThan(1);
  });

  it('marca o provider ativo com o badge e chama onActivate para os demais', async () => {
    const onActivate = vi.fn();
    render(<AiProviderConfig {...baseProps({ onActivate })} />);

    expect(screen.getByText('provider_active')).toBeInTheDocument();

    const activateButtons = screen.getAllByRole('button', { name: 'provider_activate' });
    expect(activateButtons).toHaveLength(1);
    await userEvent.click(activateButtons[0]);
    expect(onActivate).toHaveBeenCalledWith('OPENAI');
  });

  it('chama onEdit com o id do provider ao clicar em Configurar', async () => {
    const onEdit = vi.fn();
    render(<AiProviderConfig {...baseProps({ onEdit })} />);

    const configureButtons = screen.getAllByRole('button', { name: 'provider_configure' });
    await userEvent.click(configureButtons[0]);
    expect(onEdit).toHaveBeenCalledWith('ANTHROPIC');
  });

  it('não renderiza o modal nem registra o tour quando editing é null', () => {
    render(<AiProviderConfig {...baseProps({ editing: null })} />);

    expect(screen.queryByTestId('form-builder')).not.toBeInTheDocument();
    expect(screen.queryByTestId('help-button')).not.toBeInTheDocument();
    expect(mocks.registerTour).not.toHaveBeenCalled();
  });

  it('abre o modal com título, help button e formulário quando editing está preenchido', () => {
    render(<AiProviderConfig {...baseProps({ editing: 'OPENAI' })} />);

    expect(screen.getByText('label:OPENAI', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByTestId('help-button')).toHaveAttribute('data-tour-id', 'settings-ai');
    expect(screen.getByTestId('help-button')).toHaveAttribute('data-start-direct', 'true');
    expect(screen.getByTestId('submit-label')).toHaveTextContent('Salvar');
  });

  it('registra 2 passos de tour (sem baseUrl) para providers normais', () => {
    render(<AiProviderConfig {...baseProps({ editing: 'OPENAI' })} />);

    expect(mocks.registerTour).toHaveBeenCalledTimes(1);
    const [tourId, steps] = mocks.registerTour.mock.calls[0];
    expect(tourId).toBe('settings-ai');
    expect(steps.map((s: { selectorId: string }) => s.selectorId)).toEqual([
      'ai-field-apiKey',
      'ai-field-model',
    ]);
  });

  it('registra 3 passos de tour, com baseUrl primeiro, quando editing é OPENAI_COMPATIBLE', () => {
    render(
      <AiProviderConfig
        {...baseProps({ options: ['OPENAI_COMPATIBLE'], active: 'OPENAI_COMPATIBLE', editing: 'OPENAI_COMPATIBLE' })}
      />,
    );

    const [, steps] = mocks.registerTour.mock.calls[0];
    expect(steps.map((s: { selectorId: string }) => s.selectorId)).toEqual([
      'ai-field-baseUrl',
      'ai-field-apiKey',
      'ai-field-model',
    ]);
  });

  it('propaga o submit do FormBuilder para o onSubmit do componente', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const values = { apiKey: 'abc' };
    render(<AiProviderConfig {...baseProps({ editing: 'OPENAI', onSubmit, values })} />);

    await userEvent.click(screen.getByText('submit-form'));
    expect(onSubmit).toHaveBeenCalledWith(values);
  });

  it('fecha o modal (onEdit(null)) ao cancelar o formulário', async () => {
    const onEdit = vi.fn();
    render(<AiProviderConfig {...baseProps({ editing: 'OPENAI', onEdit })} />);

    await userEvent.click(screen.getByText('cancel-form'));
    expect(onEdit).toHaveBeenCalledWith(null);
  });

  it('fecha o modal (onEdit(null)) ao clicar no X do Dialog', async () => {
    const onEdit = vi.fn();
    render(<AiProviderConfig {...baseProps({ editing: 'OPENAI', onEdit })} />);

    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onEdit).toHaveBeenCalledWith(null);
  });
  it('não marca como ativo se o provider selecionado não estiver configurado', () => {
    render(
      <AiProviderConfig
        {...baseProps({
          active: 'ANTHROPIC',
          isConfiguredFor: (p) => p !== 'ANTHROPIC',
          isOperational: true,
        })}
      />
    );

    expect(screen.queryByText('provider_active')).not.toBeInTheDocument();
    expect(screen.getAllByText('provider_not_configured').length).toBeGreaterThan(0);
  });

  it('não marca como ativo se o provider selecionado estiver configurado mas não operacional', () => {
    render(
      <AiProviderConfig
        {...baseProps({
          active: 'ANTHROPIC',
          isConfiguredFor: () => true,
          isOperational: false,
        })}
      />
    );

    expect(screen.queryByText('provider_active')).not.toBeInTheDocument();
  });

  it('marca como ativo quando o provider selecionado estiver configurado e operacional', () => {
    render(
      <AiProviderConfig
        {...baseProps({
          active: 'ANTHROPIC',
          isConfiguredFor: () => true,
          isOperational: true,
        })}
      />
    );

    expect(screen.getByText('provider_active')).toBeInTheDocument();
  });
});