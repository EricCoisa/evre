import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DescribeModal, getDescribeData } from './describe-modal';
import { toast } from 'sonner';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockSources = [
  {
    key: 'logs.list',
    kind: 'list' as const,
    description: 'Logs do sistema',
    fields: ['module', 'action'],
    params: [{ name: 'limit', type: 'number' as const, description: 'Limite' }],
  },
];

vi.mock('@/lib/actions/pageBuilder/queries', () => ({
  usePageSources: () => ({ data: mockSources }),
}));

describe('getDescribeData', () => {
  it('retorna a estrutura correta com expectedOutputFormat para dashboard', () => {
    const data = getDescribeData('dashboard', mockSources);

    expect(data.profile).toBe('dashboard');
    expect(data.dataSources).toBe('role-filtered');
    expect(data.expectedOutputFormat).toBeDefined();
    expect(data.instructions).toContain('data.source');
    expect(data.pages).toBeDefined();
    expect(data.maxBlocks).toBe(20);
    expect(data.maxChildren).toBe(12);
    expect(data.blocks.length).toBeGreaterThan(0);
    expect(data.sources).toHaveLength(1);
    expect(data.sources[0].key).toBe('logs.list');
    expect(data.inlineShapes).toBeUndefined();
    expect(data.spans).toBeDefined();
    expect(data.classNames).toBeDefined();
  });

  it('retorna a estrutura correta com inlineShapes e sem pages para proposal', () => {
    const data = getDescribeData('proposal', mockSources);

    expect(data.profile).toBe('proposal');
    expect(data.dataSources).toBe('inline-only');
    expect(data.expectedOutputFormat).toBeDefined();
    expect(data.instructions).toContain('data.inline');
    expect(data.pages).toBeUndefined();
    expect(data.sources).toEqual([]);
    expect(data.inlineShapes).toBeDefined();
    expect(data.maxBlocks).toBe(80);
  });
});

describe('DescribeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renderiza o modal quando open=true e permite copiar', async () => {
    render(<DescribeModal open={true} onOpenChange={vi.fn()} profile="dashboard" />);

    expect(screen.getByText('Especificações da Página (Describe)')).toBeInTheDocument();

    const copyBtn = screen.getByRole('button', { name: /Copiar JSON/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    });

    const copiedText = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    const parsed = JSON.parse(copiedText);

    expect(parsed.profile).toBe('dashboard');
    expect(parsed.blocks).toBeDefined();
    expect(parsed.expectedOutputFormat).toBeDefined();

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('JSON do describe copiado para a área de transferência!');
    });
  });
});
