import { describe, it, expect } from 'vitest';
import { EmailProvider, StorageProvider } from './types';

describe('EmailProvider', () => {
  it('has the two supported providers', () => {
    expect(EmailProvider.RESEND).toBe('RESEND');
    expect(EmailProvider.SMTP).toBe('SMTP');
  });
});

describe('StorageProvider', () => {
  it('has the two supported providers', () => {
    expect(StorageProvider.S3).toBe('S3');
    expect(StorageProvider.LOCAL).toBe('LOCAL');
  });
});
