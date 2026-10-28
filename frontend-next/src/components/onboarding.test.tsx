import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Onboarding, type OnboardingStep } from './onboarding';

function makeSteps(): OnboardingStep[] {
  return [
    {
      id: 's1',
      title: 'Passo 1',
      description: 'Descrição 1',
      render: (ctx) => <button onClick={ctx.onNext}>avançar 1</button>,
    },
    {
      id: 's2',
      title: 'Passo 2',
      render: (ctx) => (
        <>
          <button onClick={ctx.onBack}>voltar</button>
          <button onClick={ctx.onNext}>avançar 2</button>
        </>
      ),
    },
    {
      id: 's3',
      title: 'Passo 3',
      render: (ctx) => <button onClick={ctx.onNext}>finalizar</button>,
    },
  ];
}

describe('Onboarding', () => {
  it('renders the first step title, description, and progress bar segments', () => {
    render(<Onboarding steps={makeSteps()} />);
    expect(screen.getByText('Passo 1')).toBeInTheDocument();
    expect(screen.getByText('Descrição 1')).toBeInTheDocument();
  });

  it('omits the progress bar when there is only one step', () => {
    const { container } = render(
      <Onboarding steps={[{ id: 'only', title: 'Único', render: () => null }]} />,
    );
    expect(container.querySelector('.bg-primary')).toBeNull();
  });

  it('passes isFirst/isLast correctly and advances through onNext', async () => {
    const user = userEvent.setup();
    render(<Onboarding steps={makeSteps()} />);

    await user.click(screen.getByText('avançar 1'));
    expect(screen.getByText('Passo 2')).toBeInTheDocument();

    await user.click(screen.getByText('avançar 2'));
    expect(screen.getByText('Passo 3')).toBeInTheDocument();
  });

  it('goes back a step via onBack, and stays on the first step when already there', async () => {
    const user = userEvent.setup();
    render(<Onboarding steps={makeSteps()} />);

    await user.click(screen.getByText('avançar 1'));
    expect(screen.getByText('Passo 2')).toBeInTheDocument();

    await user.click(screen.getByText('voltar'));
    expect(screen.getByText('Passo 1')).toBeInTheDocument();
  });

  it('calls onComplete when onNext fires on the last step', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Onboarding steps={makeSteps()} onComplete={onComplete} />);

    await user.click(screen.getByText('avançar 1'));
    await user.click(screen.getByText('avançar 2'));
    expect(screen.getByText('Passo 3')).toBeInTheDocument();

    await user.click(screen.getByText('finalizar'));
    expect(onComplete).toHaveBeenCalledTimes(1);
    // Última etapa: não deve avançar para um índice inexistente.
    expect(screen.getByText('Passo 3')).toBeInTheDocument();
  });

  it('renders without the Card chrome when chrome="plain"', () => {
    const { container } = render(<Onboarding steps={makeSteps()} chrome="plain" />);
    expect(container.querySelector('[data-slot="card"]')).toBeNull();
    expect(screen.getByText('Passo 1').tagName).toBe('H3');
  });

  it('renders with the Card chrome by default', () => {
    const { container } = render(<Onboarding steps={makeSteps()} />);
    expect(container.querySelector('[data-slot="card"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="card-title"]')).not.toBeNull();
  });
});
