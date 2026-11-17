import { render } from '@testing-library/react';
import { Analytics } from './analytics';

vi.mock('next/script', () => ({
  default: ({ id, src }: { id?: string; src?: string }) => <script data-testid={id ?? src} />,
}));

const accept = () => localStorage.setItem('cookie-consent', JSON.stringify('accepted'));

describe('Analytics', () => {
  beforeEach(() => localStorage.clear());

  it('não carrega nada sem consentimento', () => {
    const { container } = render(<Analytics ga4Id="G-ABC123" clarityId="abc123" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('carrega GA4 e Clarity após consentimento', async () => {
    accept();
    const { findByTestId } = render(<Analytics ga4Id="G-ABC123" clarityId="abc123" />);
    expect(await findByTestId('ga4-init')).toBeInTheDocument();
    expect(await findByTestId('clarity-init')).toBeInTheDocument();
  });

  it('ignora IDs fora do formato', () => {
    accept();
    const { container } = render(<Analytics ga4Id="');alert(1)//" clarityId="x'y" />);
    expect(container).toBeEmptyDOMElement();
  });
});
