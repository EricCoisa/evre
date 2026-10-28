import { Test, TestingModule } from '@nestjs/testing';
import { CryptoService } from './crypto.service';

const pbkdf2Mock = vi.hoisted(() => vi.fn());

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    pbkdf2: pbkdf2Mock,
  };
});

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CryptoService],
    }).compile();
    service = module.get<CryptoService>(CryptoService);

    // Default: delegate to the real pbkdf2 via Node builtin
    pbkdf2Mock.mockImplementation(
      (
        password: any,
        salt: any,
        iterations: any,
        keylen: any,
        digest: any,
        cb: any,
      ) => {
        const crypto = require('node:crypto');
        crypto.pbkdf2(password, salt, iterations, keylen, digest, cb);
      },
    );
  });

  afterEach(() => vi.clearAllMocks());

  describe('generatePasswordHash', () => {
    it('returns an object with non-empty hash and salt strings', async () => {
      const result = await service.generatePasswordHash('password123');
      expect(typeof result.hash).toBe('string');
      expect(typeof result.salt).toBe('string');
      expect(result.hash.length).toBeGreaterThan(0);
      expect(result.salt.length).toBeGreaterThan(0);
    });

    it('generates unique salt and hash for the same password on each call', async () => {
      const r1 = await service.generatePasswordHash('same');
      const r2 = await service.generatePasswordHash('same');
      expect(r1.salt).not.toBe(r2.salt);
      expect(r1.hash).not.toBe(r2.hash);
    });

    it('rejects when pbkdf2 callback receives an error', async () => {
      pbkdf2Mock.mockImplementationOnce(
        (_p: any, _s: any, _i: any, _kl: any, _d: any, cb: any) => {
          cb(new Error('pbkdf2 hash error'), Buffer.alloc(0));
        },
      );
      await expect(service.generatePasswordHash('test')).rejects.toThrow(
        'pbkdf2 hash error',
      );
    });
  });

  describe('verifyPassword', () => {
    it('returns true for the correct password', async () => {
      const { hash, salt } = await service.generatePasswordHash('correct');
      expect(await service.verifyPassword('correct', hash, salt)).toBe(true);
    });

    it('returns false for an incorrect password', async () => {
      const { hash, salt } = await service.generatePasswordHash('correct');
      expect(await service.verifyPassword('wrong', hash, salt)).toBe(false);
    });

    it('rejects when pbkdf2 callback receives an error', async () => {
      pbkdf2Mock.mockImplementationOnce(
        (_p: any, _s: any, _i: any, _kl: any, _d: any, cb: any) => {
          cb(new Error('pbkdf2 verify error'), Buffer.alloc(0));
        },
      );
      await expect(
        service.verifyPassword('pw', 'hash', 'salt'),
      ).rejects.toThrow('pbkdf2 verify error');
    });
  });

  describe('encryptString / decryptString', () => {
    const secret = 'test-secret-key-32-chars-abcde1234';

    afterEach(() => {
      delete process.env.CRYPTO_SECRET;
    });

    it('encrypts and decrypts (round-trip)', () => {
      const plain = 'hello world';
      const enc = service.encryptString(plain, secret);
      expect(enc).not.toBe(plain);
      expect(service.decryptString(enc, secret)).toBe(plain);
    });

    it('uses process.env.CRYPTO_SECRET when no secret argument is provided', () => {
      process.env.CRYPTO_SECRET = secret;
      const plain = 'env-secret-test';
      const enc = service.encryptString(plain);
      expect(service.decryptString(enc)).toBe(plain);
    });

    it('throws when secret is undefined and CRYPTO_SECRET env var is absent', () => {
      expect(() => service.encryptString('test')).toThrow(
        'Missing encryption secret',
      );
    });

    it('produces a different cipher-text on each call (random IV)', () => {
      const enc1 = service.encryptString('same', secret);
      const enc2 = service.encryptString('same', secret);
      expect(enc1).not.toBe(enc2);
    });
  });

  describe('tryDecrypt', () => {
    const secret = 'test-secret-key-32-chars-abcde1234';

    it('returns decrypted value for a valid encrypted payload', () => {
      const plain = 'super-secret';
      const enc = service.encryptString(plain, secret);
      expect(service.tryDecrypt(enc, secret)).toBe(plain);
    });

    it('returns the original string when decryption fails (invalid payload)', () => {
      expect(service.tryDecrypt('not-a-valid-payload', secret)).toBe(
        'not-a-valid-payload',
      );
    });
  });
});
