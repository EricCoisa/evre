import * as crypto from 'crypto';

const CODE_LENGTH = 6;

export function generateVerificationCode(): string {
  return crypto
    .randomInt(0, 10 ** CODE_LENGTH)
    .toString()
    .padStart(CODE_LENGTH, '0');
}

export function hashVerificationCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}
