import { StrictMode } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { VerificationCodeModal } from './verification-code-modal';

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('sonner', () => ({ toast }));
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'pt-BR' }),
}));
vi.mock('@/lib/actions/verification/queries', () => ({
  useRequestVerification: () => ({ mutate: mocks.mutate, isPending: false }),
  useConfirmVerification: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));

const CHALLENGE = { purpose: 'PHONE_CONFIRMATION' as const, channel: 'WHATSAPP' as const, target: '+5511999998888' };

describe('VerificationCodeModal — StrictMode double-invoke', () => {
  it('manda só um código mesmo com o efeito disparando 2x (StrictMode)', () => {
    render(
      <StrictMode>
        <VerificationCodeModal
          challenge={CHALLENGE}
          onConfirmed={vi.fn()}
          onCancelled={vi.fn()}
        />
      </StrictMode>,
    );

    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });
});

describe('VerificationCodeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutate.mockImplementation((_challenge, opts) => opts?.onSettled?.());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sem challenge: não dispara request e não renderiza o conteúdo', () => {
    render(<VerificationCodeModal challenge={null} onConfirmed={vi.fn()} onCancelled={vi.fn()} />);

    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(screen.queryByText('verification_title')).not.toBeInTheDocument();
  });

  it('sanitiza a entrada removendo caracteres não numéricos', () => {
    render(<VerificationCodeModal challenge={CHALLENGE} onConfirmed={vi.fn()} onCancelled={vi.fn()} />);

    const input = screen.getByLabelText('verification_code_label') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1a2b3c' } });

    expect(input.value).toBe('123');
  });

  it('botão de submit fica desabilitado enquanto o código não tem 6 dígitos', () => {
    render(<VerificationCodeModal challenge={CHALLENGE} onConfirmed={vi.fn()} onCancelled={vi.fn()} />);

    const input = screen.getByLabelText('verification_code_label') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '123' } });

    expect(screen.getByText('submit')).toBeDisabled();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('após um submit rejeitado, editar para um código incompleto mostra o erro de validação', async () => {
    mocks.mutateAsync.mockRejectedValue(new Error('invalid code'));
    render(<VerificationCodeModal challenge={CHALLENGE} onConfirmed={vi.fn()} onCancelled={vi.fn()} />);

    const input = screen.getByLabelText('verification_code_label') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalled());

    fireEvent.change(input, { target: { value: '123' } });

    expect(screen.getByText('verification_code_invalid')).toBeInTheDocument();
  });

  it('submit com código válido: confirma, mostra toast de sucesso e chama onConfirmed', async () => {
    mocks.mutateAsync.mockResolvedValue(undefined);
    const onConfirmed = vi.fn();
    render(<VerificationCodeModal challenge={CHALLENGE} onConfirmed={onConfirmed} onCancelled={vi.fn()} />);

    const input = screen.getByLabelText('verification_code_label') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(onConfirmed).toHaveBeenCalled());
    expect(mocks.mutateAsync).toHaveBeenCalledWith({ purpose: CHALLENGE.purpose, code: '123456' });
    expect(toast.success).toHaveBeenCalledWith('verification_confirmed');
  });

  it('confirmação rejeitada: mantém o modal aberto sem chamar onConfirmed', async () => {
    mocks.mutateAsync.mockRejectedValue(new Error('invalid code'));
    const onConfirmed = vi.fn();
    render(<VerificationCodeModal challenge={CHALLENGE} onConfirmed={onConfirmed} onCancelled={vi.fn()} />);

    const input = screen.getByLabelText('verification_code_label') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalled());
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(screen.getByText('verification_title')).toBeInTheDocument();
  });

  it('cancelar chama onCancelled', () => {
    const onCancelled = vi.fn();
    render(<VerificationCodeModal challenge={CHALLENGE} onConfirmed={vi.fn()} onCancelled={onCancelled} />);

    fireEvent.click(screen.getByText('cancel'));

    expect(onCancelled).toHaveBeenCalled();
  });

  it('reenvio: fica desabilitado até o cooldown passar, e dispara outro request ao clicar', async () => {
    vi.useFakeTimers();
    render(<VerificationCodeModal challenge={CHALLENGE} onConfirmed={vi.fn()} onCancelled={vi.fn()} />);

    const resendButton = screen.getByText('verification_resend');
    expect(resendButton).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(resendButton).not.toBeDisabled();

    fireEvent.click(resendButton);

    expect(mocks.mutate).toHaveBeenCalledTimes(2);
    expect(resendButton).toBeDisabled();
  });
});
