import { CookieConsent } from '../CookieConsent';

describe('CookieConsent global contract', () => {
  it('has slug "cookie-consent"', () => {
    expect(CookieConsent.slug).toBe('cookie-consent');
  });

  it('has public read access', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(CookieConsent.access?.read?.({} as any)).toBe(true);
  });

  it('requires an authenticated user to update', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(CookieConsent.access?.update?.({ req: { user: null } } as any)).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(CookieConsent.access?.update?.({ req: { user: { id: '1' } } } as any)).toBe(true);
  });

  it('has message, acceptButtonText and declineButtonText required fields', () => {
    const fields = CookieConsent.fields ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byName = (name: string) => fields.find((f: any) => f.name === name) as any;

    expect(byName('message')?.type).toBe('textarea');
    expect(byName('message')?.required).toBe(true);

    expect(byName('acceptButtonText')?.required).toBe(true);
    expect(byName('declineButtonText')?.required).toBe(true);
  });
});
