import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { ContactProfileSyncService } from '../contact-profile-sync.service';
import { providerFetch } from '../providers/provider-http.util';

/** Hosts de onde o WhatsApp serve foto de perfil. A URL vem do provider; só buscamos nestes. */
const PHOTO_HOST = /(^|\.)(whatsapp\.net|whatsapp\.com|fbcdn\.net)$/i;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export interface ContactPhoto {
  data: Buffer;
  mimeType: string;
}

/** Corpo da resposta, ou `null` se passar de `maxBytes`: aborta a leitura em vez de baixar tudo e medir depois. */
async function readCapped(
  res: Response,
  maxBytes: number,
): Promise<Buffer | null> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!res.body) return null;

  const chunks: Buffer[] = [];
  let total = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export function isAllowedPhotoUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && PHOTO_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

/** Entrega a foto de perfil sem guardá-la, pedindo uma URL nova ao provider se a gravada expirou. */
@Injectable()
export class GetContactPhotoUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ContactProfileSyncService,
    private readonly i18n: I18nService,
  ) {}

  async execute(contactId: string): Promise<ContactPhoto> {
    const photo =
      (await this.fetchStored(contactId)) ??
      (await this.renewAndFetch(contactId));
    if (!photo) {
      throw new NotFoundException(this.i18n.t('messaging.photo_not_found'));
    }
    return photo;
  }

  private async renewAndFetch(contactId: string): Promise<ContactPhoto | null> {
    try {
      await this.profiles.sync(contactId, true);
    } catch {
      return null;
    }
    return this.fetchStored(contactId);
  }

  private async fetchStored(contactId: string): Promise<ContactPhoto | null> {
    const contact = await this.prisma.messagingContact.findUnique({
      where: { id: contactId },
    });
    const url = contact?.profilePictureUrl;
    if (!url || !isAllowedPhotoUrl(url)) return null;

    try {
      // `manual`: a allowlist vale para a URL gravada; seguir um redirect a contornaria.
      const res = await providerFetch(url, { redirect: 'manual' });
      const mimeType = res.headers.get('content-type') ?? '';
      if (!res.ok || !mimeType.startsWith('image/')) return null;
      const data = await readCapped(res, MAX_PHOTO_BYTES);
      return data && data.length > 0 ? { data, mimeType } : null;
    } catch {
      return null;
    }
  }
}
