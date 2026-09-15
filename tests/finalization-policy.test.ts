import { describe, expect, it } from 'vitest';
import { parseFinalizationMode, requiresDigitalSeal } from '@/lib/finalization-policy';

describe('finalization policy', () => {
  it('supports electronic-only finalization without a seal', () => {
    expect(parseFinalizationMode('ELECTRONIC')).toBe('ELECTRONIC');
    expect(requiresDigitalSeal('ELECTRONIC')).toBe(false);
  });

  it('defaults unknown and missing values to the safer sealed mode', () => {
    expect(parseFinalizationMode(undefined)).toBe('DIGITAL_SEAL');
    expect(parseFinalizationMode('anything')).toBe('DIGITAL_SEAL');
    expect(requiresDigitalSeal('DIGITAL_SEAL')).toBe(true);
  });
});
