/** Celular BR no formato legado, sem o 9: 55 + DDD + 8 dígitos começando em 6-9. */
const BR_MOBILE_WITHOUT_9 = /^55(\d{2})([6-9]\d{7})$/;

/** Normaliza o telefone para E.164 sem `+`, canonizando o 9º dígito brasileiro. */
export function normalizePhone(raw: string): string {
  // JID de dispositivo (`5534…:12@s.whatsapp.net`): o `:12` é o aparelho, não parte do número.
  const user = String(raw ?? '')
    .split('@')[0]
    .split(':')[0];
  const digits = user.replace(/\D/g, '');
  const br = BR_MOBILE_WITHOUT_9.exec(digits);
  return br ? `55${br[1]}9${br[2]}` : digits;
}

/** Telefone para log: só os 4 últimos dígitos. O número é dado pessoal e não precisa estar inteiro num log. */
export function maskPhone(phone: string): string {
  const digits = normalizePhone(phone);
  return digits.length > 4 ? `…${digits.slice(-4)}` : '…';
}

/** Formas em que o WhatsApp pode conhecer o número: a canônica e, no celular BR, a legada sem o 9. */
export function phoneVariants(phone: string): string[] {
  const canonical = normalizePhone(phone);
  const br = /^55(\d{2})9([6-9]\d{7})$/.exec(canonical);
  return br ? [canonical, `55${br[1]}${br[2]}`] : [canonical];
}

/** Domínios de JID que identificam uma pessoa pelo telefone. */
const PHONE_JID_DOMAINS = ['s.whatsapp.net', 'c.us'];

/** Extrai o telefone de um JID, ou `null` quando o JID não é de uma pessoa com número. */
export function phoneFromJid(jid: string | null | undefined): string | null {
  if (!jid) return null;
  const [user, domain] = jid.split('@');
  if (domain !== undefined && !PHONE_JID_DOMAINS.includes(domain)) return null;
  const phone = normalizePhone(user);
  return phone || null;
}

/** Primeiro JID da lista que seja telefone: para o `@lid`, o provider manda o JID de telefone ao lado. */
export function firstPhoneJid(
  ...jids: Array<string | null | undefined>
): string | null {
  for (const jid of jids) {
    const phone = phoneFromJid(jid);
    if (phone) return phone;
  }
  return null;
}
