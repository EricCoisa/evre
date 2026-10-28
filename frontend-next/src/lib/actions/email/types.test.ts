import { describe, it, expect } from 'vitest';
import { EmailTemplateType } from './types';

describe('EmailTemplateType', () => {
  it('mirrors the backend template type constants', () => {
    expect(EmailTemplateType).toEqual({ INVITATION: 'INVITATION', PASSWORD_RESET: 'PASSWORD_RESET' });
  });
});
