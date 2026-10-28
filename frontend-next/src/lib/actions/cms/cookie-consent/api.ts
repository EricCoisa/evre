"use server";
import { getPayload } from 'payload';
import config from '@payload-config';
import { CookieConsentData } from './type';

/** Busca o texto do banner de consentimento de cookies configurado no Payload CMS. */
export async function getCookieConsent(): Promise<CookieConsentData | null> {
  try {
    const payload = await getPayload({ config });

    const result = await payload.findGlobal({ slug: 'cookie-consent' });

    return result as unknown as CookieConsentData;
  } catch {
    return null;
  }
}
