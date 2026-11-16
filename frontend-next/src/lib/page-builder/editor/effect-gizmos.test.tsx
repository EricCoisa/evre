import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tilt3DGizmo } from './effect-gizmos';

/** jsdom não implementa Pointer Capture nem o construtor `PointerEvent` com clientX/clientY
 * confiável — mesmo padrão já usado em `components/window.test.tsx`: disparar um `MouseEvent`
 * com o `type` "pointerXXX" (React casa pelo nome do evento, não pela classe). */
function pointerEvent(type: string, init: MouseEventInit) {
  return new MouseEvent(type, { bubbles: true, ...init });
}

function setup(params: Record<string, unknown> = {}) {
  const onChange = vi.fn();
  render(<Tilt3DGizmo params={params} onChange={onChange} />);
  const handle = screen.getByLabelText(/Inclinação 3D/);
  Object.assign(handle, { setPointerCapture: () => {}, hasPointerCapture: () => false, releasePointerCapture: () => {} });
  return { onChange, handle };
}

describe('Tilt3DGizmo', () => {
  it('arrastar para a direita/baixo aumenta rotateY e reduz rotateX', () => {
    const { onChange, handle } = setup({ rotateX: 0, rotateY: 0 });

    act(() => handle.dispatchEvent(pointerEvent('pointerdown', { clientX: 0, clientY: 0 })));
    act(() => handle.dispatchEvent(pointerEvent('pointermove', { clientX: 10, clientY: 10 })));

    expect(onChange).toHaveBeenCalledWith({ rotateY: 4, rotateX: -4 });
  });

  it('sem params usa os mesmos defaults do efeito real (6/3)', () => {
    render(<Tilt3DGizmo params={{}} onChange={vi.fn()} />);
    expect(screen.getByText('X 6° · Y 3°')).toBeInTheDocument();
  });

  it('satura em ±60 graus mesmo com um arrasto enorme', () => {
    const { onChange, handle } = setup({ rotateX: 0, rotateY: 0 });

    act(() => handle.dispatchEvent(pointerEvent('pointerdown', { clientX: 0, clientY: 0 })));
    act(() => handle.dispatchEvent(pointerEvent('pointermove', { clientX: 1000, clientY: -1000 })));

    expect(onChange).toHaveBeenCalledWith({ rotateY: 60, rotateX: 60 });
  });

  it('pointermove sem pointerdown anterior não chama onChange', () => {
    const { onChange, handle } = setup({ rotateX: 0, rotateY: 0 });
    act(() => handle.dispatchEvent(pointerEvent('pointermove', { clientX: 10, clientY: 10 })));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('pointerup encerra o arrasto — move seguinte não chama mais onChange', () => {
    const { onChange, handle } = setup({ rotateX: 0, rotateY: 0 });

    act(() => handle.dispatchEvent(pointerEvent('pointerdown', { clientX: 0, clientY: 0 })));
    act(() => handle.dispatchEvent(pointerEvent('pointerup', {})));
    onChange.mockClear();
    act(() => handle.dispatchEvent(pointerEvent('pointermove', { clientX: 50, clientY: 50 })));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('setas do teclado ajustam rotateX/rotateY em passos', () => {
    const { onChange, handle } = setup({ rotateX: 10, rotateY: 10 });

    act(() => handle.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowRight' })));
    expect(onChange).toHaveBeenCalledWith({ rotateY: 12 });

    act(() => handle.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowUp' })));
    expect(onChange).toHaveBeenCalledWith({ rotateX: 8 });
  });
});
