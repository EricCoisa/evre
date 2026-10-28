import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToolCallGroup from './tool-call-group';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}));

describe('ToolCallGroup', () => {
  it('renders a single tool message with its name resolved and shows the content on expand', async () => {
    const user = userEvent.setup();
    render(
      <ToolCallGroup
        messages={[{ id: 't1', content: 'resultado', toolCallId: 'c1' }]}
        toolNameByCallId={{ c1: 'search' }}
      />,
    );

    expect(screen.getByText('toolCall')).toBeInTheDocument();
    await user.click(screen.getByText('toolCall'));
    expect(screen.getByText('resultado')).toBeInTheDocument();
  });

  it('falls back to the generic icon when the single message has no resolvable tool name', () => {
    render(
      <ToolCallGroup
        messages={[{ id: 't1', content: 'resultado' }]}
        toolNameByCallId={{}}
      />,
    );

    expect(screen.getByText('🔧')).toBeInTheDocument();
    expect(screen.getByText('toolCall')).toBeInTheDocument();
  });

  it('groups multiple tool messages under a count summary, listing each by name', () => {
    render(
      <ToolCallGroup
        messages={[
          { id: 't1', content: 'resultado 1', toolCallId: 'c1' },
          { id: 't2', content: 'resultado 2', toolCallId: 'c2' },
        ]}
        toolNameByCallId={{ c1: 'search', c2: 'fetch' }}
      />,
    );

    expect(screen.getByText('toolCallCount:2')).toBeInTheDocument();
    expect(screen.getByText('search')).toBeInTheDocument();
    expect(screen.getByText('fetch')).toBeInTheDocument();
    expect(screen.getByText('resultado 1')).toBeInTheDocument();
    expect(screen.getByText('resultado 2')).toBeInTheDocument();
  });

  it('shows the generic icon per item in a group when its tool name is unresolved', () => {
    render(
      <ToolCallGroup
        messages={[
          { id: 't1', content: 'resultado 1' },
          { id: 't2', content: 'resultado 2', toolCallId: 'unknown' },
        ]}
        toolNameByCallId={{}}
      />,
    );

    expect(screen.getAllByText('🔧').length).toBeGreaterThan(0);
  });
});
