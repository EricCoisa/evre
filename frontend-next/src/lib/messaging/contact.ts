import { API_PATHS } from '@/lib/generated/paths';
import type { MessagingContact } from '@/lib/actions/messaging/types';

type NameFields = Pick<MessagingContact, 'phone' | 'name' | 'pushName'>;

/** Como o contato aparece: o nome que o operador deu, senão o do WhatsApp, senão o número. */
export function contactDisplayName(contact: Partial<NameFields> & { phone: string }): string {
  return contact.name || contact.pushName || contact.phone;
}

/** Devolve até duas iniciais do nome, ou null quando não há letra. */
export function contactInitials(name: string | null | undefined): string | null {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const letters = words
    .map((word) => Array.from(word).find((char) => /\p{L}/u.test(char)))
    .filter((char): char is string => !!char)
    .slice(0, 2);
  return letters.length ? letters.join('').toLocaleUpperCase() : null;
}

/** A foto vem pelo proxy do front (a URL do WhatsApp expira e não é exposta). */
export const contactPhotoSrc = (contactId: string) =>
  `/api${API_PATHS.MESSAGING_CONTACTS_BY_ID_PHOTO(contactId)}`;
