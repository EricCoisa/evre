import { isIP } from 'net';

/** Prefixo de data URL (`data:image/png;base64,`): o que separar dele é o base64 puro. */
export const DATA_URL_PREFIX = /^data:[^,]*,/;

/** Lê o mimetype declarado no prefixo de uma data URL, ou `null` se não for uma. */
export function mimeFromDataUrl(value: string): string | null {
  const mime = /^data:([^;,]+)[;,]/.exec(value)?.[1];
  return mime || null;
}

/** Sufixos de nomes que só existem em rede interna: o provider, na internet, não os resolve. */
const INTERNAL_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home.arpa',
];

/** Octetos de um IPv4 em notação decimal pontuada, ou `null`. (A URL já normaliza `2130706433` e `0x7f.1`.) */
function ipv4Octets(host: string): number[] | null {
  if (isIP(host) !== 4) return null;
  return host.split('.').map(Number);
}

function isPrivateIpv4([a, b]: number[]): boolean {
  return (
    a === 0 || // "esta rede" / 0.0.0.0
    a === 10 ||
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / metadata de nuvem
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/** IPv6 sem colchetes. Cobre loopback, não especificado, ULA (fc00::/7), link-local e IPv4 embutido (`::ffff:a.b.c.d`). */
function isPrivateIpv6(host: string): boolean {
  if (host === '::1' || host === '::') return true;
  if (/^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host)) {
    return true;
  }
  // A URL escreve `::ffff:127.0.0.1` como `::ffff:7f00:1`.
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
  if (mapped) {
    const high = parseInt(mapped[1], 16);
    const low = parseInt(mapped[2], 16);
    return isPrivateIpv4([high >> 8, high & 0xff, low >> 8, low & 0xff]);
  }
  return false;
}

/** Detecta host privado ou interno (loopback, RFC1918, link-local, sufixo interno). */
export function isUnreachableHost(rawHost: string): boolean {
  const host = rawHost
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (host === 'localhost') return true;
  if (isIP(host) === 6) return isPrivateIpv6(host);
  const octets = ipv4Octets(host);
  if (octets) return isPrivateIpv4(octets);
  if (INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  return !host.includes('.');
}

/** Devolve `null` se a URL é alcançável pelo provider, ou o motivo quando não é. */
export function unreachableMediaReason(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'mediaUrl precisa ser uma URL absoluta';
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return 'mediaUrl precisa usar http ou https';
  }
  if (isUnreachableHost(url.hostname)) {
    return `mediaUrl aponta para um host privado (${url.hostname}) que o provider não alcança`;
  }
  return null;
}
