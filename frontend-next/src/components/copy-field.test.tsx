import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CopyField } from './copy-field';
import { toast } from 'sonner';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const writeText = vi.fn();

describe('CopyField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
  });

  it('renders the label when provided', () => {
    render(<CopyField value="abc123" label="Token" />);
    expect(screen.getByText('Token')).toBeInTheDocument();
    expect(screen.getByDisplayValue('abc123')).toBeInTheDocument();
  });

  it('omits the label when not provided', () => {
    render(<CopyField value="abc123" />);
    expect(screen.queryByText('Token')).toBeNull();
  });

  it('renders the value as a read-only input', () => {
    render(<CopyField value="abc123" />);
    expect(screen.getByDisplayValue('abc123')).toHaveAttribute('readonly');
  });

  // fireEvent, não userEvent: sobrescrever navigator.clipboard quebra a sequência de
  // ponteiro interna do user-event (que também lê navigator.clipboard), e o clique nunca chega.
  it('copies the value and shows a success toast', async () => {
    render(<CopyField value="abc123" />);

    fireEvent.click(screen.getByText('copy'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('abc123'));
    expect(toast.success).toHaveBeenCalledWith('copied');
  });

  it('shows an error toast when the clipboard write fails', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    render(<CopyField value="abc123" />);

    fireEvent.click(screen.getByText('copy'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('copyFailed'));
  });
});
