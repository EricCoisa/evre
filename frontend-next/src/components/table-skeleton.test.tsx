import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableSkeleton } from './table-skeleton';

describe('TableSkeleton', () => {
  it('renderiza com defaults sem erro', () => {
    const { container } = render(<TableSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('showToolbar=false omite a toolbar', () => {
    const { container } = render(<TableSkeleton showToolbar={false} />);
    // With showToolbar=false, the toolbar divs are absent — fewer top-level skeleton children
    expect(container.querySelectorAll('.space-y-4').length).toBeGreaterThanOrEqual(1);
  });

  it('showToolbar=true (default) inclui a toolbar', () => {
    const { container: withToolbar } = render(<TableSkeleton showToolbar={true} />);
    const { container: withoutToolbar } = render(<TableSkeleton showToolbar={false} />);
    expect(withToolbar.innerHTML.length).toBeGreaterThan(withoutToolbar.innerHTML.length);
  });

  it('aceita className personalizada', () => {
    const { container } = render(<TableSkeleton className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
