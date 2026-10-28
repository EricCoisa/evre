import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentWindow } from './agent-window';
import { serverCanAccessRoute, serverFeatureFlag } from '@/lib/server-context';

vi.mock('@/lib/server-context', () => ({
  serverFeatureFlag: vi.fn(),
  serverCanAccessRoute: vi.fn(),
}));
vi.mock('./agent-window-chat', () => ({
  AgentWindowChat: () => <div data-testid="agent-window-chat" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AgentWindow', () => {
  it('renders nothing when the AI_AGENT flag is disabled', async () => {
    vi.mocked(serverFeatureFlag).mockResolvedValue(false);
    vi.mocked(serverCanAccessRoute).mockResolvedValue(true);

    const node = await AgentWindow();

    expect(node).toBeNull();
  });

  it('renders nothing when the user cannot reach /agent', async () => {
    vi.mocked(serverFeatureFlag).mockResolvedValue(true);
    vi.mocked(serverCanAccessRoute).mockResolvedValue(false);

    const node = await AgentWindow();

    expect(node).toBeNull();
  });

  it('renders AgentWindowChat when the flag is on and the route is reachable', async () => {
    vi.mocked(serverFeatureFlag).mockResolvedValue(true);
    vi.mocked(serverCanAccessRoute).mockResolvedValue(true);

    const node = await AgentWindow();
    render(node);

    expect(serverFeatureFlag).toHaveBeenCalledWith('AI_AGENT');
    expect(serverCanAccessRoute).toHaveBeenCalledWith('/agent');
    expect(screen.getByTestId('agent-window-chat')).toBeInTheDocument();
  });
});
