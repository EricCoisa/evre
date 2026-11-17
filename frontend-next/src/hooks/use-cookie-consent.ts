import { useEffect, useState } from 'react';
import { useLocalStorage } from '@/hooks/use-localStorage';

export const COOKIE_CONSENT_KEY = 'cookie-consent';
export const COOKIE_CONSENT_CHANGE_EVENT = 'cookie-consent-change';
export type CookieConsentChoice = 'accepted' | 'declined';

/** `true` só depois de o visitante aceitar os cookies; reage à escolha feita no banner. */
export function useCookieConsent(): boolean {
  const { getValue } = useLocalStorage<CookieConsentChoice>(COOKIE_CONSENT_KEY);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const sync = () => setAccepted(getValue() === 'accepted');
    sync();
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, sync);
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, sync);
  }, [getValue]);

  return accepted;
}
