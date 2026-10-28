import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CookieConsentBanner } from './cookie-consent-banner';
import type { CookieConsentData } from '@/lib/actions/cms/cookie-consent/type';

const data: CookieConsentData = {
  message: 'Usamos cookies essenciais.',
  acceptButtonText: 'Aceitar',
  declineButtonText: 'Recusar',
  policyLinkSlug: 'privacy-policy',
  policyLinkText: 'Saiba mais',
};

describe('CookieConsentBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('não renderiza sem dados do CMS', () => {
    render(<CookieConsentBanner data={null} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('mostra o banner quando não há escolha salva', async () => {
    render(<CookieConsentBanner data={data} />);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(data.message)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Saiba mais' })).toHaveAttribute('href', '/legal/privacy-policy');
  });

  it('esconde e grava "accepted" ao aceitar', async () => {
    render(<CookieConsentBanner data={data} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Aceitar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem('cookie-consent')).toBe(JSON.stringify('accepted'));
  });

  it('esconde e grava "declined" ao recusar', async () => {
    render(<CookieConsentBanner data={data} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Recusar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem('cookie-consent')).toBe(JSON.stringify('declined'));
  });

  it('não mostra o banner de novo se já houver escolha salva', () => {
    localStorage.setItem('cookie-consent', JSON.stringify('accepted'));
    render(<CookieConsentBanner data={data} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
