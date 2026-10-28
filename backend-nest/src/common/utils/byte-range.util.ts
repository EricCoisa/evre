export type ByteRange = { start: number; end: number };

/** Interpreta `Range: bytes=…` (RFC 9110 §14) sobre um conteúdo de `size` bytes. */
export function parseByteRange(
  header: string | undefined,
  size: number,
): ByteRange | 'unsatisfiable' | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? '');
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;

  // `bytes=-N` = os últimos N bytes.
  const start =
    rawStart === '' ? Math.max(size - Number(rawEnd), 0) : Number(rawStart);
  const end =
    rawStart === '' || rawEnd === ''
      ? size - 1
      : Math.min(Number(rawEnd), size - 1);

  if (start >= size || start > end) return 'unsatisfiable';
  return { start, end };
}
