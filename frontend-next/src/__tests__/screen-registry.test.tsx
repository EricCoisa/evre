import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScreenItem, snapshotScreen } from '@/components/agent/screen-registry';

describe('screen-registry', () => {
  it('registra enquanto montado e some ao desmontar', () => {
    const { unmount } = renderHook(() =>
      useScreenItem('config', 'system-configuration', 'SYSTEM_AI_ANTHROPIC_MODEL'),
    );

    expect(snapshotScreen()).toContainEqual({
      kind: 'config',
      source: 'system-configuration',
      detail: 'SYSTEM_AI_ANTHROPIC_MODEL',
    });

    // Sem a limpeza, trocar de aba deixaria a aba anterior no prompt para sempre.
    unmount();
    expect(snapshotScreen()).toHaveLength(0);
  });

  it('não duplica o mesmo item, e só some quando a última cópia desmonta', () => {
    const a = renderHook(() => useScreenItem('collection', 'users'));
    const b = renderHook(() => useScreenItem('collection', 'users'));

    expect(snapshotScreen()).toHaveLength(1);

    a.unmount();
    expect(snapshotScreen()).toHaveLength(1);

    b.unmount();
    expect(snapshotScreen()).toHaveLength(0);
  });

  it('respeita o teto de itens', () => {
    const hooks = Array.from({ length: 5 }, (_, i) =>
      renderHook(() => useScreenItem('record', 'users', `id-${i}`)),
    );

    expect(snapshotScreen(2)).toHaveLength(2);

    hooks.forEach((h) => h.unmount());
  });
});
