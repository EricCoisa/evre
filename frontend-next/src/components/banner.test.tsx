import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Banner } from './banner';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('Banner', () => {
  it('renderiza as chaves de tradução de boas-vindas', () => {
    render(<Banner />);
    expect(screen.getByText('welcomeBack')).toBeInTheDocument();
    expect(screen.getByText('accessDashboard')).toBeInTheDocument();
  });
});
