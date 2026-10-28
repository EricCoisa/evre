import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordingBar } from './recording-bar';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}));

describe('RecordingBar', () => {
  it('formata o timer com padding de segundos', () => {
    render(<RecordingBar seconds={65} busy={false} onCancel={vi.fn()} onSend={vi.fn()} />);
    expect(screen.getByText('1:05')).toBeInTheDocument();
  });

  it('chama onCancel ao clicar no botão de cancelar', async () => {
    const onCancel = vi.fn();
    render(<RecordingBar seconds={0} busy={false} onCancel={onCancel} onSend={vi.fn()} />);

    await userEvent.click(screen.getByLabelText('cancelRecording'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('chama onSend ao clicar no botão de enviar', async () => {
    const onSend = vi.fn();
    render(<RecordingBar seconds={0} busy={false} onCancel={vi.fn()} onSend={onSend} />);

    await userEvent.click(screen.getByLabelText('sendVoice'));

    expect(onSend).toHaveBeenCalled();
  });

  it('desabilita o botão de enviar quando busy', () => {
    render(<RecordingBar seconds={0} busy={true} onCancel={vi.fn()} onSend={vi.fn()} />);

    expect(screen.getByLabelText('sendVoice')).toBeDisabled();
  });
});
