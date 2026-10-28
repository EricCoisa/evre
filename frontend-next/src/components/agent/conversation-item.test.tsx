import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConversationItem from './conversation-item';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function setup(overrides: Partial<Parameters<typeof ConversationItem>[0]> = {}) {
  const onSelect = vi.fn();
  const onDelete = vi.fn();
  const onCheckedChange = vi.fn();
  render(
    <ConversationItem
      id="c1"
      title="minha conversa"
      selected={false}
      checked={false}
      selectionMode={false}
      onSelect={onSelect}
      onDelete={onDelete}
      onCheckedChange={onCheckedChange}
      {...overrides}
    />,
  );
  return { onSelect, onDelete, onCheckedChange };
}

describe('ConversationItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects on click', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup();

    await user.click(screen.getByText('minha conversa'));

    expect(onSelect).toHaveBeenCalledWith('c1');
  });

  it('selects on Enter and Space keydown', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup();

    const item = screen.getByText('minha conversa').closest('[role="button"]') as HTMLElement;
    item.focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('c1');

    await user.keyboard(' ');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('does not select on other keys', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup();

    (screen.getByText('minha conversa').closest('[role="button"]') as HTMLElement).focus();
    await user.keyboard('{ArrowDown}');

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('toggles the checkbox without triggering select', async () => {
    const user = userEvent.setup();
    const { onCheckedChange, onSelect } = setup();

    await user.click(screen.getByRole('checkbox'));

    expect(onCheckedChange).toHaveBeenCalledWith('c1', true);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('deletes without triggering select, when not in selection mode', async () => {
    const user = userEvent.setup();
    const { onDelete, onSelect } = setup({ selectionMode: false });

    await user.click(screen.getByTitle('deleteConversation'));

    expect(onDelete).toHaveBeenCalledWith('c1');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('hides the delete button in selection mode', () => {
    setup({ selectionMode: true });

    expect(screen.queryByTitle('deleteConversation')).not.toBeInTheDocument();
  });

  it('applies the selected styling when selected', () => {
    setup({ selected: true });

    expect(screen.getByText('minha conversa').closest('[role="button"]')).toHaveClass('bg-primary');
  });
});
