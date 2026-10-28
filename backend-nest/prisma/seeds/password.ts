import * as crypto from 'crypto';

export async function generatePasswordHash(
  password: string,
): Promise<{ hash: string; salt: string }> {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = await new Promise<string>((resolve, reject) => {
    crypto.pbkdf2(password, salt, 25000, 512, 'sha256', (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString('hex'));
    });
  });
  return { hash, salt };
}
