import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IsDev } from './isDev';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('IsDev', () => {
  it('renderiza o badge de dev', () => {
    render(<IsDev />);
    expect(screen.getByTitle('Dev mode')).toBeInTheDocument();
  });

  it('exibe a tradução ou DEV como fallback', () => {
    render(<IsDev />);
    const el = screen.getByTitle('Dev mode');
    expect(el.textContent).toBeTruthy();
  });
});
