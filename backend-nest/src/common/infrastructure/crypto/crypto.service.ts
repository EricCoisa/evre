import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

const ALGO = 'aes-256-gcm';

@Injectable()
export class CryptoService {
  async generatePasswordHash(
    password: string,
  ): Promise<{ hash: string; salt: string }> {
    const salt = crypto.randomBytes(32).toString('hex');
    // 25k iterations matches Payload CMS defaults for cross-compatibility; upgrade path: migrate hashes to 600k (OWASP 2023) in a background job
    const hash = await new Promise<string>((resolve, reject) => {
      crypto.pbkdf2(password, salt, 25000, 512, 'sha256', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey.toString('hex'));
      });
    });
    return { hash, salt };
  }

  async verifyPassword(
    password: string,
    hash: string,
    salt: string,
  ): Promise<boolean> {
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.pbkdf2(password, salt, 25000, 512, 'sha256', (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
    const hashBuf = Buffer.from(hash, 'hex');
    if (derivedKey.length !== hashBuf.length) return false;
    return crypto.timingSafeEqual(derivedKey, hashBuf);
  }

  private getKeyFromSecret(secret: string | undefined): Buffer {
    if (!secret) {
      throw new Error('Missing encryption secret');
    }
    return crypto.createHash('sha256').update(secret).digest();
  }

  encryptString(plain: string, secret?: string): string {
    // CRYPTO_SECRET separates AES key from JWT signing key; set CRYPTO_SECRET=<old JWT_SECRET> on existing installs before rotating
    const key = this.getKeyFromSecret(secret ?? process.env.CRYPTO_SECRET);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(plain, 'utf8')),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  decryptString(payload: string, secret?: string): string {
    const key = this.getKeyFromSecret(secret ?? process.env.CRYPTO_SECRET);
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.slice(0, 12);
    const authTag = buf.slice(12, 28);
    const encrypted = buf.slice(28);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  tryDecrypt(payload: string, secret?: string): string {
    try {
      return this.decryptString(payload, secret);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      return payload;
    }
  }
}
