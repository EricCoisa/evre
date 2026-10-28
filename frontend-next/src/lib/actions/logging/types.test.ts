import { describe, it, expect } from 'vitest';
import { LogModule } from './types';
import { LoggingModule } from '@/lib/generated/schemas';

describe('LogModule', () => {
  it('re-exports the generated LoggingModule enum unchanged', () => {
    expect(LogModule).toBe(LoggingModule);
  });
});
